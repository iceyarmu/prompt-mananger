import { render, screen, fireEvent, waitFor } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, beforeEach, vi } from 'vitest';

// Import components
import FileTree from '@/components/FileTree.vue';
import MarkdownEditor from '@/components/MarkdownEditor.vue';
import Modal from '@/components/Modal.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import WebDAVConfigModal from '@/components/WebDAVConfigModal.vue';
import OptimizationResultsModal from '@/components/OptimizationResultsModal.vue';
import TemplateManager from '@/components/TemplateManager.vue';
import ModelManager from '@/components/ModelManager.vue';

describe('Keyboard Navigation Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  describe('Global Keyboard Navigation', () => {
    test('Tab navigation follows logical order', async () => {
      const { container } = render(App);
      
      const focusableElements = container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      
      const expectedOrder = [
        '[data-cy="skip-link"]',
        '[data-cy="main-nav"]',
        '[data-cy="file-tree"]',
        '[data-cy="editor"]',
        '[data-cy="toolbar"]'
      ];
      
      for (const selector of expectedOrder) {
        await user.tab();
        const element = container.querySelector(selector);
        expect(document.activeElement).toBe(element);
      }
    });

    test('Shift+Tab navigates backwards', async () => {
      const { container } = render(App);
      
      // Navigate forward first
      await user.tab();
      await user.tab();
      await user.tab();
      
      const thirdElement = document.activeElement;
      
      // Navigate backward
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      
      const firstElement = container.querySelector('[data-cy="skip-link"]');
      expect(document.activeElement).toBe(firstElement);
    });

    test('Skip links work correctly', async () => {
      const { container } = render(App);
      
      const skipLink = container.querySelector('[data-cy="skip-link"]');
      skipLink?.focus();
      
      await user.keyboard('{Enter}');
      
      const mainContent = container.querySelector('#main');
      expect(document.activeElement).toBe(mainContent);
    });
  });

  describe('File Tree Keyboard Navigation', () => {
    const mockFiles = [
      {
        name: 'folder1',
        type: 'folder',
        children: [
          { name: 'file1.md', type: 'file' },
          { name: 'file2.md', type: 'file' }
        ]
      },
      { name: 'file3.md', type: 'file' }
    ];

    test('Arrow keys navigate through tree items', async () => {
      const { container } = render(FileTree, {
        props: { files: mockFiles }
      });

      const firstItem = container.querySelector('[role="treeitem"]');
      firstItem?.focus();

      // Down arrow
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toHaveAttribute('data-name', 'file3.md');

      // Up arrow
      await user.keyboard('{ArrowUp}');
      expect(document.activeElement).toHaveAttribute('data-name', 'folder1');

      // Right arrow expands folder
      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toHaveAttribute('aria-expanded', 'true');

      // Down into folder
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toHaveAttribute('data-name', 'file1.md');

      // Left arrow collapses folder
      await user.keyboard('{ArrowLeft}');
      expect(document.activeElement).toHaveAttribute('data-name', 'folder1');
      expect(document.activeElement).toHaveAttribute('aria-expanded', 'false');
    });

    test('Enter and Space keys activate items', async () => {
      const onSelect = vi.fn();
      const { container } = render(FileTree, {
        props: { files: mockFiles, onSelect }
      });

      const fileItem = container.querySelector('[data-name="file3.md"]');
      fileItem?.focus();

      // Enter opens file
      await user.keyboard('{Enter}');
      expect(onSelect).toHaveBeenCalledWith('file3.md');

      // Space selects item
      await user.keyboard(' ');
      expect(fileItem).toHaveAttribute('aria-selected', 'true');
    });

    test('Home and End keys navigate to first/last items', async () => {
      const { container } = render(FileTree, {
        props: { files: mockFiles }
      });

      const items = container.querySelectorAll('[role="treeitem"]');
      items[1]?.focus();

      // Home key
      await user.keyboard('{Home}');
      expect(document.activeElement).toBe(items[0]);

      // End key
      await user.keyboard('{End}');
      expect(document.activeElement).toBe(items[items.length - 1]);
    });

    test('Context menu keyboard accessible', async () => {
      const { container } = render(FileTree, {
        props: { files: mockFiles }
      });

      const fileItem = container.querySelector('[data-name="file3.md"]');
      fileItem?.focus();

      // Shift+F10 or Application key opens context menu
      await user.keyboard('{Shift>}{F10}{/Shift}');
      
      const contextMenu = await screen.findByRole('menu');
      expect(contextMenu).toBeVisible();

      // Arrow keys navigate menu items
      await user.keyboard('{ArrowDown}');
      const firstMenuItem = contextMenu.querySelector('[role="menuitem"]');
      expect(document.activeElement).toBe(firstMenuItem);

      // Escape closes menu
      await user.keyboard('{Escape}');
      expect(contextMenu).not.toBeVisible();
      expect(document.activeElement).toBe(fileItem);
    });

    test('Type-ahead search in tree', async () => {
      const { container } = render(FileTree, {
        props: { files: mockFiles }
      });

      const tree = container.querySelector('[role="tree"]');
      tree?.focus();

      // Type to search
      await user.keyboard('file2');
      
      await waitFor(() => {
        expect(document.activeElement).toHaveAttribute('data-name', 'file2.md');
      });
    });
  });

  describe('Markdown Editor Keyboard Navigation', () => {
    test('Editor keyboard shortcuts', async () => {
      const onSave = vi.fn();
      const { container } = render(MarkdownEditor, {
        props: { onSave }
      });

      const editor = container.querySelector('[role="textbox"]');
      editor?.focus();

      // Bold shortcut
      await user.keyboard('{Control>}b{/Control}');
      expect(editor).toHaveValue('****');

      // Italic shortcut
      await user.keyboard('{Control>}i{/Control}');
      expect(editor).toHaveValue('**__**');

      // Save shortcut
      await user.keyboard('{Control>}s{/Control}');
      expect(onSave).toHaveBeenCalled();

      // Undo/Redo
      await user.keyboard('{Control>}z{/Control}');
      expect(editor).toHaveValue('****');

      await user.keyboard('{Control>}y{/Control}');
      expect(editor).toHaveValue('**__**');
    });

    test('Toolbar keyboard navigation', async () => {
      const { container } = render(MarkdownEditor);

      const toolbar = container.querySelector('[role="toolbar"]');
      const buttons = toolbar?.querySelectorAll('button');

      // Tab into toolbar
      buttons?.[0]?.focus();

      // Arrow keys navigate toolbar buttons
      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(buttons?.[1]);

      await user.keyboard('{ArrowLeft}');
      expect(document.activeElement).toBe(buttons?.[0]);

      // Home/End in toolbar
      await user.keyboard('{End}');
      expect(document.activeElement).toBe(buttons?.[buttons.length - 1]);

      await user.keyboard('{Home}');
      expect(document.activeElement).toBe(buttons?.[0]);
    });

    test('Find and replace keyboard shortcuts', async () => {
      const { container } = render(MarkdownEditor, {
        props: { value: 'Hello world\nHello universe' }
      });

      const editor = container.querySelector('[role="textbox"]');
      editor?.focus();

      // Open find dialog
      await user.keyboard('{Control>}f{/Control}');
      
      const findDialog = await screen.findByRole('dialog', { name: /find/i });
      expect(findDialog).toBeVisible();

      // Type search term
      const searchInput = findDialog.querySelector('input[type="search"]');
      await user.type(searchInput!, 'Hello');

      // F3 for next match
      await user.keyboard('{F3}');
      expect(editor).toHaveAttribute('data-current-match', '1');

      // Shift+F3 for previous match
      await user.keyboard('{Shift>}{F3}{/Shift}');
      expect(editor).toHaveAttribute('data-current-match', '0');

      // Open replace dialog
      await user.keyboard('{Control>}h{/Control}');
      
      const replaceInput = findDialog.querySelector('input[name="replace"]');
      await user.type(replaceInput!, 'Hi');

      // Replace current
      await user.keyboard('{Alt>}r{/Alt}');
      expect(editor).toHaveValue('Hi world\nHello universe');

      // Replace all
      await user.keyboard('{Alt>}a{/Alt}');
      expect(editor).toHaveValue('Hi world\nHi universe');
    });
  });

  describe('Modal Dialog Keyboard Navigation', () => {
    test('Focus trap in modal', async () => {
      const onClose = vi.fn();
      const { container } = render(Modal, {
        props: { visible: true, onClose }
      });

      const modal = container.querySelector('[role="dialog"]');
      const focusableElements = modal?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      // Initial focus on first element
      expect(document.activeElement).toBe(focusableElements?.[0]);

      // Tab cycles through modal elements
      for (let i = 0; i < focusableElements!.length; i++) {
        await user.tab();
      }

      // Should wrap back to first element
      expect(document.activeElement).toBe(focusableElements?.[0]);

      // Shift+Tab from first element goes to last
      await user.tab({ shift: true });
      expect(document.activeElement).toBe(focusableElements?.[focusableElements!.length - 1]);
    });

    test('Escape closes modal', async () => {
      const onClose = vi.fn();
      render(Modal, {
        props: { visible: true, onClose }
      });

      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalled();
    });

    test('Focus restoration after modal closes', async () => {
      const { rerender } = render(Modal, {
        props: { visible: false }
      });

      const triggerButton = document.createElement('button');
      triggerButton.setAttribute('data-cy', 'trigger');
      document.body.appendChild(triggerButton);
      triggerButton.focus();

      const previousFocus = document.activeElement;

      // Open modal
      await rerender({ visible: true });

      // Focus should be in modal
      const modal = screen.getByRole('dialog');
      expect(modal.contains(document.activeElement)).toBe(true);

      // Close modal
      await rerender({ visible: false });

      // Focus should return to trigger
      expect(document.activeElement).toBe(previousFocus);
    });
  });

  describe('Form Keyboard Navigation', () => {
    test('WebDAV configuration form navigation', async () => {
      const onSave = vi.fn();
      const { container } = render(WebDAVConfigModal, {
        props: { visible: true, onSave }
      });

      // Tab through form fields
      const fields = ['url', 'username', 'password'];
      for (const field of fields) {
        await user.tab();
        const input = container.querySelector(`[name="${field}"]`);
        expect(document.activeElement).toBe(input);
      }

      // Enter in last field submits form
      await user.keyboard('{Enter}');
      expect(onSave).toHaveBeenCalled();
    });

    test('Form validation keyboard accessible', async () => {
      const { container } = render(WebDAVConfigModal, {
        props: { visible: true }
      });

      const urlInput = container.querySelector('[name="url"]');
      urlInput?.focus();

      // Type invalid URL
      await user.type(urlInput as HTMLInputElement, 'invalid-url');
      await user.tab();

      // Error should be announced
      expect(urlInput).toHaveAttribute('aria-invalid', 'true');
      expect(urlInput).toHaveAttribute('aria-describedby');

      const errorId = urlInput?.getAttribute('aria-describedby');
      const errorMessage = container.querySelector(`#${errorId}`);
      expect(errorMessage).toHaveTextContent(/invalid url/i);
    });

    test('Radio group keyboard navigation', async () => {
      const { container } = render(OptimizationModeSelector);

      const radioGroup = container.querySelector('[role="radiogroup"]');
      const radios = radioGroup?.querySelectorAll('[role="radio"]');

      radios?.[0]?.focus();

      // Arrow keys navigate radio options
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(radios?.[1]);
      expect(radios?.[1]).toHaveAttribute('aria-checked', 'true');

      await user.keyboard('{ArrowUp}');
      expect(document.activeElement).toBe(radios?.[0]);
      expect(radios?.[0]).toHaveAttribute('aria-checked', 'true');

      // Space selects current option
      await user.keyboard(' ');
      expect(radios?.[0]).toHaveAttribute('aria-checked', 'true');
    });

    test('Checkbox keyboard interaction', async () => {
      const { container } = render(TemplateManager);

      const checkboxes = container.querySelectorAll('[role="checkbox"]');
      checkboxes[0]?.focus();

      // Space toggles checkbox
      await user.keyboard(' ');
      expect(checkboxes[0]).toHaveAttribute('aria-checked', 'true');

      await user.keyboard(' ');
      expect(checkboxes[0]).toHaveAttribute('aria-checked', 'false');

      // Tab navigates to next checkbox
      await user.tab();
      expect(document.activeElement).toBe(checkboxes[1]);
    });
  });

  describe('Data Table Keyboard Navigation', () => {
    test('Table navigation with arrow keys', async () => {
      const { container } = render(ModelManager);

      const table = container.querySelector('[role="table"]');
      const firstCell = table?.querySelector('td');
      firstCell?.focus();

      // Arrow keys navigate cells
      await user.keyboard('{ArrowRight}');
      expect(document.activeElement?.getAttribute('role')).toBe('cell');

      await user.keyboard('{ArrowDown}');
      expect(document.activeElement?.parentElement?.getAttribute('role')).toBe('row');

      // Ctrl+Home/End navigate to first/last cell
      await user.keyboard('{Control>}{Home}{/Control}');
      const cells = table?.querySelectorAll('td');
      expect(document.activeElement).toBe(cells?.[0]);

      await user.keyboard('{Control>}{End}{/Control}');
      expect(document.activeElement).toBe(cells?.[cells!.length - 1]);
    });

    test('Table row actions keyboard accessible', async () => {
      const onEdit = vi.fn();
      const onDelete = vi.fn();
      
      const { container } = render(ModelManager, {
        props: { onEdit, onDelete }
      });

      const firstRow = container.querySelector('tr[data-row="0"]');
      const editButton = firstRow?.querySelector('[aria-label="Edit"]');
      
      editButton?.focus();
      await user.keyboard('{Enter}');
      expect(onEdit).toHaveBeenCalled();

      const deleteButton = firstRow?.querySelector('[aria-label="Delete"]');
      deleteButton?.focus();
      await user.keyboard('{Enter}');
      expect(onDelete).toHaveBeenCalled();
    });
  });

  describe('Custom Keyboard Shortcuts', () => {
    test('Application-wide shortcuts', async () => {
      const { container } = render(App);

      // Command palette
      await user.keyboard('{Control>}k{/Control}');
      const commandPalette = await screen.findByRole('dialog', { name: /command/i });
      expect(commandPalette).toBeVisible();

      // Close palette
      await user.keyboard('{Escape}');
      expect(commandPalette).not.toBeVisible();

      // Quick save
      await user.keyboard('{Control>}s{/Control}');
      const saveNotification = await screen.findByRole('status');
      expect(saveNotification).toHaveTextContent(/saved/i);

      // New file
      await user.keyboard('{Control>}n{/Control}');
      const newFileDialog = await screen.findByRole('dialog', { name: /new file/i });
      expect(newFileDialog).toBeVisible();

      // Open file
      await user.keyboard('{Control>}o{/Control}');
      const openFileDialog = await screen.findByRole('dialog', { name: /open/i });
      expect(openFileDialog).toBeVisible();
    });

    test('Keyboard shortcut help dialog', async () => {
      const { container } = render(App);

      // Open help
      await user.keyboard('{Control>}?{/Control}');
      
      const helpDialog = await screen.findByRole('dialog', { name: /keyboard shortcuts/i });
      expect(helpDialog).toBeVisible();

      // Should list all shortcuts
      const shortcuts = helpDialog.querySelectorAll('[data-shortcut]');
      expect(shortcuts.length).toBeGreaterThan(10);

      // Each shortcut should have description
      shortcuts.forEach(shortcut => {
        expect(shortcut).toHaveAttribute('data-shortcut');
        expect(shortcut).toHaveTextContent(/.+/);
      });
    });
  });

  describe('Focus Management', () => {
    test('Focus visible indicators', async () => {
      const { container } = render(App);

      const focusableElements = container.querySelectorAll(
        'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      for (const element of focusableElements) {
        (element as HTMLElement).focus();
        
        const styles = window.getComputedStyle(element);
        const hasFocusIndicator = 
          styles.outlineWidth !== '0px' ||
          styles.boxShadow !== 'none' ||
          element.classList.contains('focus-visible');
        
        expect(hasFocusIndicator).toBe(true);
      }
    });

    test('Focus moves to appropriate element after action', async () => {
      const { container } = render(FileTree, {
        props: { files: mockFiles }
      });

      const fileItem = container.querySelector('[data-name="file3.md"]');
      fileItem?.focus();

      // Delete file
      await user.keyboard('{Delete}');
      
      // Confirm deletion
      const confirmButton = await screen.findByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Focus should move to previous item
      await waitFor(() => {
        expect(document.activeElement).toHaveAttribute('data-name', 'folder1');
      });
    });

    test('Focus trap in dropdown menus', async () => {
      const { container } = render(ModelSelect);

      const selectButton = container.querySelector('[role="combobox"]');
      selectButton?.focus();

      // Open dropdown
      await user.keyboard('{Enter}');
      
      const dropdown = await screen.findByRole('listbox');
      expect(dropdown).toBeVisible();

      // Tab should stay within dropdown
      await user.tab();
      expect(dropdown.contains(document.activeElement)).toBe(true);

      // Escape closes and returns focus
      await user.keyboard('{Escape}');
      expect(dropdown).not.toBeVisible();
      expect(document.activeElement).toBe(selectButton);
    });
  });

  describe('Accessibility Shortcuts', () => {
    test('Landmark navigation shortcuts', async () => {
      const { container } = render(App);

      // Skip to navigation
      await user.keyboard('{Alt>}n{/Alt}');
      const nav = container.querySelector('nav');
      expect(document.activeElement).toBe(nav);

      // Skip to main
      await user.keyboard('{Alt>}m{/Alt}');
      const main = container.querySelector('main');
      expect(document.activeElement).toBe(main);

      // Skip to search
      await user.keyboard('{Alt>}s{/Alt}');
      const search = container.querySelector('[role="search"]');
      expect(document.activeElement?.closest('[role="search"]')).toBe(search);
    });

    test('Heading navigation', async () => {
      const { container } = render(App);

      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');

      // Navigate through headings
      for (let i = 0; i < headings.length - 1; i++) {
        await user.keyboard('{Alt>}]{/Alt}'); // Next heading
        expect(document.activeElement).toBe(headings[i + 1]);
      }

      // Navigate backwards
      await user.keyboard('{Alt>}[{/Alt}'); // Previous heading
      expect(document.activeElement).toBe(headings[headings.length - 2]);
    });
  });
});

