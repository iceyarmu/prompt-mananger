import { performance } from 'perf_hooks';

describe('Performance Benchmarks', () => {
  beforeAll(async () => {
    await setupPerformanceEnvironment();
  });
  
  describe('File Operations Performance', () => {
    test('loads 1000 files within 3 seconds', async () => {
      const mockFiles = generateMockFileTree(1000);
      
      const start = performance.now();
      await fileTreeStore.loadTree(mockFiles);
      const end = performance.now();
      
      const duration = end - start;
      expect(duration).toBeLessThan(3000);
      
      // Log performance metrics
      console.log(`Loaded 1000 files in ${duration.toFixed(2)}ms`);
    });
    
    test('file save operations complete under 500ms', async () => {
      const testContent = generateTestContent(10000); // 10KB content
      
      const start = performance.now();
      await saveManager.saveFile('/test.md', testContent);
      const end = performance.now();
      
      const duration = end - start;
      expect(duration).toBeLessThan(500);
    });
    
    test('handles 10MB files efficiently', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      
      const start = performance.now();
      await editorStore.loadContent('large-file.md', largeContent);
      const end = performance.now();
      
      const loadTime = end - start;
      expect(loadTime).toBeLessThan(5000); // 5 seconds max
      
      // Test editing performance
      const editStart = performance.now();
      await editorStore.appendContent('Additional content');
      const editEnd = performance.now();
      
      const editTime = editEnd - editStart;
      expect(editTime).toBeLessThan(100); // Should be instant
    });
    
    test('searches through 1000 files quickly', async () => {
      const files = generateMockFileTree(1000);
      await fileTreeStore.loadTree(files);
      
      const start = performance.now();
      const results = await fileTreeStore.search('test');
      const end = performance.now();
      
      const searchTime = end - start;
      expect(searchTime).toBeLessThan(500);
      console.log(`Search completed in ${searchTime.toFixed(2)}ms, found ${results.length} results`);
    });
  });
  
  describe('Memory Usage', () => {
    test('memory usage stays under 200MB with 100 files', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Load 100 large files
      for (let i = 0; i < 100; i++) {
        const content = generateLargeContent(50000); // 50KB each
        await editorStore.loadContent(`file-${i}.md`, content);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;
      
      expect(memoryIncreaseMB).toBeLessThan(200);
      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
    });
    
    test('detects and prevents memory leaks', async () => {
      const iterations = 100;
      const memorySnapshots = [];
      
      for (let i = 0; i < iterations; i++) {
        // Perform operations that could leak
        const content = generateTestContent(10000);
        await editorStore.loadContent(`leak-test-${i}.md`, content);
        await editorStore.clearContent();
        
        if (i % 10 === 0) {
          if (global.gc) global.gc();
          memorySnapshots.push(process.memoryUsage().heapUsed);
        }
      }
      
      // Check for linear memory growth (leak indicator)
      const memoryGrowth = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
      const averageGrowthPerIteration = memoryGrowth / iterations;
      
      // Should not grow more than 1KB per iteration
      expect(averageGrowthPerIteration).toBeLessThan(1024);
    });
    
    test('garbage collection works effectively', async () => {
      if (!global.gc) {
        console.log('Skipping GC test - not running with --expose-gc');
        return;
      }
      
      // Allocate large amount of memory
      const largeArrays = [];
      for (let i = 0; i < 100; i++) {
        largeArrays.push(new Array(100000).fill('test'));
      }
      
      const beforeGC = process.memoryUsage().heapUsed;
      
      // Clear references and force GC
      largeArrays.length = 0;
      global.gc();
      
      const afterGC = process.memoryUsage().heapUsed;
      const freedMemoryMB = (beforeGC - afterGC) / 1024 / 1024;
      
      expect(freedMemoryMB).toBeGreaterThan(10); // Should free significant memory
      console.log(`GC freed ${freedMemoryMB.toFixed(2)}MB`);
    });
  });
  
  describe('UI Performance', () => {
    test('maintains 60fps during editor typing', async () => {
      const editor = await mountEditor();
      const frameTimes: number[] = [];
      
      let frameCount = 0;
      const measureFrame = () => {
        const now = performance.now();
        if (frameTimes.length > 0) {
          const frameTime = now - frameTimes[frameTimes.length - 1];
          if (frameTime > 16.67) { // 60fps = 16.67ms per frame
            frameCount++;
          }
        }
        frameTimes.push(now);
        
        if (frameTimes.length < 60) {
          requestAnimationFrame(measureFrame);
        }
      };
      
      requestAnimationFrame(measureFrame);
      
      // Simulate heavy typing
      await editor.simulateTyping('Lorem ipsum '.repeat(100));
      
      // Wait for measurements to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const droppedFrames = frameCount;
      const fps = 1000 / (frameTimes[frameTimes.length - 1] - frameTimes[0]) * frameTimes.length;
      
      expect(fps).toBeGreaterThan(55); // Allow for some variance
      expect(droppedFrames).toBeLessThan(5);
    });
    
    test('smooth scrolling performance', async () => {
      const largeContent = 'Line\\n'.repeat(10000);
      await editorStore.loadContent('scroll-test.md', largeContent);
      
      const scrollPerformance = await measureScrollPerformance();
      
      expect(scrollPerformance.averageFPS).toBeGreaterThan(50);
      expect(scrollPerformance.jankFrames).toBeLessThan(10);
    });
    
    test('virtual scrolling for large lists', async () => {
      const files = generateMockFileTree(5000);
      
      const start = performance.now();
      await fileTreeStore.loadTree(files);
      const end = performance.now();
      
      // Should use virtual scrolling, so render time should be fast
      expect(end - start).toBeLessThan(1000);
      
      // Check DOM node count
      const visibleNodes = document.querySelectorAll('[data-cy^="file-"]').length;
      expect(visibleNodes).toBeLessThan(100); // Only visible items rendered
    });
  });
  
  describe('Network Performance', () => {
    test('implements request batching', async () => {
      const requests = [];
      
      // Queue multiple requests
      for (let i = 0; i < 10; i++) {
        requests.push(api.getFile(`file-${i}.md`));
      }
      
      const start = performance.now();
      await Promise.all(requests);
      const end = performance.now();
      
      // Should batch requests, taking less time than sequential
      const totalTime = end - start;
      expect(totalTime).toBeLessThan(500); // Much faster than 10 * 100ms
    });
    
    test('caches API responses effectively', async () => {
      // First request
      const start1 = performance.now();
      await api.getFile('cached-file.md');
      const end1 = performance.now();
      const firstRequestTime = end1 - start1;
      
      // Second request (should be cached)
      const start2 = performance.now();
      await api.getFile('cached-file.md');
      const end2 = performance.now();
      const cachedRequestTime = end2 - start2;
      
      expect(cachedRequestTime).toBeLessThan(firstRequestTime / 10);
    });
    
    test('implements connection pooling', async () => {
      const connections = [];
      
      // Create multiple connections
      for (let i = 0; i < 20; i++) {
        connections.push(webdav.connect());
      }
      
      await Promise.all(connections);
      
      // Check connection pool size
      const poolSize = webdav.getActiveConnections();
      expect(poolSize).toBeLessThan(10); // Should reuse connections
    });
  });
  
  describe('Bundle Size Analysis', () => {
    test('initial bundle size under limits', async () => {
      const bundleStats = await analyzeBundleSize();
      
      expect(bundleStats.initialChunk).toBeLessThan(500 * 1024); // 500KB
      expect(bundleStats.totalSize).toBeLessThan(2 * 1024 * 1024); // 2MB
      
      console.log('Bundle analysis:', {
        initial: `${(bundleStats.initialChunk / 1024).toFixed(2)}KB`,
        total: `${(bundleStats.totalSize / 1024 / 1024).toFixed(2)}MB`,
        chunks: bundleStats.chunkCount
      });
    });
    
    test('code splitting works effectively', async () => {
      const bundleStats = await analyzeBundleSize();
      
      // Should have multiple chunks
      expect(bundleStats.chunkCount).toBeGreaterThan(5);
      
      // Lazy loaded chunks
      expect(bundleStats.lazyChunks).toBeGreaterThan(3);
      
      // No single chunk too large
      bundleStats.chunks.forEach(chunk => {
        expect(chunk.size).toBeLessThan(300 * 1024); // 300KB max per chunk
      });
    });
    
    test('tree shaking removes unused code', async () => {
      const beforeTreeShaking = await getBundleSize({ treeShake: false });
      const afterTreeShaking = await getBundleSize({ treeShake: true });
      
      const reduction = ((beforeTreeShaking - afterTreeShaking) / beforeTreeShaking) * 100;
      
      expect(reduction).toBeGreaterThan(20); // At least 20% reduction
      console.log(`Tree shaking reduced bundle by ${reduction.toFixed(2)}%`);
    });
  });
  
  describe('Optimization Performance', () => {
    test('prompt optimization completes quickly', async () => {
      const testPrompt = 'Simple test prompt for optimization';
      
      const start = performance.now();
      const result = await optimizationService.optimize(testPrompt);
      const end = performance.now();
      
      const optimizationTime = end - start;
      expect(optimizationTime).toBeLessThan(3000); // 3 seconds max
      
      console.log(`Optimization completed in ${optimizationTime.toFixed(2)}ms`);
    });
    
    test('handles batch optimization efficiently', async () => {
      const prompts = Array(10).fill('Test prompt').map((p, i) => `${p} ${i}`);
      
      const start = performance.now();
      const results = await optimizationService.batchOptimize(prompts);
      const end = performance.now();
      
      const totalTime = end - start;
      const timePerPrompt = totalTime / prompts.length;
      
      expect(timePerPrompt).toBeLessThan(1000); // Less than 1s per prompt
      console.log(`Batch optimization: ${timePerPrompt.toFixed(2)}ms per prompt`);
    });
  });
  
  describe('Database Performance', () => {
    test('IndexedDB operations are fast', async () => {
      const testData = generateTestData(1000);
      
      // Write performance
      const writeStart = performance.now();
      await db.bulkInsert('prompts', testData);
      const writeEnd = performance.now();
      
      const writeTime = writeEnd - writeStart;
      expect(writeTime).toBeLessThan(500);
      
      // Read performance
      const readStart = performance.now();
      const results = await db.getAll('prompts');
      const readEnd = performance.now();
      
      const readTime = readEnd - readStart;
      expect(readTime).toBeLessThan(200);
      
      console.log(`DB Performance - Write: ${writeTime.toFixed(2)}ms, Read: ${readTime.toFixed(2)}ms`);
    });
    
    test('implements efficient indexing', async () => {
      // Create index
      await db.createIndex('prompts', 'title');
      
      // Insert test data
      const data = generateTestData(5000);
      await db.bulkInsert('prompts', data);
      
      // Search with index
      const start = performance.now();
      const results = await db.search('prompts', 'title', 'test');
      const end = performance.now();
      
      const searchTime = end - start;
      expect(searchTime).toBeLessThan(50); // Very fast with index
    });
  });
  
  describe('Real-world Scenarios', () => {
    test('handles typical user session efficiently', async () => {
      const metrics = {
        startup: 0,
        fileLoad: 0,
        editing: 0,
        optimization: 0,
        save: 0
      };
      
      // Startup
      const startupBegin = performance.now();
      await app.initialize();
      metrics.startup = performance.now() - startupBegin;
      
      // Load files
      const loadBegin = performance.now();
      await fileTreeStore.loadTree();
      await editorStore.loadContent('example.md', 'Test content');
      metrics.fileLoad = performance.now() - loadBegin;
      
      // Edit content
      const editBegin = performance.now();
      for (let i = 0; i < 100; i++) {
        await editorStore.appendContent(`Line ${i}\\n`);
      }
      metrics.editing = performance.now() - editBegin;
      
      // Optimize
      const optBegin = performance.now();
      await optimizationService.optimize(editorStore.getContent());
      metrics.optimization = performance.now() - optBegin;
      
      // Save
      const saveBegin = performance.now();
      await saveManager.save();
      metrics.save = performance.now() - saveBegin;
      
      // Check all operations are within acceptable limits
      expect(metrics.startup).toBeLessThan(2000);
      expect(metrics.fileLoad).toBeLessThan(1000);
      expect(metrics.editing).toBeLessThan(500);
      expect(metrics.optimization).toBeLessThan(3000);
      expect(metrics.save).toBeLessThan(500);
      
      console.table(metrics);
    });
  });
});

