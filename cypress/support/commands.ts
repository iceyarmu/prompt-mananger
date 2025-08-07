/// <reference types="cypress" />
/// <reference types="@percy/cypress" />
/// <reference types="cypress-axe" />
/// <reference types="cypress-real-events" />

// Custom commands for testing

declare namespace Cypress {
  interface Chainable {
    /**
     * Set up the test environment with mock data
     */
    setupTestEnvironment(): Chainable<void>;
    
    /**
     * Mock WebDAV server responses
     */
    mockWebDAVServer(): Chainable<void>;
    
    /**
     * Set up basic file structure for testing
     */
    setupBasicFile(): Chainable<void>;
    
    /**
     * Login with test credentials
     */
    login(username?: string, password?: string): Chainable<void>;
    
    /**
     * Configure WebDAV connection
     */
    configureWebDAV(url?: string, username?: string, password?: string): Chainable<void>;
    
    /**
     * Create a test file in the file tree
     */
    createTestFile(path: string, content?: string): Chainable<void>;
    
    /**
     * Open file in editor
     */
    openFile(filename: string): Chainable<void>;
    
    /**
     * Save current file
     */
    saveFile(): Chainable<void>;
    
    /**
     * Test accessibility
     */
    checkA11y(context?: string, options?: any): Chainable<void>;
    
    /**
     * Measure performance
     */
    measurePerformance(name: string): Chainable<number>;
    
    /**
     * Wait for file tree to load
     */
    waitForFileTree(): Chainable<void>;
    
    /**
     * Type in markdown editor
     */
    typeInEditor(content: string): Chainable<void>;
    
    /**
     * Get by data-cy attribute
     */
    getByDataCy(value: string): Chainable<JQuery<HTMLElement>>;
  }
}

// Setup test environment
Cypress.Commands.add('setupTestEnvironment', () => {
  cy.log('Setting up test environment');
  
  // Clear all storage
  cy.clearLocalStorage();
  cy.clearCookies();
  
  // Set up default preferences
  cy.window().then((win) => {
    win.localStorage.setItem('preferences', JSON.stringify({
      theme: 'light',
      language: 'en-US',
      autoSave: true,
      autoSaveInterval: 5000
    }));
  });
});

// Mock WebDAV server
Cypress.Commands.add('mockWebDAVServer', () => {
  cy.log('Mocking WebDAV server');
  
  // Mock PROPFIND for directory listing
  cy.intercept('PROPFIND', '**/webdav/**', {
    statusCode: 207,
    body: `<?xml version="1.0" encoding="utf-8"?>
      <d:multistatus xmlns:d="DAV:">
        <d:response>
          <d:href>/webdav/</d:href>
          <d:propstat>
            <d:prop>
              <d:resourcetype><d:collection/></d:resourcetype>
            </d:prop>
            <d:status>HTTP/1.1 200 OK</d:status>
          </d:propstat>
        </d:response>
        <d:response>
          <d:href>/webdav/test-folder/</d:href>
          <d:propstat>
            <d:prop>
              <d:resourcetype><d:collection/></d:resourcetype>
            </d:prop>
            <d:status>HTTP/1.1 200 OK</d:status>
          </d:propstat>
        </d:response>
        <d:response>
          <d:href>/webdav/test.md</d:href>
          <d:propstat>
            <d:prop>
              <d:resourcetype/>
              <d:getcontentlength>100</d:getcontentlength>
              <d:getlastmodified>Wed, 01 Jan 2025 00:00:00 GMT</d:getlastmodified>
            </d:prop>
            <d:status>HTTP/1.1 200 OK</d:status>
          </d:propstat>
        </d:response>
      </d:multistatus>`,
    headers: {
      'content-type': 'application/xml'
    }
  }).as('webdavPropfind');
  
  // Mock GET for file content
  cy.intercept('GET', '**/webdav/**.md', {
    statusCode: 200,
    body: '# Test File\n\nThis is test content for the markdown editor.'
  }).as('webdavGet');
  
  // Mock PUT for file save
  cy.intercept('PUT', '**/webdav/**', {
    statusCode: 201
  }).as('webdavPut');
  
  // Mock MKCOL for directory creation
  cy.intercept('MKCOL', '**/webdav/**', {
    statusCode: 201
  }).as('webdavMkcol');
  
  // Mock DELETE
  cy.intercept('DELETE', '**/webdav/**', {
    statusCode: 204
  }).as('webdavDelete');
  
  // Mock OPTIONS for CORS
  cy.intercept('OPTIONS', '**/webdav/**', {
    statusCode: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, PUT, POST, DELETE, PROPFIND, MKCOL, COPY, MOVE, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, Depth'
    }
  }).as('webdavOptions');
});

