describe('Editor ← → Optimization Service Integration Tests', () => {
  beforeEach(() => {
    cy.setupTestEnvironment();
    cy.mockOptimizationService();
    cy.clearLocalStorage();
    cy.visit('/');
    cy.setupWebDAVConnection();
  });

  describe('Basic Optimization Flow', () => {
    it('should optimize prompt content from editor', () => {
      const originalPrompt = `Please help me write a detailed blog post about artificial intelligence`;
      
      cy.createTestFile('optimize-basic.md', originalPrompt);
      cy.getByDataCy('file-optimize-basic').dblclick();
      
      // Trigger optimization
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('optimization-modal').should('be.visible');
      
      // Select optimization mode
      cy.getByDataCy('optimization-mode').select('general');
      cy.getByDataCy('start-optimization').click();
      
      // Wait for optimization
      cy.getByDataCy('optimization-loading').should('be.visible');
      cy.wait('@optimizePrompt');
      
      // Verify results
      cy.getByDataCy('optimization-complete').should('be.visible');
      cy.getByDataCy('original-prompt').should('contain', originalPrompt);
      cy.getByDataCy('optimized-prompt').should('exist');
      cy.getByDataCy('optimization-score').should('exist');
      cy.getByDataCy('improvement-suggestions').should('exist');
    });

    it('should handle multiple optimization modes', () => {
      const testPrompt = `Analyze this data and provide insights`;
      
      cy.createTestFile('multi-mode.md', testPrompt);
      cy.getByDataCy('file-multi-mode').dblclick();
      
      // Test different optimization modes
      const modes = ['general', 'analytical', 'output-format'];
      
      modes.forEach(mode => {
        cy.getByDataCy('optimize-button').click();
        cy.getByDataCy('optimization-mode').select(mode);
        cy.getByDataCy('start-optimization').click();
        
        cy.wait('@optimizePrompt').then((interception) => {
          expect(interception.request.body.mode).to.equal(mode);
        });
        
        cy.getByDataCy(`${mode}-results`).should('exist');
        cy.getByDataCy('close-optimization').click();
      });
    });

    it('should apply optimization results to editor', () => {
      cy.createTestFile('apply-opt.md', '# Original prompt');
      cy.getByDataCy('file-apply-opt').dblclick();
      
      // Optimize
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('start-optimization').click();
      cy.wait('@optimizePrompt');
      
      // Store optimized content
      cy.getByDataCy('optimized-prompt').invoke('text').as('optimizedContent');
      
      // Apply optimization
      cy.getByDataCy('apply-optimization').click();
      cy.getByDataCy('confirmation-dialog').should('be.visible');
      cy.getByDataCy('confirm-apply').click();
      
      // Verify editor updated
      cy.get('@optimizedContent').then((optimized) => {
        cy.getByDataCy('editor-content').should('contain', optimized);
      });
      
      // Verify dirty state
      cy.getByDataCy('unsaved-indicator').should('be.visible');
    });
  });

  describe('User Prompt Optimization', () => {
    it('should optimize user-provided prompts', () => {
      const userPrompt = `I want to learn about machine learning`;
      
      cy.getByDataCy('user-prompt-input').click();
      cy.getByDataCy('user-prompt-textarea').type(userPrompt);
      
      // Select optimization level
      cy.getByDataCy('optimization-level').select('professional');
      cy.getByDataCy('optimize-user-prompt').click();
      
      // Wait for optimization
      cy.wait('@optimizeUserPrompt');
      
      // Verify enhanced prompt
      cy.getByDataCy('enhanced-prompt').should('exist');
      cy.getByDataCy('enhancement-explanation').should('exist');
      cy.getByDataCy('context-additions').should('exist');
      
      // Use enhanced prompt
      cy.getByDataCy('use-enhanced').click();
      cy.getByDataCy('editor-content').should('not.contain', userPrompt);
      cy.getByDataCy('editor-content').invoke('text').should('have.length.greaterThan', userPrompt.length);
    });

    it('should handle different optimization levels', () => {
      const userPrompt = `Explain quantum computing`;
      
      const levels = ['basic', 'planning', 'professional'];
      
      levels.forEach(level => {
        cy.getByDataCy('user-prompt-input').click();
        cy.getByDataCy('user-prompt-textarea').clear().type(userPrompt);
        cy.getByDataCy('optimization-level').select(level);
        cy.getByDataCy('optimize-user-prompt').click();
        
        cy.wait('@optimizeUserPrompt').then((interception) => {
          expect(interception.request.body.level).to.equal(level);
        });
        
        // Verify level-specific enhancements
        cy.getByDataCy(`${level}-enhancements`).should('exist');
        cy.getByDataCy('clear-optimization').click();
      });
    });

    it('should preserve context during user prompt optimization', () => {
      // Set up context
      cy.createTestFile('context.md', '# Context Document\n\nImportant background information');
      cy.getByDataCy('file-context').dblclick();
      
      // Add user prompt with context reference
      cy.getByDataCy('user-prompt-input').click();
      cy.getByDataCy('user-prompt-textarea').type('Based on the context above, explain the concept');
      cy.getByDataCy('include-context').check();
      
      // Optimize
      cy.getByDataCy('optimize-user-prompt').click();
      cy.wait('@optimizeUserPrompt').then((interception) => {
        expect(interception.request.body.context).to.include('Important background information');
      });
      
      // Verify context preserved in result
      cy.getByDataCy('enhanced-prompt').should('contain', 'context');
      cy.getByDataCy('context-integration').should('be.visible');
    });
  });

  describe('Iterative Optimization', () => {
    it('should support iterative prompt refinement', () => {
      cy.createTestFile('iterate.md', '# Initial prompt');
      cy.getByDataCy('file-iterate').dblclick();
      
      // First optimization
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('start-optimization').click();
      cy.wait('@optimizePrompt');
      cy.getByDataCy('apply-optimization').click();
      cy.getByDataCy('confirm-apply').click();
      
      // Second optimization (iterate)
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('iteration-notice').should('contain', 'This prompt has been optimized before');
      cy.getByDataCy('continue-iteration').click();
      cy.wait('@optimizePrompt');
      
      // Verify iteration tracking
      cy.getByDataCy('iteration-count').should('contain', '2');
      cy.getByDataCy('iteration-history').click();
      cy.getByDataCy('history-modal').should('be.visible');
      cy.getByDataCy('iteration-1').should('exist');
      cy.getByDataCy('iteration-2').should('exist');
    });

    it('should compare optimization iterations', () => {
      cy.createTestFile('compare.md', '# Base prompt');
      cy.getByDataCy('file-compare').dblclick();
      
      // Perform multiple optimizations
      for (let i = 0; i < 3; i++) {
        cy.getByDataCy('optimize-button').click();
        cy.getByDataCy('start-optimization').click();
        cy.wait('@optimizePrompt');
        cy.getByDataCy('apply-optimization').click();
        cy.getByDataCy('confirm-apply').click();
        cy.wait(500); // Small delay between iterations
      }
      
      // Open comparison view
      cy.getByDataCy('compare-iterations').click();
      cy.getByDataCy('comparison-modal').should('be.visible');
      
      // Select iterations to compare
      cy.getByDataCy('compare-from').select('1');
      cy.getByDataCy('compare-to').select('3');
      cy.getByDataCy('show-comparison').click();
      
      // Verify comparison display
      cy.getByDataCy('diff-view').should('be.visible');
      cy.getByDataCy('additions').should('exist');
      cy.getByDataCy('deletions').should('exist');
      cy.getByDataCy('similarity-score').should('exist');
    });
  });

  describe('Optimization with Templates', () => {
    it('should optimize prompts with template variables', () => {
      const templatePrompt = `
        As a {{role}}, please {{action}} regarding {{topic}}.
        Consider the following constraints: {{constraints}}
      `;
      
      cy.createTestFile('template-opt.md', templatePrompt);
      cy.getByDataCy('file-template-opt').dblclick();
      
      // Set template variables
      cy.getByDataCy('template-variables').click();
      cy.setTemplateVariable('role', 'data scientist');
      cy.setTemplateVariable('action', 'analyze trends');
      cy.setTemplateVariable('topic', 'user engagement metrics');
      cy.setTemplateVariable('constraints', 'last 30 days, mobile users only');
      
      // Optimize with variables
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('optimize-with-variables').check();
      cy.getByDataCy('start-optimization').click();
      
      cy.wait('@optimizePrompt').then((interception) => {
        const body = interception.request.body;
        expect(body.content).to.include('data scientist');
        expect(body.content).to.include('analyze trends');
        expect(body.hasVariables).to.be.true;
      });
      
      // Verify optimized template preserves variables
      cy.getByDataCy('optimized-prompt').should('contain', '{{role}}');
      cy.getByDataCy('optimized-prompt').should('contain', '{{action}}');
    });

    it('should suggest new template variables during optimization', () => {
      cy.createTestFile('suggest-vars.md', 'Analyze sales data for Q3 2024 in North America region');
      cy.getByDataCy('file-suggest-vars').dblclick();
      
      // Optimize
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('suggest-variables').check();
      cy.getByDataCy('start-optimization').click();
      cy.wait('@optimizePrompt');
      
      // Check suggested variables
      cy.getByDataCy('suggested-variables').should('be.visible');
      cy.getByDataCy('var-suggestion-timeframe').should('contain', 'Q3 2024');
      cy.getByDataCy('var-suggestion-region').should('contain', 'North America');
      cy.getByDataCy('var-suggestion-dataType').should('contain', 'sales data');
      
      // Apply suggestions
      cy.getByDataCy('apply-all-suggestions').click();
      cy.getByDataCy('optimized-prompt').should('contain', '{{timeframe}}');
      cy.getByDataCy('optimized-prompt').should('contain', '{{region}}');
      cy.getByDataCy('optimized-prompt').should('contain', '{{dataType}}');
    });
  });

  describe('Optimization Presets and Profiles', () => {
    it('should apply optimization presets', () => {
      cy.createTestFile('preset.md', 'Write code to sort an array');
      cy.getByDataCy('file-preset').dblclick();
      
      // Select coding preset
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('optimization-presets').click();
      cy.getByDataCy('preset-coding').click();
      
      // Verify preset configuration
      cy.getByDataCy('preset-name').should('contain', 'Coding Assistant');
      cy.getByDataCy('preset-description').should('exist');
      cy.getByDataCy('preset-settings').should('contain', 'Include examples');
      cy.getByDataCy('preset-settings').should('contain', 'Specify language');
      
      // Apply preset optimization
      cy.getByDataCy('apply-preset').click();
      cy.wait('@optimizePrompt');
      
      // Verify coding-specific optimizations
      cy.getByDataCy('optimized-prompt').should('contain', 'language');
      cy.getByDataCy('optimized-prompt').should('contain', 'example');
      cy.getByDataCy('code-structure-suggestion').should('exist');
    });

    it('should save custom optimization profiles', () => {
      cy.createTestFile('custom-profile.md', 'Generic prompt');
      cy.getByDataCy('file-custom-profile').dblclick();
      
      // Configure custom optimization
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('optimization-mode').select('analytical');
      cy.getByDataCy('include-examples').check();
      cy.getByDataCy('enhance-clarity').check();
      cy.getByDataCy('add-constraints').check();
      
      // Save as profile
      cy.getByDataCy('save-profile').click();
      cy.getByDataCy('profile-name').type('My Analysis Profile');
      cy.getByDataCy('profile-description').type('For analytical prompts with examples');
      cy.getByDataCy('confirm-save-profile').click();
      
      // Verify profile saved
      cy.getByDataCy('saved-profiles').click();
      cy.getByDataCy('profile-My-Analysis-Profile').should('exist');
      
      // Use saved profile
      cy.createTestFile('use-profile.md', 'Another prompt');
      cy.getByDataCy('file-use-profile').dblclick();
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('saved-profiles').click();
      cy.getByDataCy('profile-My-Analysis-Profile').click();
      
      // Verify settings loaded
      cy.getByDataCy('optimization-mode').should('have.value', 'analytical');
      cy.getByDataCy('include-examples').should('be.checked');
    });
  });

  describe('Batch Optimization', () => {
    it('should optimize multiple files in batch', () => {
      // Create multiple files
      const files = [
        { name: 'batch1.md', content: 'First prompt for optimization' },
        { name: 'batch2.md', content: 'Second prompt for optimization' },
        { name: 'batch3.md', content: 'Third prompt for optimization' }
      ];
      
      files.forEach(file => {
        cy.createTestFile(file.name, file.content);
      });
      
      // Select files for batch optimization
      cy.getByDataCy('file-batch1').click();
      cy.get('body').type('{ctrl}', { release: false });
      cy.getByDataCy('file-batch2').click();
      cy.getByDataCy('file-batch3').click();
      cy.get('body').type('{ctrl}'); // Release
      
      // Right-click for batch operation
      cy.getByDataCy('file-batch2').rightclick();
      cy.getByDataCy('batch-optimize').click();
      
      // Configure batch optimization
      cy.getByDataCy('batch-modal').should('be.visible');
      cy.getByDataCy('batch-mode').select('general');
      cy.getByDataCy('start-batch').click();
      
      // Monitor progress
      cy.getByDataCy('batch-progress').should('be.visible');
      cy.getByDataCy('progress-bar').should('exist');
      cy.getByDataCy('processing-file').should('exist');
      
      // Wait for completion
      cy.wait(['@optimizePrompt', '@optimizePrompt', '@optimizePrompt']);
      
      // Verify results
      cy.getByDataCy('batch-complete').should('be.visible');
      cy.getByDataCy('batch-results').find('.result-item').should('have.length', 3);
      cy.getByDataCy('apply-all-batch').click();
      
      // Verify files updated
      files.forEach(file => {
        cy.getByDataCy(`file-${file.name.replace('.md', '')}`).should('have.class', 'modified');
      });
    });

    it('should handle batch optimization failures', () => {
      // Create files
      cy.createTestFile('success1.md', 'Valid prompt');
      cy.createTestFile('fail.md', 'Invalid prompt {{broken');
      cy.createTestFile('success2.md', 'Another valid prompt');
      
      // Select for batch
      cy.selectMultipleFiles(['success1', 'fail', 'success2']);
      cy.getByDataCy('file-success1').rightclick();
      cy.getByDataCy('batch-optimize').click();
      cy.getByDataCy('start-batch').click();
      
      // Wait for processing
      cy.wait('@optimizePrompt');
      cy.wait('@optimizePrompt');
      
      // Check results
      cy.getByDataCy('batch-results').should('be.visible');
      cy.getByDataCy('result-success1').should('have.class', 'success');
      cy.getByDataCy('result-fail').should('have.class', 'error');
      cy.getByDataCy('result-success2').should('have.class', 'success');
      
      // Error details
      cy.getByDataCy('result-fail').click();
      cy.getByDataCy('error-details').should('contain', 'Invalid template syntax');
      
      // Apply only successful
      cy.getByDataCy('apply-successful').click();
      cy.getByDataCy('file-success1').should('have.class', 'modified');
      cy.getByDataCy('file-fail').should('not.have.class', 'modified');
      cy.getByDataCy('file-success2').should('have.class', 'modified');
    });
  });

  describe('Optimization History and Analytics', () => {
    it('should track optimization history', () => {
      cy.createTestFile('history.md', 'Track my optimizations');
      cy.getByDataCy('file-history').dblclick();
      
      // Perform multiple optimizations
      for (let i = 0; i < 3; i++) {
        cy.getByDataCy('optimize-button').click();
        cy.getByDataCy('start-optimization').click();
        cy.wait('@optimizePrompt');
        cy.getByDataCy('close-optimization').click();
        cy.wait(1000); // Ensure timestamp difference
      }
      
      // View history
      cy.getByDataCy('optimization-history').click();
      cy.getByDataCy('history-list').find('.history-item').should('have.length', 3);
      
      // Check history details
      cy.getByDataCy('history-item-0').should('contain', 'history.md');
      cy.getByDataCy('history-item-0').should('contain', 'general');
      cy.getByDataCy('history-item-0').find('.timestamp').should('exist');
      cy.getByDataCy('history-item-0').find('.score').should('exist');
      
      // Restore from history
      cy.getByDataCy('history-item-1').click();
      cy.getByDataCy('restore-version').click();
      cy.getByDataCy('editor-content').invoke('text').then(text => {
        cy.wrap(text).as('restoredContent');
      });
      
      // Verify restoration
      cy.get('@restoredContent').should('not.equal', 'Track my optimizations');
    });

    it('should provide optimization analytics', () => {
      // Create and optimize multiple files
      const testFiles = ['file1.md', 'file2.md', 'file3.md'];
      testFiles.forEach((file, index) => {
        cy.createTestFile(file, `Prompt ${index}`);
        cy.getByDataCy(`file-${file.replace('.md', '')}`).dblclick();
        cy.getByDataCy('optimize-button').click();
        cy.getByDataCy('start-optimization').click();
        cy.wait('@optimizePrompt');
        cy.getByDataCy('close-optimization').click();
      });
      
      // View analytics
      cy.getByDataCy('optimization-analytics').click();
      cy.getByDataCy('analytics-modal').should('be.visible');
      
      // Check statistics
      cy.getByDataCy('total-optimizations').should('contain', '3');
      cy.getByDataCy('average-improvement').should('exist');
      cy.getByDataCy('most-used-mode').should('exist');
      cy.getByDataCy('optimization-chart').should('exist');
      
      // Time-based analytics
      cy.getByDataCy('time-filter').select('today');
      cy.getByDataCy('optimizations-today').should('contain', '3');
      
      // Mode breakdown
      cy.getByDataCy('mode-breakdown').should('exist');
      cy.getByDataCy('mode-general-count').should('exist');
    });
  });

  describe('Real-time Optimization Suggestions', () => {
    it('should provide real-time suggestions while typing', () => {
      cy.createTestFile('realtime.md', '');
      cy.getByDataCy('file-realtime').dblclick();
      
      // Enable real-time suggestions
      cy.getByDataCy('settings-button').click();
      cy.getByDataCy('realtime-optimization').check();
      cy.getByDataCy('save-settings').click();
      
      // Type and get suggestions
      cy.typeInEditor('Please help me');
      cy.wait(500); // Debounce delay
      
      cy.getByDataCy('suggestion-panel').should('be.visible');
      cy.getByDataCy('suggestion-list').find('.suggestion').should('have.length.greaterThan', 0);
      
      // Apply suggestion
      cy.getByDataCy('suggestion-0').click();
      cy.getByDataCy('editor-content').invoke('text').should('not.equal', 'Please help me');
    });

    it('should throttle real-time suggestions appropriately', () => {
      cy.createTestFile('throttle.md', '');
      cy.getByDataCy('file-throttle').dblclick();
      
      // Enable real-time suggestions
      cy.getByDataCy('settings-button').click();
      cy.getByDataCy('realtime-optimization').check();
      cy.getByDataCy('save-settings').click();
      
      // Type rapidly
      const text = 'This is a test of rapid typing for throttling';
      cy.typeInEditor(text, { delay: 10 });
      
      // Check API calls are throttled
      cy.get('@optimizeSuggestions.all').should('have.length.lessThan', text.length / 5);
    });
  });

  describe('Export and Import Optimizations', () => {
    it('should export optimization configurations', () => {
      // Configure optimization settings
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('optimization-mode').select('analytical');
      cy.getByDataCy('include-examples').check();
      cy.getByDataCy('enhance-clarity').check();
      
      // Export configuration
      cy.getByDataCy('export-config').click();
      cy.getByDataCy('export-modal').should('be.visible');
      cy.getByDataCy('config-name').type('My Config');
      cy.getByDataCy('include-profiles').check();
      cy.getByDataCy('download-config').click();
      
      // Verify download
      cy.readFile('cypress/downloads/optimization-config-My-Config.json').then((config) => {
        expect(config.mode).to.equal('analytical');
        expect(config.settings.includeExamples).to.be.true;
        expect(config.settings.enhanceClarity).to.be.true;
      });
    });

    it('should import optimization configurations', () => {
      // Create config file
      const config = {
        mode: 'output-format',
        settings: {
          includeExamples: true,
          formatType: 'json',
          validateSchema: true
        },
        profiles: [
          {
            name: 'Imported Profile',
            settings: { mode: 'general' }
          }
        ]
      };
      
      // Import configuration
      cy.getByDataCy('optimize-button').click();
      cy.getByDataCy('import-config').click();
      cy.fixture('optimization-config.json', { config }).as('configFile');
      cy.getByDataCy('config-file-input').selectFile('@configFile');
      cy.getByDataCy('confirm-import').click();
      
      // Verify import
      cy.getByDataCy('import-success').should('be.visible');
      cy.getByDataCy('optimization-mode').should('have.value', 'output-format');
      cy.getByDataCy('saved-profiles').click();
      cy.getByDataCy('profile-Imported-Profile').should('exist');
    });
  });
});