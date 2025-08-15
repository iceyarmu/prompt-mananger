describe('Editor ← → Execution Service Integration Tests', () => {
  beforeEach(() => {
    cy.setupTestEnvironment();
    cy.mockExecutionService();
    cy.mockLLMProviders();
    cy.clearLocalStorage();
    cy.visit('/');
    cy.setupWebDAVConnection();
  });

  describe('Basic Prompt Execution', () => {
    it('should execute prompt from editor with selected model', () => {
      const prompt = 'Explain the concept of recursion in programming';
      
      cy.createTestFile('execute-basic.md', prompt);
      cy.getByDataCy('file-execute-basic').dblclick();
      
      // Select model
      cy.getByDataCy('model-selector').click();
      cy.getByDataCy('model-gpt-4').click();
      cy.getByDataCy('selected-model').should('contain', 'GPT-4');
      
      // Execute
      cy.getByDataCy('execute-button').click();
      cy.getByDataCy('execution-loading').should('be.visible');
      
      cy.wait('@executePrompt').then((interception) => {
        expect(interception.request.body.model).to.equal('gpt-4');
        expect(interception.request.body.prompt).to.equal(prompt);
      });
      
      // Verify results
      cy.getByDataCy('execution-complete').should('be.visible');
      cy.getByDataCy('result-content').should('not.be.empty');
      cy.getByDataCy('execution-metadata').should('contain', 'GPT-4');
      cy.getByDataCy('token-count').should('exist');
      cy.getByDataCy('execution-time').should('exist');
      cy.getByDataCy('cost-estimate').should('exist');
    });

    it('should handle streaming responses', () => {
      cy.createTestFile('stream.md', 'Generate a long story about space exploration');
      cy.getByDataCy('file-stream').dblclick();
      
      // Enable streaming
      cy.getByDataCy('execution-options').click();
      cy.getByDataCy('enable-streaming').check();
      cy.getByDataCy('save-options').click();
      
      // Execute with streaming
      cy.getByDataCy('execute-button').click();
      
      // Verify streaming indicators
      cy.getByDataCy('streaming-indicator').should('be.visible');
      cy.getByDataCy('result-content').should('exist');
      
      // Content should update progressively
      let previousLength = 0;
      for (let i = 0; i < 3; i++) {
        cy.wait(500);
        cy.getByDataCy('result-content').invoke('text').then(text => {
          expect(text.length).to.be.greaterThan(previousLength);
          previousLength = text.length;
        });
      }
      
      // Streaming should complete
      cy.getByDataCy('streaming-complete', { timeout: 10000 }).should('exist');
      cy.getByDataCy('streaming-indicator').should('not.exist');
    });

    it('should stop execution on demand', () => {
      cy.createTestFile('stoppable.md', 'Generate 100 random numbers');
      cy.getByDataCy('file-stoppable').dblclick();
      
      // Start execution
      cy.getByDataCy('execute-button').click();
      cy.getByDataCy('execution-loading').should('be.visible');
      
      // Stop execution
      cy.getByDataCy('stop-execution').click();
      cy.getByDataCy('stop-confirmation').should('be.visible');
      cy.getByDataCy('confirm-stop').click();
      
      // Verify stopped
      cy.getByDataCy('execution-stopped').should('be.visible');
      cy.getByDataCy('partial-results').should('exist');
      cy.getByDataCy('resume-option').should('be.visible');
    });
  });

  describe('Template Variable Processing', () => {
    it('should process template variables before execution', () => {
      const templatePrompt = `
        System: You are a {{role}} assistant.
        User: {{task}}
        Context: {{context}}
      `;
      
      cy.createTestFile('template-exec.md', templatePrompt);
      cy.getByDataCy('file-template-exec').dblclick();
      
      // Set template variables
      cy.getByDataCy('template-variables').click();
      cy.setTemplateVariable('role', 'technical');
      cy.setTemplateVariable('task', 'Review this code');
      cy.setTemplateVariable('context', 'Python web application');
      cy.getByDataCy('apply-variables').click();
      
      // Execute
      cy.getByDataCy('execute-button').click();
      
      cy.wait('@executePrompt').then((interception) => {
        const prompt = interception.request.body.prompt;
        expect(prompt).to.include('technical assistant');
        expect(prompt).to.include('Review this code');
        expect(prompt).to.include('Python web application');
        expect(prompt).to.not.include('{{');
      });
      
      // Results should show processed prompt
      cy.getByDataCy('executed-prompt').click();
      cy.getByDataCy('prompt-modal').should('be.visible');
      cy.getByDataCy('processed-prompt').should('contain', 'technical');
      cy.getByDataCy('processed-prompt').should('not.contain', '{{role}}');
    });

    it('should validate required variables before execution', () => {
      const promptWithVars = 'Analyze {{data}} using {{method}}';
      
      cy.createTestFile('validate-vars.md', promptWithVars);
      cy.getByDataCy('file-validate-vars').dblclick();
      
      // Try to execute without setting variables
      cy.getByDataCy('execute-button').click();
      
      // Should show validation error
      cy.getByDataCy('variable-error').should('be.visible');
      cy.getByDataCy('missing-variables').should('contain', 'data');
      cy.getByDataCy('missing-variables').should('contain', 'method');
      
      // Set one variable
      cy.getByDataCy('template-variables').click();
      cy.setTemplateVariable('data', 'sales figures');
      cy.getByDataCy('apply-variables').click();
      
      // Try again
      cy.getByDataCy('execute-button').click();
      cy.getByDataCy('missing-variables').should('contain', 'method');
      cy.getByDataCy('missing-variables').should('not.contain', 'data');
      
      // Set remaining variable
      cy.setTemplateVariable('method', 'regression analysis');
      cy.getByDataCy('apply-variables').click();
      
      // Should execute successfully
      cy.getByDataCy('execute-button').click();
      cy.wait('@executePrompt');
      cy.getByDataCy('execution-complete').should('be.visible');
    });

    it('should support dynamic variable injection', () => {
      cy.createTestFile('dynamic.md', 'Current time is {{timestamp}} and user is {{user}}');
      cy.getByDataCy('file-dynamic').dblclick();
      
      // Enable dynamic variables
      cy.getByDataCy('execution-options').click();
      cy.getByDataCy('enable-dynamic-vars').check();
      cy.getByDataCy('save-options').click();
      
      // Execute
      cy.getByDataCy('execute-button').click();
      
      cy.wait('@executePrompt').then((interception) => {
        const prompt = interception.request.body.prompt;
        expect(prompt).to.match(/Current time is \d{4}-\d{2}-\d{2}/);
        expect(prompt).to.include('and user is');
        expect(prompt).to.not.include('{{timestamp}}');
        expect(prompt).to.not.include('{{user}}');
      });
    });
  });

  describe('Multi-Model Execution', () => {
    it('should execute prompt with multiple models for comparison', () => {
      cy.createTestFile('compare-models.md', 'What is the capital of France?');
      cy.getByDataCy('file-compare-models').dblclick();
      
      // Enable multi-model comparison
      cy.getByDataCy('execution-mode').click();
      cy.getByDataCy('mode-comparison').click();
      
      // Select multiple models
      cy.getByDataCy('model-selector').click();
      cy.getByDataCy('select-multiple').click();
      cy.getByDataCy('model-gpt-3.5-turbo').check();
      cy.getByDataCy('model-gpt-4').check();
      cy.getByDataCy('model-claude-2').check();
      cy.getByDataCy('apply-selection').click();
      
      // Execute
      cy.getByDataCy('execute-button').click();
      cy.getByDataCy('multi-execution-progress').should('be.visible');
      
      // Wait for all executions
      cy.wait(['@executePrompt', '@executePrompt', '@executePrompt']);
      
      // Verify comparison view
      cy.getByDataCy('comparison-results').should('be.visible');
      cy.getByDataCy('result-gpt-3.5-turbo').should('exist');
      cy.getByDataCy('result-gpt-4').should('exist');
      cy.getByDataCy('result-claude-2').should('exist');
      
      // Check comparison metrics
      cy.getByDataCy('response-comparison').should('exist');
      cy.getByDataCy('token-comparison').should('exist');
      cy.getByDataCy('time-comparison').should('exist');
      cy.getByDataCy('cost-comparison').should('exist');
    });

    it('should handle model-specific parameters', () => {
      cy.createTestFile('model-params.md', 'Generate creative content');
      cy.getByDataCy('file-model-params').dblclick();
      
      // Configure GPT model parameters
      cy.getByDataCy('model-selector').click();
      cy.getByDataCy('model-gpt-4').click();
      cy.getByDataCy('model-settings').click();
      
      // Set GPT-specific parameters
      cy.getByDataCy('temperature').clear().type('0.8');
      cy.getByDataCy('max-tokens').clear().type('500');
      cy.getByDataCy('top-p').clear().type('0.9');
      cy.getByDataCy('frequency-penalty').clear().type('0.5');
      cy.getByDataCy('save-params').click();
      
      // Execute
      cy.getByDataCy('execute-button').click();
      
      cy.wait('@executePrompt').then((interception) => {
        const params = interception.request.body.parameters;
        expect(params.temperature).to.equal(0.8);
        expect(params.max_tokens).to.equal(500);
        expect(params.top_p).to.equal(0.9);
        expect(params.frequency_penalty).to.equal(0.5);
      });
      
      // Switch to Claude model
      cy.getByDataCy('model-selector').click();
      cy.getByDataCy('model-claude-2').click();
      cy.getByDataCy('model-settings').click();
      
      // Set Claude-specific parameters
      cy.getByDataCy('max-tokens-to-sample').clear().type('1000');
      cy.getByDataCy('temperature').clear().type('0.7');
      cy.getByDataCy('save-params').click();
      
      // Execute with Claude
      cy.getByDataCy('execute-button').click();
      
      cy.wait('@executePrompt').then((interception) => {
        const params = interception.request.body.parameters;
        expect(params.max_tokens_to_sample).to.equal(1000);
        expect(params.temperature).to.equal(0.7);
      });
    });
  });

  describe('Execution Context Management', () => {
    it('should maintain conversation context across executions', () => {
      cy.createTestFile('context.md', 'Hello, my name is Alice');
      cy.getByDataCy('file-context').dblclick();
      
      // Enable context retention
      cy.getByDataCy('execution-options').click();
      cy.getByDataCy('maintain-context').check();
      cy.getByDataCy('save-options').click();
      
      // First execution
      cy.getByDataCy('execute-button').click();
      cy.wait('@executePrompt');
      cy.getByDataCy('result-content').should('contain', 'Hello Alice');
      
      // Update prompt for follow-up
      cy.getByDataCy('editor-content').clear().type('What is my name?');
      
      // Second execution with context
      cy.getByDataCy('execute-button').click();
      
      cy.wait('@executePrompt').then((interception) => {
        const context = interception.request.body.context;
        expect(context).to.have.length.greaterThan(0);
        expect(context[0].content).to.include('Alice');
      });
      
      cy.getByDataCy('result-content').should('contain', 'Alice');
      
      // View context history
      cy.getByDataCy('view-context').click();
      cy.getByDataCy('context-modal').should('be.visible');
      cy.getByDataCy('context-messages').find('.message').should('have.length.greaterThan', 2);
    });

    it('should support system prompts and roles', () => {
      cy.createTestFile('system.md', 'User prompt here');
      cy.getByDataCy('file-system').dblclick();
      
      // Add system prompt
      cy.getByDataCy('add-system-prompt').click();
      cy.getByDataCy('system-prompt-editor').type('You are a helpful coding assistant specialized in Python');
      cy.getByDataCy('save-system-prompt').click();
      
      // Execute with system prompt
      cy.getByDataCy('execute-button').click();
      
      cy.wait('@executePrompt').then((interception) => {
        const messages = interception.request.body.messages;
        expect(messages[0].role).to.equal('system');
        expect(messages[0].content).to.include('coding assistant');
        expect(messages[1].role).to.equal('user');
      });
    });

    it('should handle file attachments and context files', () => {
      // Create context files
      cy.createTestFile('data.json', '{"users": 100, "revenue": 50000}');
      cy.createTestFile('analyze.md', 'Analyze the attached data file');
      
      cy.getByDataCy('file-analyze').dblclick();
      
      // Attach context file
      cy.getByDataCy('attach-context').click();
      cy.getByDataCy('file-browser').should('be.visible');
      cy.getByDataCy('select-file-data').click();
      cy.getByDataCy('confirm-attachment').click();
      
      // Verify attachment
      cy.getByDataCy('attached-files').should('contain', 'data.json');
      
      // Execute with attachment
      cy.getByDataCy('execute-button').click();
      
      cy.wait('@executePrompt').then((interception) => {
        const body = interception.request.body;
        expect(body.attachments).to.have.length(1);
        expect(body.attachments[0].name).to.equal('data.json');
        expect(body.attachments[0].content).to.include('users');
      });
    });
  });

  describe('Execution History and Results Management', () => {
    it('should save execution history', () => {
      cy.createTestFile('history.md', 'Test prompt');
      cy.getByDataCy('file-history').dblclick();
      
      // Execute multiple times with different models
      const models = ['gpt-3.5-turbo', 'gpt-4', 'claude-2'];
      
      models.forEach(model => {
        cy.getByDataCy('model-selector').click();
        cy.getByDataCy(`model-${model}`).click();
        cy.getByDataCy('execute-button').click();
        cy.wait('@executePrompt');
        cy.wait(500);
      });
      
      // View execution history
      cy.getByDataCy('execution-history').click();
      cy.getByDataCy('history-panel').should('be.visible');
      cy.getByDataCy('history-list').find('.execution-item').should('have.length', 3);
      
      // Check history details
      cy.getByDataCy('execution-0').should('contain', 'claude-2');
      cy.getByDataCy('execution-1').should('contain', 'gpt-4');
      cy.getByDataCy('execution-2').should('contain', 'gpt-3.5-turbo');
      
      // Load previous execution
      cy.getByDataCy('execution-1').click();
      cy.getByDataCy('load-execution').click();
      cy.getByDataCy('result-content').should('exist');
      cy.getByDataCy('execution-metadata').should('contain', 'gpt-4');
    });

    it('should export execution results', () => {
      cy.createTestFile('export.md', 'Generate a report');
      cy.getByDataCy('file-export').dblclick();
      
      // Execute
      cy.getByDataCy('execute-button').click();
      cy.wait('@executePrompt');
      
      // Export options
      cy.getByDataCy('export-results').click();
      cy.getByDataCy('export-modal').should('be.visible');
      
      // Export as Markdown
      cy.getByDataCy('format-markdown').click();
      cy.getByDataCy('include-metadata').check();
      cy.getByDataCy('include-prompt').check();
      cy.getByDataCy('download-export').click();
      
      // Verify download
      cy.readFile('cypress/downloads/execution-export.md').should((content) => {
        expect(content).to.include('# Execution Results');
        expect(content).to.include('Generate a report');
        expect(content).to.include('Model:');
        expect(content).to.include('Tokens:');
      });
      
      // Export as JSON
      cy.getByDataCy('export-results').click();
      cy.getByDataCy('format-json').click();
      cy.getByDataCy('download-export').click();
      
      cy.readFile('cypress/downloads/execution-export.json').then((json) => {
        expect(json).to.have.property('prompt');
        expect(json).to.have.property('result');
        expect(json).to.have.property('metadata');
      });
    });

    it('should support result formatting and copying', () => {
      cy.createTestFile('format.md', 'Generate JSON data');
      cy.getByDataCy('file-format').dblclick();
      
      // Execute
      cy.getByDataCy('execute-button').click();
      cy.wait('@executePrompt');
      
      // Format as code
      cy.getByDataCy('format-as-code').click();
      cy.getByDataCy('language-selector').select('json');
      cy.getByDataCy('apply-formatting').click();
      
      cy.getByDataCy('result-content').should('have.class', 'language-json');
      cy.getByDataCy('syntax-highlighting').should('exist');
      
      // Copy formatted result
      cy.getByDataCy('copy-formatted').click();
      cy.getByDataCy('copy-success').should('be.visible');
      
      // Verify clipboard
      cy.window().then((win) => {
        win.navigator.clipboard.readText().then((text) => {
          expect(text).to.include('{');
        });
      });
    });
  });

  describe('Batch Execution', () => {
    it('should execute prompts in batch mode', () => {
      // Create multiple prompt files
      const prompts = [
        { file: 'batch1.md', content: 'What is 2+2?' },
        { file: 'batch2.md', content: 'What is the capital of Japan?' },
        { file: 'batch3.md', content: 'Explain photosynthesis' }
      ];
      
      prompts.forEach(p => cy.createTestFile(p.file, p.content));
      
      // Select files for batch execution
      cy.selectMultipleFiles(['batch1', 'batch2', 'batch3']);
      cy.getByDataCy('file-batch1').rightclick();
      cy.getByDataCy('batch-execute').click();
      
      // Configure batch execution
      cy.getByDataCy('batch-execution-modal').should('be.visible');
      cy.getByDataCy('batch-model').select('gpt-3.5-turbo');
      cy.getByDataCy('parallel-execution').check();
      cy.getByDataCy('start-batch-execution').click();
      
      // Monitor progress
      cy.getByDataCy('batch-progress').should('be.visible');
      cy.getByDataCy('executing-count').should('exist');
      
      // Wait for completion
      cy.wait(['@executePrompt', '@executePrompt', '@executePrompt']);
      
      // Verify results
      cy.getByDataCy('batch-complete').should('be.visible');
      cy.getByDataCy('batch-results').find('.result-row').should('have.length', 3);
      
      // Check individual results
      prompts.forEach((p, i) => {
        cy.getByDataCy(`result-${i}`).should('contain', p.file);
        cy.getByDataCy(`result-${i}-status`).should('contain', 'Success');
        cy.getByDataCy(`result-${i}-tokens`).should('exist');
      });
      
      // Export batch results
      cy.getByDataCy('export-batch-results').click();
      cy.readFile('cypress/downloads/batch-execution-results.csv').should('exist');
    });

    it('should handle batch execution with templates', () => {
      // Create template
      const template = 'Translate "{{text}}" to {{language}}';
      cy.createTestFile('translation-template.md', template);
      
      // Create data file
      const data = [
        { text: 'Hello', language: 'Spanish' },
        { text: 'Goodbye', language: 'French' },
        { text: 'Thank you', language: 'German' }
      ];
      
      // Setup batch with template
      cy.getByDataCy('batch-execute-menu').click();
      cy.getByDataCy('template-batch').click();
      cy.getByDataCy('select-template').click();
      cy.getByDataCy('template-translation-template').click();
      
      // Upload or input data
      cy.getByDataCy('batch-data-input').click();
      cy.getByDataCy('data-format').select('json');
      cy.getByDataCy('data-content').type(JSON.stringify(data), { parseSpecialCharSequences: false });
      cy.getByDataCy('validate-data').click();
      
      // Verify data mapping
      cy.getByDataCy('data-preview').should('be.visible');
      cy.getByDataCy('mapped-variables').should('contain', 'text');
      cy.getByDataCy('mapped-variables').should('contain', 'language');
      cy.getByDataCy('row-count').should('contain', '3');
      
      // Execute batch
      cy.getByDataCy('execute-template-batch').click();
      
      // Wait for executions
      cy.wait('@executePrompt');
      cy.wait('@executePrompt');
      cy.wait('@executePrompt');
      
      // Verify results
      cy.getByDataCy('batch-results').should('be.visible');
      cy.getByDataCy('result-0').should('contain', 'Hola');
      cy.getByDataCy('result-1').should('contain', 'Au revoir');
      cy.getByDataCy('result-2').should('contain', 'Danke');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle API errors gracefully', () => {
      cy.createTestFile('error.md', 'Test prompt');
      cy.getByDataCy('file-error').dblclick();
      
      // Simulate API error
      cy.intercept('POST', '**/execute', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('executeError');
      
      // Execute
      cy.getByDataCy('execute-button').click();
      cy.wait('@executeError');
      
      // Verify error handling
      cy.getByDataCy('execution-error').should('be.visible');
      cy.getByDataCy('error-message').should('contain', 'Internal server error');
      cy.getByDataCy('retry-execution').should('be.visible');
      cy.getByDataCy('report-issue').should('be.visible');
      
      // Retry with success
      cy.intercept('POST', '**/execute', {
        statusCode: 200,
        body: { result: 'Success' }
      }).as('executeSuccess');
      
      cy.getByDataCy('retry-execution').click();
      cy.wait('@executeSuccess');
      cy.getByDataCy('execution-complete').should('be.visible');
    });

    it('should handle rate limiting', () => {
      cy.createTestFile('rate-limit.md', 'Test');
      cy.getByDataCy('file-rate-limit').dblclick();
      
      // Simulate rate limit
      cy.intercept('POST', '**/execute', {
        statusCode: 429,
        headers: {
          'Retry-After': '60'
        },
        body: { error: 'Rate limit exceeded' }
      }).as('rateLimited');
      
      // Execute
      cy.getByDataCy('execute-button').click();
      cy.wait('@rateLimited');
      
      // Verify rate limit handling
      cy.getByDataCy('rate-limit-warning').should('be.visible');
      cy.getByDataCy('retry-timer').should('contain', '60');
      cy.getByDataCy('queue-execution').should('be.visible');
      
      // Queue for later
      cy.getByDataCy('queue-execution').click();
      cy.getByDataCy('execution-queued').should('be.visible');
      cy.getByDataCy('queue-position').should('exist');
    });

    it('should validate model availability', () => {
      cy.createTestFile('model-check.md', 'Test');
      cy.getByDataCy('file-model-check').dblclick();
      
      // Select unavailable model
      cy.getByDataCy('model-selector').click();
      cy.getByDataCy('model-gpt-4-32k').click();
      
      // Mock unavailable response
      cy.intercept('GET', '**/models/gpt-4-32k/status', {
        statusCode: 200,
        body: { available: false, reason: 'Not in your plan' }
      });
      
      // Try to execute
      cy.getByDataCy('execute-button').click();
      
      // Should show availability warning
      cy.getByDataCy('model-unavailable').should('be.visible');
      cy.getByDataCy('unavailable-reason').should('contain', 'Not in your plan');
      cy.getByDataCy('alternative-models').should('be.visible');
      cy.getByDataCy('model-gpt-4').should('exist');
      cy.getByDataCy('model-gpt-3.5-turbo').should('exist');
    });
  });

  describe('Advanced Execution Features', () => {
    it('should support function calling', () => {
      cy.createTestFile('functions.md', 'What is the weather in Paris?');
      cy.getByDataCy('file-functions').dblclick();
      
      // Enable function calling
      cy.getByDataCy('execution-options').click();
      cy.getByDataCy('enable-functions').check();
      cy.getByDataCy('configure-functions').click();
      
      // Add weather function
      cy.getByDataCy('add-function').click();
      cy.getByDataCy('function-name').type('get_weather');
      cy.getByDataCy('function-description').type('Get weather for a location');
      cy.getByDataCy('add-parameter').click();
      cy.getByDataCy('param-name').type('location');
      cy.getByDataCy('param-type').select('string');
      cy.getByDataCy('param-required').check();
      cy.getByDataCy('save-function').click();
      
      // Execute with functions
      cy.getByDataCy('execute-button').click();
      
      cy.wait('@executePrompt').then((interception) => {
        expect(interception.request.body.functions).to.have.length(1);
        expect(interception.request.body.functions[0].name).to.equal('get_weather');
      });
      
      // Verify function call in response
      cy.getByDataCy('function-calls').should('be.visible');
      cy.getByDataCy('function-call-0').should('contain', 'get_weather');
      cy.getByDataCy('function-args-0').should('contain', 'Paris');
    });

    it('should support response validation', () => {
      cy.createTestFile('validate.md', 'Generate a JSON object with name and age fields');
      cy.getByDataCy('file-validate').dblclick();
      
      // Configure response validation
      cy.getByDataCy('execution-options').click();
      cy.getByDataCy('enable-validation').check();
      cy.getByDataCy('validation-type').select('json-schema');
      cy.getByDataCy('schema-editor').type(JSON.stringify({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name', 'age']
      }, null, 2));
      cy.getByDataCy('save-validation').click();
      
      // Execute
      cy.getByDataCy('execute-button').click();
      cy.wait('@executePrompt');
      
      // Check validation result
      cy.getByDataCy('validation-status').should('be.visible');
      cy.getByDataCy('validation-passed').should('exist');
      cy.getByDataCy('validated-response').should('have.class', 'valid');
    });

    it('should support response post-processing', () => {
      cy.createTestFile('postprocess.md', 'List 5 random numbers');
      cy.getByDataCy('file-postprocess').dblclick();
      
      // Configure post-processing
      cy.getByDataCy('execution-options').click();
      cy.getByDataCy('enable-postprocessing').check();
      cy.getByDataCy('postprocess-type').select('extract-numbers');
      cy.getByDataCy('sort-numbers').check();
      cy.getByDataCy('save-postprocess').click();
      
      // Execute
      cy.getByDataCy('execute-button').click();
      cy.wait('@executePrompt');
      
      // Verify post-processing
      cy.getByDataCy('raw-response').should('exist');
      cy.getByDataCy('processed-response').should('exist');
      cy.getByDataCy('extracted-numbers').should('be.visible');
      cy.getByDataCy('number-list').find('.number').should('have.length', 5);
      
      // Verify sorting
      cy.getByDataCy('number-list').find('.number').then($numbers => {
        const numbers = Array.from($numbers).map(el => parseInt(el.textContent));
        const sorted = [...numbers].sort((a, b) => a - b);
        expect(numbers).to.deep.equal(sorted);
      });
    });
  });
});