import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  
  // Run tests in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Parallel workers on CI, single worker locally
  workers: process.env.CI ? 4 : 1,
  
  // Reporter to use
  reporter: [
    ['html'],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
    
    // Test timeout
    actionTimeout: 10000,
    
    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile viewports
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },

    // Test against branded browsers
    {
      name: 'edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },

    // E2E tests
    {
      name: 'e2e',
      testMatch: /.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    // Performance tests
    {
      name: 'performance',
      testMatch: /.*\.perf\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Enable Chrome DevTools Protocol for performance metrics
        launchOptions: {
          args: [
            '--enable-precise-memory-info',
            '--disable-dev-shm-usage',
            '--js-flags=--expose-gc'
          ],
        },
      },
    },

    // Accessibility tests
    {
      name: 'accessibility',
      testMatch: /.*\.a11y\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        // Include accessibility tree in traces
        trace: 'on',
      },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});