describe('Regression Testing Suite', () => {
  describe('Existing Optimization Features', () => {
    test('general optimization mode still works', async () => {
      const testPrompt = 'You are a helpful assistant';
      const result = await optimizationService.optimize(testPrompt, 'general');
      
      expect(result).toBeDefined();
      expect(result.optimized).not.toBe(testPrompt);
      expect(result.improvements).toBeInstanceOf(Array);
      expect(result.improvements.length).toBeGreaterThan(0);
    });
    
    test('analytical optimization mode still works', async () => {
      const testPrompt = 'Analyze data and provide insights';
      const result = await optimizationService.optimize(testPrompt, 'analytical');
      
      expect(result).toBeDefined();
      expect(result.clarityScore).toBeDefined();
      expect(result.specificityScore).toBeDefined();
    });
    
    test('output format optimization still works', async () => {
      const testPrompt = 'Generate a response';
      const result = await optimizationService.optimize(testPrompt, 'output-format', {
        format: 'JSON'
      });
      
      expect(result.optimized).toContain('JSON');
      expect(result.formatExample).toBeDefined();
    });
    
    test('iterative optimization still works', async () => {
      const testPrompt = 'Simple prompt';
      const result = await optimizationService.optimize(testPrompt, 'iterative', {
        iterations: 3
      });
      
      expect(result.iterations).toHaveLength(3);
      expect(result.bestIteration).toBeDefined();
    });
  });
  
  describe('API Compatibility', () => {
    test('v1 API endpoints still work', async () => {
      const endpoints = [
        '/api/v1/optimize',
        '/api/v1/execute',
        '/api/v1/templates',
        '/api/v1/history'
      ];
      
      for (const endpoint of endpoints) {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { 'X-API-Version': 'v1' }
        });
        
        expect(response.status).not.toBe(404);
        expect(response.headers.get('X-API-Version')).toBe('v1');
      }
    });
    
    test('backward compatible request format', async () => {
      // Old format
      const oldFormatRequest = {
        prompt: 'Test prompt',
        mode: 'general'
      };
      
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(oldFormatRequest)
      });
      
      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.optimized).toBeDefined();
    });
    
    test('deprecated parameters still work with warnings', async () => {
      const deprecatedRequest = {
        prompt: 'Test',
        enhanceMode: true, // deprecated
        useAI: true // deprecated
      };
      
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deprecatedRequest)
      });
      
      expect(response.ok).toBe(true);
      expect(response.headers.get('X-Deprecation-Warning')).toBeDefined();
    });
  });
  
  describe('Settings and Preferences', () => {
    test('existing preferences are preserved after update', async () => {
      const originalPrefs = {
        theme: 'dark',
        language: 'en-US',
        autoSave: true,
        autoSaveInterval: 5000,
        customSetting: 'value'
      };
      
      localStorage.setItem('preferences', JSON.stringify(originalPrefs));
      
      // Simulate app update
      await app.initialize();
      
      const loadedPrefs = JSON.parse(localStorage.getItem('preferences') || '{}');
      expect(loadedPrefs).toMatchObject(originalPrefs);
    });
    
    test('migration of old settings format', async () => {
      // Old format
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('lang', 'en');
      localStorage.setItem('autosave', 'true');
      
      // Run migration
      await app.migrateSettings();
      
      // Check new format
      const prefs = JSON.parse(localStorage.getItem('preferences') || '{}');
      expect(prefs.theme).toBe('dark');
      expect(prefs.language).toBe('en-US');
      expect(prefs.autoSave).toBe(true);
      
      // Old keys should be removed
      expect(localStorage.getItem('theme')).toBeNull();
      expect(localStorage.getItem('lang')).toBeNull();
      expect(localStorage.getItem('autosave')).toBeNull();
    });
  });
  
  describe('File Operations', () => {
    test('file save functionality unchanged', async () => {
      const testContent = 'Test content for regression';
      const filename = 'regression-test.md';
      
      await fileManager.createFile(filename, testContent);
      const savedContent = await fileManager.readFile(filename);
      
      expect(savedContent).toBe(testContent);
    });
    
    test('file tree operations still work', async () => {
      // Create folder
      await fileManager.createFolder('regression-folder');
      
      // Create file in folder
      await fileManager.createFile('regression-folder/test.md', 'content');
      
      // List files
      const files = await fileManager.listFiles('regression-folder');
      expect(files).toContainEqual(expect.objectContaining({
        name: 'test.md'
      }));
      
      // Delete file
      await fileManager.deleteFile('regression-folder/test.md');
      const filesAfter = await fileManager.listFiles('regression-folder');
      expect(filesAfter).not.toContainEqual(expect.objectContaining({
        name: 'test.md'
      }));
    });
  });
  
  describe('WebDAV Integration', () => {
    test('WebDAV connection still works', async () => {
      const config = {
        url: 'http://localhost:8080/webdav',
        username: 'testuser',
        password: 'testpass'
      };
      
      const connected = await webdav.connect(config);
      expect(connected).toBe(true);
      
      const status = await webdav.getStatus();
      expect(status.connected).toBe(true);
    });
    
    test('WebDAV file operations unchanged', async () => {
      await webdav.connect(testConfig);
      
      // Create file
      await webdav.putFile('/test.md', 'WebDAV test content');
      
      // Read file
      const content = await webdav.getFile('/test.md');
      expect(content).toBe('WebDAV test content');
      
      // Delete file
      await webdav.deleteFile('/test.md');
      
      // Verify deleted
      await expect(webdav.getFile('/test.md')).rejects.toThrow();
    });
  });
  
  describe('Editor Functionality', () => {
    test('markdown rendering unchanged', () => {
      const markdown = `# Heading
      
**Bold** and *italic*

- List item 1
- List item 2

\`\`\`javascript
const code = 'example';
\`\`\``;
      
      const rendered = markdownRenderer.render(markdown);
      
      expect(rendered).toContain('<h1>Heading</h1>');
      expect(rendered).toContain('<strong>Bold</strong>');
      expect(rendered).toContain('<em>italic</em>');
      expect(rendered).toContain('<ul>');
      expect(rendered).toContain('<pre><code class="language-javascript">');
    });
    
    test('syntax highlighting still works', () => {
      const code = 'const test = "value";';
      const highlighted = syntaxHighlighter.highlight(code, 'javascript');
      
      expect(highlighted).toContain('class="token keyword"');
      expect(highlighted).toContain('class="token string"');
    });
    
    test('editor shortcuts unchanged', async () => {
      const editor = await mountEditor();
      
      // Bold shortcut
      await userEvent.keyboard('{Control>}b{/Control}');
      expect(editor.getSelectedText()).toBe('****');
      
      // Save shortcut
      const saveSpy = vi.spyOn(editor, 'save');
      await userEvent.keyboard('{Control>}s{/Control}');
      expect(saveSpy).toHaveBeenCalled();
    });
  });
  
  describe('Template System', () => {
    test('built-in templates still work', async () => {
      const templates = await templateManager.getBuiltinTemplates();
      
      expect(templates).toContainEqual(expect.objectContaining({
        id: 'general-optimize'
      }));
      expect(templates).toContainEqual(expect.objectContaining({
        id: 'analytical-optimize'
      }));
    });
    
    test('custom templates preserved', async () => {
      const customTemplate = {
        id: 'custom-1',
        name: 'My Template',
        content: 'Template content',
        variables: ['var1', 'var2']
      };
      
      await templateManager.saveTemplate(customTemplate);
      
      // Simulate app update
      await app.reinitialize();
      
      const loaded = await templateManager.getTemplate('custom-1');
      expect(loaded).toMatchObject(customTemplate);
    });
    
    test('template variable processing unchanged', () => {
      const template = 'Hello {{name}}, your age is {{age}}';
      const variables = { name: 'John', age: 30 };
      
      const processed = templateProcessor.process(template, variables);
      expect(processed).toBe('Hello John, your age is 30');
    });
  });
  
  describe('History Management', () => {
    test('optimization history preserved', async () => {
      // Create history entries
      const entries = [];
      for (let i = 0; i < 5; i++) {
        const entry = await optimizationService.optimize(`Test ${i}`, 'general');
        entries.push(entry);
      }
      
      // Simulate app update
      await app.reinitialize();
      
      // Check history preserved
      const history = await historyManager.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(5);
      
      entries.forEach(entry => {
        expect(history).toContainEqual(expect.objectContaining({
          id: entry.id
        }));
      });
    });
    
    test('history search still works', async () => {
      await historyManager.addEntry({
        prompt: 'Searchable prompt',
        optimized: 'Optimized version',
        timestamp: Date.now()
      });
      
      const results = await historyManager.search('Searchable');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].prompt).toContain('Searchable');
    });
  });
  
  describe('UI Components', () => {
    test('modal components still function', async () => {
      const { container } = render(OptimizationModal);
      
      const openButton = screen.getByRole('button', { name: /optimize/i });
      await userEvent.click(openButton);
      
      const modal = container.querySelector('[role="dialog"]');
      expect(modal).toBeVisible();
      
      // Close with escape
      await userEvent.keyboard('{Escape}');
      expect(modal).not.toBeVisible();
    });
    
    test('file tree component unchanged', async () => {
      const { container } = render(FileTree, {
        props: { files: mockFiles }
      });
      
      // Expand folder
      const folder = screen.getByText('folder1');
      await userEvent.click(folder);
      
      expect(container.querySelector('[aria-expanded="true"]')).toBeInTheDocument();
      
      // Double-click file
      const file = screen.getByText('file1.md');
      await userEvent.dblClick(file);
      
      expect(mockOpenFile).toHaveBeenCalledWith('file1.md');
    });
  });
  
  describe('Performance Baselines', () => {
    test('file load time within baseline', async () => {
      const start = performance.now();
      await fileManager.loadFile('test.md');
      const duration = performance.now() - start;
      
      // Should not regress beyond 200ms
      expect(duration).toBeLessThan(200);
    });
    
    test('optimization speed within baseline', async () => {
      const start = performance.now();
      await optimizationService.optimize('Test prompt', 'general');
      const duration = performance.now() - start;
      
      // Should not regress beyond 3000ms
      expect(duration).toBeLessThan(3000);
    });
    
    test('memory usage within baseline', () => {
      const initialMemory = performance.memory.usedJSHeapSize;
      
      // Perform typical operations
      for (let i = 0; i < 10; i++) {
        fileManager.createFile(`test${i}.md`, 'Content');
      }
      
      const finalMemory = performance.memory.usedJSHeapSize;
      const increase = (finalMemory - initialMemory) / 1024 / 1024;
      
      // Should not increase by more than 50MB
      expect(increase).toBeLessThan(50);
    });
  });
  
  describe('Data Import/Export', () => {
    test('export format unchanged', async () => {
      const exportData = await dataManager.exportAll();
      
      expect(exportData).toHaveProperty('version');
      expect(exportData).toHaveProperty('preferences');
      expect(exportData).toHaveProperty('templates');
      expect(exportData).toHaveProperty('history');
      expect(exportData).toHaveProperty('files');
      
      // Version should be compatible
      expect(exportData.version).toMatch(/^1\.\d+\.\d+$/);
    });
    
    test('import old format still works', async () => {
      const oldFormatData = {
        version: '1.0.0',
        data: {
          preferences: { theme: 'dark' },
          templates: [],
          history: []
        }
      };
      
      const result = await dataManager.import(oldFormatData);
      expect(result.success).toBe(true);
      expect(result.migrated).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    test('error boundaries still catch errors', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };
      
      const { container } = render(ErrorBoundary, {
        slots: {
          default: ThrowError
        }
      });
      
      expect(container.querySelector('.error-message')).toBeInTheDocument();
      expect(container.textContent).toContain('Something went wrong');
    });
    
    test('network error handling unchanged', async () => {
      // Mock network failure
      fetchMock.mockRejectOnce(new Error('Network error'));
      
      const result = await optimizationService.optimize('Test', 'general');
      
      expect(result.error).toBeDefined();
      expect(result.error.type).toBe('network');
      expect(result.fallback).toBeDefined();
    });
  });
});