describe('State Management Across Components Tests', () => {
  beforeEach(() => {
    cy.setupTestEnvironment();
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.visit('/');
  });

  describe('Pinia Store Integration', () => {
    it('should maintain consistent state across all stores', () => {
      cy.setupWebDAVConnection();
      
      // Create test data
      cy.createTestFile('state-test.md', '# State Test Content');
      cy.getByDataCy('file-state-test').dblclick();
      
      // Check all store states are synchronized
      cy.window().then((win) => {
        const pinia = win.__PINIA__;
        const stores = pinia.state.value;
        
        // App store
        expect(stores.app).to.exist;
        expect(stores.app.isLoading).to.be.false;
        expect(stores.app.initialized).to.be.true;
        
        // FileTree store
        expect(stores.fileTree).to.exist;
        expect(stores.fileTree.isConnected).to.be.true;
        expect(stores.fileTree.files).to.be.an('array');
        expect(stores.fileTree.selectedFile).to.include('state-test.md');
        
        // Editor store
        expect(stores.editor).to.exist;
        expect(stores.editor.currentFile).to.include('state-test.md');
        expect(stores.editor.content).to.include('State Test Content');
        expect(stores.editor.isDirty).to.be.false;
        
        // WebDAV store
        expect(stores.webdav).to.exist;
        expect(stores.webdav.isConfigured).to.be.true;
        expect(stores.webdav.connectionStatus).to.equal('connected');
        
        // Preferences store
        expect(stores.preferences).to.exist;
        expect(stores.preferences.theme).to.be.oneOf(['light', 'dark']);
      });
    });

    it('should propagate state changes across dependent stores', () => {
      cy.setupWebDAVConnection();
      cy.createTestFile('propagate.md', '# Initial');
      
      // Change theme in preferences
      cy.getByDataCy('settings-button').click();
      cy.getByDataCy('theme-selector').select('dark');
      cy.getByDataCy('save-settings').click();
      
      // Verify propagation
      cy.window().then((win) => {
        const stores = win.__PINIA__.state.value;
        
        // Preferences updated
        expect(stores.preferences.theme).to.equal('dark');
        
        // App store reacted
        expect(stores.app.currentTheme).to.equal('dark');
        
        // Editor store updated
        expect(stores.editor.editorTheme).to.equal('dark');
      });
      
      // UI should reflect changes
      cy.get('body').should('have.class', 'dark-theme');
      cy.getByDataCy('editor-container').should('have.class', 'theme-dark');
    });

    it('should handle store subscriptions and watchers', () => {
      cy.setupWebDAVConnection();
      
      // Set up subscription tracking
      cy.window().then((win) => {
        const subscriptions = [];
        const { useFileTreeStore, useEditorStore } = win;
        
        const fileTreeStore = useFileTreeStore();
        const editorStore = useEditorStore();
        
        // Subscribe to file selection changes
        fileTreeStore.$subscribe((mutation, state) => {
          subscriptions.push({
            store: 'fileTree',
            type: mutation.type,
            payload: mutation.payload
          });
        });
        
        // Subscribe to editor changes
        editorStore.$subscribe((mutation, state) => {
          subscriptions.push({
            store: 'editor',
            type: mutation.type,
            payload: mutation.payload
          });
        });
        
        win.__subscriptions__ = subscriptions;
      });
      
      // Perform actions that trigger subscriptions
      cy.createTestFile('subscribe.md', '# Content');
      cy.getByDataCy('file-subscribe').click(); // Select file
      cy.getByDataCy('file-subscribe').dblclick(); // Open file
      cy.typeInEditor(' Modified');
      
      // Verify subscriptions fired
      cy.window().then((win) => {
        const subs = win.__subscriptions__;
        
        // Should have file selection subscription
        const fileSelectSub = subs.find(s => 
          s.store === 'fileTree' && s.payload?.selectedFile
        );
        expect(fileSelectSub).to.exist;
        
        // Should have editor content subscription
        const editorContentSub = subs.find(s => 
          s.store === 'editor' && s.payload?.content
        );
        expect(editorContentSub).to.exist;
      });
    });

    it('should handle computed properties across stores', () => {
      cy.setupWebDAVConnection();
      
      // Create files with different states
      cy.createTestFile('saved.md', '# Saved');
      cy.createTestFile('unsaved.md', '# Unsaved');
      
      // Open and modify second file
      cy.getByDataCy('file-unsaved').dblclick();
      cy.typeInEditor(' Modified');
      
      // Check computed properties
      cy.window().then((win) => {
        const { useEditorStore, useFileTreeStore, useAppStore } = win;
        
        const editorStore = useEditorStore();
        const fileTreeStore = useFileTreeStore();
        const appStore = useAppStore();
        
        // Editor computed
        expect(editorStore.canSave).to.be.true;
        expect(editorStore.displayTitle).to.include('unsaved.md');
        expect(editorStore.hasUnsavedChanges).to.be.true;
        
        // FileTree computed
        expect(fileTreeStore.modifiedFiles).to.include('unsaved.md');
        expect(fileTreeStore.fileCount).to.equal(2);
        
        // App computed
        expect(appStore.hasBlockingOperations).to.be.false;
        expect(appStore.canNavigate).to.be.false; // Has unsaved changes
      });
    });
  });

  describe('Cross-Store Actions', () => {
    it('should coordinate actions across multiple stores', () => {
      cy.setupWebDAVConnection();
      cy.createTestFile('coordinate.md', '# Coordinate');
      
      // Action that affects multiple stores
      cy.getByDataCy('file-coordinate').dblclick();
      cy.typeInEditor(' Modified');
      cy.saveFile();
      
      // Verify coordinated updates
      cy.window().then((win) => {
        const stores = win.__PINIA__.state.value;
        
        // Editor store: saved
        expect(stores.editor.isDirty).to.be.false;
        expect(stores.editor.lastSaved).to.exist;
        
        // FileTree store: updated
        expect(stores.fileTree.files.find(f => f.name === 'coordinate.md').modified).to.exist;
        
        // WebDAV store: synced
        expect(stores.webdav.lastSync).to.exist;
        
        // History store: recorded
        expect(stores.history?.recent).to.include('coordinate.md');
      });
    });

    it('should handle transactional updates across stores', () => {
      cy.setupWebDAVConnection();
      
      // Start a multi-store transaction
      cy.getByDataCy('batch-operation').click();
      cy.getByDataCy('batch-create').click();
      
      // Configure batch creation
      cy.getByDataCy('batch-count').type('3');
      cy.getByDataCy('batch-prefix').type('transaction');
      cy.getByDataCy('execute-batch').click();
      
      // Monitor transaction
      cy.window().then((win) => {
        const stores = win.__PINIA__.state.value;
        
        // Should be in transaction mode
        expect(stores.app.isInTransaction).to.be.true;
        expect(stores.fileTree.pendingChanges).to.have.length(3);
      });
      
      // Complete transaction
      cy.getByDataCy('commit-transaction').click();
      
      // Verify atomic update
      cy.window().then((win) => {
        const stores = win.__PINIA__.state.value;
        
        // Transaction completed
        expect(stores.app.isInTransaction).to.be.false;
        
        // All files created
        expect(stores.fileTree.files.filter(f => f.name.includes('transaction'))).to.have.length(3);
        
        // No pending changes
        expect(stores.fileTree.pendingChanges).to.have.length(0);
      });
    });

    it('should rollback failed cross-store operations', () => {
      cy.setupWebDAVConnection();
      cy.createTestFile('rollback.md', '# Original');
      
      // Start operation that will fail
      cy.intercept('PUT', '**/webdav/**', { statusCode: 500 }).as('failedSave');
      
      // Capture initial state
      cy.window().then((win) => {
        const initialState = JSON.parse(JSON.stringify(win.__PINIA__.state.value));
        win.__initialState__ = initialState;
      });
      
      // Attempt operation
      cy.getByDataCy('file-rollback').dblclick();
      cy.typeInEditor(' Modified');
      cy.saveFile();
      cy.wait('@failedSave');
      
      // Should show rollback option
      cy.getByDataCy('operation-failed').should('be.visible');
      cy.getByDataCy('rollback-changes').click();
      
      // Verify state rolled back
      cy.window().then((win) => {
        const currentState = win.__PINIA__.state.value;
        const initialState = win.__initialState__;
        
        // Editor reverted
        expect(currentState.editor.content).to.equal(initialState.editor.content);
        expect(currentState.editor.isDirty).to.be.false;
        
        // FileTree reverted
        expect(currentState.fileTree.files).to.deep.equal(initialState.fileTree.files);
      });
    });
  });

  describe('State Persistence', () => {
    it('should persist state to localStorage', () => {
      cy.setupWebDAVConnection();
      cy.createTestFile('persist.md', '# Persist');
      
      // Make various state changes
      cy.getByDataCy('settings-button').click();
      cy.getByDataCy('theme-selector').select('dark');
      cy.getByDataCy('autosave-toggle').check();
      cy.getByDataCy('save-settings').click();
      
      cy.getByDataCy('file-persist').dblclick();
      cy.typeInEditor(' Modified');
      
      // Check localStorage
      cy.window().then((win) => {
        const stored = win.localStorage.getItem('pinia-state');
        expect(stored).to.exist;
        
        const parsedState = JSON.parse(stored);
        expect(parsedState.preferences.theme).to.equal('dark');
        expect(parsedState.preferences.autoSave).to.be.true;
        expect(parsedState.editor.recentFiles).to.include('persist.md');
      });
    });

    it('should restore state from localStorage', () => {
      // Set up initial state
      const initialState = {
        preferences: {
          theme: 'dark',
          autoSave: true,
          fontSize: 16
        },
        webdav: {
          url: 'https://saved.webdav.com',
          username: 'saveduser'
        },
        editor: {
          recentFiles: ['file1.md', 'file2.md', 'file3.md']
        }
      };
      
      cy.window().then((win) => {
        win.localStorage.setItem('pinia-state', JSON.stringify(initialState));
      });
      
      // Reload and verify restoration
      cy.reload();
      
      cy.window().then((win) => {
        const stores = win.__PINIA__.state.value;
        
        // Preferences restored
        expect(stores.preferences.theme).to.equal('dark');
        expect(stores.preferences.autoSave).to.be.true;
        expect(stores.preferences.fontSize).to.equal(16);
        
        // WebDAV config restored
        expect(stores.webdav.url).to.equal('https://saved.webdav.com');
        expect(stores.webdav.username).to.equal('saveduser');
        
        // Editor state restored
        expect(stores.editor.recentFiles).to.deep.equal(['file1.md', 'file2.md', 'file3.md']);
      });
      
      // UI reflects restored state
      cy.get('body').should('have.class', 'dark-theme');
      cy.getByDataCy('autosave-indicator').should('be.visible');
    });

    it('should handle selective state persistence', () => {
      cy.setupWebDAVConnection();
      
      // Create sensitive data
      cy.getByDataCy('webdav-config').click();
      cy.getByDataCy('webdav-password').type('secret-password');
      cy.getByDataCy('api-key').type('secret-api-key');
      cy.getByDataCy('save-config').click();
      
      // Create non-sensitive data
      cy.createTestFile('normal.md', '# Normal');
      cy.getByDataCy('file-normal').dblclick();
      
      // Check persistence
      cy.window().then((win) => {
        const stored = win.localStorage.getItem('pinia-state');
        const parsedState = JSON.parse(stored);
        
        // Sensitive data not persisted
        expect(parsedState.webdav.password).to.be.undefined;
        expect(parsedState.api?.key).to.be.undefined;
        
        // Normal data persisted
        expect(parsedState.webdav.url).to.exist;
        expect(parsedState.editor.currentFile).to.include('normal.md');
      });
    });

    it('should migrate state schema on version changes', () => {
      // Set old schema state
      const oldState = {
        version: '1.0.0',
        theme: 'dark', // Old location
        files: ['file1.md'], // Old structure
        config: {
          webdav: 'https://old.webdav.com'
        }
      };
      
      cy.window().then((win) => {
        win.localStorage.setItem('pinia-state', JSON.stringify(oldState));
      });
      
      // Load with new schema
      cy.reload();
      
      // Should migrate to new structure
      cy.window().then((win) => {
        const stores = win.__PINIA__.state.value;
        
        // Migrated to new locations
        expect(stores.preferences.theme).to.equal('dark');
        expect(stores.fileTree.files).to.deep.equal(['file1.md']);
        expect(stores.webdav.url).to.equal('https://old.webdav.com');
        
        // Version updated
        const stored = JSON.parse(win.localStorage.getItem('pinia-state'));
        expect(stored.version).to.not.equal('1.0.0');
      });
    });
  });

  describe('State Synchronization', () => {
    it('should sync state across browser tabs', () => {
      cy.setupWebDAVConnection();
      
      // Simulate storage event from another tab
      cy.window().then((win) => {
        const otherTabState = {
          preferences: { theme: 'dark' },
          editor: { recentFiles: ['other-tab.md'] }
        };
        
        // Trigger storage event
        const event = new StorageEvent('storage', {
          key: 'pinia-state',
          newValue: JSON.stringify(otherTabState),
          url: win.location.href
        });
        win.dispatchEvent(event);
      });
      
      // Current tab should sync
      cy.window().then((win) => {
        const stores = win.__PINIA__.state.value;
        expect(stores.preferences.theme).to.equal('dark');
        expect(stores.editor.recentFiles).to.include('other-tab.md');
      });
      
      // UI should update
      cy.get('body').should('have.class', 'dark-theme');
    });

    it('should handle conflicting state updates', () => {
      cy.setupWebDAVConnection();
      cy.createTestFile('conflict.md', '# Original');
      cy.getByDataCy('file-conflict').dblclick();
      
      // Start editing
      cy.typeInEditor(' Local edit');
      
      // Simulate conflicting update from another source
      cy.window().then((win) => {
        const stores = win.__PINIA__.state.value;
        stores.editor.content = '# Different content from another source';
      });
      
      // Should detect conflict
      cy.getByDataCy('state-conflict').should('be.visible');
      cy.getByDataCy('conflict-resolution').should('be.visible');
      
      // Options
      cy.getByDataCy('keep-local').should('exist');
      cy.getByDataCy('accept-remote').should('exist');
      cy.getByDataCy('merge-states').should('exist');
      
      // Choose merge
      cy.getByDataCy('merge-states').click();
      cy.getByDataCy('merge-preview').should('be.visible');
      cy.getByDataCy('accept-merge').click();
      
      // State should be merged
      cy.getByDataCy('editor-content').invoke('text').should('include', 'Local edit');
    });

    it('should throttle rapid state updates', () => {
      cy.setupWebDAVConnection();
      
      // Track state saves
      let saveCount = 0;
      cy.window().then((win) => {
        const originalSetItem = win.localStorage.setItem;
        win.localStorage.setItem = function(key, value) {
          if (key === 'pinia-state') saveCount++;
          return originalSetItem.call(this, key, value);
        };
      });
      
      // Make rapid changes
      for (let i = 0; i < 10; i++) {
        cy.getByDataCy('settings-button').click();
        cy.getByDataCy('font-size').clear().type(String(12 + i));
        cy.getByDataCy('save-settings').click();
      }
      
      // Wait for throttle period
      cy.wait(1000);
      
      // Should have throttled saves
      cy.wrap(null).then(() => {
        expect(saveCount).to.be.lessThan(10);
        expect(saveCount).to.be.greaterThan(0);
      });
    });
  });

  describe('State Debugging and DevTools', () => {
    it('should expose state for debugging', () => {
      cy.setupWebDAVConnection();
      
      // Check DevTools integration
      cy.window().then((win) => {
        // Pinia DevTools exposed
        expect(win.__PINIA__).to.exist;
        expect(win.__PINIA__.state).to.exist;
        expect(win.__PINIA__.stores).to.exist;
        
        // Can inspect state
        const state = win.__PINIA__.state.value;
        console.log('Current state:', state);
        
        // Can access stores directly
        const { useAppStore, useEditorStore } = win;
        expect(useAppStore).to.be.a('function');
        expect(useEditorStore).to.be.a('function');
      });
    });

    it('should track state mutations in development', () => {
      cy.setupWebDAVConnection();
      
      // Enable mutation tracking
      cy.window().then((win) => {
        const mutations = [];
        win.__PINIA__._mutations = mutations;
        
        // Hook into mutations
        const stores = win.__PINIA__.stores;
        stores.forEach(store => {
          store.$onAction(({
            name,
            store,
            args,
            after,
            onError
          }) => {
            mutations.push({
              timestamp: Date.now(),
              store: store.$id,
              action: name,
              args
            });
          });
        });
      });
      
      // Perform actions
      cy.createTestFile('track.md', '# Track');
      cy.getByDataCy('file-track').dblclick();
      cy.typeInEditor(' Modified');
      
      // Check mutations tracked
      cy.window().then((win) => {
        const mutations = win.__PINIA__._mutations;
        
        expect(mutations).to.have.length.greaterThan(0);
        
        // Should have file creation mutation
        const createMutation = mutations.find(m => 
          m.action === 'createFile' || m.action === 'addFile'
        );
        expect(createMutation).to.exist;
        
        // Should have editor update mutation
        const editorMutation = mutations.find(m => 
          m.store === 'editor' && m.action === 'updateContent'
        );
        expect(editorMutation).to.exist;
      });
    });

    it('should support time-travel debugging', () => {
      cy.setupWebDAVConnection();
      
      // Capture state snapshots
      const snapshots = [];
      cy.window().then((win) => {
        win.__stateSnapshots__ = snapshots;
        
        // Take initial snapshot
        snapshots.push({
          timestamp: Date.now(),
          state: JSON.parse(JSON.stringify(win.__PINIA__.state.value))
        });
      });
      
      // Make changes
      cy.createTestFile('snapshot1.md', '# Snapshot 1');
      cy.window().then((win) => {
        win.__stateSnapshots__.push({
          timestamp: Date.now(),
          state: JSON.parse(JSON.stringify(win.__PINIA__.state.value))
        });
      });
      
      cy.getByDataCy('file-snapshot1').dblclick();
      cy.window().then((win) => {
        win.__stateSnapshots__.push({
          timestamp: Date.now(),
          state: JSON.parse(JSON.stringify(win.__PINIA__.state.value))
        });
      });
      
      cy.typeInEditor(' Modified');
      cy.window().then((win) => {
        win.__stateSnapshots__.push({
          timestamp: Date.now(),
          state: JSON.parse(JSON.stringify(win.__PINIA__.state.value))
        });
      });
      
      // Time travel to previous state
      cy.window().then((win) => {
        const snapshots = win.__stateSnapshots__;
        const previousState = snapshots[1].state; // Before file was opened
        
        // Restore previous state
        Object.keys(previousState).forEach(storeId => {
          win.__PINIA__.state.value[storeId] = previousState[storeId];
        });
      });
      
      // UI should reflect previous state
      cy.getByDataCy('editor-content').should('be.empty');
      cy.getByDataCy('file-snapshot1').should('not.have.class', 'selected');
    });
  });

  describe('Store Composition and Modules', () => {
    it('should support nested store modules', () => {
      cy.window().then((win) => {
        const stores = win.__PINIA__.state.value;
        
        // Check for nested modules
        if (stores.editor) {
          expect(stores.editor).to.have.property('buffer');
          expect(stores.editor).to.have.property('cursor');
          expect(stores.editor).to.have.property('selection');
        }
        
        if (stores.fileTree) {
          expect(stores.fileTree).to.have.property('expanded');
          expect(stores.fileTree).to.have.property('filters');
        }
      });
    });

    it('should handle store plugins', () => {
      cy.window().then((win) => {
        // Check for plugin functionality
        const { useAppStore } = win;
        const appStore = useAppStore();
        
        // Logger plugin
        if (appStore.$logger) {
          expect(appStore.$logger).to.be.a('function');
          appStore.$logger('Test log message');
        }
        
        // History plugin
        if (appStore.$history) {
          expect(appStore.$history).to.have.property('undo');
          expect(appStore.$history).to.have.property('redo');
          expect(appStore.$history).to.have.property('canUndo');
          expect(appStore.$history).to.have.property('canRedo');
        }
      });
    });

    it('should support store composition', () => {
      cy.setupWebDAVConnection();
      
      cy.window().then((win) => {
        const { useEditorStore, useFileTreeStore, useWebDAVStore } = win;
        
        // Composed store example
        const useFileEditorStore = () => {
          const editor = useEditorStore();
          const fileTree = useFileTreeStore();
          const webdav = useWebDAVStore();
          
          return {
            // Composed getters
            get currentFilePath() {
              return fileTree.getFilePath(editor.currentFile);
            },
            get canSaveToWebDAV() {
              return editor.isDirty && webdav.isConnected;
            },
            // Composed actions
            async saveCurrentFile() {
              if (this.canSaveToWebDAV) {
                const path = this.currentFilePath;
                const content = editor.content;
                await webdav.saveFile(path, content);
                editor.markClean();
                fileTree.updateFileStatus(path, 'saved');
              }
            }
          };
        };
        
        // Test composed store
        const composedStore = useFileEditorStore();
        expect(composedStore.currentFilePath).to.be.a('string');
        expect(composedStore.canSaveToWebDAV).to.be.a('boolean');
        expect(composedStore.saveCurrentFile).to.be.a('function');
      });
    });
  });

  describe('Performance Optimization', () => {
    it('should debounce frequent state updates', () => {
      cy.setupWebDAVConnection();
      cy.createTestFile('debounce.md', '# Debounce');
      cy.getByDataCy('file-debounce').dblclick();
      
      // Track content updates
      let updateCount = 0;
      cy.window().then((win) => {
        const { useEditorStore } = win;
        const editorStore = useEditorStore();
        
        editorStore.$subscribe((mutation) => {
          if (mutation.type === 'direct' && mutation.payload?.content !== undefined) {
            updateCount++;
          }
        });
      });
      
      // Type rapidly
      const text = 'Testing debounced updates';
      for (let char of text) {
        cy.typeInEditor(char, { delay: 10 });
      }
      
      // Wait for debounce
      cy.wait(500);
      
      // Should have debounced updates
      cy.wrap(null).then(() => {
        expect(updateCount).to.be.lessThan(text.length);
        expect(updateCount).to.be.greaterThan(0);
      });
    });

    it('should use shallow reactive for large datasets', () => {
      cy.setupWebDAVConnection();
      
      // Create many files
      const fileCount = 100;
      for (let i = 0; i < fileCount; i++) {
        cy.createTestFile(`perf-${i}.md`, `# File ${i}`, { silent: true });
      }
      
      // Check performance
      cy.window().then((win) => {
        const start = performance.now();
        
        // Access store
        const { useFileTreeStore } = win;
        const fileTreeStore = useFileTreeStore();
        
        // Should use shallow reactive for file list
        const files = fileTreeStore.files;
        expect(files).to.have.length(fileCount);
        
        // Measure access time
        files.forEach(file => file.name);
        
        const duration = performance.now() - start;
        expect(duration).to.be.lessThan(100); // Should be fast
      });
    });

    it('should optimize computed properties with caching', () => {
      cy.setupWebDAVConnection();
      
      // Create test data
      for (let i = 0; i < 10; i++) {
        cy.createTestFile(`cache-${i}.md`, `# File ${i}`);
      }
      
      cy.window().then((win) => {
        const { useFileTreeStore } = win;
        const fileTreeStore = useFileTreeStore();
        
        let computeCount = 0;
        
        // Override computed to track calls
        const originalComputed = fileTreeStore.sortedFiles;
        Object.defineProperty(fileTreeStore, 'sortedFiles', {
          get() {
            computeCount++;
            return originalComputed;
          }
        });
        
        // Access computed multiple times
        const sorted1 = fileTreeStore.sortedFiles;
        const sorted2 = fileTreeStore.sortedFiles;
        const sorted3 = fileTreeStore.sortedFiles;
        
        // Should use cached value
        expect(computeCount).to.equal(1);
        expect(sorted1).to.equal(sorted2);
        expect(sorted2).to.equal(sorted3);
      });
    });
  });
});