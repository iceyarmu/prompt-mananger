import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    
    // Cross-browser testing configuration
    browsers: [
      {
        family: 'chromium',
        name: 'chrome',
        channel: 'stable',
        displayName: 'Chrome'
      },
      {
        family: 'chromium',
        name: 'edge',
        channel: 'stable',
        displayName: 'Edge'
      },
      {
        family: 'firefox',
        name: 'firefox',
        channel: 'stable',
        displayName: 'Firefox'
      }
    ],
    
    setupNodeEvents(on, config) {
      // Implement node event listeners here
      
      // Add code coverage plugin
      require('@cypress/code-coverage/task')(on, config);
      
      // Visual regression testing with Percy
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        table(message) {
          console.table(message);
          return null;
        }
      });
      
      return config;
    },
    
    env: {
      // Environment variables for testing
      WEBDAV_URL: 'http://localhost:8080',
      WEBDAV_USERNAME: 'testuser',
      WEBDAV_PASSWORD: 'testpass',
      API_BASE_URL: 'http://localhost:3000/api',
      COVERAGE: true
    },
    
    // Retry configuration for flaky tests
    retries: {
      runMode: 2,
      openMode: 0
    }
  },
  
  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite'
    },
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts'
  }
});