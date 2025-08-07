// ***********************************************************
// This example support/e2e.ts file is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Import visual regression testing
import '@percy/cypress';

// Import accessibility testing
import 'cypress-axe';

// Import real events for better interaction testing
import 'cypress-real-events/support';

// Custom error handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // Returning false here prevents Cypress from failing the test
  // We should only do this for expected errors
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false;
  }
  // Let other errors fail the test
  return true;
});

// Before each test
beforeEach(() => {
  // Clear local storage and session storage
  cy.window().then((win) => {
    win.localStorage.clear();
    win.sessionStorage.clear();
  });
  
  // Set up interceptors for common API calls
  cy.intercept('GET', '/api/health', { statusCode: 200, body: { status: 'ok' } }).as('healthCheck');
  cy.intercept('POST', '/api/optimize', { fixture: 'optimize-response.json' }).as('optimizePrompt');
  cy.intercept('POST', '/api/execute', { fixture: 'execute-response.json' }).as('executePrompt');
  
  // Set viewport for consistent testing
  cy.viewport(1280, 720);
});

// After each test
afterEach(() => {
  // Take screenshot on failure
  if (Cypress.currentTest.state === 'failed') {
    cy.screenshot(`failed-${Cypress.currentTest.title}`);
  }
});

// Global test configuration
Cypress.config('defaultCommandTimeout', 10000);
Cypress.config('requestTimeout', 10000);
Cypress.config('responseTimeout', 10000);

// Performance monitoring
let performanceMetrics = [];

Cypress.on('window:before:load', (win) => {
  // Monitor performance
  win.performance.mark('test-start');
});

Cypress.on('test:after:run', (test, runnable) => {
  // Collect performance metrics
  cy.window().then((win) => {
    win.performance.mark('test-end');
    win.performance.measure('test-duration', 'test-start', 'test-end');
    
    const measure = win.performance.getEntriesByName('test-duration')[0];
    if (measure) {
      performanceMetrics.push({
        test: test.title,
        duration: measure.duration,
        state: test.state
      });
    }
  });
});

// Log performance metrics after all tests
after(() => {
  if (performanceMetrics.length > 0) {
    cy.task('table', performanceMetrics);
  }
});