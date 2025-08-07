describe('File Management Workflows', () => {
  beforeEach(() => {
    cy.setupTestEnvironment();
    cy.mockWebDAVServer();
    cy.visit('/');
    cy.configureWebDAV();
    cy.waitForFileTree();
  });

  describe('File Creation and Editing', () => {
    it('creates and edits markdown files', () => {
      // Create a new file
      cy.getByDataCy('file-tree').rightclick();
      cy.getByDataCy('new-file').click();
      cy.getByDataCy('filename-input').type('test-document.md');
      cy.getByDataCy('create-file').click();
      
      // Verify file appears in tree
      cy.getByDataCy('file-test-document-md').should('exist');
      
      // Open the file
      cy.getByDataCy('file-test-document-md').dblclick();
      
      // Edit content
      const content = `# Test Document

## Introduction
This is a test document for the prompt management platform.

### Features
- Markdown editing
- Real-time preview
- Auto-save functionality

\`\`\`javascript
const example = "code block test";
console.log(example);
\`\`\`

**Bold text** and *italic text* test.`;
      
      cy.typeInEditor(content);
      
      // Verify unsaved indicator
      cy.getByDataCy('unsaved-indicator').should('be.visible');
      
      // Save the file
      cy.saveFile();
      
      // Verify saved indicator
      cy.getByDataCy('save-indicator').should('contain', 'Saved');
      cy.getByDataCy('unsaved-indicator').should('not.exist');
    });

    it('handles auto-save functionality', () => {
      cy.createTestFile('auto-save-test.md');
      
      // Type content
      cy.typeInEditor('Initial content');
      
      // Wait for auto-save (based on configured interval)
      cy.wait(5500); // Auto-save interval + buffer
      
      // Verify auto-saved
      cy.getByDataCy('save-indicator').should('contain', 'Auto-saved');
    });

    it('handles large files efficiently', () => {
      // Create large content
      const largeContent = 'Lorem ipsum dolor sit amet. '.repeat(10000);
      
      cy.createTestFile('large-file.md', largeContent);
      
      // Measure load time
      cy.measurePerformance('large-file-load').then((duration) => {
        expect(duration).to.be.lessThan(3000); // Should load within 3 seconds
      });
      
      // Verify editor performance
      cy.typeInEditor('Additional content at the end');
      
      // Verify smooth scrolling
      cy.get('.editor-container').scrollTo('bottom', { duration: 500 });
      cy.get('.editor-container').scrollTo('top', { duration: 500 });
    });
  });

  describe('Folder Operations', () => {
    it('creates nested folder structure', () => {
      // Create parent folder
      cy.getByDataCy('file-tree').rightclick();
      cy.getByDataCy('new-folder').click();
      cy.getByDataCy('folder-name-input').type('Project');
      cy.getByDataCy('create-folder').click();
      
      // Create subfolder
      cy.getByDataCy('folder-Project').rightclick();
      cy.getByDataCy('new-folder').click();
      cy.getByDataCy('folder-name-input').type('Prompts');
      cy.getByDataCy('create-folder').click();
      
      // Create file in subfolder
      cy.getByDataCy('folder-Project-Prompts').rightclick();
      cy.getByDataCy('new-file').click();
      cy.getByDataCy('filename-input').type('assistant.md');
      cy.getByDataCy('create-file').click();
      
      // Verify structure
      cy.getByDataCy('folder-Project').should('exist');
      cy.getByDataCy('folder-Project-Prompts').should('exist');
      cy.getByDataCy('file-assistant-md').should('exist');
    });

    it('handles drag and drop operations', () => {
      // Create folders and files
      cy.createTestFile('source.md');
      cy.getByDataCy('file-tree').rightclick();
      cy.getByDataCy('new-folder').click();
      cy.getByDataCy('folder-name-input').type('Destination');
      cy.getByDataCy('create-folder').click();
      
      // Drag file to folder
      cy.getByDataCy('file-source-md')
        .trigger('dragstart', { dataTransfer: new DataTransfer() });
      
      cy.getByDataCy('folder-Destination')
        .trigger('dragover')
        .trigger('drop');
      
      // Verify file moved
      cy.getByDataCy('folder-Destination').click();
      cy.getByDataCy('file-source-md').should('exist');
    });
  });

  describe('File Renaming and Deletion', () => {
    beforeEach(() => {
      cy.createTestFile('rename-test.md');
    });

    it('renames files successfully', () => {
      cy.getByDataCy('file-rename-test-md').rightclick();
      cy.getByDataCy('rename-file').click();
      
      cy.getByDataCy('rename-input').clear().type('renamed-file.md');
      cy.get('body').type('{enter}');
      
      // Verify rename
      cy.getByDataCy('file-renamed-file-md').should('exist');
      cy.getByDataCy('file-rename-test-md').should('not.exist');
    });

    it('deletes files with confirmation', () => {
      cy.getByDataCy('file-rename-test-md').rightclick();
      cy.getByDataCy('delete-file').click();
      
      // Confirm deletion
      cy.getByDataCy('confirm-delete').should('be.visible');
      cy.getByDataCy('confirm-delete-yes').click();
      
      // Verify deletion
      cy.getByDataCy('file-rename-test-md').should('not.exist');
    });

    it('handles batch operations', () => {
      // Create multiple files
      cy.createTestFile('file1.md');
      cy.createTestFile('file2.md');
      cy.createTestFile('file3.md');
      
      // Select multiple files
      cy.getByDataCy('file-file1-md').click();
      cy.get('body').type('{ctrl}', { release: false });
      cy.getByDataCy('file-file2-md').click();
      cy.getByDataCy('file-file3-md').click();
      cy.get('body').type('{ctrl}', { release: true });
      
      // Batch delete
      cy.get('body').type('{del}');
      cy.getByDataCy('confirm-batch-delete').should('be.visible');
      cy.getByDataCy('confirm-batch-delete-yes').click();
      
      // Verify all deleted
      cy.getByDataCy('file-file1-md').should('not.exist');
      cy.getByDataCy('file-file2-md').should('not.exist');
      cy.getByDataCy('file-file3-md').should('not.exist');
    });
  });

  describe('Search and Filter', () => {
    beforeEach(() => {
      // Create test structure
      cy.createTestFile('api-prompt.md');
      cy.createTestFile('ui-prompt.md');
      cy.createTestFile('database-query.sql');
      cy.createTestFile('README.md');
    });

    it('searches files by name', () => {
      cy.getByDataCy('search-input').type('prompt');
      
      // Verify filtered results
      cy.getByDataCy('file-api-prompt-md').should('be.visible');
      cy.getByDataCy('file-ui-prompt-md').should('be.visible');
      cy.getByDataCy('file-database-query-sql').should('not.exist');
      cy.getByDataCy('file-README-md').should('not.exist');
    });

    it('filters by file type', () => {
      cy.getByDataCy('filter-dropdown').click();
      cy.getByDataCy('filter-markdown').click();
      
      // Verify only markdown files shown
      cy.getByDataCy('file-api-prompt-md').should('be.visible');
      cy.getByDataCy('file-ui-prompt-md').should('be.visible');
      cy.getByDataCy('file-README-md').should('be.visible');
      cy.getByDataCy('file-database-query-sql').should('not.exist');
    });
  });
});