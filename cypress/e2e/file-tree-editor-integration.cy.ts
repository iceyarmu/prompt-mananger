describe('File Tree ← → Editor Integration Tests', () => {
  beforeEach(() => {
    cy.setupTestEnvironment();
    cy.mockWebDAVServer();
    cy.clearLocalStorage();
    cy.visit('/');
    cy.setupWebDAVConnection();
  });

  describe('File Selection and Loading', () => {
    it('should load file content when selected from tree', () => {
      // Create test files
      cy.createTestFile('test1.md', '# Test 1 Content');
      cy.createTestFile('test2.md', '# Test 2 Content');
      
      // Select first file
      cy.getByDataCy('file-test1').click();
      cy.getByDataCy('editor-content').should('contain', 'Test 1 Content');
      cy.getByDataCy('editor-title').should('contain', 'test1.md');
      
      // Switch to second file
      cy.getByDataCy('file-test2').click();
      cy.getByDataCy('editor-content').should('contain', 'Test 2 Content');
      cy.getByDataCy('editor-title').should('contain', 'test2.md');
    });

    it('should handle double-click to open files', () => {
      cy.createTestFile('double-click.md', '# Double Click Test');
      
      // Single click should select
      cy.getByDataCy('file-double-click').click();
      cy.getByDataCy('file-double-click').should('have.class', 'selected');
      
      // Double click should open
      cy.getByDataCy('file-double-click').dblclick();
      cy.getByDataCy('editor-content').should('contain', 'Double Click Test');
      cy.getByDataCy('editor-mode').should('equal', 'edit');
    });

    it('should update tree when file is saved with new name', () => {
      cy.createTestFile('original.md', '# Original');
      cy.getByDataCy('file-original').dblclick();
      
      // Save as new file
      cy.getByDataCy('save-as-button').click();
      cy.getByDataCy('new-filename').type('renamed.md');
      cy.getByDataCy('confirm-save-as').click();
      
      // Verify tree updated
      cy.getByDataCy('file-renamed').should('exist');
      cy.getByDataCy('file-original').should('not.exist');
      cy.getByDataCy('editor-title').should('contain', 'renamed.md');
    });
  });

  describe('Unsaved Changes Tracking', () => {
    it('should show unsaved indicator when file is modified', () => {
      cy.createTestFile('unsaved.md', '# Initial');
      cy.getByDataCy('file-unsaved').dblclick();
      
      // Modify content
      cy.typeInEditor(' Modified');
      
      // Check indicators
      cy.getByDataCy('file-unsaved').should('have.class', 'unsaved');
      cy.getByDataCy('unsaved-dot').should('be.visible');
      cy.getByDataCy('editor-dirty-indicator').should('be.visible');
    });

    it('should warn when switching files with unsaved changes', () => {
      cy.createTestFile('file1.md', '# File 1');
      cy.createTestFile('file2.md', '# File 2');
      
      // Edit first file
      cy.getByDataCy('file-file1').dblclick();
      cy.typeInEditor(' Modified');
      
      // Try to switch
      cy.getByDataCy('file-file2').click();
      
      // Should show warning dialog
      cy.getByDataCy('unsaved-warning').should('be.visible');
      cy.getByDataCy('warning-message').should('contain', 'unsaved changes');
      
      // Options
      cy.getByDataCy('save-and-continue').should('be.visible');
      cy.getByDataCy('discard-changes').should('be.visible');
      cy.getByDataCy('cancel-switch').should('be.visible');
    });

    it('should handle save and continue workflow', () => {
      cy.createTestFile('save-continue1.md', '# File 1');
      cy.createTestFile('save-continue2.md', '# File 2');
      
      // Edit first file
      cy.getByDataCy('file-save-continue1').dblclick();
      cy.typeInEditor(' Modified');
      
      // Switch with save
      cy.getByDataCy('file-save-continue2').click();
      cy.getByDataCy('save-and-continue').click();
      
      // Verify save completed
      cy.wait('@webdavPut');
      cy.getByDataCy('file-save-continue1').should('not.have.class', 'unsaved');
      
      // Verify switched to new file
      cy.getByDataCy('editor-content').should('contain', 'File 2');
      cy.getByDataCy('editor-title').should('contain', 'save-continue2.md');
    });
  });

  describe('File Tree State Synchronization', () => {
    it('should reflect file system changes in tree', () => {
      cy.createTestFile('sync-test.md', '# Sync Test');
      
      // Simulate external file creation
      cy.window().then((win) => {
        win.__mockWebDAVCreate__('external.md', '# External File');
      });
      
      // Refresh tree
      cy.getByDataCy('refresh-tree').click();
      
      // New file should appear
      cy.getByDataCy('file-external').should('exist');
      
      // Simulate external deletion
      cy.window().then((win) => {
        win.__mockWebDAVDelete__('sync-test.md');
      });
      
      cy.getByDataCy('refresh-tree').click();
      cy.getByDataCy('file-sync-test').should('not.exist');
    });

    it('should update tree icons based on file type', () => {
      // Create files with different extensions
      cy.createTestFile('document.md', '# Markdown');
      cy.createTestFile('data.json', '{"test": true}');
      cy.createTestFile('script.js', 'console.log("test");');
      cy.createTestFile('style.css', 'body { color: red; }');
      
      // Verify correct icons
      cy.getByDataCy('file-document').find('.file-icon').should('have.class', 'icon-markdown');
      cy.getByDataCy('file-data').find('.file-icon').should('have.class', 'icon-json');
      cy.getByDataCy('file-script').find('.file-icon').should('have.class', 'icon-javascript');
      cy.getByDataCy('file-style').find('.file-icon').should('have.class', 'icon-css');
    });

    it('should maintain expansion state during operations', () => {
      // Create nested structure
      cy.createFolder('parent');
      cy.createFolder('parent/child1');
      cy.createFolder('parent/child2');
      cy.createTestFile('parent/child1/file1.md', '# File 1');
      cy.createTestFile('parent/child2/file2.md', '# File 2');
      
      // Expand folders
      cy.getByDataCy('folder-parent').find('.expand-icon').click();
      cy.getByDataCy('folder-child1').find('.expand-icon').click();
      cy.getByDataCy('folder-child2').find('.expand-icon').click();
      
      // Perform operation
      cy.getByDataCy('file-file1').dblclick();
      cy.typeInEditor(' Modified');
      cy.saveFile();
      
      // Verify expansion maintained
      cy.getByDataCy('folder-parent').should('have.class', 'expanded');
      cy.getByDataCy('folder-child1').should('have.class', 'expanded');
      cy.getByDataCy('folder-child2').should('have.class', 'expanded');
    });
  });

  describe('Multi-file Operations', () => {
    it('should support opening multiple files in tabs', () => {
      // Create test files
      cy.createTestFile('tab1.md', '# Tab 1');
      cy.createTestFile('tab2.md', '# Tab 2');
      cy.createTestFile('tab3.md', '# Tab 3');
      
      // Open files
      cy.getByDataCy('file-tab1').dblclick();
      cy.getByDataCy('file-tab2').dblclick();
      cy.getByDataCy('file-tab3').dblclick();
      
      // Verify tabs created
      cy.getByDataCy('editor-tabs').find('.tab').should('have.length', 3);
      cy.getByDataCy('tab-tab1').should('exist');
      cy.getByDataCy('tab-tab2').should('exist');
      cy.getByDataCy('tab-tab3').should('have.class', 'active');
      
      // Switch between tabs
      cy.getByDataCy('tab-tab1').click();
      cy.getByDataCy('editor-content').should('contain', 'Tab 1');
      cy.getByDataCy('tab-tab1').should('have.class', 'active');
    });

    it('should handle closing tabs with unsaved changes', () => {
      cy.createTestFile('closeable.md', '# Closeable');
      cy.getByDataCy('file-closeable').dblclick();
      
      // Modify file
      cy.typeInEditor(' Modified');
      
      // Try to close tab
      cy.getByDataCy('tab-closeable').find('.close-button').click();
      
      // Should show warning
      cy.getByDataCy('close-warning').should('be.visible');
      cy.getByDataCy('save-before-close').click();
      
      // Should save and close
      cy.wait('@webdavPut');
      cy.getByDataCy('tab-closeable').should('not.exist');
    });

    it('should support split view for multiple files', () => {
      cy.createTestFile('split1.md', '# Split 1');
      cy.createTestFile('split2.md', '# Split 2');
      
      // Open first file
      cy.getByDataCy('file-split1').dblclick();
      
      // Split view with second file
      cy.getByDataCy('file-split2').rightclick();
      cy.getByDataCy('open-split-right').click();
      
      // Verify split view
      cy.getByDataCy('editor-split-container').should('exist');
      cy.getByDataCy('editor-left').should('contain', 'Split 1');
      cy.getByDataCy('editor-right').should('contain', 'Split 2');
      
      // Both should be editable
      cy.getByDataCy('editor-left').click().type(' - Left edit');
      cy.getByDataCy('editor-right').click().type(' - Right edit');
      
      cy.getByDataCy('editor-left').should('contain', 'Left edit');
      cy.getByDataCy('editor-right').should('contain', 'Right edit');
    });
  });

  describe('File Tree Context Menu', () => {
    it('should show appropriate context menu options', () => {
      cy.createTestFile('context.md', '# Context');
      
      // Right-click file
      cy.getByDataCy('file-context').rightclick();
      
      // Verify file options
      cy.getByDataCy('context-menu').should('be.visible');
      cy.getByDataCy('menu-open').should('exist');
      cy.getByDataCy('menu-rename').should('exist');
      cy.getByDataCy('menu-duplicate').should('exist');
      cy.getByDataCy('menu-delete').should('exist');
      cy.getByDataCy('menu-copy-path').should('exist');
      
      // Right-click folder
      cy.createFolder('test-folder');
      cy.getByDataCy('folder-test-folder').rightclick();
      
      // Verify folder options
      cy.getByDataCy('menu-new-file').should('exist');
      cy.getByDataCy('menu-new-folder').should('exist');
      cy.getByDataCy('menu-rename').should('exist');
      cy.getByDataCy('menu-delete').should('exist');
    });

    it('should execute context menu actions correctly', () => {
      cy.createTestFile('original.md', '# Original');
      
      // Duplicate file
      cy.getByDataCy('file-original').rightclick();
      cy.getByDataCy('menu-duplicate').click();
      cy.getByDataCy('duplicate-name').should('have.value', 'original-copy.md');
      cy.getByDataCy('confirm-duplicate').click();
      
      // Verify duplication
      cy.getByDataCy('file-original-copy').should('exist');
      cy.getByDataCy('file-original-copy').dblclick();
      cy.getByDataCy('editor-content').should('contain', 'Original');
      
      // Rename file
      cy.getByDataCy('file-original-copy').rightclick();
      cy.getByDataCy('menu-rename').click();
      cy.getByDataCy('rename-input').clear().type('renamed.md');
      cy.getByDataCy('confirm-rename').click();
      
      // Verify rename
      cy.getByDataCy('file-renamed').should('exist');
      cy.getByDataCy('file-original-copy').should('not.exist');
    });
  });

  describe('Drag and Drop', () => {
    it('should support file drag and drop within tree', () => {
      // Create folder structure
      cy.createFolder('source');
      cy.createFolder('destination');
      cy.createTestFile('source/moveable.md', '# Moveable');
      
      // Drag file to destination
      cy.getByDataCy('file-moveable')
        .drag('[data-cy="folder-destination"]');
      
      // Verify move
      cy.getByDataCy('folder-destination').find('[data-cy="file-moveable"]').should('exist');
      cy.getByDataCy('folder-source').find('[data-cy="file-moveable"]').should('not.exist');
      
      // Verify content preserved
      cy.getByDataCy('file-moveable').dblclick();
      cy.getByDataCy('editor-content').should('contain', 'Moveable');
    });

    it('should support external file drop', () => {
      // Simulate file drop
      const file = new File(['# Dropped Content'], 'dropped.md', { type: 'text/markdown' });
      
      cy.getByDataCy('file-tree').trigger('drop', {
        dataTransfer: {
          files: [file],
          types: ['Files'],
          effectAllowed: 'copy'
        }
      });
      
      // Verify file added
      cy.getByDataCy('upload-progress').should('be.visible');
      cy.getByDataCy('file-dropped').should('exist');
      
      // Verify content
      cy.getByDataCy('file-dropped').dblclick();
      cy.getByDataCy('editor-content').should('contain', 'Dropped Content');
    });

    it('should prevent invalid drop operations', () => {
      cy.createTestFile('file1.md', '# File 1');
      cy.createTestFile('file2.md', '# File 2');
      
      // Try to drop file onto another file (invalid)
      cy.getByDataCy('file-file1')
        .drag('[data-cy="file-file2"]');
      
      // Should show error
      cy.getByDataCy('drop-error').should('contain', 'Cannot drop file onto file');
      
      // Files should remain unchanged
      cy.getByDataCy('file-file1').should('exist');
      cy.getByDataCy('file-file2').should('exist');
    });
  });

  describe('Search and Filter', () => {
    it('should filter tree based on search input', () => {
      // Create files
      cy.createTestFile('apple.md', '# Apple');
      cy.createTestFile('banana.md', '# Banana');
      cy.createTestFile('cherry.md', '# Cherry');
      cy.createFolder('fruits');
      cy.createTestFile('fruits/orange.md', '# Orange');
      
      // Search for 'an'
      cy.getByDataCy('tree-search').type('an');
      
      // Should show matching files
      cy.getByDataCy('file-banana').should('be.visible');
      cy.getByDataCy('file-orange').should('be.visible');
      cy.getByDataCy('file-apple').should('not.be.visible');
      cy.getByDataCy('file-cherry').should('not.be.visible');
      
      // Clear search
      cy.getByDataCy('tree-search').clear();
      cy.getByDataCy('file-apple').should('be.visible');
      cy.getByDataCy('file-cherry').should('be.visible');
    });

    it('should highlight search matches', () => {
      cy.createTestFile('highlighted.md', '# Highlighted');
      
      cy.getByDataCy('tree-search').type('light');
      cy.getByDataCy('file-highlighted').find('.highlight').should('exist');
      cy.getByDataCy('file-highlighted').find('.highlight').should('contain', 'light');
    });
  });

  describe('Recent Files', () => {
    it('should track recently opened files', () => {
      // Create and open files
      cy.createTestFile('recent1.md', '# Recent 1');
      cy.createTestFile('recent2.md', '# Recent 2');
      cy.createTestFile('recent3.md', '# Recent 3');
      
      cy.getByDataCy('file-recent1').dblclick();
      cy.wait(100);
      cy.getByDataCy('file-recent2').dblclick();
      cy.wait(100);
      cy.getByDataCy('file-recent3').dblclick();
      
      // Check recent files list
      cy.getByDataCy('recent-files-button').click();
      cy.getByDataCy('recent-files-list').find('.recent-file').should('have.length', 3);
      
      // Most recent first
      cy.getByDataCy('recent-files-list').find('.recent-file').first().should('contain', 'recent3.md');
      cy.getByDataCy('recent-files-list').find('.recent-file').last().should('contain', 'recent1.md');
    });

    it('should open file from recent list', () => {
      cy.createTestFile('from-recent.md', '# From Recent');
      cy.getByDataCy('file-from-recent').dblclick();
      
      // Open different file
      cy.createTestFile('other.md', '# Other');
      cy.getByDataCy('file-other').dblclick();
      
      // Open from recent
      cy.getByDataCy('recent-files-button').click();
      cy.getByDataCy('recent-from-recent').click();
      
      // Should open file
      cy.getByDataCy('editor-content').should('contain', 'From Recent');
      cy.getByDataCy('editor-title').should('contain', 'from-recent.md');
    });
  });
});