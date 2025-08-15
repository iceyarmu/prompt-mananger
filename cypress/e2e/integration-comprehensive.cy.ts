describe('Comprehensive Integration Tests - Story 2.12', () => {
  beforeEach(() => {
    cy.setupTestEnvironment();
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('Integration Point 1: WebDAV ← → FileTree ← → Editor ← → Optimization', () => {
    it('should sync file changes across all integrated services', () => {
      // Setup WebDAV connection
      cy.visit('/');
      cy.setupWebDAVConnection();
      
      // Test WebDAV → FileTree integration
      cy.getByDataCy('file-tree').should('be.visible');
      cy.getByDataCy('connection-status').should('contain', 'Connected');
      
      // Create file through FileTree
      cy.createTestFile('test-integration.md', '# Initial Content');
      
      // Verify FileTree → Editor integration
      cy.getByDataCy('file-test-integration').dblclick();
      cy.getByDataCy('markdown-editor').should('be.visible');
      cy.getByDataCy('editor-content').should('contain', 'Initial Content');
      
      // Test Editor → Optimization integration
      cy.getByDataCy('optimize-button').click();
      cy.wait('@optimizePrompt');
      cy.getByDataCy('optimization-results').should('be.visible');
      
      // Apply optimization and verify sync back
      cy.getByDataCy('apply-optimization').click();
      cy.getByDataCy('editor-content').should('not.contain', 'Initial Content');
      
      // Save and verify WebDAV sync
      cy.saveFile();
      cy.wait('@webdavPut');
      cy.getByDataCy('save-indicator').should('contain', 'Saved');
      
      // Refresh and verify persistence
      cy.reload();
      cy.getByDataCy('file-test-integration').dblclick();
      cy.getByDataCy('editor-content').should('not.contain', 'Initial Content');
    });

    it('should handle concurrent operations without conflicts', () => {
      cy.setupWebDAVConnection();
      
      // Open multiple files simultaneously
      cy.createTestFile('file1.md', '# File 1');
      cy.createTestFile('file2.md', '# File 2');
      cy.createTestFile('file3.md', '# File 3');
      
      // Edit files in quick succession
      cy.getByDataCy('file-file1').dblclick();
      cy.typeInEditor('Updated content 1');
      
      cy.getByDataCy('file-file2').dblclick();
      cy.typeInEditor('Updated content 2');
      
      cy.getByDataCy('file-file3').dblclick();
      cy.typeInEditor('Updated content 3');
      
      // Save all files
      cy.get('body').type('{ctrl}s');
      
      // Verify all saves completed
      cy.getByDataCy('save-queue').should('not.exist');
      cy.getByDataCy('save-indicator').should('contain', 'All changes saved');
    });
  });

  describe('Integration Point 2: Editor → Prompt Execution Service', () => {
    it('should execute prompts with proper context and model integration', () => {
      cy.setupWebDAVConnection();
      cy.createTestFile('execute-test.md', '{{model}}: Please summarize {{context}}');
      
      // Open file in editor
      cy.getByDataCy('file-execute-test').dblclick();
      
      // Select model
      cy.getByDataCy('model-selector').click();
      cy.getByDataCy('model-gpt-3.5-turbo').click();
      
      // Add context variables
      cy.getByDataCy('context-panel').click();
      cy.getByDataCy('add-variable').click();
      cy.getByDataCy('variable-name').type('context');
      cy.getByDataCy('variable-value').type('Integration testing documentation');
      cy.getByDataCy('save-variable').click();
      
      // Execute prompt
      cy.getByDataCy('execute-button').click();
      cy.wait('@executePrompt');
      
      // Verify execution results
      cy.getByDataCy('execution-results').should('be.visible');
      cy.getByDataCy('result-content').should('not.be.empty');
      cy.getByDataCy('token-usage').should('exist');
      cy.getByDataCy('model-used').should('contain', 'gpt-3.5-turbo');
    });

    it('should handle template variables and parameter injection', () => {
      cy.setupWebDAVConnection();
      
      // Create prompt with template variables
      const promptContent = `
        {{#system}}
        You are a {{role}} assistant.
        {{/system}}
        
        {{#user}}
        {{task}}
        {{/user}}
      `;
      
      cy.createTestFile('template-test.md', promptContent);
      cy.getByDataCy('file-template-test').dblclick();
      
      // Set template variables
      cy.getByDataCy('template-variables').click();
      cy.setTemplateVariable('role', 'technical');
      cy.setTemplateVariable('task', 'Explain integration testing');
      
      // Execute and verify variable replacement
      cy.getByDataCy('execute-button').click();
      cy.wait('@executePrompt').then((interception) => {
        expect(interception.request.body).to.include('technical assistant');
        expect(interception.request.body).to.include('Explain integration testing');
      });
    });
  });

  describe('Integration Point 3: Unified Pinia Stores', () => {
    it('should maintain state consistency across all stores', () => {
      cy.visit('/');
      
      // Set preferences
      cy.getByDataCy('settings-button').click();
      cy.getByDataCy('theme-selector').select('dark');
      cy.getByDataCy('autosave-toggle').check();
      cy.getByDataCy('save-settings').click();
      
      // Setup WebDAV
      cy.setupWebDAVConnection();
      
      // Create and edit file
      cy.createTestFile('state-test.md', '# State Test');
      cy.getByDataCy('file-state-test').dblclick();
      
      // Verify stores are synced
      cy.window().then((win) => {
        const stores = win.__PINIA__;
        
        // Check app store
        expect(stores.state.value.app.theme).to.equal('dark');
        expect(stores.state.value.app.isLoading).to.be.false;
        
        // Check fileTree store
        expect(stores.state.value.fileTree.isConnected).to.be.true;
        expect(stores.state.value.fileTree.files).to.have.length.greaterThan(0);
        
        // Check editor store
        expect(stores.state.value.editor.currentFile).to.include('state-test.md');
        expect(stores.state.value.editor.isDirty).to.be.false;
        
        // Check preferences store
        expect(stores.state.value.preferences.autoSave).to.be.true;
      });
    });

    it('should persist store state across sessions', () => {
      cy.visit('/');
      
      // Configure application state
      cy.setupWebDAVConnection();
      cy.createTestFile('persist-test.md', '# Persistence Test');
      cy.getByDataCy('file-persist-test').dblclick();
      cy.typeInEditor('Modified content');
      
      // Get current state
      cy.window().then((win) => {
        const currentState = JSON.parse(JSON.stringify(win.__PINIA__.state.value));
        cy.wrap(currentState).as('savedState');
      });
      
      // Reload page
      cy.reload();
      
      // Verify state persistence
      cy.get('@savedState').then((savedState) => {
        cy.window().then((win) => {
          const restoredState = win.__PINIA__.state.value;
          
          // Verify critical state preserved
          expect(restoredState.webdav.url).to.equal(savedState.webdav.url);
          expect(restoredState.preferences).to.deep.equal(savedState.preferences);
          expect(restoredState.editor.recentFiles).to.deep.equal(savedState.editor.recentFiles);
        });
      });
    });
  });

  describe('Integration Point 4: Event Bus Communication', () => {
    it('should propagate events across components correctly', () => {
      cy.setupWebDAVConnection();
      cy.createTestFile('event-test.md', '# Event Test');
      
      // Monitor event bus
      cy.window().then((win) => {
        const eventLog = [];
        win.__eventBus__ = win.__eventBus__ || {};
        
        const originalEmit = win.__eventBus__.emit || (() => {});
        win.__eventBus__.emit = (event, ...args) => {
          eventLog.push({ event, args, timestamp: Date.now() });
          return originalEmit(event, ...args);
        };
        
        cy.wrap(eventLog).as('eventLog');
      });
      
      // Trigger various events
      cy.getByDataCy('file-event-test').dblclick();
      cy.typeInEditor('Modified');
      cy.saveFile();
      cy.getByDataCy('optimize-button').click();
      
      // Verify event sequence
      cy.get('@eventLog').then((eventLog) => {
        const events = eventLog.map(e => e.event);
        
        expect(events).to.include('file:opened');
        expect(events).to.include('editor:changed');
        expect(events).to.include('file:saving');
        expect(events).to.include('file:saved');
        expect(events).to.include('optimization:started');
      });
    });

    it('should handle event errors gracefully', () => {
      cy.visit('/');
      
      // Inject error-throwing listener
      cy.window().then((win) => {
        win.__eventBus__ = win.__eventBus__ || {};
        win.__eventBus__.on('test:error', () => {
          throw new Error('Test error in event handler');
        });
      });
      
      // Trigger error event
      cy.window().then((win) => {
        win.__eventBus__.emit('test:error');
      });
      
      // Application should continue functioning
      cy.getByDataCy('app-container').should('be.visible');
      cy.getByDataCy('error-boundary').should('not.exist');
    });
  });

  describe('Integration Point 5: Service Initialization Sequence', () => {
    it('should initialize services in correct dependency order', () => {
      const initOrder = [];
      
      // Intercept service initializations
      cy.intercept('**/api/**', (req) => {
        initOrder.push(req.url);
        req.reply({ statusCode: 200, body: {} });
      });
      
      cy.visit('/');
      
      // Wait for initialization
      cy.getByDataCy('app-ready').should('exist');
      
      // Verify initialization order
      cy.wrap(initOrder).should((order) => {
        const expectedSequence = [
          'storage',
          'preference',
          'webdav',
          'model',
          'template',
          'optimization',
          'execution',
          'history'
        ];
        
        expectedSequence.forEach((service, index) => {
          if (index > 0) {
            const prevIndex = order.findIndex(url => url.includes(expectedSequence[index - 1]));
            const currIndex = order.findIndex(url => url.includes(service));
            expect(prevIndex).to.be.lessThan(currIndex);
          }
        });
      });
    });

    it('should handle service initialization failures', () => {
      // Fail template service initialization
      cy.intercept('GET', '**/templates/**', { statusCode: 500 });
      
      cy.visit('/');
      
      // App should still load with degraded functionality
      cy.getByDataCy('app-container').should('be.visible');
      cy.getByDataCy('warning-banner').should('contain', 'Some features may be limited');
      
      // Non-dependent features should work
      cy.getByDataCy('file-tree').should('be.visible');
      cy.getByDataCy('editor').should('be.visible');
      
      // Template-dependent features should show error
      cy.getByDataCy('template-selector').click();
      cy.getByDataCy('template-error').should('contain', 'Templates unavailable');
    });
  });

  describe('Integration Point 6: Three-Panel Layout System', () => {
    it('should maintain layout state during operations', () => {
      cy.visit('/');
      cy.setupWebDAVConnection();
      
      // Set custom panel sizes
      cy.getByDataCy('left-panel-resizer').drag(50, 0);
      cy.getByDataCy('right-panel-resizer').drag(-50, 0);
      
      // Get panel dimensions
      cy.getByDataCy('left-panel').then($panel => {
        const leftWidth = $panel.width();
        cy.wrap(leftWidth).as('leftPanelWidth');
      });
      
      // Perform various operations
      cy.createTestFile('layout-test.md', '# Layout Test');
      cy.getByDataCy('file-layout-test').dblclick();
      cy.typeInEditor('Content');
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('close-modal').click();
      
      // Verify layout preserved
      cy.get('@leftPanelWidth').then((originalWidth) => {
        cy.getByDataCy('left-panel').should(($panel) => {
          expect($panel.width()).to.be.closeTo(originalWidth, 5);
        });
      });
    });

    it('should handle panel collapse and expand correctly', () => {
      cy.visit('/');
      
      // Collapse left panel
      cy.getByDataCy('collapse-left-panel').click();
      cy.getByDataCy('left-panel').should('have.class', 'collapsed');
      cy.getByDataCy('editor-panel').should('have.class', 'expanded');
      
      // Collapse right panel
      cy.getByDataCy('collapse-right-panel').click();
      cy.getByDataCy('right-panel').should('have.class', 'collapsed');
      cy.getByDataCy('editor-panel').should('have.class', 'full-width');
      
      // Expand panels
      cy.getByDataCy('expand-left-panel').click();
      cy.getByDataCy('left-panel').should('not.have.class', 'collapsed');
      
      cy.getByDataCy('expand-right-panel').click();
      cy.getByDataCy('right-panel').should('not.have.class', 'collapsed');
    });
  });

  describe('Integration Point 7: Feature Flag System', () => {
    it('should toggle between old and new platform based on feature flag', () => {
      cy.visit('/');
      
      // Verify new platform is default
      cy.getByDataCy('platform-indicator').should('contain', 'New Platform');
      cy.getByDataCy('system-router').should('have.attr', 'data-platform', 'new');
      
      // Toggle to old platform
      cy.getByDataCy('settings-button').click();
      cy.getByDataCy('feature-flags-tab').click();
      cy.getByDataCy('new_platform_enabled').uncheck();
      cy.getByDataCy('save-settings').click();
      
      // Verify switch to old platform
      cy.reload();
      cy.getByDataCy('platform-indicator').should('contain', 'Legacy Platform');
      cy.getByDataCy('system-router').should('have.attr', 'data-platform', 'legacy');
      
      // Verify old platform components loaded
      cy.getByDataCy('legacy-editor').should('exist');
      cy.getByDataCy('new-editor').should('not.exist');
    });

    it('should maintain data consistency across platform switches', () => {
      cy.visit('/');
      cy.setupWebDAVConnection();
      
      // Create data in new platform
      cy.createTestFile('platform-test.md', '# Platform Test Content');
      cy.getByDataCy('file-platform-test').dblclick();
      
      // Switch to old platform
      cy.toggleFeatureFlag('new_platform_enabled', false);
      cy.reload();
      
      // Verify data accessible in old platform
      cy.getByDataCy('file-platform-test').should('exist');
      cy.getByDataCy('file-platform-test').dblclick();
      cy.getByDataCy('legacy-editor').should('contain', 'Platform Test Content');
      
      // Edit in old platform
      cy.typeInEditor(' - Edited in legacy');
      cy.saveFile();
      
      // Switch back to new platform
      cy.toggleFeatureFlag('new_platform_enabled', true);
      cy.reload();
      
      // Verify changes preserved
      cy.getByDataCy('file-platform-test').dblclick();
      cy.getByDataCy('editor-content').should('contain', 'Edited in legacy');
    });

    it('should handle gradual rollout correctly', () => {
      // Set user in rollout percentage
      cy.window().then((win) => {
        win.localStorage.setItem('userId', 'user-123'); // Should be in 10% rollout
      });
      
      cy.visit('/');
      
      // Check gradual rollout service
      cy.window().then((win) => {
        const gradualRollout = win.__gradualRolloutService__;
        expect(gradualRollout.isUserInRollout('new_platform_enabled', 10)).to.be.true;
        expect(gradualRollout.isUserInRollout('new_platform_enabled', 5)).to.be.false;
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from WebDAV connection failures', () => {
      cy.visit('/');
      cy.setupWebDAVConnection();
      
      // Simulate connection failure
      cy.intercept('**/webdav/**', { statusCode: 503 }).as('webdavError');
      
      cy.createTestFile('error-test.md', '# Error Test');
      cy.wait('@webdavError');
      
      // Should show error and retry option
      cy.getByDataCy('connection-error').should('be.visible');
      cy.getByDataCy('retry-connection').should('be.visible');
      
      // Fix connection
      cy.intercept('**/webdav/**', { statusCode: 200 });
      cy.getByDataCy('retry-connection').click();
      
      // Should recover
      cy.getByDataCy('connection-status').should('contain', 'Connected');
      cy.getByDataCy('file-error-test').should('exist');
    });

    it('should handle optimization service failures gracefully', () => {
      cy.setupWebDAVConnection();
      cy.createTestFile('opt-error.md', '# Optimization Error Test');
      cy.getByDataCy('file-opt-error').dblclick();
      
      // Fail optimization
      cy.intercept('POST', '**/optimize', { statusCode: 500, body: { error: 'Service unavailable' } });
      
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('optimization-error').should('contain', 'Service unavailable');
      cy.getByDataCy('optimization-retry').should('be.visible');
      
      // Editor should remain functional
      cy.typeInEditor('Still working');
      cy.saveFile();
      cy.getByDataCy('save-indicator').should('contain', 'Saved');
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large files efficiently', () => {
      cy.setupWebDAVConnection();
      
      // Create large file content (1MB)
      const largeContent = '# Large File\n' + 'x'.repeat(1024 * 1024);
      cy.createTestFile('large.md', largeContent);
      
      // Measure load time
      const startTime = Date.now();
      cy.getByDataCy('file-large').dblclick();
      cy.getByDataCy('editor-ready').should('exist');
      const loadTime = Date.now() - startTime;
      
      // Should load within performance budget
      expect(loadTime).to.be.lessThan(2000);
      
      // Check memory usage
      cy.window().then((win) => {
        if (win.performance && win.performance.memory) {
          const memoryUsage = win.performance.memory.usedJSHeapSize / 1024 / 1024;
          expect(memoryUsage).to.be.lessThan(200); // Less than 200MB
        }
      });
    });

    it('should clean up resources on component unmount', () => {
      cy.setupWebDAVConnection();
      
      // Open multiple files
      for (let i = 0; i < 5; i++) {
        cy.createTestFile(`file${i}.md`, `# File ${i}`);
        cy.getByDataCy(`file-file${i}`).dblclick();
      }
      
      // Get initial memory
      cy.window().then((win) => {
        if (win.performance && win.performance.memory) {
          const initialMemory = win.performance.memory.usedJSHeapSize;
          cy.wrap(initialMemory).as('initialMemory');
        }
      });
      
      // Close all files
      cy.getByDataCy('close-all-files').click();
      
      // Force garbage collection if available
      cy.window().then((win) => {
        if (win.gc) win.gc();
      });
      
      // Memory should be released
      cy.get('@initialMemory').then((initialMemory) => {
        cy.window().then((win) => {
          if (win.performance && win.performance.memory) {
            const currentMemory = win.performance.memory.usedJSHeapSize;
            expect(currentMemory).to.be.lessThan(initialMemory * 1.1); // Max 10% increase
          }
        });
      });
    });
  });

  describe('Data Integrity and Consistency', () => {
    it('should maintain data integrity during concurrent edits', () => {
      cy.setupWebDAVConnection();
      cy.createTestFile('concurrent.md', '# Original Content');
      
      // Open in editor
      cy.getByDataCy('file-concurrent').dblclick();
      
      // Simulate external change
      cy.window().then((win) => {
        win.__mockWebDAVUpdate__('concurrent.md', '# External Change');
      });
      
      // Try to save local changes
      cy.typeInEditor('\nLocal change');
      cy.saveFile();
      
      // Should detect conflict
      cy.getByDataCy('conflict-dialog').should('be.visible');
      cy.getByDataCy('conflict-yours').should('contain', 'Local change');
      cy.getByDataCy('conflict-theirs').should('contain', 'External Change');
      
      // Resolve conflict
      cy.getByDataCy('merge-changes').click();
      cy.getByDataCy('merged-content').should('contain', 'External Change');
      cy.getByDataCy('merged-content').should('contain', 'Local change');
      cy.getByDataCy('accept-merge').click();
      
      // Verify resolution
      cy.getByDataCy('editor-content').should('contain', 'External Change');
      cy.getByDataCy('editor-content').should('contain', 'Local change');
    });

    it('should validate data before operations', () => {
      cy.setupWebDAVConnection();
      
      // Test invalid file names
      cy.getByDataCy('new-file-button').click();
      cy.getByDataCy('filename-input').type('../../etc/passwd');
      cy.getByDataCy('create-button').click();
      cy.getByDataCy('validation-error').should('contain', 'Invalid file path');
      
      // Test invalid template variables
      cy.createTestFile('template.md', '{{invalid}syntax}}');
      cy.getByDataCy('file-template').dblclick();
      cy.getByDataCy('template-error').should('contain', 'Invalid template syntax');
      
      // Test XSS prevention
      cy.typeInEditor('<script>alert("XSS")</script>');
      cy.getByDataCy('preview-button').click();
      cy.getByDataCy('preview-content').should('not.contain', '<script>');
      cy.getByDataCy('preview-content').should('contain', '&lt;script&gt;');
    });
  });
});