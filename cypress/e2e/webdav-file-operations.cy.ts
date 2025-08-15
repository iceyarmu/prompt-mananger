describe('WebDAV ← → File Operations Integration Tests', () => {
  beforeEach(() => {
    cy.setupTestEnvironment();
    cy.mockWebDAVServer();
    cy.clearLocalStorage();
    cy.visit('/');
  });

  describe('WebDAV Connection Management', () => {
    it('should establish and maintain WebDAV connection', () => {
      // Test connection setup
      cy.getByDataCy('webdav-config').click();
      cy.getByDataCy('webdav-url').type('https://webdav.example.com');
      cy.getByDataCy('webdav-username').type('testuser');
      cy.getByDataCy('webdav-password').type('testpass');
      
      // Test connection
      cy.getByDataCy('test-connection').click();
      cy.wait('@webdavOptions');
      cy.getByDataCy('connection-success').should('be.visible');
      
      // Save configuration
      cy.getByDataCy('save-config').click();
      
      // Verify connection persists
      cy.reload();
      cy.getByDataCy('connection-status').should('contain', 'Connected');
      cy.getByDataCy('webdav-url-display').should('contain', 'webdav.example.com');
    });

    it('should handle connection failures gracefully', () => {
      // Simulate server failure
      cy.intercept('OPTIONS', '**/webdav/**', { statusCode: 503 }).as('webdavFail');
      
      cy.getByDataCy('webdav-config').click();
      cy.getByDataCy('webdav-url').type('https://failing.webdav.com');
      cy.getByDataCy('test-connection').click();
      
      cy.wait('@webdavFail');
      cy.getByDataCy('connection-error').should('be.visible');
      cy.getByDataCy('error-message').should('contain', 'Service unavailable');
      cy.getByDataCy('retry-connection').should('be.visible');
    });

    it('should auto-reconnect after connection loss', () => {
      cy.setupWebDAVConnection();
      
      // Simulate connection loss
      cy.intercept('PROPFIND', '**/webdav/**', { statusCode: 0 }).as('connectionLost');
      cy.getByDataCy('refresh-tree').click();
      cy.wait('@connectionLost');
      
      cy.getByDataCy('connection-status').should('contain', 'Disconnected');
      cy.getByDataCy('reconnecting-indicator').should('be.visible');
      
      // Restore connection
      cy.intercept('PROPFIND', '**/webdav/**', {
        statusCode: 207,
        body: '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"></d:multistatus>'
      });
      
      // Should auto-reconnect
      cy.getByDataCy('connection-status', { timeout: 10000 }).should('contain', 'Connected');
    });

    it('should support multiple WebDAV server configurations', () => {
      // Add first server
      cy.getByDataCy('webdav-config').click();
      cy.getByDataCy('server-name').type('Production');
      cy.getByDataCy('webdav-url').type('https://prod.webdav.com');
      cy.getByDataCy('webdav-username').type('produser');
      cy.getByDataCy('webdav-password').type('prodpass');
      cy.getByDataCy('save-config').click();
      
      // Add second server
      cy.getByDataCy('add-server').click();
      cy.getByDataCy('server-name').type('Development');
      cy.getByDataCy('webdav-url').type('https://dev.webdav.com');
      cy.getByDataCy('webdav-username').type('devuser');
      cy.getByDataCy('webdav-password').type('devpass');
      cy.getByDataCy('save-config').click();
      
      // Switch between servers
      cy.getByDataCy('server-selector').click();
      cy.getByDataCy('server-Development').click();
      cy.getByDataCy('webdav-url-display').should('contain', 'dev.webdav.com');
      
      cy.getByDataCy('server-selector').click();
      cy.getByDataCy('server-Production').click();
      cy.getByDataCy('webdav-url-display').should('contain', 'prod.webdav.com');
    });
  });

  describe('File Operations', () => {
    beforeEach(() => {
      cy.setupWebDAVConnection();
    });

    it('should create files through WebDAV', () => {
      const fileName = 'test-file.md';
      const fileContent = '# Test Content\n\nThis is a test file.';
      
      // Create file
      cy.getByDataCy('new-file-button').click();
      cy.getByDataCy('file-name-input').type(fileName);
      cy.getByDataCy('create-file').click();
      
      // Verify WebDAV PUT request
      cy.wait('@webdavPut').then((interception) => {
        expect(interception.request.url).to.include(fileName);
        expect(interception.request.method).to.equal('PUT');
      });
      
      // Edit file
      cy.getByDataCy(`file-${fileName.replace('.md', '')}`).dblclick();
      cy.typeInEditor(fileContent);
      cy.saveFile();
      
      // Verify content saved to WebDAV
      cy.wait('@webdavPut').then((interception) => {
        expect(interception.request.body).to.equal(fileContent);
      });
    });

    it('should read files from WebDAV', () => {
      // Mock existing file on server
      cy.intercept('PROPFIND', '**/webdav/**', {
        statusCode: 207,
        fixture: 'webdav-file-list.xml'
      });
      
      cy.intercept('GET', '**/webdav/existing-file.md', {
        statusCode: 200,
        body: '# Existing File\n\nContent from WebDAV server'
      }).as('webdavGet');
      
      // Refresh tree to load files
      cy.getByDataCy('refresh-tree').click();
      
      // Open existing file
      cy.getByDataCy('file-existing-file').dblclick();
      cy.wait('@webdavGet');
      
      // Verify content loaded
      cy.getByDataCy('editor-content').should('contain', 'Content from WebDAV server');
    });

    it('should update files through WebDAV', () => {
      cy.createTestFile('update-test.md', '# Original Content');
      
      // Open and edit file
      cy.getByDataCy('file-update-test').dblclick();
      cy.getByDataCy('editor-content').clear();
      cy.typeInEditor('# Updated Content\n\nThis has been modified.');
      
      // Save changes
      cy.saveFile();
      
      // Verify WebDAV PUT with updated content
      cy.wait('@webdavPut').then((interception) => {
        expect(interception.request.body).to.include('Updated Content');
        expect(interception.request.body).to.include('This has been modified');
      });
      
      // Verify save indicator
      cy.getByDataCy('save-indicator').should('contain', 'Saved');
    });

    it('should delete files through WebDAV', () => {
      cy.createTestFile('delete-test.md', '# To be deleted');
      
      // Delete file
      cy.getByDataCy('file-delete-test').rightclick();
      cy.getByDataCy('delete-file').click();
      cy.getByDataCy('confirm-delete').click();
      
      // Verify WebDAV DELETE request
      cy.wait('@webdavDelete').then((interception) => {
        expect(interception.request.method).to.equal('DELETE');
        expect(interception.request.url).to.include('delete-test.md');
      });
      
      // Verify file removed from tree
      cy.getByDataCy('file-delete-test').should('not.exist');
    });

    it('should move/rename files through WebDAV', () => {
      cy.createTestFile('original-name.md', '# File to rename');
      
      // Rename file
      cy.getByDataCy('file-original-name').rightclick();
      cy.getByDataCy('rename-file').click();
      cy.getByDataCy('new-name-input').clear().type('renamed-file.md');
      cy.getByDataCy('confirm-rename').click();
      
      // Verify WebDAV MOVE request
      cy.wait('@webdavMove').then((interception) => {
        expect(interception.request.method).to.equal('MOVE');
        expect(interception.request.headers.destination).to.include('renamed-file.md');
      });
      
      // Verify tree updated
      cy.getByDataCy('file-renamed-file').should('exist');
      cy.getByDataCy('file-original-name').should('not.exist');
    });

    it('should copy files through WebDAV', () => {
      cy.createTestFile('source.md', '# Source file');
      
      // Copy file
      cy.getByDataCy('file-source').rightclick();
      cy.getByDataCy('copy-file').click();
      cy.getByDataCy('copy-name-input').should('have.value', 'source-copy.md');
      cy.getByDataCy('confirm-copy').click();
      
      // Verify WebDAV COPY request
      cy.wait('@webdavCopy').then((interception) => {
        expect(interception.request.method).to.equal('COPY');
        expect(interception.request.headers.destination).to.include('source-copy.md');
      });
      
      // Verify both files exist
      cy.getByDataCy('file-source').should('exist');
      cy.getByDataCy('file-source-copy').should('exist');
    });
  });

  describe('Folder Operations', () => {
    beforeEach(() => {
      cy.setupWebDAVConnection();
    });

    it('should create folders through WebDAV', () => {
      // Create folder
      cy.getByDataCy('new-folder-button').click();
      cy.getByDataCy('folder-name-input').type('test-folder');
      cy.getByDataCy('create-folder').click();
      
      // Verify WebDAV MKCOL request
      cy.wait('@webdavMkcol').then((interception) => {
        expect(interception.request.method).to.equal('MKCOL');
        expect(interception.request.url).to.include('test-folder');
      });
      
      // Verify folder in tree
      cy.getByDataCy('folder-test-folder').should('exist');
      cy.getByDataCy('folder-test-folder').should('have.class', 'folder');
    });

    it('should list folder contents from WebDAV', () => {
      // Mock folder with contents
      cy.intercept('PROPFIND', '**/webdav/parent-folder/**', {
        statusCode: 207,
        fixture: 'webdav-folder-contents.xml'
      }).as('folderContents');
      
      // Create and expand folder
      cy.createFolder('parent-folder');
      cy.getByDataCy('folder-parent-folder').find('.expand-icon').click();
      
      cy.wait('@folderContents');
      
      // Verify children loaded
      cy.getByDataCy('folder-parent-folder').find('.tree-children').should('be.visible');
      cy.getByDataCy('file-child1').should('exist');
      cy.getByDataCy('file-child2').should('exist');
      cy.getByDataCy('folder-subfolder').should('exist');
    });

    it('should delete folders recursively through WebDAV', () => {
      // Create folder structure
      cy.createFolder('parent');
      cy.createTestFile('parent/file1.md', 'File 1');
      cy.createTestFile('parent/file2.md', 'File 2');
      cy.createFolder('parent/subfolder');
      cy.createTestFile('parent/subfolder/nested.md', 'Nested file');
      
      // Delete parent folder
      cy.getByDataCy('folder-parent').rightclick();
      cy.getByDataCy('delete-folder').click();
      cy.getByDataCy('confirm-recursive-delete').should('be.visible');
      cy.getByDataCy('delete-count').should('contain', '5'); // parent + 2 files + subfolder + nested
      cy.getByDataCy('confirm-delete').click();
      
      // Verify WebDAV DELETE request
      cy.wait('@webdavDelete').then((interception) => {
        expect(interception.request.method).to.equal('DELETE');
        expect(interception.request.url).to.include('parent');
      });
      
      // Verify everything removed
      cy.getByDataCy('folder-parent').should('not.exist');
    });

    it('should move folders with contents through WebDAV', () => {
      // Create folder structure
      cy.createFolder('source-folder');
      cy.createTestFile('source-folder/file.md', 'Content');
      cy.createFolder('destination');
      
      // Drag folder to destination
      cy.getByDataCy('folder-source-folder').drag('[data-cy="folder-destination"]');
      
      // Verify WebDAV MOVE request
      cy.wait('@webdavMove').then((interception) => {
        expect(interception.request.method).to.equal('MOVE');
        expect(interception.request.headers.destination).to.include('destination/source-folder');
      });
      
      // Verify tree structure updated
      cy.getByDataCy('folder-destination').find('.expand-icon').click();
      cy.getByDataCy('folder-destination').find('[data-cy="folder-source-folder"]').should('exist');
    });
  });

  describe('Synchronization', () => {
    beforeEach(() => {
      cy.setupWebDAVConnection();
    });

    it('should detect external changes and sync', () => {
      cy.createTestFile('sync-test.md', '# Original');
      
      // Simulate external change
      cy.intercept('GET', '**/webdav/sync-test.md', {
        statusCode: 200,
        body: '# Modified Externally',
        headers: {
          'Last-Modified': new Date(Date.now() + 1000).toUTCString()
        }
      });
      
      // Trigger sync check
      cy.getByDataCy('sync-now').click();
      
      // Should detect change
      cy.getByDataCy('sync-conflict').should('be.visible');
      cy.getByDataCy('conflict-file').should('contain', 'sync-test.md');
      cy.getByDataCy('local-version').should('contain', 'Original');
      cy.getByDataCy('remote-version').should('contain', 'Modified Externally');
      
      // Choose remote version
      cy.getByDataCy('use-remote').click();
      cy.getByDataCy('editor-content').should('contain', 'Modified Externally');
    });

    it('should handle concurrent edits with conflict resolution', () => {
      cy.createTestFile('concurrent.md', '# Base Content');
      cy.getByDataCy('file-concurrent').dblclick();
      
      // Start editing
      cy.typeInEditor('\n\nLocal edit');
      
      // Simulate remote change before save
      cy.intercept('HEAD', '**/webdav/concurrent.md', {
        statusCode: 200,
        headers: {
          'ETag': '"modified-etag"',
          'Last-Modified': new Date(Date.now() + 1000).toUTCString()
        }
      });
      
      // Try to save
      cy.saveFile();
      
      // Should detect conflict
      cy.getByDataCy('save-conflict').should('be.visible');
      cy.getByDataCy('conflict-resolution').should('be.visible');
      
      // Options available
      cy.getByDataCy('overwrite-remote').should('exist');
      cy.getByDataCy('merge-changes').should('exist');
      cy.getByDataCy('discard-local').should('exist');
      
      // Choose merge
      cy.getByDataCy('merge-changes').click();
      cy.getByDataCy('merge-editor').should('be.visible');
      cy.getByDataCy('accept-merge').click();
      
      // Verify merged content saved
      cy.wait('@webdavPut');
      cy.getByDataCy('save-indicator').should('contain', 'Saved');
    });

    it('should queue operations when offline', () => {
      cy.setupWebDAVConnection();
      cy.createTestFile('offline-test.md', '# Initial');
      
      // Go offline
      cy.window().then(win => {
        win.dispatchEvent(new Event('offline'));
      });
      
      cy.getByDataCy('connection-status').should('contain', 'Offline');
      
      // Make changes while offline
      cy.getByDataCy('file-offline-test').dblclick();
      cy.typeInEditor('\n\nOffline edit 1');
      cy.saveFile();
      
      cy.createTestFile('offline-new.md', '# Created offline');
      
      cy.getByDataCy('file-offline-test').rightclick();
      cy.getByDataCy('rename-file').click();
      cy.getByDataCy('new-name-input').clear().type('offline-renamed.md');
      cy.getByDataCy('confirm-rename').click();
      
      // Check operation queue
      cy.getByDataCy('pending-operations').should('be.visible');
      cy.getByDataCy('operation-count').should('contain', '3');
      cy.getByDataCy('view-queue').click();
      cy.getByDataCy('queue-modal').should('be.visible');
      cy.getByDataCy('queue-item-0').should('contain', 'Save: offline-test.md');
      cy.getByDataCy('queue-item-1').should('contain', 'Create: offline-new.md');
      cy.getByDataCy('queue-item-2').should('contain', 'Rename: offline-test.md');
      
      // Go back online
      cy.window().then(win => {
        win.dispatchEvent(new Event('online'));
      });
      
      // Should process queue
      cy.getByDataCy('sync-status').should('contain', 'Syncing');
      cy.wait(['@webdavPut', '@webdavPut', '@webdavMove']);
      cy.getByDataCy('sync-status').should('contain', 'Synced');
      cy.getByDataCy('pending-operations').should('not.exist');
    });

    it('should perform incremental sync for large directories', () => {
      // Mock large directory
      cy.intercept('PROPFIND', '**/webdav/**', {
        statusCode: 207,
        fixture: 'webdav-large-directory.xml'
      }).as('largePropfind');
      
      // Initial load
      cy.getByDataCy('refresh-tree').click();
      cy.wait('@largePropfind');
      
      // Should show progress
      cy.getByDataCy('sync-progress').should('be.visible');
      cy.getByDataCy('sync-progress-bar').should('exist');
      cy.getByDataCy('files-synced').should('exist');
      
      // Subsequent sync should be incremental
      cy.intercept('PROPFIND', '**/webdav/**', (req) => {
        expect(req.headers).to.have.property('if-modified-since');
        req.reply({
          statusCode: 207,
          fixture: 'webdav-incremental-changes.xml'
        });
      }).as('incrementalSync');
      
      cy.getByDataCy('sync-now').click();
      cy.wait('@incrementalSync');
      
      // Only changed files updated
      cy.getByDataCy('sync-summary').should('contain', '2 files updated');
    });
  });

  describe('Permission Handling', () => {
    beforeEach(() => {
      cy.setupWebDAVConnection();
    });

    it('should respect read-only permissions', () => {
      // Mock file with read-only permissions
      cy.intercept('PROPFIND', '**/webdav/readonly.md', {
        statusCode: 207,
        fixture: 'webdav-readonly-file.xml'
      });
      
      cy.intercept('GET', '**/webdav/readonly.md', {
        statusCode: 200,
        body: '# Read Only File'
      });
      
      // Load file
      cy.createTestFile('readonly.md', '# Read Only');
      cy.getByDataCy('file-readonly').should('have.class', 'readonly');
      cy.getByDataCy('file-readonly').find('.lock-icon').should('exist');
      
      // Open file
      cy.getByDataCy('file-readonly').dblclick();
      cy.getByDataCy('editor-readonly-banner').should('be.visible');
      cy.getByDataCy('editor-content').should('have.attr', 'readonly');
      
      // Save button should be disabled
      cy.getByDataCy('save-button').should('be.disabled');
      
      // Context menu should have limited options
      cy.getByDataCy('file-readonly').rightclick();
      cy.getByDataCy('delete-file').should('not.exist');
      cy.getByDataCy('rename-file').should('not.exist');
      cy.getByDataCy('copy-file').should('exist'); // Copy should still work
    });

    it('should handle permission errors gracefully', () => {
      cy.createTestFile('restricted.md', '# Content');
      
      // Simulate permission denied on save
      cy.intercept('PUT', '**/webdav/restricted.md', {
        statusCode: 403,
        body: '<?xml version="1.0"?><d:error xmlns:d="DAV:"><d:message>Permission denied</d:message></d:error>'
      }).as('permissionDenied');
      
      // Try to save
      cy.getByDataCy('file-restricted').dblclick();
      cy.typeInEditor('\n\nNew content');
      cy.saveFile();
      
      cy.wait('@permissionDenied');
      
      // Should show error
      cy.getByDataCy('permission-error').should('be.visible');
      cy.getByDataCy('error-message').should('contain', 'Permission denied');
      cy.getByDataCy('save-as-option').should('be.visible');
      cy.getByDataCy('request-access').should('be.visible');
    });

    it('should detect and display file locks', () => {
      // Mock locked file
      cy.intercept('PROPFIND', '**/webdav/locked.md', {
        statusCode: 207,
        fixture: 'webdav-locked-file.xml'
      });
      
      cy.createTestFile('locked.md', '# Locked');
      
      // Should show lock indicator
      cy.getByDataCy('file-locked').should('have.class', 'locked');
      cy.getByDataCy('file-locked').find('.lock-info').should('exist');
      
      // Hover for lock details
      cy.getByDataCy('file-locked').find('.lock-info').trigger('mouseover');
      cy.getByDataCy('lock-tooltip').should('be.visible');
      cy.getByDataCy('locked-by').should('contain', 'other-user');
      cy.getByDataCy('lock-expires').should('exist');
      
      // Open shows warning
      cy.getByDataCy('file-locked').dblclick();
      cy.getByDataCy('lock-warning').should('be.visible');
      cy.getByDataCy('lock-warning').should('contain', 'locked by other-user');
      cy.getByDataCy('open-readonly').should('exist');
      cy.getByDataCy('request-unlock').should('exist');
    });
  });

  describe('Large File Handling', () => {
    beforeEach(() => {
      cy.setupWebDAVConnection();
    });

    it('should handle large file uploads with progress', () => {
      // Create large file (5MB)
      const largeContent = 'x'.repeat(5 * 1024 * 1024);
      const blob = new Blob([largeContent], { type: 'text/plain' });
      const file = new File([blob], 'large-file.md');
      
      // Upload file
      cy.getByDataCy('file-tree').selectFile(file, { action: 'drag-drop' });
      
      // Should show upload progress
      cy.getByDataCy('upload-progress').should('be.visible');
      cy.getByDataCy('upload-filename').should('contain', 'large-file.md');
      cy.getByDataCy('progress-bar').should('exist');
      cy.getByDataCy('upload-speed').should('exist');
      cy.getByDataCy('time-remaining').should('exist');
      
      // Can cancel upload
      cy.getByDataCy('cancel-upload').should('be.visible');
      
      // Wait for completion
      cy.getByDataCy('upload-complete', { timeout: 30000 }).should('be.visible');
      cy.getByDataCy('file-large-file').should('exist');
    });

    it('should chunk large file downloads', () => {
      // Mock large file
      cy.intercept('HEAD', '**/webdav/huge.md', {
        statusCode: 200,
        headers: {
          'Content-Length': '10485760', // 10MB
          'Accept-Ranges': 'bytes'
        }
      });
      
      // Mock chunked responses
      cy.intercept('GET', '**/webdav/huge.md', (req) => {
        const range = req.headers.range;
        if (range) {
          const [start, end] = range.replace('bytes=', '').split('-').map(Number);
          req.reply({
            statusCode: 206,
            headers: {
              'Content-Range': `bytes ${start}-${end}/10485760`
            },
            body: 'x'.repeat(end - start + 1)
          });
        }
      }).as('chunkedDownload');
      
      // Open large file
      cy.getByDataCy('file-huge').dblclick();
      
      // Should show loading progress
      cy.getByDataCy('loading-progress').should('be.visible');
      cy.getByDataCy('chunks-loaded').should('exist');
      
      // Should make multiple chunk requests
      cy.get('@chunkedDownload.all').should('have.length.greaterThan', 1);
      
      // Eventually loads
      cy.getByDataCy('editor-content', { timeout: 20000 }).should('exist');
    });

    it('should support resumable uploads', () => {
      const largeContent = 'x'.repeat(3 * 1024 * 1024);
      
      // Start upload
      cy.getByDataCy('new-file-button').click();
      cy.getByDataCy('file-name-input').type('resumable.md');
      cy.getByDataCy('create-file').click();
      cy.getByDataCy('file-resumable').dblclick();
      cy.typeInEditor(largeContent);
      cy.saveFile();
      
      // Simulate connection interruption at 50%
      let uploadProgress = 0;
      cy.intercept('PUT', '**/webdav/resumable.md', (req) => {
        uploadProgress += req.body.length;
        if (uploadProgress > 1.5 * 1024 * 1024) {
          req.reply({ statusCode: 0 }); // Connection lost
        } else {
          req.reply({ statusCode: 100 }); // Continue
        }
      }).as('interruptedUpload');
      
      cy.wait('@interruptedUpload');
      
      // Should show resume option
      cy.getByDataCy('upload-interrupted').should('be.visible');
      cy.getByDataCy('resume-upload').should('be.visible');
      cy.getByDataCy('retry-upload').should('be.visible');
      
      // Resume upload
      cy.intercept('PUT', '**/webdav/resumable.md', {
        statusCode: 201
      }).as('resumedUpload');
      
      cy.getByDataCy('resume-upload').click();
      
      // Should send Content-Range header
      cy.wait('@resumedUpload').then((interception) => {
        expect(interception.request.headers).to.have.property('content-range');
      });
      
      cy.getByDataCy('upload-complete').should('be.visible');
    });
  });

  describe('Cache Management', () => {
    beforeEach(() => {
      cy.setupWebDAVConnection();
    });

    it('should cache file contents for offline access', () => {
      // Create and load files
      cy.createTestFile('cached1.md', '# Cached Content 1');
      cy.createTestFile('cached2.md', '# Cached Content 2');
      
      cy.getByDataCy('file-cached1').dblclick();
      cy.getByDataCy('editor-content').should('contain', 'Cached Content 1');
      cy.getByDataCy('file-cached2').dblclick();
      cy.getByDataCy('editor-content').should('contain', 'Cached Content 2');
      
      // Go offline
      cy.window().then(win => {
        win.dispatchEvent(new Event('offline'));
      });
      
      // Should still be able to access cached files
      cy.getByDataCy('file-cached1').dblclick();
      cy.getByDataCy('editor-content').should('contain', 'Cached Content 1');
      cy.getByDataCy('cached-indicator').should('be.visible');
      
      // Can edit cached files offline
      cy.typeInEditor('\n\nOffline edit');
      cy.getByDataCy('offline-save-indicator').should('be.visible');
    });

    it('should manage cache size and eviction', () => {
      // Check cache status
      cy.getByDataCy('settings-button').click();
      cy.getByDataCy('cache-settings').click();
      cy.getByDataCy('cache-size').should('exist');
      cy.getByDataCy('cache-limit').should('contain', '100 MB');
      
      // Create many files to fill cache
      for (let i = 0; i < 20; i++) {
        cy.createTestFile(`file${i}.md`, 'x'.repeat(1024 * 1024)); // 1MB each
      }
      
      // Check cache is managing size
      cy.getByDataCy('cache-size').invoke('text').then((text) => {
        const size = parseFloat(text);
        expect(size).to.be.lessThan(100); // Should not exceed 100MB
      });
      
      // Can manually clear cache
      cy.getByDataCy('clear-cache').click();
      cy.getByDataCy('confirm-clear-cache').click();
      cy.getByDataCy('cache-cleared').should('be.visible');
      cy.getByDataCy('cache-size').should('contain', '0');
    });

    it('should validate cache integrity', () => {
      cy.createTestFile('integrity.md', '# Original Content');
      cy.getByDataCy('file-integrity').dblclick();
      
      // Modify cache directly (simulate corruption)
      cy.window().then(win => {
        const cache = win.localStorage.getItem('fileCache');
        if (cache) {
          const corrupted = cache.replace('Original', 'Corrupted');
          win.localStorage.setItem('fileCache', corrupted);
        }
      });
      
      // Open file again
      cy.getByDataCy('file-integrity').dblclick();
      
      // Should detect corruption and re-fetch
      cy.getByDataCy('cache-invalid').should('be.visible');
      cy.wait('@webdavGet');
      cy.getByDataCy('editor-content').should('contain', 'Original Content');
      cy.getByDataCy('cache-repaired').should('be.visible');
    });
  });

  describe('Batch Operations', () => {
    beforeEach(() => {
      cy.setupWebDAVConnection();
    });

    it('should support batch file operations', () => {
      // Create multiple files
      const files = ['batch1.md', 'batch2.md', 'batch3.md', 'batch4.md'];
      files.forEach(file => cy.createTestFile(file, `# ${file}`));
      
      // Select multiple files
      cy.getByDataCy('file-batch1').click();
      cy.get('body').type('{shift}', { release: false });
      cy.getByDataCy('file-batch4').click();
      cy.get('body').type('{shift}');
      
      // Batch delete
      cy.getByDataCy('selection-count').should('contain', '4 files selected');
      cy.getByDataCy('batch-actions').should('be.visible');
      cy.getByDataCy('batch-delete').click();
      cy.getByDataCy('confirm-batch-delete').click();
      
      // Should batch WebDAV requests
      cy.getByDataCy('batch-progress').should('be.visible');
      cy.wait(['@webdavDelete', '@webdavDelete', '@webdavDelete', '@webdavDelete']);
      
      // All files deleted
      files.forEach(file => {
        cy.getByDataCy(`file-${file.replace('.md', '')}`).should('not.exist');
      });
    });

    it('should support batch download as archive', () => {
      // Create files
      cy.createTestFile('download1.md', '# File 1');
      cy.createTestFile('download2.md', '# File 2');
      cy.createTestFile('download3.md', '# File 3');
      
      // Select files
      cy.selectMultipleFiles(['download1', 'download2', 'download3']);
      
      // Download as archive
      cy.getByDataCy('batch-download').click();
      cy.getByDataCy('archive-format').select('zip');
      cy.getByDataCy('download-archive').click();
      
      // Verify archive creation
      cy.getByDataCy('archive-progress').should('be.visible');
      cy.readFile('cypress/downloads/archive.zip', 'binary').should('exist');
    });

    it('should support batch metadata updates', () => {
      // Create files
      cy.createTestFile('meta1.md', '# File 1');
      cy.createTestFile('meta2.md', '# File 2');
      
      // Select files
      cy.selectMultipleFiles(['meta1', 'meta2']);
      
      // Batch update metadata
      cy.getByDataCy('batch-properties').click();
      cy.getByDataCy('batch-properties-modal').should('be.visible');
      
      // Set properties
      cy.getByDataCy('batch-tag').type('important');
      cy.getByDataCy('batch-author').type('Test User');
      cy.getByDataCy('batch-readonly').check();
      cy.getByDataCy('apply-batch-properties').click();
      
      // Verify PROPPATCH requests
      cy.wait(['@webdavProppatch', '@webdavProppatch']).then((interceptions) => {
        interceptions.forEach(int => {
          expect(int.request.body).to.include('important');
          expect(int.request.body).to.include('Test User');
        });
      });
      
      // Verify UI updated
      cy.getByDataCy('file-meta1').should('have.class', 'readonly');
      cy.getByDataCy('file-meta2').should('have.class', 'readonly');
    });
  });
});