// Helper to simulate complex keyboard interactions
export class KeyboardNavigationTester {
  private container: HTMLElement;
  private user: ReturnType<typeof userEvent.setup>;

  constructor(container: HTMLElement) {
    this.container = container;
    this.user = userEvent.setup();
  }

  async navigateToElement(selector: string): Promise<HTMLElement | null> {
    const element = this.container.querySelector(selector) as HTMLElement;
    if (!element) return null;

    element.focus();
    return element;
  }

  async testTabOrder(expectedSelectors: string[]): Promise<boolean> {
    for (const selector of expectedSelectors) {
      await this.user.tab();
      const expected = this.container.querySelector(selector);
      if (document.activeElement !== expected) {
        console.error(`Tab order mismatch: expected ${selector}, got ${document.activeElement?.tagName}`);
        return false;
      }
    }
    return true;
  }

  async testArrowKeyNavigation(direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
    const keyMap = {
      up: '{ArrowUp}',
      down: '{ArrowDown}',
      left: '{ArrowLeft}',
      right: '{ArrowRight}'
    };
    
    await this.user.keyboard(keyMap[direction]);
  }

  async testKeyboardShortcut(modifier: string, key: string): Promise<void> {
    await this.user.keyboard(`{${modifier}>}${key}{/${modifier}}`);
  }

  getFocusedElement(): Element | null {
    return document.activeElement;
  }

  async ensureFocusVisible(): Promise<boolean> {
    const element = document.activeElement as HTMLElement;
    if (!element) return false;

    const styles = window.getComputedStyle(element);
    return styles.outlineWidth !== '0px' || 
           styles.boxShadow !== 'none' ||
           element.classList.contains('focus-visible');
  }
}