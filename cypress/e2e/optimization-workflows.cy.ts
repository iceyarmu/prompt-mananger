describe('Prompt Optimization Workflows', () => {
  beforeEach(() => {
    cy.setupTestEnvironment();
    cy.mockWebDAVServer();
    cy.visit('/');
    cy.configureWebDAV();
    cy.waitForFileTree();
  });

  describe('Basic Optimization', () => {
    beforeEach(() => {
      const basicPrompt = `You are an AI assistant.
Help users with their questions.
Be helpful and accurate.`;
      
      cy.createTestFile('basic-prompt.md', basicPrompt);
      cy.openFile('basic-prompt.md');
    });

    it('optimizes a simple prompt', () => {
      // Click optimize button
      cy.getByDataCy('optimize-button').click();
      
      // Select optimization mode
      cy.getByDataCy('optimization-mode-selector').should('be.visible');
      cy.getByDataCy('mode-general').click();
      
      // Start optimization
      cy.getByDataCy('start-optimization').click();
      
      // Wait for loading
      cy.getByDataCy('optimization-loading').should('be.visible');
      
      // Check results
      cy.wait('@optimizePrompt');
      cy.getByDataCy('optimization-results').should('be.visible');
      
      // Verify both versions shown
      cy.getByDataCy('original-prompt').should('contain', 'You are an AI assistant');
      cy.getByDataCy('optimized-prompt').should('be.visible');
      
      // Check improvements list
      cy.getByDataCy('improvements-list').should('be.visible');
      cy.getByDataCy('improvements-list').find('li').should('have.length.at.least', 1);
    });

    it('shows diff view for optimization', () => {
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('mode-general').click();
      cy.getByDataCy('start-optimization').click();
      
      cy.wait('@optimizePrompt');
      
      // Switch to diff view
      cy.getByDataCy('view-diff').click();
      cy.getByDataCy('diff-viewer').should('be.visible');
      
      // Check diff markers
      cy.get('.diff-added').should('exist');
      cy.get('.diff-removed').should('exist');
      
      // Switch back to side-by-side
      cy.getByDataCy('view-side-by-side').click();
      cy.getByDataCy('side-by-side-view').should('be.visible');
    });

    it('applies optimization to editor', () => {
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('mode-general').click();
      cy.getByDataCy('start-optimization').click();
      
      cy.wait('@optimizePrompt');
      
      // Apply optimization
      cy.getByDataCy('apply-optimization').click();
      
      // Verify confirmation
      cy.getByDataCy('apply-confirmation').should('be.visible');
      cy.getByDataCy('confirm-apply').click();
      
      // Check editor updated
      cy.getByDataCy('editor-textarea').should('not.contain', 'You are an AI assistant');
      cy.getByDataCy('unsaved-indicator').should('be.visible');
      
      // Save the optimized version
      cy.saveFile();
    });

    it('cancels optimization', () => {
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('mode-general').click();
      cy.getByDataCy('start-optimization').click();
      
      cy.wait('@optimizePrompt');
      
      // Cancel without applying
      cy.getByDataCy('cancel-optimization').click();
      
      // Verify editor unchanged
      cy.getByDataCy('editor-textarea').should('contain', 'You are an AI assistant');
      cy.getByDataCy('unsaved-indicator').should('not.exist');
    });
  });

  describe('Advanced Optimization Modes', () => {
    const complexPrompt = `# Complex Assistant Prompt

You are an advanced AI assistant designed to help with various tasks.

## Capabilities
- Answer questions
- Provide explanations
- Generate content
- Solve problems

## Instructions
1. Read the user's request carefully
2. Think through the problem step by step
3. Provide a clear and helpful response
4. Ask for clarification if needed

## Context
This assistant is used in a professional environment where accuracy is important.`;

    beforeEach(() => {
      cy.createTestFile('complex-prompt.md', complexPrompt);
      cy.openFile('complex-prompt.md');
    });

    it('uses analytical optimization mode', () => {
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('mode-analytical').click();
      
      // Configure analytical options
      cy.getByDataCy('analytical-options').should('be.visible');
      cy.getByDataCy('focus-clarity').check();
      cy.getByDataCy('focus-specificity').check();
      
      cy.getByDataCy('start-optimization').click();
      cy.wait('@optimizePrompt');
      
      // Check analytical improvements
      cy.getByDataCy('analytical-score').should('be.visible');
      cy.getByDataCy('clarity-improvement').should('be.visible');
      cy.getByDataCy('specificity-improvement').should('be.visible');
    });

    it('uses output format optimization', () => {
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('mode-output-format').click();
      
      // Select output format
      cy.getByDataCy('format-selector').select('JSON');
      cy.getByDataCy('include-examples').check();
      
      cy.getByDataCy('start-optimization').click();
      cy.wait('@optimizePrompt');
      
      // Verify format-specific improvements
      cy.getByDataCy('optimized-prompt').should('contain', 'JSON');
      cy.getByDataCy('format-example').should('be.visible');
    });

    it('uses iterative optimization', () => {
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('mode-iterative').click();
      
      // Set iteration count
      cy.getByDataCy('iteration-count').clear().type('3');
      
      cy.getByDataCy('start-optimization').click();
      
      // Wait for multiple iterations
      cy.getByDataCy('iteration-1').should('be.visible');
      cy.getByDataCy('iteration-2').should('be.visible');
      cy.getByDataCy('iteration-3').should('be.visible');
      
      // Check iteration improvements
      cy.getByDataCy('iteration-comparison').should('be.visible');
      cy.getByDataCy('best-iteration').should('have.class', 'highlighted');
    });
  });

  describe('Optimization History', () => {
    it('saves optimization history', () => {
      // Perform optimization
      cy.createTestFile('history-test.md', 'Test prompt');
      cy.openFile('history-test.md');
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('mode-general').click();
      cy.getByDataCy('start-optimization').click();
      cy.wait('@optimizePrompt');
      cy.getByDataCy('apply-optimization').click();
      cy.getByDataCy('confirm-apply').click();
      
      // Open history
      cy.getByDataCy('history-button').click();
      cy.getByDataCy('optimization-history').should('be.visible');
      
      // Check history entry
      cy.getByDataCy('history-entry-1').should('exist');
      cy.getByDataCy('history-entry-1').should('contain', 'history-test.md');
      cy.getByDataCy('history-entry-1').should('contain', 'General Optimization');
    });

    it('restores from history', () => {
      // Create history
      cy.createTestFile('restore-test.md', 'Original prompt');
      cy.openFile('restore-test.md');
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('mode-general').click();
      cy.getByDataCy('start-optimization').click();
      cy.wait('@optimizePrompt');
      cy.getByDataCy('apply-optimization').click();
      cy.getByDataCy('confirm-apply').click();
      cy.saveFile();
      
      // Modify the file
      cy.typeInEditor('Modified content');
      cy.saveFile();
      
      // Restore from history
      cy.getByDataCy('history-button').click();
      cy.getByDataCy('history-entry-1').click();
      cy.getByDataCy('restore-version').click();
      
      // Confirm restoration
      cy.getByDataCy('restore-confirmation').should('be.visible');
      cy.getByDataCy('confirm-restore').click();
      
      // Verify content restored
      cy.getByDataCy('editor-textarea').should('not.contain', 'Modified content');
    });

    it('compares optimization versions', () => {
      // Create multiple optimizations
      cy.createTestFile('compare-test.md', 'Base prompt');
      cy.openFile('compare-test.md');
      
      // First optimization
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('mode-general').click();
      cy.getByDataCy('start-optimization').click();
      cy.wait('@optimizePrompt');
      cy.getByDataCy('apply-optimization').click();
      cy.getByDataCy('confirm-apply').click();
      cy.saveFile();
      
      // Second optimization
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('mode-analytical').click();
      cy.getByDataCy('start-optimization').click();
      cy.wait('@optimizePrompt');
      cy.getByDataCy('apply-optimization').click();
      cy.getByDataCy('confirm-apply').click();
      cy.saveFile();
      
      // Open comparison
      cy.getByDataCy('history-button').click();
      cy.getByDataCy('compare-versions').click();
      
      // Select versions to compare
      cy.getByDataCy('version-1-checkbox').check();
      cy.getByDataCy('version-2-checkbox').check();
      cy.getByDataCy('start-comparison').click();
      
      // Verify comparison view
      cy.getByDataCy('version-comparison').should('be.visible');
      cy.getByDataCy('version-1-content').should('be.visible');
      cy.getByDataCy('version-2-content').should('be.visible');
      cy.getByDataCy('comparison-metrics').should('be.visible');
    });
  });

  describe('Batch Optimization', () => {
    beforeEach(() => {
      // Create multiple prompt files
      cy.createTestFile('prompt1.md', 'First prompt for testing');
      cy.createTestFile('prompt2.md', 'Second prompt for testing');
      cy.createTestFile('prompt3.md', 'Third prompt for testing');
    });

    it('optimizes multiple files in batch', () => {
      // Select multiple files
      cy.getByDataCy('file-prompt1-md').click();
      cy.get('body').type('{ctrl}', { release: false });
      cy.getByDataCy('file-prompt2-md').click();
      cy.getByDataCy('file-prompt3-md').click();
      cy.get('body').type('{ctrl}', { release: true });
      
      // Start batch optimization
      cy.getByDataCy('batch-optimize').click();
      cy.getByDataCy('batch-optimization-modal').should('be.visible');
      
      // Configure batch settings
      cy.getByDataCy('batch-mode').select('general');
      cy.getByDataCy('batch-parallel').check();
      
      cy.getByDataCy('start-batch-optimization').click();
      
      // Monitor progress
      cy.getByDataCy('batch-progress').should('be.visible');
      cy.getByDataCy('file-1-status').should('contain', 'Processing');
      cy.getByDataCy('file-2-status').should('contain', 'Processing');
      cy.getByDataCy('file-3-status').should('contain', 'Processing');
      
      // Wait for completion
      cy.getByDataCy('batch-complete', { timeout: 30000 }).should('be.visible');
      
      // Review results
      cy.getByDataCy('batch-results').should('be.visible');
      cy.getByDataCy('successful-count').should('contain', '3');
      cy.getByDataCy('failed-count').should('contain', '0');
      
      // Apply all optimizations
      cy.getByDataCy('apply-all-optimizations').click();
      cy.getByDataCy('confirm-batch-apply').click();
      
      // Verify files updated
      cy.getByDataCy('batch-applied-success').should('be.visible');
    });
  });
});