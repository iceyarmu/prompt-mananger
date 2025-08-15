/// <reference types="cypress" />

describe('Security Audit Testing', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  describe('XSS Prevention', () => {
    it('should prevent script injection in user inputs', () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')">',
        '<body onload=alert("XSS")>',
        '"><script>alert("XSS")</script>',
        '\';alert(String.fromCharCode(88,83,83))//',
        '<script>alert(String.fromCharCode(88,83,83))</script>',
        '<IMG SRC="javascript:alert(\'XSS\');">',
        '<IMG SRC=JaVaScRiPt:alert(\'XSS\')>',
        '<IMG SRC=`javascript:alert("XSS")`>',
        '<IMG """><SCRIPT>alert("XSS")</SCRIPT>">',
        '<SCRIPT SRC=http://evil.com/xss.js></SCRIPT>'
      ];

      // Test in markdown editor
      cy.get('[data-testid="markdown-editor"] .cm-content').as('editor');
      
      xssPayloads.forEach(payload => {
        cy.get('@editor').clear().type(payload);
        
        // Check that script is not executed
        cy.window().then((win) => {
          cy.stub(win, 'alert').as('alertStub');
        });
        
        // Trigger render
        cy.get('[data-testid="preview-panel"]').should('exist');
        
        // Alert should not have been called
        cy.get('@alertStub').should('not.have.been.called');
        
        // Content should be escaped in preview
        cy.get('[data-testid="preview-panel"]').then(($preview) => {
          const html = $preview.html();
          expect(html).to.not.include('<script');
          expect(html).to.not.include('onerror=');
          expect(html).to.not.include('javascript:');
        });
      });
    });

    it('should sanitize HTML in file names', () => {
      const maliciousFilenames = [
        '<script>alert(1)</script>.md',
        '"><img src=x onerror=alert(1)>.md',
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'file://etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      ];

      cy.get('[data-testid="file-tree"]').within(() => {
        maliciousFilenames.forEach(filename => {
          // Try to create file with malicious name
          cy.get('[data-testid="new-file-button"]').click();
          cy.get('[data-testid="filename-input"]').type(filename);
          cy.get('[data-testid="create-button"]').click();
          
          // Check that filename is sanitized
          cy.get('[role="treeitem"]').last().then(($item) => {
            const displayName = $item.text();
            expect(displayName).to.not.include('<script');
            expect(displayName).to.not.include('../');
            expect(displayName).to.not.include('..\\');
          });
        });
      });
    });

    it('should prevent DOM-based XSS through URL parameters', () => {
      // Test URL parameter injection
      const xssUrls = [
        '/?search=<script>alert("XSS")</script>',
        '/#<script>alert("XSS")</script>',
        '/?redirect=javascript:alert("XSS")',
        '/?callback=alert("XSS")'
      ];

      xssUrls.forEach(url => {
        cy.visit(url);
        
        // Check that scripts are not executed
        cy.window().then((win) => {
          cy.stub(win, 'alert').as('alertStub');
        });
        
        cy.get('@alertStub').should('not.have.been.called');
      });
    });

    it('should escape user input in templates', () => {
      // Open template manager
      cy.get('[data-testid="template-manager"]').click();
      
      // Try to inject script through template variables
      const maliciousInput = '{{<script>alert("XSS")</script>}}';
      
      cy.get('[data-testid="template-variable-input"]').type(maliciousInput);
      cy.get('[data-testid="apply-template"]').click();
      
      // Check output is escaped
      cy.get('[data-testid="output-panel"]').then(($output) => {
        const text = $output.text();
        expect(text).to.not.include('<script');
        expect(text).to.include('&lt;script');
      });
    });
  });

  describe('CSRF Protection', () => {
    it('should include CSRF tokens in forms', () => {
      // Open settings form
      cy.get('[data-testid="settings-button"]').click();
      
      cy.get('form').within(() => {
        // Check for CSRF token
        cy.get('input[name="csrf_token"], input[name="_token"], meta[name="csrf-token"]')
          .should('exist');
      });
    });

    it('should validate origin headers', () => {
      // Test cross-origin requests
      cy.request({
        method: 'POST',
        url: '/api/settings',
        headers: {
          'Origin': 'http://evil.com'
        },
        failOnStatusCode: false
      }).then((response) => {
        // Should reject cross-origin requests
        expect(response.status).to.be.oneOf([403, 401]);
      });
    });
  });

  describe('Authentication & Authorization', () => {
    it('should not expose sensitive data in localStorage', () => {
      cy.window().then((win) => {
        const localStorage = win.localStorage;
        
        // Check for sensitive data patterns
        const sensitivePatterns = [
          /api[_-]?key/i,
          /secret/i,
          /password/i,
          /token/i,
          /credential/i,
          /private[_-]?key/i
        ];
        
        Object.keys(localStorage).forEach(key => {
          const value = localStorage.getItem(key);
          
          // Keys should not contain sensitive names
          sensitivePatterns.forEach(pattern => {
            if (pattern.test(key)) {
              // If key contains sensitive pattern, value should be encrypted
              expect(value).to.not.match(/^[A-Za-z0-9-_]+$/);
            }
          });
        });
      });
    });

    it('should not expose API keys in network requests', () => {
      // Intercept all API requests
      cy.intercept('**/*', (req) => {
        // Check headers for exposed API keys
        const headers = req.headers;
        
        if (headers['x-api-key'] || headers['authorization']) {
          // API keys should be properly formatted (not plain text)
          const authHeader = headers['authorization'] || headers['x-api-key'];
          
          // Should use Bearer token or be hashed
          expect(authHeader).to.match(/^Bearer\s+[\w-]+\.[\w-]+\.[\w-]+$|^\$2[ayb]\$.{56}$/);
        }
        
        // Check URL for exposed keys
        expect(req.url).to.not.include('api_key=');
        expect(req.url).to.not.include('apikey=');
        expect(req.url).to.not.include('secret=');
      });
      
      // Trigger some API calls
      cy.get('[data-testid="save-button"]').click();
    });

    it('should handle authentication errors properly', () => {
      // Test with invalid credentials
      cy.intercept('POST', '/api/auth', {
        statusCode: 401,
        body: { error: 'Invalid credentials' }
      });
      
      // Should not expose system information in error
      cy.get('[data-testid="login-button"]').click();
      cy.get('[data-testid="error-message"]').should('not.contain', 'stack');
      cy.get('[data-testid="error-message"]').should('not.contain', 'trace');
    });
  });

  describe('Content Security Policy', () => {
    it('should have proper CSP headers', () => {
      cy.request('/').then((response) => {
        const csp = response.headers['content-security-policy'];
        
        if (csp) {
          // Check for important CSP directives
          expect(csp).to.include("default-src 'self'");
          expect(csp).to.include("script-src");
          expect(csp).to.not.include("'unsafe-inline'");
          expect(csp).to.not.include("'unsafe-eval'");
        }
      });
    });

    it('should prevent inline script execution', () => {
      // Try to inject inline script
      const inlineScript = '<div onclick="alert(1)">Click me</div>';
      
      cy.get('[data-testid="markdown-editor"] .cm-content')
        .clear()
        .type(inlineScript);
      
      // Click should not execute
      cy.get('[data-testid="preview-panel"]').within(() => {
        cy.get('div').click({ force: true });
      });
      
      // Alert should not appear
      cy.window().then((win) => {
        cy.stub(win, 'alert').as('alertStub');
      });
      cy.get('@alertStub').should('not.have.been.called');
    });
  });

  describe('Input Validation', () => {
    it('should validate file upload types', () => {
      // Test file upload with wrong type
      const fileName = 'malicious.exe';
      const fileContent = 'MZ'; // EXE file signature
      
      cy.get('[data-testid="file-upload"]').then(($input) => {
        const blob = new Blob([fileContent], { type: 'application/x-msdownload' });
        const file = new File([blob], fileName, { type: 'application/x-msdownload' });
        
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        $input[0].files = dataTransfer.files;
        $input.trigger('change');
      });
      
      // Should show error for invalid file type
      cy.get('[data-testid="error-message"]').should('contain', 'Invalid file type');
    });

    it('should limit file size uploads', () => {
      // Create large file (>10MB)
      const largeContent = new Array(11 * 1024 * 1024).join('a');
      const fileName = 'large.md';
      
      cy.get('[data-testid="file-upload"]').then(($input) => {
        const blob = new Blob([largeContent], { type: 'text/markdown' });
        const file = new File([blob], fileName, { type: 'text/markdown' });
        
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        $input[0].files = dataTransfer.files;
        $input.trigger('change');
      });
      
      // Should show size limit error
      cy.get('[data-testid="error-message"]').should('contain', 'File size exceeds limit');
    });

    it('should sanitize file paths', () => {
      const maliciousPaths = [
        '../../../../etc/passwd',
        'C:\\Windows\\System32\\config\\SAM',
        '\\\\server\\share\\sensitive.txt',
        'file:///etc/passwd'
      ];
      
      maliciousPaths.forEach(path => {
        cy.get('[data-testid="file-path-input"]').clear().type(path);
        cy.get('[data-testid="open-file"]').click();
        
        // Should not allow directory traversal
        cy.get('[data-testid="error-message"]').should('contain', 'Invalid path');
      });
    });
  });

  describe('Secure Communication', () => {
    it('should use HTTPS for all requests', () => {
      cy.intercept('**/*', (req) => {
        // All external requests should use HTTPS
        if (!req.url.startsWith('http://localhost')) {
          expect(req.url).to.match(/^https:\/\//);
        }
      });
    });

    it('should not expose sensitive data in URLs', () => {
      // Check all navigation
      cy.get('a[href]').each(($link) => {
        const href = $link.attr('href');
        
        // URLs should not contain sensitive data
        expect(href).to.not.include('password=');
        expect(href).to.not.include('token=');
        expect(href).to.not.include('api_key=');
        expect(href).to.not.include('secret=');
      });
    });
  });

  describe('Error Handling', () => {
    it('should not expose stack traces to users', () => {
      // Trigger an error
      cy.intercept('GET', '/api/data', {
        statusCode: 500,
        body: {
          error: 'Internal Server Error',
          stack: 'Error: Database connection failed\n  at Object.<anonymous>',
          details: 'PostgreSQL connection timeout'
        }
      });
      
      cy.get('[data-testid="load-data"]').click();
      
      // Error display should not show technical details
      cy.get('[data-testid="error-message"]').then(($error) => {
        const text = $error.text();
        expect(text).to.not.include('stack');
        expect(text).to.not.include('PostgreSQL');
        expect(text).to.not.include('Object.<anonymous>');
      });
    });

    it('should log errors securely', () => {
      // Check console for sensitive data
      cy.window().then((win) => {
        const originalLog = win.console.log;
        const originalError = win.console.error;
        
        cy.stub(win.console, 'log').callsFake((...args) => {
          // Console should not log sensitive data
          const message = args.join(' ');
          expect(message).to.not.match(/api[_-]?key/i);
          expect(message).to.not.match(/password/i);
          expect(message).to.not.match(/secret/i);
          
          originalLog.apply(win.console, args);
        });
        
        cy.stub(win.console, 'error').callsFake((...args) => {
          const message = args.join(' ');
          expect(message).to.not.match(/api[_-]?key/i);
          expect(message).to.not.match(/password/i);
          
          originalError.apply(win.console, args);
        });
      });
    });
  });

  describe('Session Management', () => {
    it('should implement secure session handling', () => {
      // Check for secure session cookies
      cy.getCookies().then((cookies) => {
        cookies.forEach(cookie => {
          if (cookie.name.includes('session') || cookie.name.includes('auth')) {
            // Session cookies should have security flags
            expect(cookie.secure).to.be.true;
            expect(cookie.httpOnly).to.be.true;
            expect(cookie.sameSite).to.be.oneOf(['strict', 'lax']);
          }
        });
      });
    });

    it('should handle session timeout', () => {
      // Simulate session timeout
      cy.window().then((win) => {
        // Clear session data
        win.sessionStorage.clear();
        win.localStorage.removeItem('auth_token');
      });
      
      // Try to perform authenticated action
      cy.get('[data-testid="save-button"]').click();
      
      // Should redirect to login or show session expired
      cy.get('[data-testid="session-expired"], [data-testid="login-form"]')
        .should('be.visible');
    });
  });

  describe('Rate Limiting', () => {
    it('should implement rate limiting for API requests', () => {
      // Make multiple rapid requests
      const requests = [];
      
      for (let i = 0; i < 20; i++) {
        requests.push(
          cy.request({
            method: 'POST',
            url: '/api/optimize',
            failOnStatusCode: false
          })
        );
      }
      
      Promise.all(requests).then((responses) => {
        // Some requests should be rate limited
        const rateLimited = responses.filter(r => r.status === 429);
        expect(rateLimited.length).to.be.greaterThan(0);
      });
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize markdown content', () => {
      const maliciousMarkdown = `
# Title
<script>alert('XSS')</script>
[Click me](javascript:alert('XSS'))
![](onerror=alert('XSS'))
<iframe src="evil.com"></iframe>
      `;
      
      cy.get('[data-testid="markdown-editor"] .cm-content')
        .clear()
        .type(maliciousMarkdown);
      
      // Check rendered output
      cy.get('[data-testid="preview-panel"]').then(($preview) => {
        const html = $preview.html();
        
        // Scripts should be removed
        expect(html).to.not.include('<script');
        expect(html).to.not.include('javascript:');
        expect(html).to.not.include('onerror=');
        expect(html).to.not.include('<iframe');
      });
    });
  });
});

// Helper command for checking security headers
Cypress.Commands.add('checkSecurityHeaders', () => {
  cy.request('/').then((response) => {
    const headers = response.headers;
    
    // Check for security headers
    expect(headers).to.have.property('x-content-type-options', 'nosniff');
    expect(headers).to.have.property('x-frame-options').that.matches(/DENY|SAMEORIGIN/);
    expect(headers).to.have.property('x-xss-protection');
    expect(headers).to.have.property('strict-transport-security');
  });
});