describe('Prompt Management Platform - Complete Workflow', () => {
  beforeEach(() => {
    cy.setupTestEnvironment();
    cy.mockWebDAVServer();
    cy.clearLocalStorage();
  });
  
  it('completes full prompt lifecycle from setup to execution', () => {
    // 1. Initial setup and WebDAV configuration
    cy.visit('/');
    cy.getByDataCy('config-button').should('be.visible').click();
    
    cy.getByDataCy('webdav-url').type('https://test.webdav.com');
    cy.getByDataCy('webdav-username').type('testuser');
    cy.getByDataCy('webdav-password').type('testpass');
    
    cy.getByDataCy('test-connection').click();
    cy.getByDataCy('connection-success').should('be.visible');
    cy.getByDataCy('save-config').click();
    
    // 2. File tree operations
    cy.getByDataCy('file-tree').should('be.visible');
    cy.getByDataCy('connection-status').should('contain', 'Connected');
    
    // Create new folder
    cy.getByDataCy('file-tree').rightclick();
    cy.getByDataCy('context-menu').should('be.visible');
    cy.getByDataCy('new-folder').click();
    
    cy.getByDataCy('folder-name-input').type('Test Project');
    cy.getByDataCy('create-folder').click();
    
    // Create new prompt file
    cy.getByDataCy('folder-Test-Project').rightclick();
    cy.getByDataCy('new-file').click();
    
    cy.getByDataCy('filename-input').type('my-test-prompt');
    cy.getByDataCy('create-file').click();
    
    // 3. File editing workflow
    cy.getByDataCy('file-my-test-prompt').dblclick();
    cy.getByDataCy('markdown-editor').should('be.visible');
    
    const promptContent = `# AI Assistant Prompt
    
Please act as a helpful AI assistant that provides detailed and accurate responses.

## Guidelines
- Be concise but thorough
- Use examples when helpful  
- Ask clarifying questions when needed

## Context
This is a test prompt for the new prompt management system.`;
    
    cy.getByDataCy('editor-textarea').clear().type(promptContent);
    cy.getByDataCy('unsaved-indicator').should('be.visible');
    
    // 4. Save functionality
    cy.get('body').type('{ctrl}s');
    cy.getByDataCy('save-indicator').should('contain', 'Saved');
    cy.getByDataCy('unsaved-indicator').should('not.exist');
    
    // 5. Preview functionality
    cy.getByDataCy('preview-button').click();
    cy.getByDataCy('preview-content').should('contain', 'AI Assistant Prompt');
    cy.getByDataCy('edit-button').click();
    
    // 6. Optimization workflow
    cy.getByDataCy('optimize-button').click();
    cy.getByDataCy('optimization-modal').should('be.visible');
    cy.getByDataCy('optimization-loading').should('be.visible');
    
    cy.wait('@optimizePrompt');
    cy.getByDataCy('optimization-results').should('be.visible');
    cy.getByDataCy('original-content').should('contain', 'AI Assistant Prompt');
    cy.getByDataCy('optimized-content').should('be.visible');
    
    cy.getByDataCy('diff-view').click();
    cy.getByDataCy('diff-display').should('be.visible');
    
    cy.getByDataCy('apply-optimization').click();
    cy.getByDataCy('optimization-applied').should('be.visible');
    
    // 7. Prompt execution workflow
    cy.getByDataCy('model-selector').click();
    cy.getByDataCy('model-gpt-3.5-turbo').click();
    
    cy.getByDataCy('execute-button').click();
    cy.getByDataCy('execution-loading').should('be.visible');
    
    cy.wait('@executePrompt');
    cy.getByDataCy('execution-results').should('be.visible');
    cy.getByDataCy('result-content').should('not.be.empty');
    cy.getByDataCy('token-usage').should('be.visible');
    cy.getByDataCy('execution-time').should('be.visible');
    
    // 8. Results management
    cy.getByDataCy('copy-result').click();
    cy.getByDataCy('copy-notification').should('contain', 'Copied');
    
    cy.getByDataCy('export-result').click();
    cy.readFile('cypress/downloads/execution-result.json').should('exist');
    
    // 9. File management operations
    cy.getByDataCy('file-my-test-prompt').rightclick();
    cy.getByDataCy('rename-file').click();
    
    cy.getByDataCy('rename-input').clear().type('optimized-assistant-prompt');
    cy.get('body').type('{enter}');
    
    cy.getByDataCy('file-optimized-assistant-prompt').should('exist');
    
    // 10. Cleanup and verification
    cy.getByDataCy('refresh-tree').click();
    cy.getByDataCy('file-optimized-assistant-prompt').should('exist');
    cy.getByDataCy('folder-Test-Project').should('exist');
  });
  
  it('handles error scenarios gracefully', () => {
    // Network failure scenarios
    cy.intercept('PUT', '**/webdav/**', { forceNetworkError: true });
    
    cy.visit('/');
    cy.setupBasicFile();
    
    cy.getByDataCy('save-button').click();
    cy.getByDataCy('error-notification').should('contain', 'Network error');
    cy.getByDataCy('retry-button').should('be.visible');
    
    // Invalid file operations
    cy.getByDataCy('file-tree').rightclick();
    cy.getByDataCy('new-file').click();
    cy.getByDataCy('filename-input').type('invalid/filename');
    cy.getByDataCy('create-file').click();
    
    cy.getByDataCy('validation-error').should('contain', 'Invalid filename');
  });
});