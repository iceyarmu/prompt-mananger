describe('Cross-Browser Compatibility', () => {
  const browsers = ['chrome', 'firefox', 'edge', 'safari'];
  
  browsers.forEach(browser => {
    describe(`${browser} Browser Tests`, () => {
      beforeEach(() => {
        cy.setupTestEnvironment();
        cy.mockWebDAVServer();
        cy.visit('/');
        
        // Log browser info
        cy.window().then(win => {
          cy.log(`Testing on ${browser}:`, win.navigator.userAgent);
        });
      });

      it(`renders correctly in ${browser}`, () => {
        // Check core elements render
        cy.getByDataCy('main-layout').should('be.visible');
        cy.getByDataCy('file-tree').should('be.visible');
        cy.getByDataCy('editor-panel').should('be.visible');
        
        // Check CSS Grid/Flexbox layout
        cy.getByDataCy('main-layout')
          .should('have.css', 'display')
          .and('match', /grid|flex/);
        
        // Verify responsive design
        const viewports = [
          { width: 1920, height: 1080, name: 'desktop' },
          { width: 1366, height: 768, name: 'laptop' },
          { width: 768, height: 1024, name: 'tablet' },
          { width: 375, height: 667, name: 'mobile' }
        ];
        
        viewports.forEach(viewport => {
          cy.viewport(viewport.width, viewport.height);
          cy.getByDataCy('main-layout').should('be.visible');
          
          if (viewport.width < 768) {
            // Mobile layout
            cy.getByDataCy('mobile-menu').should('be.visible');
            cy.getByDataCy('file-tree').should('not.be.visible');
          } else {
            // Desktop layout
            cy.getByDataCy('file-tree').should('be.visible');
            cy.getByDataCy('mobile-menu').should('not.exist');
          }
        });
      });

      it(`handles file uploads in ${browser}`, () => {
        // Test native file input
        const fileName = 'test-upload.md';
        const fileContent = '# Test Upload\n\nContent for browser test';
        
        cy.getByDataCy('upload-button').click();
        cy.getByDataCy('file-input').attachFile({
          fileName,
          fileContent,
          mimeType: 'text/markdown'
        });
        
        // Verify file uploaded
        cy.getByDataCy(`file-${fileName.replace('.', '-')}`).should('exist');
        
        // Test drag and drop (browser-specific)
        if (browser !== 'safari') {
          // Safari has limited drag-drop support
          const dataTransfer = new DataTransfer();
          const file = new File([fileContent], 'drag-test.md', {
            type: 'text/markdown'
          });
          dataTransfer.items.add(file);
          
          cy.getByDataCy('file-tree')
            .trigger('dragenter', { dataTransfer })
            .trigger('dragover', { dataTransfer })
            .trigger('drop', { dataTransfer });
          
          cy.getByDataCy('file-drag-test-md').should('exist');
        }
      });

      it(`handles keyboard shortcuts in ${browser}`, () => {
        cy.createTestFile('shortcut-test.md', 'Initial content');
        cy.openFile('shortcut-test.md');
        
        // Platform-specific shortcuts
        const isMac = browser === 'safari';
        const cmdKey = isMac ? '{cmd}' : '{ctrl}';
        
        // Save shortcut
        cy.get('body').type(`${cmdKey}s`);
        cy.getByDataCy('save-indicator').should('contain', 'Saved');
        
        // Undo/Redo
        cy.typeInEditor('New text');
        cy.get('body').type(`${cmdKey}z`);
        cy.getByDataCy('editor-textarea').should('not.contain', 'New text');
        cy.get('body').type(`${cmdKey}y`);
        cy.getByDataCy('editor-textarea').should('contain', 'New text');
        
        // Search
        cy.get('body').type(`${cmdKey}f`);
        cy.getByDataCy('search-dialog').should('be.visible');
        
        // Close dialog
        cy.get('body').type('{esc}');
        cy.getByDataCy('search-dialog').should('not.exist');
      });

      it(`handles clipboard operations in ${browser}`, () => {
        cy.createTestFile('clipboard-test.md', 'Test content');
        cy.openFile('clipboard-test.md');
        
        // Select text
        cy.getByDataCy('editor-textarea')
          .type('{selectall}');
        
        // Copy
        cy.getByDataCy('editor-textarea').then($el => {
          const text = $el.val();
          
          // Browser-specific clipboard API
          cy.window().then(win => {
            if (win.navigator.clipboard) {
              cy.wrap(win.navigator.clipboard.writeText(text));
            } else {
              // Fallback for older browsers
              cy.document().then(doc => {
                const textarea = doc.createElement('textarea');
                textarea.value = text;
                doc.body.appendChild(textarea);
                textarea.select();
                doc.execCommand('copy');
                doc.body.removeChild(textarea);
              });
            }
          });
        });
        
        // Paste
        cy.getByDataCy('editor-textarea')
          .clear()
          .focus();
        
        cy.window().then(win => {
          if (win.navigator.clipboard) {
            win.navigator.clipboard.readText().then(text => {
              cy.getByDataCy('editor-textarea').type(text);
            });
          } else {
            cy.getByDataCy('editor-textarea').type('{ctrl}v');
          }
        });
        
        cy.getByDataCy('editor-textarea').should('contain', 'Test content');
      });

      it(`handles local storage in ${browser}`, () => {
        // Set preferences
        const preferences = {
          theme: 'dark',
          language: 'en-US',
          autoSave: true
        };
        
        cy.window().then(win => {
          win.localStorage.setItem('preferences', JSON.stringify(preferences));
        });
        
        // Reload and verify persistence
        cy.reload();
        
        cy.window().then(win => {
          const stored = JSON.parse(win.localStorage.getItem('preferences'));
          expect(stored).to.deep.equal(preferences);
        });
        
        // Test storage quota
        if (browser !== 'safari') {
          // Safari has different quota handling
          cy.window().then(async win => {
            if ('storage' in win.navigator && 'estimate' in win.navigator.storage) {
              const estimate = await win.navigator.storage.estimate();
              expect(estimate.usage).to.be.lessThan(estimate.quota);
            }
          });
        }
      });

      it(`handles web workers in ${browser}`, () => {
        // Test syntax highlighting worker
        const largeContent = '```javascript\n' + 
          'const code = "test";\n'.repeat(1000) + 
          '```';
        
        cy.createTestFile('worker-test.md', largeContent);
        cy.openFile('worker-test.md');
        
        // Verify worker processes content
        cy.getByDataCy('syntax-highlighted', { timeout: 5000 })
          .should('be.visible');
        
        // Check worker doesn't block UI
        cy.typeInEditor('// Adding more code');
        cy.getByDataCy('editor-textarea').should('contain', '// Adding more code');
      });

      it(`handles CSS features in ${browser}`, () => {
        // CSS Grid support
        cy.getByDataCy('grid-layout')
          .should('have.css', 'display', 'grid');
        
        // CSS Variables
        cy.window().then(win => {
          const styles = win.getComputedStyle(win.document.documentElement);
          const primaryColor = styles.getPropertyValue('--primary-color');
          expect(primaryColor).to.not.be.empty;
        });
        
        // Dark mode
        cy.getByDataCy('theme-toggle').click();
        cy.get('html').should('have.attr', 'data-theme', 'dark');
        
        // CSS Transitions
        cy.getByDataCy('animated-element')
          .should('have.css', 'transition')
          .and('not.equal', 'none');
        
        // Flexbox
        cy.getByDataCy('flex-container')
          .should('have.css', 'display', 'flex');
      });

      it(`handles WebSocket connections in ${browser}`, () => {
        // Mock WebSocket for real-time features
        cy.window().then(win => {
          const ws = new win.WebSocket('ws://localhost:8080');
          
          cy.wrap(new Promise((resolve, reject) => {
            ws.onopen = () => resolve('connected');
            ws.onerror = reject;
            
            // Clean up
            setTimeout(() => ws.close(), 1000);
          })).then(status => {
            expect(status).to.equal('connected');
          });
        });
      });

      if (browser !== 'safari') {
        it(`handles service workers in ${browser}`, () => {
          // Test service worker registration
          cy.window().then(async win => {
            if ('serviceWorker' in win.navigator) {
              const registration = await win.navigator.serviceWorker.getRegistration();
              if (registration) {
                expect(registration.active).to.not.be.null;
              }
            }
          });
        });
      }

      it(`handles form validation in ${browser}`, () => {
        cy.getByDataCy('config-button').click();
        
        // HTML5 validation
        cy.getByDataCy('webdav-url')
          .clear()
          .type('invalid-url');
        
        cy.getByDataCy('webdav-url').then($input => {
          expect($input[0].validity.valid).to.be.false;
        });
        
        // Custom validation
        cy.getByDataCy('webdav-url')
          .clear()
          .type('http://valid-url.com');
        
        cy.getByDataCy('webdav-url').then($input => {
          expect($input[0].validity.valid).to.be.true;
        });
      });
    });
  });

  describe('Mobile Browser Compatibility', () => {
    const mobileDevices = [
      { name: 'iPhone SE', width: 375, height: 667, userAgent: 'iPhone' },
      { name: 'iPhone 12', width: 390, height: 844, userAgent: 'iPhone' },
      { name: 'iPad', width: 768, height: 1024, userAgent: 'iPad' },
      { name: 'Pixel 5', width: 393, height: 851, userAgent: 'Android' },
      { name: 'Samsung Galaxy S21', width: 384, height: 854, userAgent: 'Android' }
    ];

    mobileDevices.forEach(device => {
      it(`works on ${device.name}`, () => {
        cy.viewport(device.width, device.height);
        cy.visit('/', {
          onBeforeLoad: win => {
            Object.defineProperty(win.navigator, 'userAgent', {
              value: device.userAgent
            });
          }
        });
        
        cy.setupTestEnvironment();
        cy.mockWebDAVServer();
        
        // Test mobile menu
        cy.getByDataCy('mobile-menu-toggle').should('be.visible');
        cy.getByDataCy('mobile-menu-toggle').click();
        cy.getByDataCy('mobile-menu').should('be.visible');
        
        // Test touch interactions
        cy.getByDataCy('file-tree-item')
          .first()
          .trigger('touchstart')
          .trigger('touchend');
        
        cy.getByDataCy('context-menu-mobile').should('be.visible');
        
        // Test swipe gestures
        cy.getByDataCy('editor-panel')
          .trigger('touchstart', { touches: [{ clientX: 300, clientY: 400 }] })
          .trigger('touchmove', { touches: [{ clientX: 100, clientY: 400 }] })
          .trigger('touchend');
        
        // Test pinch zoom
        if (device.name.includes('iPad')) {
          cy.getByDataCy('editor-textarea')
            .trigger('touchstart', {
              touches: [
                { clientX: 200, clientY: 300 },
                { clientX: 300, clientY: 400 }
              ]
            })
            .trigger('touchmove', {
              touches: [
                { clientX: 150, clientY: 250 },
                { clientX: 350, clientY: 450 }
              ]
            })
            .trigger('touchend');
        }
        
        // Test virtual keyboard
        cy.getByDataCy('editor-textarea').click();
        cy.window().then(win => {
          // Check if virtual keyboard would open
          const activeElement = win.document.activeElement;
          expect(activeElement.tagName).to.match(/input|textarea/i);
        });
      });
    });
  });

  describe('Browser Feature Detection', () => {
    it('detects and handles missing features gracefully', () => {
      cy.visit('/');
      
      cy.window().then(win => {
        // Check feature support
        const features = {
          webWorkers: 'Worker' in win,
          serviceWorker: 'serviceWorker' in win.navigator,
          indexedDB: 'indexedDB' in win,
          webSocket: 'WebSocket' in win,
          localStorage: 'localStorage' in win,
          sessionStorage: 'sessionStorage' in win,
          clipboard: 'clipboard' in win.navigator,
          notifications: 'Notification' in win,
          geolocation: 'geolocation' in win.navigator,
          webGL: (() => {
            const canvas = win.document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
          })()
        };
        
        // Log supported features
        cy.task('log', `Browser features: ${JSON.stringify(features, null, 2)}`);
        
        // Verify fallbacks for missing features
        if (!features.webWorkers) {
          cy.getByDataCy('no-worker-warning').should('be.visible');
        }
        
        if (!features.localStorage) {
          cy.getByDataCy('storage-fallback').should('be.visible');
        }
        
        if (!features.clipboard) {
          cy.getByDataCy('clipboard-fallback').should('be.visible');
        }
      });
    });
  });
});