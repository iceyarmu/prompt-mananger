describe('Visual Regression Testing', () => {
  beforeEach(() => {
    cy.setupTestEnvironment();
    cy.mockWebDAVServer();
    cy.visit('/');
    
    // Wait for fonts and images to load
    cy.document().its('fonts.ready').should('be.true');
    cy.wait(500); // Additional wait for animations to complete
  });

  describe('Component Visual Tests', () => {
    it('captures file tree appearance', () => {
      cy.configureWebDAV();
      cy.waitForFileTree();
      
      // Create test structure
      cy.createTestFile('test1.md');
      cy.createTestFile('test2.md');
      cy.getByDataCy('file-tree').rightclick();
      cy.getByDataCy('new-folder').click();
      cy.getByDataCy('folder-name-input').type('TestFolder');
      cy.getByDataCy('create-folder').click();
      
      // Capture file tree
      cy.getByDataCy('file-tree').percySnapshot('File Tree - Default');
      
      // Test expanded state
      cy.getByDataCy('folder-TestFolder').find('.expand-icon').click();
      cy.getByDataCy('file-tree').percySnapshot('File Tree - Expanded');
      
      // Test selected state
      cy.getByDataCy('file-test1-md').click();
      cy.getByDataCy('file-tree').percySnapshot('File Tree - Selected');
      
      // Test hover state
      cy.getByDataCy('file-test2-md').realHover();
      cy.getByDataCy('file-tree').percySnapshot('File Tree - Hover');
    });

    it('captures markdown editor appearance', () => {
      const content = `# Markdown Editor Visual Test

## Headers
### H3 Header
#### H4 Header

## Text Formatting
**Bold text** and *italic text* and ***bold italic***
~~Strikethrough~~ and \`inline code\`

## Lists
- Unordered item 1
- Unordered item 2
  - Nested item

1. Ordered item 1
2. Ordered item 2
   1. Nested ordered

## Code Block
\`\`\`javascript
const example = {
  name: 'Visual Test',
  type: 'regression',
  status: 'active'
};

function testFunction(param) {
  return param * 2;
}
\`\`\`

## Blockquote
> This is a blockquote
> with multiple lines

## Table
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |

## Links and Images
[Link text](https://example.com)
![Alt text](image.png)`;

      cy.createTestFile('visual-test.md', content);
      cy.openFile('visual-test.md');
      
      // Capture editor with content
      cy.getByDataCy('markdown-editor').percySnapshot('Markdown Editor - With Content');
      
      // Test preview mode
      cy.getByDataCy('preview-button').click();
      cy.getByDataCy('preview-panel').percySnapshot('Markdown Preview');
      
      // Test split view
      cy.getByDataCy('split-view-button').click();
      cy.getByDataCy('editor-container').percySnapshot('Split View - Editor and Preview');
      
      // Test with line numbers
      cy.getByDataCy('toggle-line-numbers').click();
      cy.getByDataCy('markdown-editor').percySnapshot('Editor - With Line Numbers');
      
      // Test with syntax highlighting
      cy.getByDataCy('editor-textarea').percySnapshot('Editor - Syntax Highlighting');
    });

    it('captures optimization modal states', () => {
      cy.createTestFile('optimize-visual.md', 'Test prompt for optimization');
      cy.openFile('optimize-visual.md');
      
      // Open optimization modal
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('optimization-modal').percySnapshot('Optimization Modal - Mode Selection');
      
      // Select mode and start
      cy.getByDataCy('mode-general').click();
      cy.getByDataCy('start-optimization').click();
      
      // Capture loading state
      cy.getByDataCy('optimization-loading').percySnapshot('Optimization - Loading State');
      
      // Wait for results
      cy.wait('@optimizePrompt');
      
      // Capture results
      cy.getByDataCy('optimization-results').percySnapshot('Optimization - Results View');
      
      // Switch to diff view
      cy.getByDataCy('view-diff').click();
      cy.getByDataCy('diff-viewer').percySnapshot('Optimization - Diff View');
      
      // Capture improvement metrics
      cy.getByDataCy('improvement-metrics').percySnapshot('Optimization - Metrics');
    });

    it('captures theme variations', () => {
      // Light theme (default)
      cy.percySnapshot('App - Light Theme');
      
      // Components in light theme
      cy.getByDataCy('file-tree').percySnapshot('File Tree - Light Theme');
      cy.createTestFile('theme-test.md', '# Theme Test');
      cy.openFile('theme-test.md');
      cy.getByDataCy('markdown-editor').percySnapshot('Editor - Light Theme');
      
      // Switch to dark theme
      cy.getByDataCy('theme-toggle').click();
      cy.wait(500); // Wait for transition
      
      // Dark theme
      cy.percySnapshot('App - Dark Theme');
      
      // Components in dark theme
      cy.getByDataCy('file-tree').percySnapshot('File Tree - Dark Theme');
      cy.getByDataCy('markdown-editor').percySnapshot('Editor - Dark Theme');
      
      // Test system theme
      cy.window().then(win => {
        // Simulate dark mode preference
        cy.wrap(win.matchMedia('(prefers-color-scheme: dark)')).then(mediaQuery => {
          if (mediaQuery.matches) {
            cy.percySnapshot('App - System Dark Mode');
          }
        });
      });
    });

    it('captures responsive layouts', () => {
      const viewports = [
        { name: 'Desktop HD', width: 1920, height: 1080 },
        { name: 'Desktop', width: 1440, height: 900 },
        { name: 'Laptop', width: 1366, height: 768 },
        { name: 'Tablet Landscape', width: 1024, height: 768 },
        { name: 'Tablet Portrait', width: 768, height: 1024 },
        { name: 'Mobile Large', width: 414, height: 896 },
        { name: 'Mobile Medium', width: 375, height: 667 },
        { name: 'Mobile Small', width: 320, height: 568 }
      ];
      
      cy.configureWebDAV();
      cy.createTestFile('responsive-test.md', '# Responsive Test');
      cy.openFile('responsive-test.md');
      
      viewports.forEach(viewport => {
        cy.viewport(viewport.width, viewport.height);
        cy.wait(300); // Wait for layout adjustment
        cy.percySnapshot(`Layout - ${viewport.name}`);
      });
    });

    it('captures modal and dialog states', () => {
      // WebDAV config modal
      cy.getByDataCy('config-button').click();
      cy.getByDataCy('webdav-config-modal').percySnapshot('WebDAV Config Modal');
      cy.get('body').type('{esc}');
      
      // New file dialog
      cy.getByDataCy('file-tree').rightclick();
      cy.getByDataCy('context-menu').percySnapshot('Context Menu');
      cy.getByDataCy('new-file').click();
      cy.getByDataCy('new-file-dialog').percySnapshot('New File Dialog');
      cy.get('body').type('{esc}');
      
      // Delete confirmation
      cy.createTestFile('delete-test.md');
      cy.getByDataCy('file-delete-test-md').rightclick();
      cy.getByDataCy('delete-file').click();
      cy.getByDataCy('confirm-dialog').percySnapshot('Delete Confirmation Dialog');
      cy.getByDataCy('cancel-button').click();
      
      // Settings modal
      cy.getByDataCy('settings-button').click();
      cy.getByDataCy('settings-modal').percySnapshot('Settings Modal');
    });

    it('captures error states', () => {
      // Connection error
      cy.intercept('PROPFIND', '**/webdav/**', { statusCode: 500 });
      cy.getByDataCy('config-button').click();
      cy.getByDataCy('webdav-url').type('http://failing-server.com');
      cy.getByDataCy('test-connection').click();
      cy.getByDataCy('connection-error').percySnapshot('Connection Error State');
      cy.get('body').type('{esc}');
      
      // Validation errors
      cy.getByDataCy('file-tree').rightclick();
      cy.getByDataCy('new-file').click();
      cy.getByDataCy('filename-input').type('invalid/name');
      cy.getByDataCy('create-file').click();
      cy.getByDataCy('validation-error').percySnapshot('Validation Error');
      
      // Network error
      cy.intercept('PUT', '**/webdav/**', { forceNetworkError: true });
      cy.createTestFile('error-test.md');
      cy.openFile('error-test.md');
      cy.typeInEditor('Changes');
      cy.saveFile();
      cy.getByDataCy('save-error').percySnapshot('Save Error Notification');
    });

    it('captures loading states', () => {
      // File tree loading
      cy.intercept('PROPFIND', '**/webdav/**', { delay: 2000, body: {} });
      cy.visit('/');
      cy.getByDataCy('file-tree-loading').percySnapshot('File Tree - Loading');
      
      // Editor loading
      cy.intercept('GET', '**/webdav/**.md', { delay: 2000, body: 'Content' });
      cy.createTestFile('loading-test.md');
      cy.getByDataCy('file-loading-test-md').dblclick();
      cy.getByDataCy('editor-loading').percySnapshot('Editor - Loading');
      
      // Optimization loading
      cy.intercept('POST', '/api/optimize', { delay: 2000, body: {} });
      cy.createTestFile('opt-loading.md', 'Test');
      cy.openFile('opt-loading.md');
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('mode-general').click();
      cy.getByDataCy('start-optimization').click();
      cy.getByDataCy('optimization-loading').percySnapshot('Optimization - Loading');
    });

    it('captures tooltips and popovers', () => {
      cy.configureWebDAV();
      cy.createTestFile('tooltip-test.md');
      cy.openFile('tooltip-test.md');
      
      // Button tooltips
      cy.getByDataCy('save-button').realHover();
      cy.wait(500); // Wait for tooltip
      cy.percySnapshot('Save Button - Tooltip');
      
      cy.getByDataCy('optimize-button').realHover();
      cy.wait(500);
      cy.percySnapshot('Optimize Button - Tooltip');
      
      // Execution options popover
      cy.getByDataCy('execution-options').click();
      cy.getByDataCy('execution-popover').percySnapshot('Execution Options Popover');
      
      // Model selector dropdown
      cy.getByDataCy('model-selector').click();
      cy.getByDataCy('model-dropdown').percySnapshot('Model Selector Dropdown');
    });

    it('captures animations mid-state', () => {
      // Accordion expansion
      cy.getByDataCy('folder-with-content').find('.expand-icon').click();
      cy.wait(150); // Mid-animation
      cy.getByDataCy('file-tree').percySnapshot('File Tree - Mid Expansion');
      
      // Modal fade in
      cy.getByDataCy('config-button').click();
      cy.wait(150); // Mid-fade
      cy.percySnapshot('Modal - Fade In Animation');
      
      // Progress bar animation
      cy.getByDataCy('simulate-progress').click();
      cy.wait(500); // Mid-progress
      cy.getByDataCy('progress-bar').percySnapshot('Progress Bar - Mid Animation');
    });
  });

  describe('Full Page Visual Tests', () => {
    it('captures complete application states', () => {
      // Empty state
      cy.percySnapshot('App - Empty State');
      
      // With content
      cy.configureWebDAV();
      cy.createTestFile('project/readme.md', '# Project README');
      cy.createTestFile('project/src/index.js', 'console.log("test");');
      cy.createTestFile('project/docs/guide.md', '# User Guide');
      cy.openFile('project/readme.md');
      cy.percySnapshot('App - With Content');
      
      // With optimization results
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('mode-general').click();
      cy.getByDataCy('start-optimization').click();
      cy.wait('@optimizePrompt');
      cy.percySnapshot('App - With Optimization Results');
      
      // With execution results
      cy.getByDataCy('cancel-optimization').click();
      cy.getByDataCy('execute-button').click();
      cy.wait('@executePrompt');
      cy.percySnapshot('App - With Execution Results');
      
      // With multiple panels
      cy.getByDataCy('show-history').click();
      cy.getByDataCy('show-templates').click();
      cy.percySnapshot('App - Multiple Panels Open');
    });
  });

  describe('Accessibility Visual Tests', () => {
    it('captures focus states', () => {
      // Tab through interface
      cy.get('body').tab();
      cy.percySnapshot('Focus - First Element');
      
      cy.get('body').tab();
      cy.percySnapshot('Focus - Second Element');
      
      // Focus in editor
      cy.createTestFile('focus-test.md');
      cy.openFile('focus-test.md');
      cy.getByDataCy('editor-textarea').focus();
      cy.percySnapshot('Focus - Editor');
      
      // Focus in modal
      cy.getByDataCy('config-button').click();
      cy.getByDataCy('webdav-url').focus();
      cy.percySnapshot('Focus - Modal Input');
    });

    it('captures high contrast mode', () => {
      // Enable high contrast
      cy.window().then(win => {
        win.document.documentElement.classList.add('high-contrast');
      });
      
      cy.percySnapshot('App - High Contrast Mode');
      
      // Test components in high contrast
      cy.createTestFile('contrast-test.md', '# Test');
      cy.openFile('contrast-test.md');
      cy.getByDataCy('markdown-editor').percySnapshot('Editor - High Contrast');
      cy.getByDataCy('file-tree').percySnapshot('File Tree - High Contrast');
    });
  });
});