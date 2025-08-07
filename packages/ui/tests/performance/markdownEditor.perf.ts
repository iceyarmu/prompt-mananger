import { test, expect, type Page } from '@playwright/test';
import { performance } from 'perf_hooks';

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  fileLoadTime: 3000, // 3s for large files
  initialRenderTime: 1000, // 1s for initial render
  viewSwitchTime: 100, // 100ms for view mode switch
  typingLatency: 50, // 50ms for typing responsiveness
  saveTime: 500, // 500ms for save operation
  memoryLimit: 100 * 1024 * 1024, // 100MB memory limit
  chunkLoadTime: 200, // 200ms per chunk
};

test.describe('Markdown Editor Performance Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/editor');
    
    // Enable performance monitoring
    await page.evaluateOnNewDocument(() => {
      window.performanceMetrics = {
        marks: {},
        measures: []
      };
      
      // Override performance.mark and performance.measure
      const originalMark = performance.mark.bind(performance);
      const originalMeasure = performance.measure.bind(performance);
      
      performance.mark = function(name) {
        window.performanceMetrics.marks[name] = performance.now();
        return originalMark(name);
      };
      
      performance.measure = function(name, startMark, endMark) {
        const measure = originalMeasure(name, startMark, endMark);
        window.performanceMetrics.measures.push({
          name,
          duration: window.performanceMetrics.marks[endMark] - window.performanceMetrics.marks[startMark]
        });
        return measure;
      };
    });
  });

  test.describe('Load Performance', () => {
    test('should load small files within threshold', async () => {
      const startTime = Date.now();
      
      // Mock small file
      await page.route('**/webdav/**', route => {
        route.fulfill({
          status: 200,
          body: 'Small file content'.repeat(100), // ~1.8KB
          headers: { 'Content-Type': 'text/plain' }
        });
      });

      await page.click('[data-testid="file-tree-item-small.md"]');
      await page.waitForSelector('.md-editor textarea');
      
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(1000); // Should load in under 1 second
      
      // Check no memory leaks
      const metrics = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory;
        }
        return null;
      });
      
      if (metrics) {
        expect(metrics.usedJSHeapSize).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryLimit);
      }
    });

    test('should load large files progressively within threshold', async () => {
      const chunkTimes: number[] = [];
      
      // Mock large file with chunked loading
      await page.route('**/webdav/**', async route => {
        if (route.request().url().includes('getFileInfo')) {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ 
              size: 5 * 1024 * 1024, // 5MB
              name: 'large.md',
              path: '/large.md'
            })
          });
        } else if (route.request().headers()['range']) {
          const chunkStart = Date.now();
          
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 50));
          
          route.fulfill({
            status: 206,
            body: 'x'.repeat(64 * 1024), // 64KB chunk
            headers: {
              'Content-Range': route.request().headers()['range']
            }
          });
          
          chunkTimes.push(Date.now() - chunkStart);
        }
      });

      const startTime = Date.now();
      
      await page.click('[data-testid="file-tree-item-large.md"]');
      
      // Wait for progressive loading to complete
      await page.waitForFunction(
        () => !document.querySelector('.loading-progress-bar'),
        { timeout: 10000 }
      );
      
      const totalLoadTime = Date.now() - startTime;
      
      // Check total load time is within threshold
      expect(totalLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.fileLoadTime);
      
      // Check individual chunk load times
      chunkTimes.forEach(time => {
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.chunkLoadTime);
      });
      
      // Verify progress updates were smooth
      const progressUpdates = await page.evaluate(() => {
        return window.performanceMetrics?.measures.filter(m => m.name.includes('progress'));
      });
      
      if (progressUpdates && progressUpdates.length > 0) {
        const avgUpdateTime = progressUpdates.reduce((sum, m) => sum + m.duration, 0) / progressUpdates.length;
        expect(avgUpdateTime).toBeLessThan(100); // Progress updates should be fast
      }
    });

    test('should handle concurrent file loads efficiently', async () => {
      // Mock file responses
      await page.route('**/webdav/**', route => {
        route.fulfill({
          status: 200,
          body: `Content for ${route.request().url()}`,
          headers: { 'Content-Type': 'text/plain' }
        });
      });

      const loadTimes: number[] = [];
      
      // Load multiple files in sequence
      for (let i = 1; i <= 3; i++) {
        const startTime = Date.now();
        
        await page.click(`[data-testid="file-tree-item-file${i}.md"]`);
        await page.waitForSelector('.md-editor textarea');
        
        loadTimes.push(Date.now() - startTime);
        
        // Small delay between loads
        await page.waitForTimeout(100);
      }
      
      // Each load should be fast
      loadTimes.forEach(time => {
        expect(time).toBeLessThan(1000);
      });
      
      // Check for memory leaks after multiple loads
      const finalMetrics = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory;
        }
        return null;
      });
      
      if (finalMetrics) {
        expect(finalMetrics.usedJSHeapSize).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryLimit);
      }
    });
  });

  test.describe('Rendering Performance', () => {
    test('should render initial content quickly', async () => {
      await page.route('**/webdav/**', route => {
        route.fulfill({
          status: 200,
          body: '# Test\nContent',
        });
      });

      await page.click('[data-testid="file-tree-item-test.md"]');
      
      // Measure time to first paint
      const renderMetrics = await page.evaluate(() => {
        const paintEntries = performance.getEntriesByType('paint');
        return {
          firstPaint: paintEntries.find(e => e.name === 'first-paint'),
          firstContentfulPaint: paintEntries.find(e => e.name === 'first-contentful-paint')
        };
      });
      
      if (renderMetrics.firstContentfulPaint) {
        expect(renderMetrics.firstContentfulPaint.startTime).toBeLessThan(PERFORMANCE_THRESHOLDS.initialRenderTime);
      }
    });

    test('should switch view modes quickly', async () => {
      // Load file first
      await page.route('**/webdav/**', route => {
        route.fulfill({
          status: 200,
          body: '# Test Document\n\nLorem ipsum dolor sit amet.',
        });
      });

      await page.click('[data-testid="file-tree-item-test.md"]');
      await page.waitForSelector('.md-editor');
      
      // Measure view mode switch times
      const switchTimes: number[] = [];
      
      for (const mode of ['Preview', 'Split', 'Edit']) {
        const startTime = Date.now();
        
        await page.click(`button:has-text("${mode}")`);
        
        // Wait for mode to be active
        await page.waitForFunction(
          (mode) => {
            const button = document.querySelector(`button:has-text("${mode}")`);
            return button?.getAttribute('aria-pressed') === 'true';
          },
          mode
        );
        
        switchTimes.push(Date.now() - startTime);
      }
      
      // All view switches should be fast
      switchTimes.forEach(time => {
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.viewSwitchTime);
      });
    });

    test('should handle syntax highlighting efficiently', async () => {
      const codeContent = `
\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Complex nested structures
const complexObject = {
  nested: {
    deeply: {
      value: 42,
      array: [1, 2, 3, 4, 5]
    }
  }
};

class Example {
  constructor() {
    this.property = "value";
  }
  
  async method() {
    return await fetch('/api/data');
  }
}
\`\`\`
      `.repeat(10); // Repeat to create larger content
      
      await page.route('**/webdav/**', route => {
        route.fulfill({
          status: 200,
          body: codeContent,
        });
      });

      const startTime = Date.now();
      
      await page.click('[data-testid="file-tree-item-code.md"]');
      await page.waitForSelector('.md-editor');
      
      // Switch to preview to trigger syntax highlighting
      await page.click('button:has-text("Preview")');
      await page.waitForSelector('.md-editor-preview pre code');
      
      const highlightTime = Date.now() - startTime;
      
      // Syntax highlighting should complete within threshold
      expect(highlightTime).toBeLessThan(2000);
      
      // Check that highlighting was applied
      const hasHighlighting = await page.evaluate(() => {
        const codeBlock = document.querySelector('.md-editor-preview pre code');
        return codeBlock?.querySelector('.hljs-keyword') !== null;
      });
      
      expect(hasHighlighting).toBe(true);
    });
  });

  test.describe('Typing Performance', () => {
    test('should handle typing with low latency', async () => {
      await page.route('**/webdav/**', route => {
        route.fulfill({
          status: 200,
          body: 'Initial content',
        });
      });

      await page.click('[data-testid="file-tree-item-test.md"]');
      await page.waitForSelector('.md-editor textarea');
      
      const textarea = page.locator('.md-editor textarea');
      
      // Measure typing latency
      const typingMetrics: number[] = [];
      const testString = 'The quick brown fox jumps over the lazy dog.';
      
      for (const char of testString) {
        const startTime = Date.now();
        
        await textarea.type(char, { delay: 10 });
        
        // Wait for character to appear
        await page.waitForFunction(
          (expectedLength) => {
            const textarea = document.querySelector('.md-editor textarea') as HTMLTextAreaElement;
            return textarea?.value.length >= expectedLength;
          },
          textarea.evaluate(el => el.value.length) + 1
        );
        
        typingMetrics.push(Date.now() - startTime);
      }
      
      // Calculate average typing latency
      const avgLatency = typingMetrics.reduce((sum, time) => sum + time, 0) / typingMetrics.length;
      
      expect(avgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.typingLatency);
      
      // Check for debouncing behavior
      const finalContent = await textarea.inputValue();
      expect(finalContent).toContain(testString);
    });

    test('should handle paste of large content efficiently', async () => {
      await page.route('**/webdav/**', route => {
        route.fulfill({
          status: 200,
          body: '',
        });
      });

      await page.click('[data-testid="file-tree-item-test.md"]');
      await page.waitForSelector('.md-editor textarea');
      
      const largeContent = 'Lorem ipsum dolor sit amet. '.repeat(1000); // ~30KB
      
      const startTime = Date.now();
      
      // Paste large content
      await page.locator('.md-editor textarea').fill(largeContent);
      
      // Wait for content to be processed
      await page.waitForFunction(
        (expectedLength) => {
          const textarea = document.querySelector('.md-editor textarea') as HTMLTextAreaElement;
          return textarea?.value.length === expectedLength;
        },
        largeContent.length
      );
      
      const pasteTime = Date.now() - startTime;
      
      expect(pasteTime).toBeLessThan(1000); // Should handle paste within 1 second
    });
  });

  test.describe('Save Performance', () => {
    test('should save files quickly', async () => {
      let saveTime = 0;
      
      await page.route('**/webdav/**', route => {
        if (route.request().method() === 'PUT') {
          const start = Date.now();
          
          // Simulate network delay
          setTimeout(() => {
            saveTime = Date.now() - start;
            route.fulfill({
              status: 200,
              body: 'OK'
            });
          }, 50);
        } else {
          route.fulfill({
            status: 200,
            body: 'Initial content'
          });
        }
      });

      await page.click('[data-testid="file-tree-item-test.md"]');
      await page.waitForSelector('.md-editor textarea');
      
      // Make changes
      await page.locator('.md-editor textarea').fill('Modified content');
      
      const startTime = Date.now();
      
      // Save
      await page.keyboard.press('Control+S');
      
      // Wait for save confirmation
      await page.waitForSelector('[role="status"]:has-text("saved")');
      
      const totalSaveTime = Date.now() - startTime;
      
      expect(totalSaveTime).toBeLessThan(PERFORMANCE_THRESHOLDS.saveTime);
      expect(saveTime).toBeLessThan(200); // Network request should be fast
    });

    test('should batch save operations efficiently', async () => {
      let saveCount = 0;
      
      await page.route('**/webdav/**', route => {
        if (route.request().method() === 'PUT') {
          saveCount++;
          route.fulfill({
            status: 200,
            body: 'OK'
          });
        } else {
          route.fulfill({
            status: 200,
            body: 'Initial'
          });
        }
      });

      await page.click('[data-testid="file-tree-item-test.md"]');
      await page.waitForSelector('.md-editor textarea');
      
      // Make multiple rapid changes
      for (let i = 0; i < 5; i++) {
        await page.locator('.md-editor textarea').fill(`Change ${i}`);
        await page.waitForTimeout(50); // Small delay between changes
      }
      
      // Trigger save
      await page.keyboard.press('Control+S');
      await page.waitForSelector('[role="status"]:has-text("saved")');
      
      // Should only save once due to debouncing
      expect(saveCount).toBe(1);
    });
  });

  test.describe('Memory Performance', () => {
    test('should not leak memory on repeated operations', async () => {
      await page.route('**/webdav/**', route => {
        route.fulfill({
          status: 200,
          body: 'Content',
        });
      });

      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });

      // Perform repeated operations
      for (let i = 0; i < 10; i++) {
        // Load file
        await page.click('[data-testid="file-tree-item-test.md"]');
        await page.waitForSelector('.md-editor textarea');
        
        // Edit content
        await page.locator('.md-editor textarea').fill(`Iteration ${i} content`);
        
        // Switch view modes
        await page.click('button:has-text("Preview")');
        await page.click('button:has-text("Split")');
        await page.click('button:has-text("Edit")');
        
        // Small delay
        await page.waitForTimeout(100);
      }

      // Force garbage collection if available
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });

      // Get final memory usage
      const finalMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });

      // Memory increase should be reasonable (less than 10MB)
      const memoryIncrease = finalMemory - initialMemory;
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    test('should clean up resources on unmount', async () => {
      await page.route('**/webdav/**', route => {
        route.fulfill({
          status: 200,
          body: 'x'.repeat(1024 * 1024), // 1MB content
        });
      });

      // Load large file
      await page.click('[data-testid="file-tree-item-large.md"]');
      await page.waitForSelector('.md-editor textarea');
      
      // Get memory with large file loaded
      const memoryWithFile = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });

      // Navigate away to trigger cleanup
      await page.goto('/home');
      await page.waitForTimeout(500); // Wait for cleanup
      
      // Force garbage collection
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });

      // Get memory after cleanup
      const memoryAfterCleanup = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });

      // Memory should be released (at least 50% of the file size)
      const memoryReleased = memoryWithFile - memoryAfterCleanup;
      expect(memoryReleased).toBeGreaterThan(512 * 1024); // At least 512KB released
    });
  });

  test.describe('Network Performance', () => {
    test('should implement effective caching', async () => {
      let requestCount = 0;
      
      await page.route('**/webdav/**', route => {
        requestCount++;
        route.fulfill({
          status: 200,
          body: 'Cached content',
          headers: {
            'Cache-Control': 'max-age=3600',
            'ETag': '"123456"'
          }
        });
      });

      // First load
      await page.click('[data-testid="file-tree-item-test.md"]');
      await page.waitForSelector('.md-editor textarea');
      
      const firstRequestCount = requestCount;
      
      // Navigate away
      await page.click('[data-testid="file-tree-item-other.md"]');
      await page.waitForTimeout(100);
      
      // Load same file again
      await page.click('[data-testid="file-tree-item-test.md"]');
      await page.waitForSelector('.md-editor textarea');
      
      // Should use cache (minimal additional requests)
      expect(requestCount - firstRequestCount).toBeLessThanOrEqual(1);
    });

    test('should handle network throttling gracefully', async () => {
      // Simulate slow network
      await page.route('**/webdav/**', async route => {
        // Add artificial delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        route.fulfill({
          status: 200,
          body: 'Slow network content',
        });
      });

      const startTime = Date.now();
      
      await page.click('[data-testid="file-tree-item-test.md"]');
      
      // Should show loading indicator quickly
      await expect(page.locator('.loading-progress-bar')).toBeVisible({ timeout: 100 });
      
      // Wait for content to load
      await page.waitForSelector('.md-editor textarea');
      
      const loadTime = Date.now() - startTime;
      
      // Even with slow network, UI should remain responsive
      expect(loadTime).toBeLessThan(2000);
    });
  });
});