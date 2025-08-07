describe('WebDAV Integration', () => {
  beforeEach(() => {
    cy.setupTestEnvironment();
    cy.visit('/');
  });

  describe('WebDAV Connection Setup', () => {
    it('connects to WebDAV server successfully', () => {
      cy.mockWebDAVServer();
      
      // Open configuration
      cy.getByDataCy('config-button').click();
      cy.getByDataCy('webdav-config-modal').should('be.visible');
      
      // Enter credentials
      cy.getByDataCy('webdav-url').type('http://localhost:8080/webdav');
      cy.getByDataCy('webdav-username').type('testuser');
      cy.getByDataCy('webdav-password').type('testpass');
      
      // Test connection
      cy.getByDataCy('test-connection').click();
      cy.getByDataCy('testing-connection').should('be.visible');
      
      // Verify success
      cy.getByDataCy('connection-success').should('be.visible');
      cy.getByDataCy('connection-success').should('contain', 'Connected successfully');
      
      // Save configuration
      cy.getByDataCy('save-config').click();
      cy.getByDataCy('config-saved').should('be.visible');
      
      // Verify connection status in UI
      cy.getByDataCy('connection-status').should('contain', 'Connected');
      cy.getByDataCy('connection-indicator').should('have.class', 'connected');
    });

    it('handles connection failure gracefully', () => {
      // Mock failed connection
      cy.intercept('PROPFIND', '**/webdav/**', {
        statusCode: 401,
        body: 'Unauthorized'
      }).as('failedConnection');
      
      cy.getByDataCy('config-button').click();
      
      // Enter invalid credentials
      cy.getByDataCy('webdav-url').type('http://localhost:8080/webdav');
      cy.getByDataCy('webdav-username').type('invaliduser');
      cy.getByDataCy('webdav-password').type('wrongpass');
      
      // Test connection
      cy.getByDataCy('test-connection').click();
      
      // Wait for failure
      cy.wait('@failedConnection');
      
      // Verify error handling
      cy.getByDataCy('connection-error').should('be.visible');
      cy.getByDataCy('connection-error').should('contain', 'Authentication failed');
      cy.getByDataCy('error-details').should('contain', '401');
    });

    it('validates WebDAV URL format', () => {
      cy.getByDataCy('config-button').click();
      
      // Test invalid URLs
      const invalidUrls = [
        'not-a-url',
        'ftp://wrong-protocol.com',
        'http://',
        'just-text'
      ];
      
      invalidUrls.forEach(url => {
        cy.getByDataCy('webdav-url').clear().type(url);
        cy.getByDataCy('test-connection').click();
        cy.getByDataCy('url-validation-error').should('be.visible');
        cy.getByDataCy('url-validation-error').should('contain', 'Invalid URL');
      });
      
      // Test valid URLs
      const validUrls = [
        'http://localhost:8080/webdav',
        'https://secure.webdav.com/files',
        'http://192.168.1.1:5000/dav'
      ];
      
      cy.mockWebDAVServer();
      
      validUrls.forEach(url => {
        cy.getByDataCy('webdav-url').clear().type(url);
        cy.getByDataCy('url-validation-error').should('not.exist');
      });
    });

    it('stores credentials securely', () => {
      cy.mockWebDAVServer();
      
      // Configure WebDAV
      cy.configureWebDAV('http://localhost:8080/webdav', 'testuser', 'testpass');
      
      // Reload page
      cy.reload();
      
      // Open config again
      cy.getByDataCy('config-button').click();
      
      // Verify URL is preserved but password is not shown
      cy.getByDataCy('webdav-url').should('have.value', 'http://localhost:8080/webdav');
      cy.getByDataCy('webdav-username').should('have.value', 'testuser');
      cy.getByDataCy('webdav-password').should('have.value', '');
      cy.getByDataCy('webdav-password').should('have.attr', 'placeholder', '••••••••');
    });
  });

  describe('WebDAV File Operations', () => {
    beforeEach(() => {
      cy.mockWebDAVServer();
      cy.configureWebDAV();
      cy.waitForFileTree();
    });

    it('lists files and directories from WebDAV', () => {
      // Verify file tree populated
      cy.getByDataCy('file-tree').should('be.visible');
      
      // Check for expected items from mock
      cy.getByDataCy('folder-test-folder').should('exist');
      cy.getByDataCy('file-test-md').should('exist');
      
      // Expand folder
      cy.getByDataCy('folder-test-folder').find('.expand-icon').click();
      
      // Wait for subfolder content
      cy.wait('@webdavPropfind');
      
      // Verify subfolder contents loaded
      cy.getByDataCy('folder-test-folder').should('have.class', 'expanded');
    });

    it('creates new file on WebDAV', () => {
      // Create file
      cy.getByDataCy('file-tree').rightclick();
      cy.getByDataCy('new-file').click();
      cy.getByDataCy('filename-input').type('new-document.md');
      cy.getByDataCy('create-file').click();
      
      // Wait for WebDAV PUT
      cy.wait('@webdavPut');
      
      // Verify file created
      cy.getByDataCy('file-new-document-md').should('exist');
      
      // Open and edit
      cy.getByDataCy('file-new-document-md').dblclick();
      cy.typeInEditor('# New Document\n\nContent for WebDAV');
      
      // Save
      cy.saveFile();
      
      // Wait for WebDAV save
      cy.wait('@webdavPut');
      
      // Verify save indicator
      cy.getByDataCy('save-indicator').should('contain', 'Saved to WebDAV');
    });

    it('reads file content from WebDAV', () => {
      // Open existing file
      cy.getByDataCy('file-test-md').dblclick();
      
      // Wait for content load
      cy.wait('@webdavGet');
      
      // Verify content loaded
      cy.getByDataCy('editor-textarea').should('contain', 'Test File');
      cy.getByDataCy('editor-textarea').should('contain', 'This is test content');
    });

    it('updates existing file on WebDAV', () => {
      // Open file
      cy.getByDataCy('file-test-md').dblclick();
      cy.wait('@webdavGet');
      
      // Modify content
      cy.getByDataCy('editor-textarea').clear();
      cy.typeInEditor('# Updated Content\n\nThis has been modified');
      
      // Save
      cy.saveFile();
      
      // Wait for WebDAV update
      cy.wait('@webdavPut');
      
      // Verify update successful
      cy.getByDataCy('save-indicator').should('contain', 'Updated on WebDAV');
    });

    it('deletes file from WebDAV', () => {
      // Delete file
      cy.getByDataCy('file-test-md').rightclick();
      cy.getByDataCy('delete-file').click();
      
      // Confirm deletion
      cy.getByDataCy('confirm-delete').should('be.visible');
      cy.getByDataCy('confirm-delete-yes').click();
      
      // Wait for WebDAV delete
      cy.wait('@webdavDelete');
      
      // Verify file removed
      cy.getByDataCy('file-test-md').should('not.exist');
      cy.getByDataCy('deletion-success').should('be.visible');
    });

    it('creates directory on WebDAV', () => {
      // Create folder
      cy.getByDataCy('file-tree').rightclick();
      cy.getByDataCy('new-folder').click();
      cy.getByDataCy('folder-name-input').type('NewFolder');
      cy.getByDataCy('create-folder').click();
      
      // Wait for WebDAV MKCOL
      cy.wait('@webdavMkcol');
      
      // Verify folder created
      cy.getByDataCy('folder-NewFolder').should('exist');
    });

    it('moves files between directories', () => {
      // Create destination folder
      cy.getByDataCy('file-tree').rightclick();
      cy.getByDataCy('new-folder').click();
      cy.getByDataCy('folder-name-input').type('Destination');
      cy.getByDataCy('create-folder').click();
      cy.wait('@webdavMkcol');
      
      // Mock MOVE operation
      cy.intercept('MOVE', '**/webdav/**', {
        statusCode: 201
      }).as('webdavMove');
      
      // Drag and drop file
      cy.getByDataCy('file-test-md')
        .trigger('dragstart', { dataTransfer: new DataTransfer() });
      
      cy.getByDataCy('folder-Destination')
        .trigger('dragover')
        .trigger('drop');
      
      // Wait for WebDAV move
      cy.wait('@webdavMove');
      
      // Verify file moved
      cy.getByDataCy('folder-Destination').click();
      cy.getByDataCy('file-test-md').should('exist');
    });

    it('copies files on WebDAV', () => {
      // Mock COPY operation
      cy.intercept('COPY', '**/webdav/**', {
        statusCode: 201
      }).as('webdavCopy');
      
      // Copy file
      cy.getByDataCy('file-test-md').rightclick();
      cy.getByDataCy('copy-file').click();
      
      // Paste in tree
      cy.getByDataCy('file-tree').rightclick();
      cy.getByDataCy('paste-file').click();
      
      // Wait for WebDAV copy
      cy.wait('@webdavCopy');
      
      // Verify file copied
      cy.getByDataCy('file-test-copy-md').should('exist');
    });
  });

  describe('WebDAV Error Handling', () => {
    beforeEach(() => {
      cy.mockWebDAVServer();
      cy.configureWebDAV();
      cy.waitForFileTree();
    });

    it('handles network interruptions', () => {
      // Start editing
      cy.createTestFile('network-test.md', 'Initial content');
      cy.openFile('network-test.md');
      
      // Simulate network failure
      cy.intercept('PUT', '**/webdav/**', { forceNetworkError: true }).as('networkError');
      
      // Try to save
      cy.typeInEditor('Modified content');
      cy.saveFile();
      
      // Wait for error
      cy.wait('@networkError');
      
      // Verify error handling
      cy.getByDataCy('save-error').should('be.visible');
      cy.getByDataCy('save-error').should('contain', 'Network error');
      
      // Check retry option
      cy.getByDataCy('retry-save').should('be.visible');
      
      // Mock successful retry
      cy.intercept('PUT', '**/webdav/**', { statusCode: 201 }).as('retrySuccess');
      
      // Retry save
      cy.getByDataCy('retry-save').click();
      cy.wait('@retrySuccess');
      
      // Verify success
      cy.getByDataCy('save-indicator').should('contain', 'Saved');
    });

    it('handles concurrent modifications', () => {
      // Open file in editor
      cy.getByDataCy('file-test-md').dblclick();
      cy.wait('@webdavGet');
      
      // Simulate concurrent modification (412 Precondition Failed)
      cy.intercept('PUT', '**/webdav/**', {
        statusCode: 412,
        body: 'Resource has been modified'
      }).as('conflictError');
      
      // Try to save
      cy.typeInEditor('My changes');
      cy.saveFile();
      
      // Wait for conflict
      cy.wait('@conflictError');
      
      // Verify conflict resolution dialog
      cy.getByDataCy('conflict-dialog').should('be.visible');
      cy.getByDataCy('conflict-message').should('contain', 'has been modified');
      
      // Options for resolution
      cy.getByDataCy('merge-changes').should('be.visible');
      cy.getByDataCy('overwrite-remote').should('be.visible');
      cy.getByDataCy('discard-local').should('be.visible');
      
      // Choose to merge
      cy.getByDataCy('merge-changes').click();
      
      // Verify merge view
      cy.getByDataCy('merge-editor').should('be.visible');
      cy.getByDataCy('local-changes').should('be.visible');
      cy.getByDataCy('remote-changes').should('be.visible');
    });

    it('handles quota exceeded errors', () => {
      // Mock quota exceeded error
      cy.intercept('PUT', '**/webdav/**', {
        statusCode: 507,
        body: 'Insufficient Storage'
      }).as('quotaError');
      
      // Try to save large file
      const largeContent = 'x'.repeat(10000000); // 10MB of content
      cy.createTestFile('large-file.md', largeContent);
      
      // Wait for quota error
      cy.wait('@quotaError');
      
      // Verify quota error handling
      cy.getByDataCy('quota-error').should('be.visible');
      cy.getByDataCy('quota-error').should('contain', 'Storage quota exceeded');
      cy.getByDataCy('storage-info').should('be.visible');
    });

    it('handles permission errors', () => {
      // Mock permission denied
      cy.intercept('PUT', '**/webdav/**', {
        statusCode: 403,
        body: 'Forbidden'
      }).as('permissionError');
      
      // Try to save to read-only file
      cy.createTestFile('readonly.md', 'Protected content');
      cy.openFile('readonly.md');
      cy.typeInEditor('Trying to modify');
      cy.saveFile();
      
      // Wait for permission error
      cy.wait('@permissionError');
      
      // Verify permission error handling
      cy.getByDataCy('permission-error').should('be.visible');
      cy.getByDataCy('permission-error').should('contain', 'Permission denied');
      cy.getByDataCy('save-as-option').should('be.visible');
    });

    it('handles session timeout', () => {
      // Simulate session timeout
      cy.intercept('PROPFIND', '**/webdav/**', {
        statusCode: 401,
        body: 'Session expired'
      }).as('sessionTimeout');
      
      // Trigger file tree refresh
      cy.getByDataCy('refresh-tree').click();
      
      // Wait for timeout error
      cy.wait('@sessionTimeout');
      
      // Verify re-authentication prompt
      cy.getByDataCy('session-expired').should('be.visible');
      cy.getByDataCy('reauth-button').should('be.visible');
      
      // Click re-authenticate
      cy.getByDataCy('reauth-button').click();
      
      // Verify config modal opens with message
      cy.getByDataCy('webdav-config-modal').should('be.visible');
      cy.getByDataCy('session-expired-message').should('be.visible');
    });
  });

  describe('WebDAV Performance', () => {
    beforeEach(() => {
      cy.mockWebDAVServer();
      cy.configureWebDAV();
    });

    it('handles large directory listings efficiently', () => {
      // Mock large directory response
      const largeDirectory = Array.from({ length: 1000 }, (_, i) => `
        <d:response>
          <d:href>/webdav/file${i}.md</d:href>
          <d:propstat>
            <d:prop>
              <d:resourcetype/>
              <d:getcontentlength>1000</d:getcontentlength>
            </d:prop>
            <d:status>HTTP/1.1 200 OK</d:status>
          </d:propstat>
        </d:response>
      `).join('');
      
      cy.intercept('PROPFIND', '**/webdav/**', {
        statusCode: 207,
        body: `<?xml version="1.0"?>
          <d:multistatus xmlns:d="DAV:">
            ${largeDirectory}
          </d:multistatus>`
      }).as('largeListing');
      
      // Measure load time
      cy.measurePerformance('large-directory-load').then(() => {
        cy.waitForFileTree();
      });
      
      // Wait for listing
      cy.wait('@largeListing');
      
      // Verify performance
      cy.get('@large-directory-load.duration').should('be.lessThan', 5000);
      
      // Verify virtual scrolling
      cy.getByDataCy('file-tree-viewport').should('exist');
      cy.getByDataCy('virtual-scroll-container').should('exist');
    });

    it('implements efficient file caching', () => {
      // Open file first time
      cy.getByDataCy('file-test-md').dblclick();
      cy.wait('@webdavGet').as('firstLoad');
      
      // Close file
      cy.getByDataCy('close-editor').click();
      
      // Open same file again
      cy.getByDataCy('file-test-md').dblclick();
      
      // Should not make another request (cached)
      cy.get('@webdavGet.all').should('have.length', 1);
      
      // Verify content loaded from cache
      cy.getByDataCy('cache-indicator').should('be.visible');
      cy.getByDataCy('editor-textarea').should('contain', 'Test File');
    });

    it('handles parallel file operations', () => {
      // Create multiple files simultaneously
      const filePromises = [];
      
      for (let i = 0; i < 5; i++) {
        cy.getByDataCy('file-tree').rightclick();
        cy.getByDataCy('new-file').click();
        cy.getByDataCy('filename-input').type(`parallel-${i}.md`);
        cy.getByDataCy('create-file').click();
        filePromises.push(`@webdavPut`);
      }
      
      // Wait for all operations
      cy.wait(filePromises);
      
      // Verify all files created
      for (let i = 0; i < 5; i++) {
        cy.getByDataCy(`file-parallel-${i}-md`).should('exist');
      }
    });
  });
});