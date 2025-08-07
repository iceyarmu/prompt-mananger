import { test, expect, type Page } from '@playwright/test';
import path from 'path';

test.describe('Markdown Editor E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/editor'); // Adjust URL based on your app routing
    await page.waitForLoadState('networkidle');
  });

  test.describe('File Loading', () => {
    test('should load a markdown file successfully', async () => {
      // Mock WebDAV response for file loading
      await page.route('**/webdav/**', route => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            body: '# Test Document\n\nThis is a test markdown file.',
            headers: {
              'Content-Type': 'text/plain'
            }
          });
        }
      });

      // Click on a file in the file tree
      await page.click('[data-testid="file-tree-item-test.md"]');
      
      // Wait for editor to load
      await page.waitForSelector('.md-editor');
      
      // Verify content is loaded
      const editorContent = await page.locator('.md-editor-input-wrapper textarea').inputValue();
      expect(editorContent).toContain('# Test Document');
      
      // Verify file name is displayed
      await expect(page.locator('.editor-header')).toContainText('test.md');
    });

    test('should show progress bar for large files', async () => {
      // Mock large file with delayed response
      await page.route('**/webdav/**', async route => {
        if (route.request().url().includes('getFileInfo')) {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ size: 5 * 1024 * 1024, name: 'large.md' })
          });
        } else if (route.request().headers()['range']) {
          // Simulate chunked loading with delay
          await new Promise(resolve => setTimeout(resolve, 100));
          route.fulfill({
            status: 206,
            body: 'Chunk content...'
          });
        }
      });

      // Click on large file
      await page.click('[data-testid="file-tree-item-large.md"]');
      
      // Check progress bar appears
      await expect(page.locator('.loading-progress-bar')).toBeVisible();
      
      // Check progress bar has percentage
      await expect(page.locator('.loading-progress-bar')).toContainText('%');
      
      // Wait for loading to complete
      await expect(page.locator('.loading-progress-bar')).toBeHidden({ timeout: 10000 });
    });

    test('should handle file loading errors gracefully', async () => {
      // Mock error response
      await page.route('**/webdav/**', route => {
        route.fulfill({
          status: 404,
          body: 'File not found'
        });
      });

      // Try to load non-existent file
      await page.click('[data-testid="file-tree-item-missing.md"]');
      
      // Check error notification appears
      await expect(page.locator('[role="alert"]')).toContainText('Failed to load file');
      
      // Check retry button is available
      await expect(page.locator('button:has-text("Retry")')).toBeVisible();
    });

    test('should prevent path traversal attacks', async () => {
      // Attempt to load file with path traversal
      await page.evaluate(() => {
        // Directly call the load function with malicious path
        window.loadFile?.('../../../etc/passwd');
      });
      
      // Check security error appears
      await expect(page.locator('[role="alert"]')).toContainText('Invalid file path');
    });
  });

  test.describe('Editor Functionality', () => {
    test('should switch between view modes', async () => {
      // Load a file first
      await page.click('[data-testid="file-tree-item-test.md"]');
      await page.waitForSelector('.md-editor');
      
      // Test Edit mode
      await page.click('button:has-text("Edit")');
      await expect(page.locator('.md-editor-input-wrapper')).toBeVisible();
      await expect(page.locator('.md-editor-preview')).toBeHidden();
      
      // Test Preview mode
      await page.click('button:has-text("Preview")');
      await expect(page.locator('.md-editor-input-wrapper')).toBeHidden();
      await expect(page.locator('.md-editor-preview')).toBeVisible();
      
      // Test Split mode
      await page.click('button:has-text("Split")');
      await expect(page.locator('.md-editor-input-wrapper')).toBeVisible();
      await expect(page.locator('.md-editor-preview')).toBeVisible();
    });

    test('should show unsaved changes indicator', async () => {
      // Load a file
      await page.click('[data-testid="file-tree-item-test.md"]');
      await page.waitForSelector('.md-editor');
      
      // Initially no unsaved changes
      await expect(page.locator('.editor-header')).not.toContainText('Unsaved');
      
      // Make changes
      await page.locator('.md-editor-input-wrapper textarea').fill('Modified content');
      
      // Check unsaved indicator appears
      await expect(page.locator('.editor-header')).toContainText('Unsaved');
    });

    test('should save file successfully', async () => {
      let saveRequested = false;
      
      // Mock save request
      await page.route('**/webdav/**', route => {
        if (route.request().method() === 'PUT') {
          saveRequested = true;
          route.fulfill({
            status: 200,
            body: 'OK'
          });
        }
      });

      // Load and modify file
      await page.click('[data-testid="file-tree-item-test.md"]');
      await page.waitForSelector('.md-editor');
      await page.locator('.md-editor-input-wrapper textarea').fill('Modified content');
      
      // Save using keyboard shortcut
      await page.keyboard.press('Control+S');
      
      // Wait for save notification
      await expect(page.locator('[role="status"]')).toContainText('saved');
      expect(saveRequested).toBe(true);
      
      // Unsaved indicator should disappear
      await expect(page.locator('.editor-header')).not.toContainText('Unsaved');
    });

    test('should support markdown formatting', async () => {
      // Load file
      await page.click('[data-testid="file-tree-item-test.md"]');
      await page.waitForSelector('.md-editor');
      
      // Enter markdown content
      const markdownContent = `
# Heading 1
## Heading 2

**Bold text**
*Italic text*

- List item 1
- List item 2

\`\`\`javascript
const code = "example";
\`\`\`
      `;
      
      await page.locator('.md-editor-input-wrapper textarea').fill(markdownContent);
      
      // Switch to preview mode
      await page.click('button:has-text("Preview")');
      
      // Verify rendered content
      await expect(page.locator('.md-editor-preview h1')).toHaveText('Heading 1');
      await expect(page.locator('.md-editor-preview h2')).toHaveText('Heading 2');
      await expect(page.locator('.md-editor-preview strong')).toHaveText('Bold text');
      await expect(page.locator('.md-editor-preview em')).toHaveText('Italic text');
      await expect(page.locator('.md-editor-preview ul li').first()).toHaveText('List item 1');
      await expect(page.locator('.md-editor-preview pre code')).toContainText('const code');
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async () => {
      // Load file
      await page.click('[data-testid="file-tree-item-test.md"]');
      await page.waitForSelector('.md-editor');
      
      // Check view mode buttons have ARIA labels
      const editButton = page.locator('button:has-text("Edit")');
      await expect(editButton).toHaveAttribute('aria-label', /edit view/i);
      await expect(editButton).toHaveAttribute('aria-pressed');
      
      const previewButton = page.locator('button:has-text("Preview")');
      await expect(previewButton).toHaveAttribute('aria-label', /preview view/i);
      await expect(previewButton).toHaveAttribute('aria-pressed');
      
      const splitButton = page.locator('button:has-text("Split")');
      await expect(splitButton).toHaveAttribute('aria-label', /split view/i);
      await expect(splitButton).toHaveAttribute('aria-pressed');
    });

    test('should be keyboard navigable', async () => {
      // Load file
      await page.click('[data-testid="file-tree-item-test.md"]');
      await page.waitForSelector('.md-editor');
      
      // Tab through view mode buttons
      await page.keyboard.press('Tab');
      await expect(page.locator('button:has-text("Edit")')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('button:has-text("Preview")')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('button:has-text("Split")')).toBeFocused();
      
      // Activate button with Enter key
      await page.keyboard.press('Enter');
      await expect(page.locator('button:has-text("Split")')).toHaveAttribute('aria-pressed', 'true');
    });

    test('should announce loading state to screen readers', async () => {
      // Mock slow loading
      await page.route('**/webdav/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        route.fulfill({
          status: 200,
          body: 'Content'
        });
      });

      // Load file
      await page.click('[data-testid="file-tree-item-test.md"]');
      
      // Check loading state has appropriate ARIA attributes
      const progressBar = page.locator('.loading-progress-bar');
      await expect(progressBar).toHaveAttribute('role', 'progressbar');
      await expect(progressBar).toHaveAttribute('aria-valuenow');
      await expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      await expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  test.describe('Error Handling', () => {
    test('should show error boundary on component crash', async () => {
      // Trigger an error in the component
      await page.evaluate(() => {
        // Force an error in the editor component
        const editor = document.querySelector('.md-editor');
        if (editor) {
          editor.dispatchEvent(new ErrorEvent('error', {
            error: new Error('Test error'),
            message: 'Test error message'
          }));
        }
      });
      
      // Check error boundary UI appears
      await expect(page.locator('[data-testid="error-boundary"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-boundary"]')).toContainText('Editor Error');
      
      // Check reload button is available
      await expect(page.locator('button:has-text("Reload Editor")')).toBeVisible();
    });

    test('should handle network errors with retry', async () => {
      let attemptCount = 0;
      
      // Mock network failure then success
      await page.route('**/webdav/**', route => {
        attemptCount++;
        if (attemptCount === 1) {
          route.abort('failed');
        } else {
          route.fulfill({
            status: 200,
            body: 'Retry successful'
          });
        }
      });

      // Try to load file
      await page.click('[data-testid="file-tree-item-test.md"]');
      
      // Error notification should appear
      await expect(page.locator('[role="alert"]')).toContainText('Network error');
      
      // Click retry
      await page.click('button:has-text("Retry")');
      
      // Should succeed on retry
      await expect(page.locator('.md-editor')).toBeVisible();
      expect(attemptCount).toBe(2);
    });
  });

  test.describe('Internationalization', () => {
    test('should display UI in Chinese when locale is zh-CN', async () => {
      // Change locale to Chinese
      await page.evaluate(() => {
        localStorage.setItem('locale', 'zh-CN');
      });
      await page.reload();
      
      // Load file
      await page.click('[data-testid="file-tree-item-test.md"]');
      await page.waitForSelector('.md-editor');
      
      // Check Chinese UI text
      await expect(page.locator('button').filter({ hasText: '编辑' })).toBeVisible();
      await expect(page.locator('button').filter({ hasText: '预览' })).toBeVisible();
      await expect(page.locator('button').filter({ hasText: '分栏' })).toBeVisible();
    });

    test('should display loading messages in correct language', async () => {
      // Set locale to Chinese
      await page.evaluate(() => {
        localStorage.setItem('locale', 'zh-CN');
      });
      await page.reload();
      
      // Mock slow loading
      await page.route('**/webdav/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 500));
        route.fulfill({
          status: 200,
          body: 'Content'
        });
      });

      // Load file
      await page.click('[data-testid="file-tree-item-test.md"]');
      
      // Check Chinese loading message
      await expect(page.locator('.loading-progress-bar')).toContainText('正在加载文件');
    });
  });
});