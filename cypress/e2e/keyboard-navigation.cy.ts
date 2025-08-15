/// <reference types="cypress" />

describe('Keyboard Navigation Testing', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  describe('Tab Navigation', () => {
    it('should navigate through all interactive elements with Tab', () => {
      const interactiveElements = [];
      
      // Start from body
      cy.get('body').tab();
      
      // Tab through all focusable elements
      const maxTabs = 100; // Prevent infinite loop
      for (let i = 0; i < maxTabs; i++) {
        cy.focused().then(($el) => {
          if ($el.length > 0) {
            const tagName = $el.prop('tagName');
            const role = $el.attr('role');
            const testId = $el.attr('data-testid');
            
            interactiveElements.push({
              element: tagName,
              role: role,
              testId: testId
            });
          }
        });
        
        cy.realPress('Tab');
      }
      
      // Verify we found interactive elements
      cy.wrap(interactiveElements).should('have.length.greaterThan', 0);
    });

    it('should navigate backwards with Shift+Tab', () => {
      // Tab forward a few times
      cy.get('body').tab().tab().tab();
      
      // Save current focused element
      let forwardElement;
      cy.focused().then(($el) => {
        forwardElement = $el.attr('data-testid') || $el.text();
      });
      
      // Shift+Tab backward
      cy.realPress(['Shift', 'Tab']);
      
      // Verify we moved backward
      cy.focused().then(($el) => {
        const currentElement = $el.attr('data-testid') || $el.text();
        expect(currentElement).to.not.equal(forwardElement);
      });
    });

    it('should skip hidden elements', () => {
      // Tab through elements
      cy.get('body').tab();
      
      // Focused element should be visible
      cy.focused().should('be.visible');
      
      // Continue tabbing and checking visibility
      for (let i = 0; i < 10; i++) {
        cy.realPress('Tab');
        cy.focused().should('be.visible');
      }
    });
  });

  describe('Arrow Key Navigation', () => {
    it('should navigate file tree with arrow keys', () => {
      // Focus file tree
      cy.get('[data-testid="file-tree"]').within(() => {
        cy.get('[role="treeitem"]').first().focus();
        
        // Down arrow moves to next item
        cy.realPress('ArrowDown');
        cy.focused().should('have.attr', 'role', 'treeitem');
        
        // Up arrow moves to previous item
        cy.realPress('ArrowUp');
        cy.focused().should('have.attr', 'role', 'treeitem');
        
        // Right arrow expands folder
        cy.get('[aria-expanded="false"]').first().focus();
        cy.realPress('ArrowRight');
        cy.focused().should('have.attr', 'aria-expanded', 'true');
        
        // Left arrow collapses folder
        cy.realPress('ArrowLeft');
        cy.focused().should('have.attr', 'aria-expanded', 'false');
      });
    });

    it('should navigate menu items with arrow keys', () => {
      // Open a dropdown menu
      cy.get('[data-testid="user-menu-button"]').click();
      
      cy.get('[role="menu"]').within(() => {
        // First menu item should be focused
        cy.get('[role="menuitem"]').first().should('have.focus');
        
        // Down arrow moves to next item
        cy.realPress('ArrowDown');
        cy.focused().should('have.attr', 'role', 'menuitem');
        
        // Up arrow moves to previous item
        cy.realPress('ArrowUp');
        cy.focused().should('have.attr', 'role', 'menuitem');
        
        // Home key moves to first item
        cy.realPress('Home');
        cy.get('[role="menuitem"]').first().should('have.focus');
        
        // End key moves to last item
        cy.realPress('End');
        cy.get('[role="menuitem"]').last().should('have.focus');
      });
      
      // Escape closes menu
      cy.realPress('Escape');
      cy.get('[role="menu"]').should('not.exist');
    });
  });

  describe('Enter and Space Key Activation', () => {
    it('should activate buttons with Enter and Space', () => {
      // Focus a button
      cy.get('button').first().focus();
      
      // Enter should activate
      cy.focused().then(($button) => {
        const clickSpy = cy.spy();
        $button.on('click', clickSpy);
        
        cy.realPress('Enter');
        cy.wrap(clickSpy).should('have.been.called');
      });
      
      // Space should also activate buttons
      cy.get('button').eq(1).focus();
      cy.focused().then(($button) => {
        const clickSpy = cy.spy();
        $button.on('click', clickSpy);
        
        cy.realPress('Space');
        cy.wrap(clickSpy).should('have.been.called');
      });
    });

    it('should activate links with Enter', () => {
      cy.get('a[href]').first().focus();
      
      // Save current URL
      cy.url().then((currentUrl) => {
        // Press Enter
        cy.realPress('Enter');
        
        // URL should change or action should occur
        cy.url().should('not.equal', currentUrl);
      });
    });

    it('should toggle checkboxes with Space', () => {
      // Find a checkbox
      cy.get('input[type="checkbox"]').first().then(($checkbox) => {
        const initialState = $checkbox.prop('checked');
        
        // Focus and press Space
        cy.wrap($checkbox).focus();
        cy.realPress('Space');
        
        // State should toggle
        cy.wrap($checkbox).should('have.prop', 'checked', !initialState);
      });
    });
  });

  describe('Escape Key Behavior', () => {
    it('should close modals with Escape', () => {
      // Open a modal
      cy.get('[data-testid="settings-button"]').click();
      cy.get('[role="dialog"]').should('be.visible');
      
      // Press Escape
      cy.realPress('Escape');
      
      // Modal should close
      cy.get('[role="dialog"]').should('not.exist');
    });

    it('should close dropdowns with Escape', () => {
      // Open a dropdown
      cy.get('[data-testid="user-menu-button"]').click();
      cy.get('[role="menu"]').should('be.visible');
      
      // Press Escape
      cy.realPress('Escape');
      
      // Dropdown should close
      cy.get('[role="menu"]').should('not.exist');
    });

    it('should cancel drag operations with Escape', () => {
      // Start a drag operation if available
      cy.get('[draggable="true"]').first().then(($element) => {
        // Simulate starting drag
        cy.wrap($element).trigger('dragstart');
        
        // Press Escape
        cy.realPress('Escape');
        
        // Drag should be cancelled (no drop event)
        cy.wrap($element).trigger('dragend');
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should support Ctrl+S to save', () => {
      // Make a change in editor
      cy.get('[data-testid="markdown-editor"] .cm-content').type('Test content');
      
      // Press Ctrl+S
      cy.get('body').type('{ctrl}s');
      
      // Check for save indication
      cy.get('[data-testid="save-indicator"]').should('contain', 'Saved');
    });

    it('should support Ctrl+Z for undo', () => {
      // Type in editor
      cy.get('[data-testid="markdown-editor"] .cm-content')
        .type('Test content')
        .wait(100);
      
      // Press Ctrl+Z
      cy.get('body').type('{ctrl}z');
      
      // Content should be undone
      cy.get('[data-testid="markdown-editor"] .cm-content')
        .should('not.contain', 'Test content');
    });

    it('should support Ctrl+Y for redo', () => {
      // Type and undo
      cy.get('[data-testid="markdown-editor"] .cm-content')
        .type('Test content')
        .wait(100);
      cy.get('body').type('{ctrl}z');
      
      // Press Ctrl+Y to redo
      cy.get('body').type('{ctrl}y');
      
      // Content should be restored
      cy.get('[data-testid="markdown-editor"] .cm-content')
        .should('contain', 'Test content');
    });

    it('should support Ctrl+F for search', () => {
      // Press Ctrl+F
      cy.get('body').type('{ctrl}f');
      
      // Search dialog should open
      cy.get('[data-testid="search-dialog"], .cm-search').should('be.visible');
    });

    it('should support custom application shortcuts', () => {
      // Test custom shortcut (e.g., Ctrl+K for command palette)
      cy.get('body').type('{ctrl}k');
      
      // Command palette should open if implemented
      cy.get('[data-testid="command-palette"], [role="combobox"]').should('be.visible');
    });
  });

  describe('Focus Trap in Modals', () => {
    it('should trap focus within modal dialogs', () => {
      // Open modal
      cy.get('[data-testid="settings-button"]').click();
      
      cy.get('[role="dialog"]').within(() => {
        // Get all focusable elements
        cy.get('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')
          .then(($elements) => {
            const elementCount = $elements.length;
            
            // Tab through all elements
            for (let i = 0; i < elementCount + 1; i++) {
              cy.realPress('Tab');
            }
            
            // Focus should wrap back to first element
            cy.focused().should('match', $elements.first());
            
            // Shift+Tab from first should go to last
            cy.realPress(['Shift', 'Tab']);
            cy.focused().should('match', $elements.last());
          });
      });
    });
  });

  describe('Form Navigation', () => {
    it('should navigate form fields with Tab', () => {
      // Open a form
      cy.get('[data-testid="settings-button"]').click();
      
      cy.get('form').within(() => {
        // Tab through form fields
        cy.get('input, select, textarea').first().focus();
        
        cy.get('input, select, textarea').each(($field, index, $allFields) => {
          if (index < $allFields.length - 1) {
            cy.realPress('Tab');
            cy.focused().should('match', $allFields.eq(index + 1));
          }
        });
      });
    });

    it('should submit forms with Enter in input fields', () => {
      // Open a form
      cy.get('[data-testid="settings-button"]').click();
      
      cy.get('form').within(() => {
        // Focus an input field
        cy.get('input[type="text"]').first().focus().type('test value');
        
        // Press Enter to submit
        cy.realPress('Enter');
      });
      
      // Form should be submitted (check for success message or closed modal)
      cy.get('[data-testid="success-message"], [role="alert"]').should('exist');
    });
  });

  describe('List Navigation', () => {
    it('should navigate lists with arrow keys', () => {
      // Find a list component
      cy.get('[role="list"], ul, ol').first().within(() => {
        // Focus first item
        cy.get('[role="listitem"], li').first().focus();
        
        // Down arrow moves to next
        cy.realPress('ArrowDown');
        cy.focused().should('match', '[role="listitem"], li');
        
        // Up arrow moves to previous
        cy.realPress('ArrowUp');
        cy.focused().should('match', '[role="listitem"], li');
      });
    });
  });

  describe('Grid Navigation', () => {
    it('should navigate grids with arrow keys if present', () => {
      // Check if grid exists
      cy.get('body').then(($body) => {
        if ($body.find('[role="grid"]').length > 0) {
          cy.get('[role="grid"]').within(() => {
            // Focus first cell
            cy.get('[role="gridcell"]').first().focus();
            
            // Arrow keys should navigate cells
            cy.realPress('ArrowRight');
            cy.focused().should('have.attr', 'role', 'gridcell');
            
            cy.realPress('ArrowDown');
            cy.focused().should('have.attr', 'role', 'gridcell');
            
            cy.realPress('ArrowLeft');
            cy.focused().should('have.attr', 'role', 'gridcell');
            
            cy.realPress('ArrowUp');
            cy.focused().should('have.attr', 'role', 'gridcell');
          });
        }
      });
    });
  });

  describe('Roving Tabindex', () => {
    it('should implement roving tabindex in toolbars', () => {
      cy.get('[role="toolbar"]').first().within(() => {
        // Only one item should have tabindex="0"
        cy.get('[tabindex="0"]').should('have.length', 1);
        
        // Others should have tabindex="-1"
        cy.get('[tabindex="-1"]').should('have.length.greaterThan', 0);
        
        // Arrow keys should move tabindex
        cy.get('[tabindex="0"]').first().focus();
        cy.realPress('ArrowRight');
        
        // New item should have tabindex="0"
        cy.focused().should('have.attr', 'tabindex', '0');
      });
    });
  });
});

// Helper function to check if element is in viewport
Cypress.Commands.add('isInViewport', { prevSubject: true }, (subject) => {
  const rect = subject[0].getBoundingClientRect();
  
  return cy.window().then((win) => {
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= win.innerHeight &&
      rect.right <= win.innerWidth
    );
  });
});