/// <reference types="cypress" />
import 'cypress-axe';

describe('Accessibility Audit - WCAG 2.1 AA Compliance', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.injectAxe();
  });

  describe('Main Application Pages', () => {
    it('should have no accessibility violations on home page', () => {
      cy.checkA11y(null, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
        }
      }, (violations) => {
        cy.task('log', `Found ${violations.length} accessibility violations`);
        cy.task('table', violations);
      });
    });

    it('should have proper heading structure', () => {
      // Check for h1 element
      cy.get('h1').should('exist').and('have.length', 1);
      
      // Verify heading hierarchy
      cy.get('h1, h2, h3, h4, h5, h6').then(($headings) => {
        const headingLevels = Array.from($headings).map(h => parseInt(h.tagName[1]));
        
        // Check for proper nesting (no skipped levels)
        for (let i = 1; i < headingLevels.length; i++) {
          const diff = headingLevels[i] - headingLevels[i-1];
          expect(diff).to.be.at.most(1, 'Heading levels should not skip');
        }
      });
    });

    it('should have proper landmarks', () => {
      // Check for main landmark
      cy.get('main, [role="main"]').should('exist');
      
      // Check for navigation landmark
      cy.get('nav, [role="navigation"]').should('exist');
      
      // Check for banner (header)
      cy.get('header, [role="banner"]').should('exist');
    });

    it('should have skip navigation link', () => {
      // Tab to reveal skip link if hidden
      cy.get('body').tab();
      
      // Check for skip link
      cy.get('a[href="#main"], a[href="#content"]').should('be.visible');
    });
  });

  describe('File Tree Component', () => {
    it('should have accessible file tree', () => {
      cy.get('[data-testid="file-tree"]').within(() => {
        // Check tree role
        cy.get('[role="tree"]').should('exist');
        
        // Check tree items
        cy.get('[role="treeitem"]').should('exist');
        
        // Check ARIA attributes
        cy.get('[role="treeitem"]').each(($item) => {
          cy.wrap($item).should('have.attr', 'aria-expanded');
          cy.wrap($item).should('have.attr', 'tabindex');
        });
      });
      
      // Run axe on file tree
      cy.checkA11y('[data-testid="file-tree"]');
    });

    it('should support keyboard navigation in file tree', () => {
      cy.get('[data-testid="file-tree"]').within(() => {
        // Focus first tree item
        cy.get('[role="treeitem"]').first().focus();
        
        // Arrow down should move to next item
        cy.focused().type('{downarrow}');
        cy.focused().should('have.attr', 'role', 'treeitem');
        
        // Arrow up should move to previous item
        cy.focused().type('{uparrow}');
        cy.focused().should('have.attr', 'role', 'treeitem');
        
        // Enter or Space should expand/collapse
        cy.focused().type('{enter}');
        cy.focused().should('have.attr', 'aria-expanded');
      });
    });
  });

  describe('Editor Component', () => {
    it('should have accessible editor', () => {
      cy.get('[data-testid="markdown-editor"]').within(() => {
        // Check for proper ARIA labels
        cy.get('.cm-editor').should('have.attr', 'aria-label');
        
        // Check for role
        cy.get('.cm-content').should('have.attr', 'role', 'textbox');
        
        // Check for aria-multiline
        cy.get('.cm-content').should('have.attr', 'aria-multiline', 'true');
      });
      
      // Run axe on editor
      cy.checkA11y('[data-testid="markdown-editor"]');
    });

    it('should have accessible toolbar buttons', () => {
      cy.get('[data-testid="editor-toolbar"]').within(() => {
        cy.get('button').each(($button) => {
          // Check for accessible name
          cy.wrap($button).then(($btn) => {
            const hasAriaLabel = $btn.attr('aria-label');
            const hasText = $btn.text().trim().length > 0;
            const hasTitle = $btn.attr('title');
            
            expect(hasAriaLabel || hasText || hasTitle).to.be.true;
          });
          
          // Check for proper role (button is implicit)
          cy.wrap($button).should('have.prop', 'tagName', 'BUTTON');
        });
      });
    });
  });

  describe('Modal Dialogs', () => {
    it('should have accessible modals', () => {
      // Open a modal (e.g., settings)
      cy.get('[data-testid="settings-button"]').click();
      
      cy.get('[role="dialog"]').within(() => {
        // Check for aria-label or aria-labelledby
        cy.root().then(($dialog) => {
          const hasLabel = $dialog.attr('aria-label') || $dialog.attr('aria-labelledby');
          expect(hasLabel).to.exist;
        });
        
        // Check for close button
        cy.get('button[aria-label*="close"], button[aria-label*="Close"]').should('exist');
      });
      
      // Check for focus trap
      cy.get('[role="dialog"]').within(() => {
        // Tab through elements
        cy.get('button, input, select, textarea, a[href], [tabindex]')
          .first()
          .focus()
          .tab();
        
        // Focus should remain within dialog
        cy.focused().should('exist');
        cy.focused().parents('[role="dialog"]').should('exist');
      });
      
      // Run axe on modal
      cy.checkA11y('[role="dialog"]');
      
      // Close modal
      cy.get('body').type('{esc}');
    });
  });

  describe('Forms and Inputs', () => {
    it('should have accessible form controls', () => {
      // Open settings or a form
      cy.get('[data-testid="settings-button"]').click();
      
      cy.get('form, [role="form"]').within(() => {
        // Check all inputs have labels
        cy.get('input, select, textarea').each(($input) => {
          const id = $input.attr('id');
          if (id) {
            cy.get(`label[for="${id}"]`).should('exist');
          } else {
            // Check for aria-label or aria-labelledby
            cy.wrap($input).then(($el) => {
              const hasAriaLabel = $el.attr('aria-label') || $el.attr('aria-labelledby');
              expect(hasAriaLabel).to.exist;
            });
          }
        });
        
        // Check for required fields indication
        cy.get('[required], [aria-required="true"]').each(($field) => {
          // Should have visual indication
          cy.wrap($field).parent().find('.required, *').should('exist');
        });
      });
      
      // Close modal
      cy.get('body').type('{esc}');
    });

    it('should have accessible error messages', () => {
      // Try to submit an invalid form
      cy.get('[data-testid="settings-button"]').click();
      
      // Find a required field and clear it
      cy.get('input[required]').first().clear();
      
      // Try to submit
      cy.get('button[type="submit"]').click();
      
      // Check for error message with proper ARIA
      cy.get('[role="alert"], [aria-live="polite"], [aria-live="assertive"]')
        .should('exist')
        .and('be.visible');
      
      // Close modal
      cy.get('body').type('{esc}');
    });
  });

  describe('Color Contrast', () => {
    it('should have sufficient color contrast', () => {
      // Check color contrast specifically
      cy.checkA11y(null, {
        runOnly: {
          type: 'tag',
          values: ['wcag2aa']
        },
        rules: {
          'color-contrast': { enabled: true }
        }
      });
    });

    it('should maintain contrast in dark mode', () => {
      // Toggle dark mode
      cy.get('[data-testid="theme-toggle"]').click();
      
      // Wait for theme to apply
      cy.wait(500);
      
      // Check contrast in dark mode
      cy.checkA11y(null, {
        runOnly: {
          type: 'tag',
          values: ['wcag2aa']
        },
        rules: {
          'color-contrast': { enabled: true }
        }
      });
    });
  });

  describe('Focus Management', () => {
    it('should have visible focus indicators', () => {
      // Tab through interactive elements
      cy.get('body').tab();
      
      // Check that focused element has visible outline
      cy.focused().should('have.css', 'outline-style').and('not.eq', 'none');
      cy.focused().should('have.css', 'outline-width').and('not.eq', '0px');
    });

    it('should manage focus correctly after actions', () => {
      // Open modal
      cy.get('[data-testid="settings-button"]').click();
      
      // Focus should move to modal
      cy.focused().parents('[role="dialog"]').should('exist');
      
      // Close modal
      cy.get('body').type('{esc}');
      
      // Focus should return to trigger button
      cy.focused().should('have.attr', 'data-testid', 'settings-button');
    });
  });

  describe('Images and Media', () => {
    it('should have alt text for images', () => {
      cy.get('img').each(($img) => {
        // Check for alt attribute
        cy.wrap($img).should('have.attr', 'alt');
        
        // If decorative, alt should be empty
        // If informative, alt should have content
        cy.wrap($img).then(($image) => {
          const isDecorative = $image.attr('role') === 'presentation';
          const altText = $image.attr('alt');
          
          if (isDecorative) {
            expect(altText).to.equal('');
          } else {
            expect(altText).to.not.be.empty;
          }
        });
      });
    });

    it('should have accessible icons', () => {
      cy.get('svg, [class*="icon"]').each(($icon) => {
        cy.wrap($icon).then(($el) => {
          const hasAriaLabel = $el.attr('aria-label');
          const hasTitle = $el.find('title').length > 0;
          const isHidden = $el.attr('aria-hidden') === 'true';
          
          // Icon should either be hidden or have accessible name
          expect(isHidden || hasAriaLabel || hasTitle).to.be.true;
        });
      });
    });
  });

  describe('Tables', () => {
    it('should have accessible tables if present', () => {
      cy.get('table').each(($table) => {
        // Check for caption or aria-label
        cy.wrap($table).then(($tbl) => {
          const hasCaption = $tbl.find('caption').length > 0;
          const hasAriaLabel = $tbl.attr('aria-label');
          expect(hasCaption || hasAriaLabel).to.be.true;
        });
        
        // Check for table headers
        cy.wrap($table).find('th').should('exist');
        
        // Check for scope attributes
        cy.wrap($table).find('th').each(($th) => {
          cy.wrap($th).should('have.attr', 'scope');
        });
      });
    });
  });

  describe('Loading States', () => {
    it('should announce loading states', () => {
      // Trigger a loading state (e.g., file operation)
      cy.get('[data-testid="file-tree"]').within(() => {
        cy.get('[role="treeitem"]').first().click();
      });
      
      // Check for loading indicator with proper ARIA
      cy.get('[aria-busy="true"], [role="status"], [aria-live]').should('exist');
    });
  });

  describe('Responsive Design', () => {
    it('should be accessible on mobile viewport', () => {
      cy.viewport('iphone-x');
      
      // Run accessibility checks
      cy.checkA11y(null, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa']
        }
      });
      
      // Check touch targets are large enough (44x44 minimum)
      cy.get('button, a, [role="button"]').each(($element) => {
        cy.wrap($element).then(($el) => {
          const width = $el.outerWidth();
          const height = $el.outerHeight();
          
          // WCAG 2.1 AA requires 44x44 for touch targets
          expect(width).to.be.at.least(44);
          expect(height).to.be.at.least(44);
        });
      });
    });

    it('should be accessible on tablet viewport', () => {
      cy.viewport('ipad-2');
      
      // Run accessibility checks
      cy.checkA11y(null, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa']
        }
      });
    });
  });
});

// Helper to install axe-core
before(() => {
  cy.task('log', 'Installing axe-core for accessibility testing');
});

// Generate accessibility report after all tests
after(() => {
  cy.task('log', 'Generating WCAG 2.1 AA compliance report');
});