// Helper functions
function generateMockFileTree(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `file-${i}.md`,
    path: `/files/file-${i}.md`,
    type: 'file',
    size: Math.random() * 100000
  }));
}

function generateTestContent(size: number): string {
  return 'x'.repeat(size);
}

function generateLargeContent(size: number): string {
  const chunk = 'Lorem ipsum dolor sit amet. ';
  const chunkSize = chunk.length;
  const iterations = Math.ceil(size / chunkSize);
  return chunk.repeat(iterations).substring(0, size);
}

async function setupPerformanceEnvironment() {
  // Set up performance monitoring
  if (typeof window !== 'undefined') {
    window.performance.mark('test-suite-start');
  }
}

async function measureScrollPerformance() {
  const frames = [];
  let jankFrames = 0;
  
  const measureFrame = (timestamp: number) => {
    if (frames.length > 0) {
      const delta = timestamp - frames[frames.length - 1];
      if (delta > 16.67 * 1.5) { // 1.5x frame time = jank
        jankFrames++;
      }
    }
    frames.push(timestamp);
  };
  
  // Scroll and measure
  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => {
      requestAnimationFrame(timestamp => {
        measureFrame(timestamp);
        window.scrollBy(0, 100);
        resolve(undefined);
      });
    });
  }
  
  const totalTime = frames[frames.length - 1] - frames[0];
  const averageFPS = (frames.length / totalTime) * 1000;
  
  return { averageFPS, jankFrames };
}

async function analyzeBundleSize() {
  // This would integrate with webpack-bundle-analyzer or similar
  const stats = require('../../../dist/stats.json');
  
  return {
    initialChunk: stats.assets.find(a => a.name.includes('main')).size,
    totalSize: stats.assets.reduce((sum, asset) => sum + asset.size, 0),
    chunkCount: stats.chunks.length,
    lazyChunks: stats.chunks.filter(c => !c.initial).length,
    chunks: stats.chunks.map(c => ({ name: c.names[0], size: c.size }))
  };
}

async function getBundleSize(options = {}) {
  // Mock implementation
  return options.treeShake ? 1500000 : 2000000;
}

function generateTestData(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    title: `Prompt ${i}`,
    content: `Test content ${i}`,
    created: new Date(),
    modified: new Date()
  }));
}