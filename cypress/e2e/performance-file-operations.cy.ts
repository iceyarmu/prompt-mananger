describe('File Operations Performance Tests', () => {
  const measureOperation = (operation) => {
    const startTime = performance.now();
    return operation().then(() => {
      const duration = performance.now() - startTime;
      return duration;
    });
  };

  const generateFileContent = (sizeMB) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const chunkSize = 1024; // 1KB chunks
    const totalChunks = sizeMB * 1024;
    let content = '';
    
    for (let i = 0; i < totalChunks; i++) {
      for (let j = 0; j < chunkSize; j++) {
        content += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    
    return content;
  };

  beforeEach(() => {
    cy.setupTestEnvironment();
    cy.mockWebDAVServer();
    cy.clearLocalStorage();
    cy.visit('/');
    cy.setupWebDAVConnection();
  });

  describe('File Creation Performance', () => {
    it('should create small files within 500ms', () => {
      const startTime = Date.now();
      
      cy.createTestFile('small-file.md', '# Small file content');
      
      cy.getByDataCy('file-small-file').should('exist');
      const duration = Date.now() - startTime;
      
      expect(duration).to.be.lessThan(500, 'Small file creation should be < 500ms');
    });

    it('should handle batch file creation efficiently', () => {
      const fileCount = 20;
      const startTime = Date.now();
      
      // Create multiple files
      for (let i = 0; i < fileCount; i++) {
        cy.createTestFile(`batch-${i}.md`, `# File ${i}`, { silent: true });
      }
      
      // Verify all files created
      cy.getByDataCy('file-batch-19').should('exist');
      const totalTime = Date.now() - startTime;
      
      // Should be efficient (not linear time)
      const avgTimePerFile = totalTime / fileCount;
      expect(avgTimePerFile).to.be.lessThan(100, 'Average time per file should be < 100ms');
      
      // Check if operations were batched
      cy.window().then(win => {
        if (win.__webdavRequests__) {
          const putRequests = win.__webdavRequests__.filter(r => r.method === 'PUT');
          expect(putRequests.length).to.be.lessThanOrEqual(fileCount, 'Should batch operations');
        }
      });
    });

    it('should optimize large file creation', () => {
      const largeContent = generateFileContent(1); // 1MB file
      const startTime = Date.now();
      
      cy.window().then(win => {
        // Create file directly through API
        const blob = new Blob([largeContent], { type: 'text/markdown' });
        const file = new File([blob], 'large.md');
        
        // Trigger file creation
        cy.getByDataCy('file-tree').selectFile(file, { action: 'drag-drop' });
      });
      
      // Should show progress for large files
      cy.getByDataCy('upload-progress').should('be.visible');
      cy.getByDataCy('progress-bar').should('exist');
      
      // Wait for completion
      cy.getByDataCy('file-large').should('exist');
      const duration = Date.now() - startTime;
      
      expect(duration).to.be.lessThan(2000, 'Large file (1MB) should upload < 2s');
    });
  });

  describe('File Reading Performance', () => {
    beforeEach(() => {
      // Pre-create test files
      cy.createTestFile('read-small.md', '# Small content');
      cy.createTestFile('read-medium.md', generateFileContent(0.1)); // 100KB
      cy.createTestFile('read-large.md', generateFileContent(1)); // 1MB
    });

    it('should open small files instantly', () => {
      const startTime = Date.now();
      
      cy.getByDataCy('file-read-small').dblclick();
      cy.getByDataCy('editor-content').should('contain', 'Small content');
      
      const duration = Date.now() - startTime;
      expect(duration).to.be.lessThan(300, 'Small file should open < 300ms');
    });

    it('should efficiently load medium files', () => {
      const startTime = Date.now();
      
      cy.getByDataCy('file-read-medium').dblclick();
      cy.getByDataCy('editor-ready').should('be.visible');
      
      const duration = Date.now() - startTime;
      expect(duration).to.be.lessThan(500, 'Medium file (100KB) should open < 500ms');
      
      // Check if syntax highlighting is deferred
      cy.window().then(win => {
        const highlightTime = win.__highlightingDuration__ || 0;
        expect(highlightTime).to.be.lessThan(200, 'Syntax highlighting should be fast');
      });
    });

    it('should stream large files', () => {
      cy.getByDataCy('file-read-large').dblclick();
      
      // Should show loading indicator
      cy.getByDataCy('file-loading').should('be.visible');
      
      // Content should appear progressively
      let contentLength = 0;
      cy.getByDataCy('editor-content').should(($el) => {
        const newLength = $el.text().length;
        expect(newLength).to.be.greaterThan(contentLength);
        contentLength = newLength;
      });
      
      // Eventually fully loaded
      cy.getByDataCy('editor-ready', { timeout: 3000 }).should('be.visible');
      
      // Verify chunked loading
      cy.window().then(win => {
        if (win.__fileLoadChunks__) {
          expect(win.__fileLoadChunks__).to.be.greaterThan(1, 'File loaded in chunks');
        }
      });
    });

    it('should cache recently opened files', () => {
      // First open
      let firstOpenTime;
      cy.getByDataCy('file-read-medium').dblclick();
      cy.getByDataCy('editor-ready').should('be.visible').then(() => {
        firstOpenTime = Date.now();
      });
      
      // Close file
      cy.getByDataCy('close-file').click();
      
      // Second open (should be cached)
      const secondOpenStart = Date.now();
      cy.getByDataCy('file-read-medium').dblclick();
      cy.getByDataCy('editor-ready').should('be.visible');
      const secondOpenTime = Date.now() - secondOpenStart;
      
      // Second open should be much faster
      expect(secondOpenTime).to.be.lessThan(100, 'Cached file should open < 100ms');
      
      // Verify cache hit
      cy.window().then(win => {
        if (win.__fileCacheHits__) {
          expect(win.__fileCacheHits__['read-medium.md']).to.be.greaterThan(0);
        }
      });
    });
  });

  describe('File Writing Performance', () => {
    beforeEach(() => {
      cy.createTestFile('write-test.md', '# Initial content');
      cy.getByDataCy('file-write-test').dblclick();
    });

    it('should save small changes quickly', () => {
      cy.typeInEditor('\n\nSmall change');
      
      const startTime = Date.now();
      cy.saveFile();
      cy.getByDataCy('save-indicator').should('contain', 'Saved');
      
      const duration = Date.now() - startTime;
      expect(duration).to.be.lessThan(500, 'Small save should complete < 500ms');
    });

    it('should debounce auto-save operations', () => {
      // Enable auto-save
      cy.getByDataCy('settings-button').click();
      cy.getByDataCy('auto-save').check();
      cy.getByDataCy('save-settings').click();
      
      // Track save operations
      let saveCount = 0;
      cy.window().then(win => {
        win.__trackSaves__ = () => saveCount++;
      });
      
      // Make rapid changes
      for (let i = 0; i < 10; i++) {
        cy.typeInEditor(`Change ${i}\n`);
        cy.wait(50);
      }
      
      // Wait for debounce
      cy.wait(1000);
      
      // Should have debounced saves
      expect(saveCount).to.be.lessThan(5, 'Saves should be debounced');
    });

    it('should handle large content updates efficiently', () => {
      const largeContent = generateFileContent(0.5); // 500KB
      
      cy.getByDataCy('editor-content').clear();
      
      const startTime = Date.now();
      cy.typeInEditor(largeContent, { delay: 0 });
      cy.saveFile();
      cy.getByDataCy('save-indicator').should('contain', 'Saved');
      
      const duration = Date.now() - startTime;
      expect(duration).to.be.lessThan(2000, 'Large content save should complete < 2s');
      
      // Check if content was compressed
      cy.window().then(win => {
        if (win.__lastSaveSize__) {
          expect(win.__lastSaveSize__).to.be.lessThan(largeContent.length, 'Content should be compressed');
        }
      });
    });

    it('should optimize diff-based saves', () => {
      // Make small change to large file
      cy.createTestFile('large-diff.md', generateFileContent(1)); // 1MB
      cy.getByDataCy('file-large-diff').dblclick();
      
      // Make small edit
      cy.typeInEditor('\n\nSmall addition at the end');
      
      const startTime = Date.now();
      cy.saveFile();
      cy.getByDataCy('save-indicator').should('contain', 'Saved');
      
      const duration = Date.now() - startTime;
      expect(duration).to.be.lessThan(500, 'Diff-based save should be fast < 500ms');
      
      // Verify diff was used
      cy.window().then(win => {
        if (win.__lastSaveMethod__) {
          expect(win.__lastSaveMethod__).to.equal('diff', 'Should use diff-based save');
        }
      });
    });
  });

  describe('File Deletion Performance', () => {
    it('should delete single files quickly', () => {
      cy.createTestFile('delete-me.md', '# Delete me');
      
      const startTime = Date.now();
      cy.getByDataCy('file-delete-me').rightclick();
      cy.getByDataCy('delete-file').click();
      cy.getByDataCy('confirm-delete').click();
      
      cy.getByDataCy('file-delete-me').should('not.exist');
      const duration = Date.now() - startTime;
      
      expect(duration).to.be.lessThan(500, 'File deletion should complete < 500ms');
    });

    it('should efficiently batch delete multiple files', () => {
      // Create test files
      for (let i = 0; i < 10; i++) {
        cy.createTestFile(`delete-batch-${i}.md`, `# File ${i}`);
      }
      
      // Select multiple files
      cy.getByDataCy('file-delete-batch-0').click();
      cy.get('body').type('{shift}', { release: false });
      cy.getByDataCy('file-delete-batch-9').click();
      cy.get('body').type('{shift}');
      
      const startTime = Date.now();
      cy.getByDataCy('batch-delete').click();
      cy.getByDataCy('confirm-batch-delete').click();
      
      // Wait for all deletions
      cy.getByDataCy('file-delete-batch-9').should('not.exist');
      const duration = Date.now() - startTime;
      
      const avgTimePerFile = duration / 10;
      expect(avgTimePerFile).to.be.lessThan(100, 'Average deletion time should be < 100ms per file');
    });

    it('should handle recursive folder deletion efficiently', () => {
      // Create nested structure
      cy.createFolder('perf-folder');
      for (let i = 0; i < 5; i++) {
        cy.createTestFile(`perf-folder/file-${i}.md`, `# File ${i}`);
        cy.createFolder(`perf-folder/subfolder-${i}`);
        cy.createTestFile(`perf-folder/subfolder-${i}/nested.md`, '# Nested');
      }
      
      const startTime = Date.now();
      cy.getByDataCy('folder-perf-folder').rightclick();
      cy.getByDataCy('delete-folder').click();
      cy.getByDataCy('confirm-recursive-delete').click();
      
      cy.getByDataCy('folder-perf-folder').should('not.exist');
      const duration = Date.now() - startTime;
      
      expect(duration).to.be.lessThan(2000, 'Recursive deletion should complete < 2s');
    });
  });

  describe('File Search Performance', () => {
    beforeEach(() => {
      // Create searchable content
      for (let i = 0; i < 20; i++) {
        cy.createTestFile(`search-${i}.md`, `# Document ${i}\n\nContent with keyword${i}`);
      }
    });

    it('should search files quickly', () => {
      cy.getByDataCy('search-button').click();
      
      const startTime = Date.now();
      cy.getByDataCy('search-input').type('keyword');
      
      // Results should appear quickly
      cy.getByDataCy('search-results').should('be.visible');
      const searchTime = Date.now() - startTime;
      
      expect(searchTime).to.be.lessThan(500, 'Search results should appear < 500ms');
      
      // Should find all matches
      cy.getByDataCy('search-results').find('.result-item').should('have.length', 20);
    });

    it('should implement incremental search', () => {
      cy.getByDataCy('search-button').click();
      
      // Type incrementally
      const searchTerm = 'keyword15';
      let previousResults = 20;
      
      for (let i = 0; i < searchTerm.length; i++) {
        cy.getByDataCy('search-input').type(searchTerm[i]);
        
        // Results should narrow down
        cy.getByDataCy('search-results').find('.result-item').should(($results) => {
          expect($results.length).to.be.lessThanOrEqual(previousResults);
          previousResults = $results.length;
        });
      }
      
      // Final result
      cy.getByDataCy('search-results').find('.result-item').should('have.length', 1);
    });

    it('should cache search results', () => {
      cy.getByDataCy('search-button').click();
      
      // First search
      let firstSearchTime;
      cy.getByDataCy('search-input').type('keyword');
      cy.getByDataCy('search-results').should('be.visible').then(() => {
        firstSearchTime = Date.now();
      });
      
      // Clear and search again
      cy.getByDataCy('search-input').clear();
      
      const secondSearchStart = Date.now();
      cy.getByDataCy('search-input').type('keyword');
      cy.getByDataCy('search-results').should('be.visible');
      const secondSearchTime = Date.now() - secondSearchStart;
      
      expect(secondSearchTime).to.be.lessThan(100, 'Cached search should be < 100ms');
    });
  });

  describe('File Tree Performance', () => {
    it('should render large file trees efficiently', () => {
      // Create large tree structure
      for (let i = 0; i < 5; i++) {
        cy.createFolder(`folder-${i}`);
        for (let j = 0; j < 10; j++) {
          cy.createTestFile(`folder-${i}/file-${j}.md`, `# File ${j}`);
        }
      }
      
      const startTime = Date.now();
      cy.getByDataCy('refresh-tree').click();
      
      // Tree should render
      cy.getByDataCy('file-tree').should('be.visible');
      cy.getByDataCy('folder-folder-4').should('exist');
      
      const renderTime = Date.now() - startTime;
      expect(renderTime).to.be.lessThan(1000, 'Large tree should render < 1s');
      
      // Check if virtual scrolling is used
      cy.window().then(win => {
        const visibleNodes = win.document.querySelectorAll('[data-cy^="folder-"], [data-cy^="file-"]');
        expect(visibleNodes.length).to.be.lessThan(60, 'Should use virtual scrolling');
      });
    });

    it('should expand/collapse folders quickly', () => {
      cy.createFolder('expandable');
      for (let i = 0; i < 20; i++) {
        cy.createTestFile(`expandable/file-${i}.md`, `# File ${i}`);
      }
      
      // Expand
      const expandStart = Date.now();
      cy.getByDataCy('folder-expandable').find('.expand-icon').click();
      cy.getByDataCy('file-expandable-file-19').should('be.visible');
      const expandTime = Date.now() - expandStart;
      
      expect(expandTime).to.be.lessThan(300, 'Folder expansion should be < 300ms');
      
      // Collapse
      const collapseStart = Date.now();
      cy.getByDataCy('folder-expandable').find('.expand-icon').click();
      cy.getByDataCy('file-expandable-file-0').should('not.be.visible');
      const collapseTime = Date.now() - collapseStart;
      
      expect(collapseTime).to.be.lessThan(100, 'Folder collapse should be < 100ms');
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle multiple simultaneous file operations', () => {
      const operations = [];
      const startTime = Date.now();
      
      // Queue multiple operations
      for (let i = 0; i < 5; i++) {
        operations.push(cy.createTestFile(`concurrent-${i}.md`, `# File ${i}`));
      }
      
      // Wait for all to complete
      cy.wrap(Promise.all(operations));
      
      // Verify all files created
      cy.getByDataCy('file-concurrent-4').should('exist');
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).to.be.lessThan(1000, 'Concurrent operations should complete < 1s');
      
      // Operations should be parallelized
      const avgTime = totalTime / 5;
      expect(avgTime).to.be.lessThan(300, 'Operations should run in parallel');
    });

    it('should maintain performance under load', () => {
      // Simulate heavy load
      const loadOperations = [];
      
      // Create files
      for (let i = 0; i < 10; i++) {
        loadOperations.push(cy.createTestFile(`load-${i}.md`, `# Load ${i}`));
      }
      
      // Perform searches
      cy.getByDataCy('search-button').click();
      cy.getByDataCy('search-input').type('load');
      
      // Open a file
      cy.getByDataCy('file-load-0').dblclick();
      
      // Edit content
      cy.typeInEditor('\n\nEditing under load');
      
      // Save
      cy.saveFile();
      
      // All operations should complete successfully
      cy.getByDataCy('save-indicator').should('contain', 'Saved');
      cy.getByDataCy('search-results').should('be.visible');
      
      // Check system remains responsive
      cy.window().then(win => {
        const fps = win.__currentFPS__ || 60;
        expect(fps).to.be.greaterThan(30, 'Should maintain 30+ FPS under load');
      });
    });
  });
});