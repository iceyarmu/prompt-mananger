module.exports = {
  ci: {
    collect: {
      // Static site testing
      staticDistDir: './dist',
      
      // Or URL testing for running server
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/editor',
        'http://localhost:3000/settings',
        'http://localhost:3000/file-tree'
      ],
      
      // Number of runs per URL
      numberOfRuns: 3,
      
      // Chrome settings
      settings: {
        preset: 'desktop',
        throttling: {
          cpuSlowdownMultiplier: 1,
          rttMs: 40,
          throughputKbps: 10 * 1024,
        },
        screenEmulation: {
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
          mobile: false,
        },
      },
      
      // Chrome flags
      chromeFlags: [
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
      ],
    },
    
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Performance assertions
        'categories:performance': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'interactive': ['error', { maxNumericValue: 3800 }],
        'speed-index': ['error', { maxNumericValue: 3400 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        
        // File operations < 500ms requirement
        'network-requests': ['warn', { maxNumericValue: 50 }],
        'network-rtt': ['error', { maxNumericValue: 500 }],
        
        // Memory usage < 200MB requirement
        'total-byte-weight': ['error', { maxNumericValue: 200 * 1024 * 1024 }],
        'dom-size': ['warn', { maxNumericValue: 1500 }],
        
        // Best practices
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        
        // Security
        'is-on-https': 'error',
        'no-vulnerable-libraries': 'error',
        
        // Specific optimizations
        'uses-text-compression': 'error',
        'uses-responsive-images': 'warn',
        'offscreen-images': 'warn',
        'render-blocking-resources': ['error', { maxNumericValue: 2 }],
        'unminified-css': 'error',
        'unminified-javascript': 'error',
        'unused-css-rules': 'warn',
        'unused-javascript': ['warn', { maxNumericValue: 100 * 1024 }],
        'modern-image-formats': 'warn',
        'uses-optimized-images': 'warn',
        'uses-rel-preconnect': 'warn',
        'font-display': 'warn',
        
        // PWA
        'installable-manifest': 'off',
        'splash-screen': 'off',
        'themed-omnibox': 'off',
        'maskable-icon': 'off',
        'service-worker': 'off',
        'works-offline': 'off',
      },
    },
    
    upload: {
      // Configure upload target (optional)
      target: 'temporary-public-storage',
      
      // Or use Lighthouse CI Server
      // target: 'lhci',
      // serverBaseUrl: 'https://your-lhci-server.com',
      // token: process.env.LHCI_TOKEN,
    },
    
    // GitHub Status Checks
    github: {
      // Automatically set status check on GitHub PR
      setGithubStatusCheck: true,
    },
  },
};