import { axe, toHaveNoViolations } from 'jest-axe';
import { render, screen, fireEvent } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';

expect.extend(toHaveNoViolations);

describe('Accessibility Compliance', () => {
  beforeAll(() => {
    // Configure axe for WCAG 2.1 AA
    axe.configure({
      rules: {
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'focus-management': { enabled: true }
      }
    });
  });
  
  describe('File Tree Accessibility', () => {
    test('meets WCAG 2.1 AA standards', async () => {
      const { container } = render(FileTree, {
        props: { files: mockFileTree }
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
    
    test('supports keyboard navigation', async () => {
      const { container } = render(FileTree, {
        props: { files: mockFileTree }
      });
      
      const firstFile = container.querySelector('[role="treeitem"]');
      firstFile?.focus();
      
      // Test arrow key navigation
      await userEvent.keyboard('{ArrowDown}');
      const secondFile = document.activeElement;
      expect(secondFile).toHaveAttribute('role', 'treeitem');
      expect(secondFile).toHaveAttribute('tabindex', '0');
      
      // Test Enter key to open
      await userEvent.keyboard('{Enter}');
      expect(mockOpenFile).toHaveBeenCalled();
      
      // Test Space key to select
      await userEvent.keyboard(' ');
      expect(secondFile).toHaveAttribute('aria-selected', 'true');
      
      // Test Home/End keys
      await userEvent.keyboard('{Home}');
      expect(document.activeElement).toBe(firstFile);
      
      await userEvent.keyboard('{End}');
      const lastFile = container.querySelector('[role="treeitem"]:last-child');
      expect(document.activeElement).toBe(lastFile);
    });
    
    test('announces file operations to screen readers', async () => {
      const { container } = render(FileTree);
      
      // Mock ARIA live region
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
      
      // Create new file
      await userEvent.keyboard('{Control>}n{/Control}');
      expect(liveRegion).toHaveTextContent('Creating new file');
      
      // Delete file
      const file = screen.getByRole('treeitem', { name: 'test.md' });
      file.focus();
      await userEvent.keyboard('{Delete}');
      expect(liveRegion).toHaveTextContent('File deleted: test.md');
    });
    
    test('provides proper ARIA labels and descriptions', () => {
      const { container } = render(FileTree);
      
      // Tree structure
      const tree = container.querySelector('[role="tree"]');
      expect(tree).toHaveAttribute('aria-label', 'File explorer');
      
      // Tree items
      const items = container.querySelectorAll('[role="treeitem"]');
      items.forEach(item => {
        expect(item).toHaveAttribute('aria-label');
        if (item.querySelector('.folder-icon')) {
          expect(item).toHaveAttribute('aria-expanded');
        }
      });
      
      // Context menu trigger
      const contextTrigger = container.querySelector('[aria-haspopup="menu"]');
      expect(contextTrigger).toHaveAttribute('aria-label', 'File actions');
    });
  });
  
  describe('Markdown Editor Accessibility', () => {
    test('meets WCAG 2.1 AA standards', async () => {
      const { container } = render(MarkdownEditor);
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
    
    test('provides screen reader announcements', async () => {
      const { container } = render(MarkdownEditor);
      
      const editor = container.querySelector('[role="textbox"]');
      expect(editor).toHaveAttribute('aria-label', 'Markdown editor');
      expect(editor).toHaveAttribute('aria-describedby');
      
      const description = container.querySelector(`#${editor?.getAttribute('aria-describedby')}`);
      expect(description).toHaveTextContent('markdown syntax');
    });
    
    test('supports keyboard shortcuts with announcements', async () => {
      const { container } = render(MarkdownEditor);
      const editor = container.querySelector('[role="textbox"]') as HTMLElement;
      
      // Bold shortcut
      editor.focus();
      await userEvent.keyboard('{Control>}b{/Control}');
      
      const announcement = container.querySelector('[role="status"]');
      expect(announcement).toHaveTextContent('Bold formatting applied');
      
      // Save shortcut
      await userEvent.keyboard('{Control>}s{/Control}');
      expect(announcement).toHaveTextContent('File saved');
    });
    
    test('toolbar accessibility', async () => {
      const { container } = render(MarkdownEditor);
      
      const toolbar = container.querySelector('[role="toolbar"]');
      expect(toolbar).toHaveAttribute('aria-label', 'Formatting toolbar');
      
      // All buttons have labels
      const buttons = toolbar?.querySelectorAll('button');
      buttons?.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
        expect(button).toHaveAttribute('type', 'button');
      });
      
      // Keyboard navigation in toolbar
      const firstButton = buttons?.[0];
      firstButton?.focus();
      
      await userEvent.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(buttons?.[1]);
      
      await userEvent.keyboard('{ArrowLeft}');
      expect(document.activeElement).toBe(buttons?.[0]);
    });
  });
  
  describe('Modal Dialog Accessibility', () => {
    test('optimization modal meets standards', async () => {
      const { container } = render(OptimizationModal, {
        props: { visible: true }
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
    
    test('implements focus trap', async () => {
      const { container } = render(OptimizationModal, {
        props: { visible: true }
      });
      
      const modal = container.querySelector('[role="dialog"]');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      
      // First focusable element gets focus
      const firstFocusable = modal?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      expect(document.activeElement).toBe(firstFocusable);
      
      // Tab cycles within modal
      const focusableElements = modal?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const lastFocusable = focusableElements?.[focusableElements.length - 1];
      
      (lastFocusable as HTMLElement)?.focus();
      await userEvent.keyboard('{Tab}');
      expect(document.activeElement).toBe(firstFocusable);
    });
    
    test('escape key handling', async () => {
      const mockClose = vi.fn();
      const { container } = render(OptimizationModal, {
        props: { visible: true, onClose: mockClose }
      });
      
      await userEvent.keyboard('{Escape}');
      expect(mockClose).toHaveBeenCalled();
    });
    
    test('proper ARIA attributes', () => {
      const { container } = render(OptimizationModal, {
        props: { visible: true }
      });
      
      const modal = container.querySelector('[role="dialog"]');
      expect(modal).toHaveAttribute('aria-labelledby');
      expect(modal).toHaveAttribute('aria-describedby');
      
      const title = container.querySelector(`#${modal?.getAttribute('aria-labelledby')}`);
      expect(title).toHaveTextContent('Optimization');
      
      const description = container.querySelector(`#${modal?.getAttribute('aria-describedby')}`);
      expect(description).toBeInTheDocument();
    });
  });
  
  describe('Color Contrast Compliance', () => {
    test('text meets WCAG AA contrast ratios', async () => {
      const { container } = render(App);
      
      // Test both light and dark themes
      const themes = ['light', 'dark'];
      
      for (const theme of themes) {
        container.setAttribute('data-theme', theme);
        
        const results = await axe(container, {
          rules: { 'color-contrast': { enabled: true } }
        });
        
        expect(results.violations.filter(v => v.id === 'color-contrast')).toHaveLength(0);
      }
    });
    
    test('interactive elements have sufficient contrast', async () => {
      const { container } = render(App);
      
      // Buttons
      const buttons = container.querySelectorAll('button');
      for (const button of buttons) {
        const results = await axe(button);
        expect(results).toHaveNoViolations();
      }
      
      // Links
      const links = container.querySelectorAll('a');
      for (const link of links) {
        const results = await axe(link);
        expect(results).toHaveNoViolations();
      }
      
      // Form inputs
      const inputs = container.querySelectorAll('input, textarea, select');
      for (const input of inputs) {
        const results = await axe(input);
        expect(results).toHaveNoViolations();
      }
    });
    
    test('focus indicators are visible', () => {
      const { container } = render(App);
      
      const focusableElements = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      
      focusableElements.forEach(element => {
        (element as HTMLElement).focus();
        const styles = window.getComputedStyle(element);
        
        // Check for visible focus indicator
        const hasOutline = styles.outlineWidth !== '0px' && styles.outlineStyle !== 'none';
        const hasBoxShadow = styles.boxShadow !== 'none';
        const hasBorder = styles.borderWidth !== '0px';
        
        expect(hasOutline || hasBoxShadow || hasBorder).toBe(true);
      });
    });
  });
  
  describe('Screen Reader Testing', () => {
    test('landmarks are properly defined', () => {
      const { container } = render(App);
      
      // Main landmarks
      expect(container.querySelector('[role="banner"], header')).toBeInTheDocument();
      expect(container.querySelector('[role="navigation"], nav')).toBeInTheDocument();
      expect(container.querySelector('[role="main"], main')).toBeInTheDocument();
      
      // Regions with labels
      const regions = container.querySelectorAll('[role="region"]');
      regions.forEach(region => {
        expect(region).toHaveAttribute('aria-label');
      });
    });
    
    test('headings follow proper hierarchy', () => {
      const { container } = render(App);
      
      const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      let lastLevel = 0;
      
      headings.forEach(heading => {
        const level = parseInt(heading.tagName[1]);
        
        // Should not skip levels
        if (lastLevel > 0) {
          expect(level).toBeLessThanOrEqual(lastLevel + 1);
        }
        
        lastLevel = level;
      });
      
      // Should have exactly one h1
      const h1s = container.querySelectorAll('h1');
      expect(h1s).toHaveLength(1);
    });
    
    test('images have appropriate alt text', () => {
      const { container } = render(App);
      
      const images = container.querySelectorAll('img');
      images.forEach(img => {
        if (!img.hasAttribute('aria-hidden')) {
          expect(img).toHaveAttribute('alt');
          expect(img.getAttribute('alt')).not.toBe('');
        }
      });
      
      // Decorative images
      const decorativeImages = container.querySelectorAll('img[aria-hidden="true"]');
      decorativeImages.forEach(img => {
        expect(img).toHaveAttribute('alt', '');
      });
    });
    
    test('form fields have labels', () => {
      const { container } = render(App);
      
      const inputs = container.querySelectorAll('input, textarea, select');
      inputs.forEach(input => {
        const hasLabel = input.hasAttribute('aria-label') || 
                        input.hasAttribute('aria-labelledby') ||
                        container.querySelector(`label[for="${input.id}"]`);
        
        expect(hasLabel).toBe(true);
        
        // Required fields
        if (input.hasAttribute('required')) {
          expect(input).toHaveAttribute('aria-required', 'true');
        }
        
        // Invalid fields
        if (input.hasAttribute('aria-invalid')) {
          expect(input).toHaveAttribute('aria-describedby');
        }
      });
    });
    
    test('dynamic content updates are announced', async () => {
      const { container } = render(App);
      
      // Check for live regions
      const liveRegions = container.querySelectorAll('[aria-live]');
      expect(liveRegions.length).toBeGreaterThan(0);
      
      // Status messages
      const statusRegion = container.querySelector('[role="status"]');
      expect(statusRegion).toBeInTheDocument();
      
      // Alert messages
      const alertRegion = container.querySelector('[role="alert"]');
      expect(alertRegion).toBeInTheDocument();
      
      // Test dynamic update
      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);
      
      expect(statusRegion).toHaveTextContent(/saved/i);
    });
  });
  
  describe('Keyboard Navigation', () => {
    test('all interactive elements are keyboard accessible', async () => {
      const { container } = render(App);
      
      const interactiveElements = container.querySelectorAll(
        'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      interactiveElements.forEach(element => {
        expect(element).toHaveAttribute('tabindex');
        const tabindex = parseInt(element.getAttribute('tabindex') || '0');
        expect(tabindex).toBeGreaterThanOrEqual(-1);
      });
    });
    
    test('tab order is logical', async () => {
      const { container } = render(App);
      
      const tabbableElements = Array.from(container.querySelectorAll(
        'a, button, input, select, textarea, [tabindex="0"]'
      ));
      
      // Tab through all elements
      for (let i = 0; i < tabbableElements.length; i++) {
        await userEvent.keyboard('{Tab}');
        
        // Check focus moves in DOM order
        if (document.activeElement && tabbableElements.includes(document.activeElement as HTMLElement)) {
          const currentIndex = tabbableElements.indexOf(document.activeElement as HTMLElement);
          expect(currentIndex).toBeGreaterThanOrEqual(i);
        }
      }
    });
    
    test('skip links work correctly', async () => {
      const { container } = render(App);
      
      // Should have skip to main content link
      const skipLink = container.querySelector('a[href="#main"]');
      expect(skipLink).toBeInTheDocument();
      
      // Should be first focusable element
      await userEvent.keyboard('{Tab}');
      expect(document.activeElement).toBe(skipLink);
      
      // Should jump to main content
      await userEvent.keyboard('{Enter}');
      const mainContent = container.querySelector('#main, [role="main"]');
      expect(document.activeElement).toBe(mainContent);
    });
    
    test('custom keyboard shortcuts are documented', () => {
      const { container } = render(App);
      
      // Keyboard help should be available
      const helpButton = screen.getByRole('button', { name: /keyboard shortcuts/i });
      expect(helpButton).toBeInTheDocument();
      
      // Shortcuts should not conflict with browser/OS shortcuts
      const shortcuts = [
        { key: 'Control+s', action: 'Save' },
        { key: 'Control+o', action: 'Open' },
        { key: 'Control+/', action: 'Show shortcuts' }
      ];
      
      shortcuts.forEach(shortcut => {
        const element = container.querySelector(`[data-shortcut="${shortcut.key}"]`);
        if (element) {
          expect(element).toHaveAttribute('aria-keyshortcuts', shortcut.key.toLowerCase());
        }
      });
    });
  });
  
  describe('Responsive Accessibility', () => {
    test('mobile touch targets meet minimum size', () => {
      const { container } = render(App);
      
      // Set mobile viewport
      window.innerWidth = 375;
      window.innerHeight = 667;
      
      const touchTargets = container.querySelectorAll('button, a, [role="button"]');
      touchTargets.forEach(target => {
        const rect = (target as HTMLElement).getBoundingClientRect();
        
        // WCAG 2.1 requires 44x44 CSS pixels minimum
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
      });
    });
    
    test('zoom functionality works correctly', () => {
      const { container } = render(App);
      
      // Test up to 200% zoom (WCAG requirement)
      const zoomLevels = [100, 125, 150, 175, 200];
      
      zoomLevels.forEach(zoom => {
        document.body.style.zoom = `${zoom}%`;
        
        // Content should remain accessible
        const mainContent = container.querySelector('[role="main"]');
        expect(mainContent).toBeVisible();
        
        // No horizontal scrolling at 200% zoom
        if (zoom === 200) {
          expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
        }
      });
    });
  });
  
  describe('Error Handling Accessibility', () => {
    test('error messages are accessible', async () => {
      const { container } = render(FormWithValidation);
      
      const input = screen.getByRole('textbox', { name: /email/i });
      const submitButton = screen.getByRole('button', { name: /submit/i });
      
      // Submit with invalid data
      await userEvent.type(input, 'invalid-email');
      await userEvent.click(submitButton);
      
      // Error message should be associated with input
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');
      
      const errorId = input.getAttribute('aria-describedby');
      const errorMessage = container.querySelector(`#${errorId}`);
      expect(errorMessage).toHaveAttribute('role', 'alert');
      expect(errorMessage).toHaveTextContent(/valid email/i);
    });
    
    test('loading states are announced', async () => {
      const { container } = render(App);
      
      const loadButton = screen.getByRole('button', { name: /load data/i });
      await userEvent.click(loadButton);
      
      // Loading indicator should be announced
      const loadingIndicator = container.querySelector('[aria-busy="true"]');
      expect(loadingIndicator).toBeInTheDocument();
      expect(loadingIndicator).toHaveAttribute('aria-label', expect.stringContaining('Loading'));
      
      // Completion should be announced
      await waitFor(() => {
        const statusRegion = container.querySelector('[role="status"]');
        expect(statusRegion).toHaveTextContent(/loaded/i);
      });
    });
  });
});

// Helper functions
const mockFileTree = [
  { name: 'folder1', type: 'folder', children: [] },
  { name: 'file1.md', type: 'file' },
  { name: 'file2.md', type: 'file' }
];

const mockOpenFile = vi.fn();