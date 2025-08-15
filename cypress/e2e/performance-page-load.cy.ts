describe('Page Load Performance Tests', () => {
  // Performance timing helpers
  const measurePageLoad = () => {
    return cy.window().then(win => {
      const perfData = win.performance.timing;
      const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
      const domReadyTime = perfData.domContentLoadedEventEnd - perfData.navigationStart;
      const resourceLoadTime = perfData.responseEnd - perfData.requestStart;
      
      return {
        pageLoadTime,
        domReadyTime,
        resourceLoadTime,
        metrics: win.performance.getEntriesByType('navigation')[0]
      };
    });
  };

  const measureResourceLoading = () => {
    return cy.window().then(win => {
      const resources = win.performance.getEntriesByType('resource');
      const grouped = resources.reduce((acc, resource) => {
        const type = resource.name.split('.').pop()?.split('?')[0] || 'other';
        if (!acc[type]) acc[type] = [];
        acc[type].push({
          name: resource.name,
          duration: resource.duration,
          size: resource.transferSize || 0
        });
        return acc;
      }, {});
      
      return grouped;
    });
  };

  beforeEach(() => {
    // Clear cache and cookies for consistent testing
    cy.clearLocalStorage();
    cy.clearCookies();
    
    // Set up performance observer
    cy.on('window:before:load', (win) => {
      win.performanceObserver = [];
      const observer = new win.PerformanceObserver((list) => {
        win.performanceObserver.push(...list.getEntries());
      });
      observer.observe({ entryTypes: ['navigation', 'resource', 'paint', 'measure'] });
    });
  });

  describe('Initial Page Load', () => {
    it('should load homepage within 2 seconds', () => {
      const startTime = Date.now();
      
      cy.visit('/', {
        onBeforeLoad: (win) => {
          win.startTime = Date.now();
        },
        onLoad: (win) => {
          win.loadTime = Date.now() - win.startTime;
        }
      });
      
      cy.window().then(win => {
        expect(win.loadTime).to.be.lessThan(2000);
      });
      
      // Measure Core Web Vitals
      cy.window().then(win => {
        const fcp = win.performanceObserver.find(e => e.name === 'first-contentful-paint');
        const lcp = win.performanceObserver.find(e => e.entryType === 'largest-contentful-paint');
        
        expect(fcp?.startTime || 0).to.be.lessThan(2000);
        if (lcp) {
          expect(lcp.startTime).to.be.lessThan(2500);
        }
      });
      
      // Check performance metrics
      measurePageLoad().then(metrics => {
        expect(metrics.pageLoadTime).to.be.lessThan(2000);
        expect(metrics.domReadyTime).to.be.lessThan(1500);
        expect(metrics.resourceLoadTime).to.be.lessThan(500);
      });
    });

    it('should achieve good Core Web Vitals scores', () => {
      cy.visit('/');
      cy.wait(1000); // Wait for all metrics to be collected
      
      cy.window().then(win => {
        // First Contentful Paint (FCP)
        const fcp = win.performance.getEntriesByName('first-contentful-paint')[0];
        expect(fcp?.startTime || 0).to.be.lessThan(1800, 'FCP should be < 1.8s');
        
        // Largest Contentful Paint (LCP)
        const entries = win.performanceObserver || [];
        const lcpEntries = entries.filter(e => e.entryType === 'largest-contentful-paint');
        if (lcpEntries.length > 0) {
          const lcp = Math.max(...lcpEntries.map(e => e.startTime));
          expect(lcp).to.be.lessThan(2500, 'LCP should be < 2.5s');
        }
        
        // First Input Delay (FID) - simulate user interaction
        cy.get('body').click();
        cy.wait(100);
        
        // Cumulative Layout Shift (CLS)
        let cls = 0;
        const layoutShiftEntries = entries.filter(e => e.entryType === 'layout-shift');
        layoutShiftEntries.forEach(entry => {
          if (!entry.hadRecentInput) {
            cls += entry.value;
          }
        });
        expect(cls).to.be.lessThan(0.1, 'CLS should be < 0.1');
      });
    });

    it('should efficiently load JavaScript bundles', () => {
      cy.visit('/');
      
      measureResourceLoading().then(resources => {
        const jsResources = resources.js || [];
        
        // Check bundle sizes
        jsResources.forEach(script => {
          expect(script.size).to.be.lessThan(500 * 1024, `${script.name} should be < 500KB`);
        });
        
        // Check load times
        jsResources.forEach(script => {
          expect(script.duration).to.be.lessThan(1000, `${script.name} should load < 1s`);
        });
        
        // Check total JS size
        const totalJsSize = jsResources.reduce((sum, s) => sum + s.size, 0);
        expect(totalJsSize).to.be.lessThan(2 * 1024 * 1024, 'Total JS should be < 2MB');
      });
    });

    it('should efficiently load CSS', () => {
      cy.visit('/');
      
      measureResourceLoading().then(resources => {
        const cssResources = resources.css || [];
        
        // Check CSS is loaded early
        cy.window().then(win => {
          const cssTimings = cssResources.map(css => {
            const entry = win.performance.getEntriesByName(css.name)[0];
            return entry?.responseEnd || 0;
          });
          
          const maxCssTime = Math.max(...cssTimings);
          expect(maxCssTime).to.be.lessThan(500, 'CSS should load within 500ms');
        });
        
        // Check CSS sizes
        cssResources.forEach(css => {
          expect(css.size).to.be.lessThan(200 * 1024, `${css.name} should be < 200KB`);
        });
      });
    });

    it('should optimize image loading', () => {
      cy.visit('/');
      
      // Check for lazy loading
      cy.get('img[loading="lazy"]').should('exist');
      
      // Check image formats
      cy.get('img').each(($img) => {
        const src = $img.attr('src');
        if (src && !src.startsWith('data:')) {
          // Images should use modern formats
          expect(src).to.match(/\.(webp|avif|svg)$/i);
        }
      });
      
      // Measure image loading performance
      measureResourceLoading().then(resources => {
        const imageTypes = ['png', 'jpg', 'jpeg', 'webp', 'avif'];
        const images = [];
        
        imageTypes.forEach(type => {
          if (resources[type]) {
            images.push(...resources[type]);
          }
        });
        
        images.forEach(img => {
          expect(img.duration).to.be.lessThan(500, `${img.name} should load < 500ms`);
        });
      });
    });
  });

  describe('Route Navigation Performance', () => {
    beforeEach(() => {
      cy.visit('/');
      cy.setupWebDAVConnection();
    });

    it('should navigate between routes quickly', () => {
      const routes = [
        { path: '/editor', selector: '[data-cy="editor-link"]' },
        { path: '/settings', selector: '[data-cy="settings-link"]' },
        { path: '/file-tree', selector: '[data-cy="file-tree-link"]' },
      ];
      
      routes.forEach(route => {
        const startTime = Date.now();
        cy.get(route.selector).click();
        cy.url().should('include', route.path);
        
        const navigationTime = Date.now() - startTime;
        expect(navigationTime).to.be.lessThan(300, `Navigation to ${route.path} should be < 300ms`);
        
        // Check for layout shifts during navigation
        cy.window().then(win => {
          const shifts = win.performanceObserver?.filter(e => e.entryType === 'layout-shift') || [];
          const recentShifts = shifts.filter(s => s.startTime > startTime);
          const totalShift = recentShifts.reduce((sum, s) => sum + s.value, 0);
          expect(totalShift).to.be.lessThan(0.05, 'Minimal layout shift during navigation');
        });
      });
    });

    it('should maintain performance with data loaded', () => {
      // Load some data
      for (let i = 0; i < 10; i++) {
        cy.createTestFile(`perf-test-${i}.md`, `# Performance Test ${i}`);
      }
      
      // Navigate to file tree
      const startTime = Date.now();
      cy.get('[data-cy="file-tree-link"]').click();
      
      // Measure rendering performance
      cy.get('[data-cy="file-tree"]').should('be.visible');
      const renderTime = Date.now() - startTime;
      expect(renderTime).to.be.lessThan(500, 'File tree should render < 500ms');
      
      // Check all files are rendered
      cy.get('[data-cy^="file-perf-test-"]').should('have.length', 10);
      
      // Check memory usage
      cy.window().then(win => {
        if (win.performance.memory) {
          const memoryMB = win.performance.memory.usedJSHeapSize / 1024 / 1024;
          expect(memoryMB).to.be.lessThan(100, 'Memory usage should be < 100MB');
        }
      });
    });
  });

  describe('Component Loading Performance', () => {
    it('should lazy load heavy components', () => {
      cy.visit('/');
      
      // Check that heavy components are not loaded initially
      cy.window().then(win => {
        const initialBundles = win.performance.getEntriesByType('resource')
          .filter(r => r.name.includes('.js'))
          .map(r => r.name);
        
        // Editor should not be loaded on homepage
        const editorBundles = initialBundles.filter(b => b.includes('editor'));
        expect(editorBundles).to.have.length(0, 'Editor not loaded initially');
      });
      
      // Navigate to editor
      cy.get('[data-cy="editor-link"]').click();
      
      // Now editor should be loaded
      cy.window().then(win => {
        const bundles = win.performance.getEntriesByType('resource')
          .filter(r => r.name.includes('.js'))
          .map(r => r.name);
        
        const editorBundles = bundles.filter(b => b.includes('editor'));
        expect(editorBundles).to.have.length.greaterThan(0, 'Editor loaded on demand');
      });
    });

    it('should progressively enhance features', () => {
      cy.visit('/');
      
      // Basic functionality should work immediately
      cy.get('[data-cy="app-shell"]').should('be.visible');
      cy.get('[data-cy="navigation"]').should('be.visible');
      
      // Enhanced features load progressively
      cy.window().then(win => {
        const entries = win.performance.getEntriesByType('resource');
        const enhancementBundles = entries.filter(e => 
          e.name.includes('enhancement') || 
          e.name.includes('feature')
        );
        
        // Check progressive loading
        enhancementBundles.forEach(bundle => {
          expect(bundle.startTime).to.be.greaterThan(100, 'Enhancement loaded after initial render');
        });
      });
    });
  });

  describe('Cache Performance', () => {
    it('should utilize browser cache on repeat visits', () => {
      // First visit
      cy.visit('/');
      let firstVisitResources;
      
      measureResourceLoading().then(resources => {
        firstVisitResources = resources;
      });
      
      // Second visit
      cy.visit('/');
      
      measureResourceLoading().then(secondVisitResources => {
        // Compare load times
        Object.keys(secondVisitResources).forEach(type => {
          if (firstVisitResources[type]) {
            const firstAvg = average(firstVisitResources[type].map(r => r.duration));
            const secondAvg = average(secondVisitResources[type].map(r => r.duration));
            
            // Second visit should be faster due to caching
            expect(secondAvg).to.be.lessThan(firstAvg * 0.5, `${type} should load faster on second visit`);
          }
        });
      });
    });

    it('should implement service worker caching', () => {
      cy.visit('/');
      
      // Check for service worker
      cy.window().then(win => {
        if ('serviceWorker' in win.navigator) {
          cy.wrap(win.navigator.serviceWorker.ready).then(registration => {
            expect(registration).to.exist;
            expect(registration.active).to.exist;
          });
        }
      });
      
      // Test offline capability
      cy.window().then(win => {
        // Simulate offline
        cy.wrap(null).then(() => {
          win.dispatchEvent(new Event('offline'));
        });
        
        // Critical resources should still load
        cy.get('[data-cy="app-shell"]').should('be.visible');
        cy.get('[data-cy="offline-indicator"]').should('be.visible');
        
        // Go back online
        cy.wrap(null).then(() => {
          win.dispatchEvent(new Event('online'));
        });
      });
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not have memory leaks on route changes', () => {
      cy.visit('/');
      
      const checkMemory = () => {
        return cy.window().then(win => {
          if (win.performance.memory) {
            return win.performance.memory.usedJSHeapSize;
          }
          return 0;
        });
      };
      
      let initialMemory;
      checkMemory().then(mem => {
        initialMemory = mem;
      });
      
      // Navigate multiple times
      for (let i = 0; i < 10; i++) {
        cy.get('[data-cy="editor-link"]').click();
        cy.get('[data-cy="settings-link"]').click();
        cy.get('[data-cy="home-link"]').click();
      }
      
      // Force garbage collection if available
      cy.window().then(win => {
        if (win.gc) win.gc();
      });
      
      // Check memory hasn't grown significantly
      checkMemory().then(finalMemory => {
        const growth = (finalMemory - initialMemory) / 1024 / 1024;
        expect(growth).to.be.lessThan(10, 'Memory growth should be < 10MB');
      });
    });

    it('should clean up event listeners and timers', () => {
      cy.visit('/editor');
      
      cy.window().then(win => {
        // Track event listeners
        const originalAddEventListener = win.addEventListener;
        const originalRemoveEventListener = win.removeEventListener;
        let listenerCount = 0;
        
        win.addEventListener = function(...args) {
          listenerCount++;
          return originalAddEventListener.apply(this, args);
        };
        
        win.removeEventListener = function(...args) {
          listenerCount--;
          return originalRemoveEventListener.apply(this, args);
        };
        
        // Navigate away
        cy.get('[data-cy="home-link"]').click();
        
        // Check listeners were cleaned up
        expect(listenerCount).to.be.lessThanOrEqual(5, 'Event listeners should be cleaned up');
      });
    });
  });

  // Helper function
  function average(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
});