describe('Memory Usage Monitoring Tests', () => {
  // Helper to get memory stats
  const getMemoryStats = () => {
    return cy.window().then(win => {
      if (win.performance && win.performance.memory) {
        return {
          usedJSHeapSize: win.performance.memory.usedJSHeapSize,
          totalJSHeapSize: win.performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: win.performance.memory.jsHeapSizeLimit,
          usedMB: Math.round(win.performance.memory.usedJSHeapSize / 1024 / 1024)
        };
      }
      return null;
    });
  };

  // Helper to force garbage collection
  const forceGC = () => {
    return cy.window().then(win => {
      if (win.gc) {
        win.gc();
        cy.wait(100); // Wait for GC to complete
      }
    });
  };

  // Helper to monitor memory growth
  const monitorMemoryGrowth = (operation, maxGrowthMB = 10) => {
    let initialMemory;
    
    return getMemoryStats()
      .then(stats => {
        initialMemory = stats?.usedMB || 0;
      })
      .then(() => operation())
      .then(() => forceGC())
      .then(() => getMemoryStats())
      .then(stats => {
        const finalMemory = stats?.usedMB || 0;
        const growth = finalMemory - initialMemory;
        expect(growth).to.be.lessThan(maxGrowthMB, `Memory growth should be < ${maxGrowthMB}MB`);
        return { initialMemory, finalMemory, growth };
      });
  };

  beforeEach(() => {
    cy.setupTestEnvironment();
    cy.clearLocalStorage();
    cy.visit('/');
    
    // Enable memory profiling
    cy.on('window:before:load', (win) => {
      win.__memoryProfile__ = {
        snapshots: [],
        leaks: []
      };
      
      // Take initial snapshot
      if (win.performance && win.performance.memory) {
        win.__memoryProfile__.snapshots.push({
          timestamp: Date.now(),
          memory: win.performance.memory.usedJSHeapSize,
          label: 'initial'
        });
      }
    });
  });

  describe('Baseline Memory Usage', () => {
    it('should have acceptable initial memory footprint', () => {
      cy.visit('/');
      cy.wait(1000); // Wait for initial load
      
      getMemoryStats().then(stats => {
        if (stats) {
          expect(stats.usedMB).to.be.lessThan(50, 'Initial memory usage should be < 50MB');
          
          // Log baseline stats
          cy.log('Initial Memory Stats', {
            usedMB: stats.usedMB,
            totalMB: Math.round(stats.totalJSHeapSize / 1024 / 1024),
            limitMB: Math.round(stats.jsHeapSizeLimit / 1024 / 1024)
          });
        }
      });
    });

    it('should stay within 200MB during typical usage', () => {
      cy.setupWebDAVConnection();
      
      // Simulate typical usage
      cy.createTestFile('typical-usage.md', '# Test Document');
      cy.getByDataCy('file-typical-usage').dblclick();
      cy.typeInEditor('\n\nSome content');
      cy.saveFile();
      
      // Open settings
      cy.getByDataCy('settings-button').click();
      cy.getByDataCy('close-settings').click();
      
      // Check memory
      getMemoryStats().then(stats => {
        if (stats) {
          expect(stats.usedMB).to.be.lessThan(200, 'Memory usage should stay < 200MB');
        }
      });
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory on component mount/unmount', () => {
      const iterations = 10;
      
      monitorMemoryGrowth(() => {
        for (let i = 0; i < iterations; i++) {
          // Open and close modal repeatedly
          cy.getByDataCy('settings-button').click();
          cy.getByDataCy('close-settings').click();
          cy.wait(100);
        }
      }, 5); // Max 5MB growth allowed
    });

    it('should not leak memory on route navigation', () => {
      monitorMemoryGrowth(() => {
        for (let i = 0; i < 20; i++) {
          cy.visit('/editor');
          cy.visit('/settings');
          cy.visit('/');
        }
      }, 10); // Max 10MB growth allowed
    });

    it('should clean up event listeners properly', () => {
      cy.window().then(win => {
        const listeners = new WeakMap();
        const originalAdd = win.addEventListener;
        const originalRemove = win.removeEventListener;
        
        let activeListeners = 0;
        
        win.addEventListener = function(type, listener, ...args) {
          activeListeners++;
          listeners.set(listener, type);
          return originalAdd.call(this, type, listener, ...args);
        };
        
        win.removeEventListener = function(type, listener, ...args) {
          if (listeners.has(listener)) {
            activeListeners--;
            listeners.delete(listener);
          }
          return originalRemove.call(this, type, listener, ...args);
        };
        
        // Navigate through app
        cy.visit('/editor');
        cy.wait(500);
        cy.visit('/settings');
        cy.wait(500);
        cy.visit('/');
        
        // Check listener cleanup
        expect(activeListeners).to.be.lessThan(50, 'Should clean up event listeners');
      });
    });

    it('should not leak memory with file operations', () => {
      cy.setupWebDAVConnection();
      
      monitorMemoryGrowth(() => {
        // Create and delete multiple files
        for (let i = 0; i < 10; i++) {
          cy.createTestFile(`leak-test-${i}.md`, `# File ${i}`);
        }
        
        // Open and close files
        for (let i = 0; i < 5; i++) {
          cy.getByDataCy(`file-leak-test-${i}`).dblclick();
          cy.wait(100);
          cy.getByDataCy('close-file').click();
        }
        
        // Delete files
        for (let i = 0; i < 10; i++) {
          cy.getByDataCy(`file-leak-test-${i}`).rightclick();
          cy.getByDataCy('delete-file').click();
          cy.getByDataCy('confirm-delete').click();
        }
      }, 15); // Max 15MB growth for file operations
    });
  });

  describe('Memory Management for Large Data', () => {
    it('should handle large files without excessive memory usage', () => {
      cy.setupWebDAVConnection();
      
      // Create large file (2MB)
      const largeContent = 'x'.repeat(2 * 1024 * 1024);
      
      monitorMemoryGrowth(() => {
        cy.createTestFile('large-file.md', largeContent);
        cy.getByDataCy('file-large-file').dblclick();
        cy.wait(1000);
      }, 50).then(({ growth }) => {
        // Memory growth should be reasonable for 2MB file
        expect(growth).to.be.lessThan(30, 'Large file should not use excessive memory');
      });
      
      // Clean up and check memory release
      cy.getByDataCy('close-file').click();
      forceGC();
      
      getMemoryStats().then(stats => {
        if (stats) {
          expect(stats.usedMB).to.be.lessThan(100, 'Memory should be released after closing large file');
        }
      });
    });

    it('should efficiently handle many small files', () => {
      cy.setupWebDAVConnection();
      
      monitorMemoryGrowth(() => {
        // Create 100 small files
        for (let i = 0; i < 100; i++) {
          cy.createTestFile(`small-${i}.md`, `# Small file ${i}`, { silent: true });
        }
        
        // Verify tree renders
        cy.getByDataCy('file-small-99').should('exist');
      }, 20).then(({ growth }) => {
        // 100 small files shouldn't use much memory
        expect(growth).to.be.lessThan(20, 'Many small files should be memory efficient');
      });
    });

    it('should use virtual scrolling for large lists', () => {
      cy.setupWebDAVConnection();
      
      // Create many files
      for (let i = 0; i < 200; i++) {
        cy.createTestFile(`scroll-${i}.md`, `# File ${i}`, { silent: true });
      }
      
      // Check DOM nodes
      cy.window().then(win => {
        const fileNodes = win.document.querySelectorAll('[data-cy^="file-scroll-"]');
        
        // Virtual scrolling should limit DOM nodes
        expect(fileNodes.length).to.be.lessThan(50, 'Should use virtual scrolling');
      });
      
      // Check memory usage
      getMemoryStats().then(stats => {
        if (stats) {
          expect(stats.usedMB).to.be.lessThan(150, 'Virtual scrolling should limit memory usage');
        }
      });
    });
  });

  describe('Memory Profiling and Monitoring', () => {
    it('should track memory usage over time', () => {
      cy.setupWebDAVConnection();
      
      const memoryTimeline = [];
      
      // Take snapshots during operations
      const takeSnapshot = (label) => {
        getMemoryStats().then(stats => {
          if (stats) {
            memoryTimeline.push({
              label,
              memory: stats.usedMB,
              timestamp: Date.now()
            });
          }
        });
      };
      
      takeSnapshot('start');
      
      // Perform operations
      cy.createTestFile('profile-1.md', '# Test 1');
      takeSnapshot('after-create-1');
      
      cy.getByDataCy('file-profile-1').dblclick();
      takeSnapshot('after-open');
      
      cy.typeInEditor('\n\nLots of content...');
      takeSnapshot('after-edit');
      
      cy.saveFile();
      takeSnapshot('after-save');
      
      cy.createTestFile('profile-2.md', '# Test 2');
      takeSnapshot('after-create-2');
      
      // Analyze timeline
      cy.wrap(memoryTimeline).then(timeline => {
        if (timeline.length > 0) {
          const maxMemory = Math.max(...timeline.map(s => s.memory));
          const minMemory = Math.min(...timeline.map(s => s.memory));
          const variation = maxMemory - minMemory;
          
          expect(maxMemory).to.be.lessThan(200, 'Peak memory should be < 200MB');
          expect(variation).to.be.lessThan(50, 'Memory variation should be < 50MB');
          
          // Log timeline for debugging
          cy.log('Memory Timeline', timeline);
        }
      });
    });

    it('should detect and report memory spikes', () => {
      cy.window().then(win => {
        let spikeDetected = false;
        let previousMemory = 0;
        
        // Monitor for spikes
        const interval = setInterval(() => {
          if (win.performance && win.performance.memory) {
            const currentMemory = win.performance.memory.usedJSHeapSize / 1024 / 1024;
            const spike = currentMemory - previousMemory;
            
            if (spike > 50) { // 50MB spike
              spikeDetected = true;
              win.__memoryProfile__.leaks.push({
                timestamp: Date.now(),
                spike: spike,
                memory: currentMemory
              });
            }
            
            previousMemory = currentMemory;
          }
        }, 100);
        
        // Perform operations that might cause spikes
        cy.setupWebDAVConnection();
        cy.createTestFile('spike-test.md', 'x'.repeat(1024 * 1024)); // 1MB file
        cy.getByDataCy('file-spike-test').dblclick();
        
        // Clean up
        cy.wait(1000).then(() => {
          clearInterval(interval);
          expect(spikeDetected).to.be.false;
        });
      });
    });
  });

  describe('Component-Specific Memory Tests', () => {
    it('should manage editor memory efficiently', () => {
      cy.setupWebDAVConnection();
      cy.createTestFile('editor-memory.md', '# Initial');
      
      monitorMemoryGrowth(() => {
        cy.getByDataCy('file-editor-memory').dblclick();
        
        // Type a lot of content
        for (let i = 0; i < 100; i++) {
          cy.typeInEditor(`Line ${i}: Some content to test memory usage\n`);
        }
        
        // Trigger syntax highlighting
        cy.wait(500);
        
        // Save
        cy.saveFile();
      }, 20).then(({ growth }) => {
        expect(growth).to.be.lessThan(20, 'Editor operations should be memory efficient');
      });
    });

    it('should manage file tree memory efficiently', () => {
      cy.setupWebDAVConnection();
      
      monitorMemoryGrowth(() => {
        // Create nested structure
        for (let i = 0; i < 5; i++) {
          cy.createFolder(`folder-${i}`);
          for (let j = 0; j < 10; j++) {
            cy.createTestFile(`folder-${i}/file-${j}.md`, `# File ${j}`);
          }
        }
        
        // Expand all folders
        for (let i = 0; i < 5; i++) {
          cy.getByDataCy(`folder-folder-${i}`).find('.expand-icon').click();
        }
      }, 25).then(({ growth }) => {
        expect(growth).to.be.lessThan(25, 'File tree should manage memory efficiently');
      });
    });

    it('should manage optimization service memory', () => {
      cy.setupWebDAVConnection();
      cy.createTestFile('optimize-memory.md', '# Optimize this prompt for better clarity');
      cy.getByDataCy('file-optimize-memory').dblclick();
      
      monitorMemoryGrowth(() => {
        // Run optimization
        cy.getByDataCy('optimize-button').click();
        cy.getByDataCy('start-optimization').click();
        cy.wait('@optimizePrompt');
        cy.getByDataCy('optimization-complete').should('be.visible');
        
        // View results
        cy.getByDataCy('view-diff').click();
        cy.wait(500);
        
        // Close modal
        cy.getByDataCy('close-optimization').click();
      }, 15).then(({ growth }) => {
        expect(growth).to.be.lessThan(15, 'Optimization should not leak memory');
      });
    });
  });

  describe('Memory Recovery and Cleanup', () => {
    it('should recover memory after heavy operations', () => {
      cy.setupWebDAVConnection();
      
      let peakMemory = 0;
      
      // Perform heavy operations
      for (let i = 0; i < 10; i++) {
        cy.createTestFile(`heavy-${i}.md`, 'x'.repeat(100 * 1024)); // 100KB each
      }
      
      getMemoryStats().then(stats => {
        if (stats) {
          peakMemory = stats.usedMB;
        }
      });
      
      // Clean up
      for (let i = 0; i < 10; i++) {
        cy.getByDataCy(`file-heavy-${i}`).rightclick();
        cy.getByDataCy('delete-file').click();
        cy.getByDataCy('confirm-delete').click();
      }
      
      // Force GC and wait
      forceGC();
      cy.wait(1000);
      
      // Check memory recovered
      getMemoryStats().then(stats => {
        if (stats && peakMemory > 0) {
          const recovered = peakMemory - stats.usedMB;
          expect(recovered).to.be.greaterThan(5, 'Should recover at least 5MB after cleanup');
        }
      });
    });

    it('should handle out of memory gracefully', () => {
      // Try to allocate large amount of memory
      cy.window().then(win => {
        let outOfMemoryHandled = false;
        
        win.addEventListener('error', (event) => {
          if (event.message && event.message.includes('memory')) {
            outOfMemoryHandled = true;
          }
        });
        
        try {
          // Try to allocate huge array (this might not actually cause OOM)
          const huge = new Array(100000000);
          for (let i = 0; i < huge.length; i++) {
            huge[i] = 'x'.repeat(1000);
          }
        } catch (e) {
          outOfMemoryHandled = true;
        }
        
        // App should still be responsive
        cy.getByDataCy('app-container').should('be.visible');
        
        if (outOfMemoryHandled) {
          cy.log('Out of memory handled gracefully');
        }
      });
    });
  });

  describe('Memory Benchmarks', () => {
    it('should meet memory performance targets', () => {
      const benchmarks = {
        initial: 50,
        typical: 200,
        peak: 300
      };
      
      const results = {
        initial: 0,
        typical: 0,
        peak: 0
      };
      
      // Initial load
      cy.visit('/');
      getMemoryStats().then(stats => {
        if (stats) {
          results.initial = stats.usedMB;
          expect(results.initial).to.be.lessThan(benchmarks.initial);
        }
      });
      
      // Typical usage
      cy.setupWebDAVConnection();
      cy.createTestFile('benchmark.md', '# Benchmark');
      cy.getByDataCy('file-benchmark').dblclick();
      cy.typeInEditor('\n\nContent');
      cy.saveFile();
      
      getMemoryStats().then(stats => {
        if (stats) {
          results.typical = stats.usedMB;
          expect(results.typical).to.be.lessThan(benchmarks.typical);
        }
      });
      
      // Peak usage
      for (let i = 0; i < 20; i++) {
        cy.createTestFile(`peak-${i}.md`, `# File ${i}`);
      }
      
      getMemoryStats().then(stats => {
        if (stats) {
          results.peak = stats.usedMB;
          expect(results.peak).to.be.lessThan(benchmarks.peak);
        }
      });
      
      // Log benchmark results
      cy.log('Memory Benchmark Results', results);
    });
  });
});