// Configure WebDAV connection
Cypress.Commands.add('configureWebDAV', (
  url = 'http://localhost:8080/webdav',
  username = 'testuser',
  password = 'testpass'
) => {
  cy.log('Configuring WebDAV connection');
  
  cy.getByDataCy('config-button').click();
  cy.getByDataCy('webdav-url').clear().type(url);
  cy.getByDataCy('webdav-username').clear().type(username);
  cy.getByDataCy('webdav-password').clear().type(password);
  cy.getByDataCy('test-connection').click();
  cy.getByDataCy('connection-success').should('be.visible');
  cy.getByDataCy('save-config').click();
});

// Create test file
Cypress.Commands.add('createTestFile', (path: string, content = '# Test\n\nTest content') => {
  cy.log(`Creating test file: ${path}`);
  
  const parts = path.split('/');
  const filename = parts.pop();
  const folder = parts.join('/');
  
  if (folder) {
    cy.getByDataCy(`folder-${folder}`).rightclick();
  } else {
    cy.getByDataCy('file-tree').rightclick();
  }
  
  cy.getByDataCy('context-menu').should('be.visible');
  cy.getByDataCy('new-file').click();
  cy.getByDataCy('filename-input').type(filename);
  cy.getByDataCy('create-file').click();
  
  if (content) {
    cy.getByDataCy('editor-textarea').clear().type(content);
    cy.saveFile();
  }
});

// Open file
Cypress.Commands.add('openFile', (filename: string) => {
  cy.log(`Opening file: ${filename}`);
  cy.getByDataCy(`file-${filename.replace('.', '-')}`).dblclick();
  cy.getByDataCy('markdown-editor').should('be.visible');
});

// Save file
Cypress.Commands.add('saveFile', () => {
  cy.log('Saving file');
  cy.get('body').type('{ctrl}s');
  cy.getByDataCy('save-indicator').should('contain', 'Saved');
});

// Setup basic file
Cypress.Commands.add('setupBasicFile', () => {
  cy.log('Setting up basic file structure');
  cy.createTestFile('test.md', '# Test Prompt\n\nThis is a test prompt for optimization.');
});

// Type in editor
Cypress.Commands.add('typeInEditor', (content: string) => {
  cy.getByDataCy('editor-textarea').clear().type(content);
});

// Wait for file tree
Cypress.Commands.add('waitForFileTree', () => {
  cy.log('Waiting for file tree to load');
  cy.getByDataCy('file-tree', { timeout: 10000 }).should('be.visible');
  cy.getByDataCy('connection-status').should('contain', 'Connected');
});

// Get by data-cy
Cypress.Commands.add('getByDataCy', (value: string) => {
  return cy.get(`[data-cy="${value}"]`);
});

// Check accessibility
Cypress.Commands.add('checkA11y', (context?: string, options?: any) => {
  cy.injectAxe();
  
  if (context) {
    cy.checkA11y(context, options);
  } else {
    cy.checkA11y(null, options);
  }
});

// Measure performance
Cypress.Commands.add('measurePerformance', (name: string) => {
  cy.window().then((win) => {
    win.performance.mark(`${name}-start`);
    
    return cy.wrap(null).then(() => {
      win.performance.mark(`${name}-end`);
      win.performance.measure(name, `${name}-start`, `${name}-end`);
      
      const measure = win.performance.getEntriesByName(name)[0];
      cy.log(`Performance: ${name} took ${measure.duration.toFixed(2)}ms`);
      
      return measure.duration;
    });
  });
});

export {};