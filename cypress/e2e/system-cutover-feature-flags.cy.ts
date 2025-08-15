describe('System Cutover and Feature Flags Integration Tests', () => {
  beforeEach(() => {
    cy.setupTestEnvironment();
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.visit('/');
  });

  describe('Feature Flag System', () => {
    it('should toggle between old and new platform', () => {
      // Check default platform
      cy.getByDataCy('platform-indicator').should('contain', 'New Platform');
      cy.getByDataCy('system-router').should('have.attr', 'data-platform', 'new');
      
      // Access feature flags
      cy.getByDataCy('settings-button').click();
      cy.getByDataCy('feature-flags-tab').click();
      
      // Verify flag state
      cy.getByDataCy('flag-new_platform_enabled').should('be.checked');
      cy.getByDataCy('flag-description').should('contain', 'Enable new integrated platform');
      
      // Toggle to old platform
      cy.getByDataCy('flag-new_platform_enabled').uncheck();
      cy.getByDataCy('confirm-flag-change').should('be.visible');
      cy.getByDataCy('change-warning').should('contain', 'Switching platforms will reload');
      cy.getByDataCy('confirm-switch').click();
      
      // Should reload with old platform
      cy.url().should('include', 'platform=legacy');
      cy.getByDataCy('platform-indicator').should('contain', 'Legacy Platform');
      cy.getByDataCy('system-router').should('have.attr', 'data-platform', 'legacy');
      
      // Verify old components loaded
      cy.getByDataCy('legacy-editor').should('exist');
      cy.getByDataCy('legacy-file-tree').should('exist');
      cy.getByDataCy('new-editor').should('not.exist');
    });

    it('should persist feature flag settings', () => {
      // Set multiple flags
      cy.getByDataCy('settings-button').click();
      cy.getByDataCy('feature-flags-tab').click();
      
      cy.getByDataCy('flag-new_platform_enabled').check();
      cy.getByDataCy('flag-experimental_features').check();
      cy.getByDataCy('flag-debug_mode').check();
      cy.getByDataCy('save-flags').click();
      
      // Check persistence
      cy.window().then((win) => {
        const flags = win.localStorage.getItem('feature-flags');
        expect(flags).to.exist;
        
        const parsed = JSON.parse(flags);
        expect(parsed.new_platform_enabled).to.be.true;
        expect(parsed.experimental_features).to.be.true;
        expect(parsed.debug_mode).to.be.true;
      });
      
      // Reload and verify
      cy.reload();
      
      cy.getByDataCy('settings-button').click();
      cy.getByDataCy('feature-flags-tab').click();
      
      cy.getByDataCy('flag-new_platform_enabled').should('be.checked');
      cy.getByDataCy('flag-experimental_features').should('be.checked');
      cy.getByDataCy('flag-debug_mode').should('be.checked');
    });

    it('should handle flag dependencies', () => {
      cy.getByDataCy('settings-button').click();
      cy.getByDataCy('feature-flags-tab').click();
      
      // Uncheck parent flag
      cy.getByDataCy('flag-new_platform_enabled').uncheck();
      
      // Dependent flags should be disabled
      cy.getByDataCy('flag-new_editor').should('be.disabled');
      cy.getByDataCy('flag-new_file_tree').should('be.disabled');
      cy.getByDataCy('flag-new_optimization').should('be.disabled');
      
      // Warning about dependencies
      cy.getByDataCy('dependency-warning').should('be.visible');
      cy.getByDataCy('dependency-warning').should('contain', 'Disabling will affect dependent features');
      
      // Re-enable parent
      cy.getByDataCy('flag-new_platform_enabled').check();
      
      // Dependent flags should be enabled
      cy.getByDataCy('flag-new_editor').should('not.be.disabled');
      cy.getByDataCy('flag-new_file_tree').should('not.be.disabled');
    });

    it('should support flag overrides via URL', () => {
      // Visit with flag overrides
      cy.visit('/?feature_new_platform_enabled=false&feature_debug_mode=true');
      
      // Check flags applied
      cy.getByDataCy('platform-indicator').should('contain', 'Legacy Platform');
      cy.getByDataCy('debug-panel').should('be.visible');
      
      // URL overrides should not persist
      cy.getByDataCy('settings-button').click();
      cy.getByDataCy('feature-flags-tab').click();
      cy.getByDataCy('override-notice').should('be.visible');
      cy.getByDataCy('override-notice').should('contain', 'URL overrides active');
      
      // Clear overrides
      cy.getByDataCy('clear-overrides').click();
      cy.url().should('not.include', 'feature_');
    });
  });

  describe('Gradual Rollout', () => {
    it('should support percentage-based rollout', () => {
      cy.window().then((win) => {
        // Mock user ID for consistent testing
        win.__userId__ = 'test-user-123';
        
        // Access rollout service
        const { GradualRolloutService } = win;
        const rollout = new GradualRolloutService();
        
        // Test percentage calculation
        expect(rollout.getUserPercentage('test-user-123')).to.be.a('number');
        expect(rollout.getUserPercentage('test-user-123')).to.be.within(0, 100);
        
        // Test rollout eligibility
        const isInRollout = rollout.isUserInRollout('new_platform_enabled', 50);
        expect(isInRollout).to.be.a('boolean');
        
        // Same user should always get same result
        const secondCheck = rollout.isUserInRollout('new_platform_enabled', 50);
        expect(secondCheck).to.equal(isInRollout);
      });
    });

    it('should handle rollout configuration', () => {
      cy.getByDataCy('admin-settings').click();
      cy.getByDataCy('rollout-config').click();
      
      // Configure rollout for feature
      cy.getByDataCy('feature-select').select('new_platform_enabled');
      cy.getByDataCy('rollout-strategy').select('percentage');
      cy.getByDataCy('rollout-percentage').clear().type('25');
      cy.getByDataCy('save-rollout').click();
      
      // Verify configuration
      cy.window().then((win) => {
        const config = win.localStorage.getItem('rollout-config');
        const parsed = JSON.parse(config);
        
        expect(parsed.new_platform_enabled).to.deep.equal({
          strategy: 'percentage',
          percentage: 25
        });
      });
      
      // Test with different users
      const userResults = [];
      for (let i = 0; i < 100; i++) {
        cy.window().then((win) => {
          win.__userId__ = `user-${i}`;
          const { GradualRolloutService } = win;
          const rollout = new GradualRolloutService();
          userResults.push(rollout.isUserInRollout('new_platform_enabled', 25));
        });
      }
      
      // Approximately 25% should be enabled
      cy.wrap(userResults).then((results) => {
        const enabledCount = results.filter(r => r).length;
        expect(enabledCount).to.be.within(15, 35); // Allow some variance
      });
    });

    it('should support user group targeting', () => {
      cy.getByDataCy('admin-settings').click();
      cy.getByDataCy('rollout-config').click();
      
      // Configure group-based rollout
      cy.getByDataCy('feature-select').select('experimental_features');
      cy.getByDataCy('rollout-strategy').select('groups');
      cy.getByDataCy('add-group').click();
      cy.getByDataCy('group-name').type('beta_testers');
      cy.getByDataCy('add-group').click();
      cy.getByDataCy('group-name').type('internal_users');
      cy.getByDataCy('save-rollout').click();
      
      // Test group membership
      cy.window().then((win) => {
        win.__userGroups__ = ['beta_testers'];
        
        const { GradualRolloutService } = win;
        const rollout = new GradualRolloutService();
        
        // Beta tester should have access
        expect(rollout.isUserInGroup('beta_testers')).to.be.true;
        expect(rollout.hasFeatureAccess('experimental_features')).to.be.true;
        
        // Non-beta user should not
        win.__userGroups__ = ['regular_users'];
        expect(rollout.isUserInGroup('beta_testers')).to.be.false;
        expect(rollout.hasFeatureAccess('experimental_features')).to.be.false;
      });
    });

    it('should support time-based rollout', () => {
      cy.getByDataCy('admin-settings').click();
      cy.getByDataCy('rollout-config').click();
      
      // Configure time-based rollout
      cy.getByDataCy('feature-select').select('holiday_theme');
      cy.getByDataCy('rollout-strategy').select('time-based');
      cy.getByDataCy('start-date').type('2024-12-20');
      cy.getByDataCy('end-date').type('2025-01-05');
      cy.getByDataCy('save-rollout').click();
      
      // Test time-based activation
      cy.window().then((win) => {
        const { GradualRolloutService } = win;
        const rollout = new GradualRolloutService();
        
        // Mock current date
        const originalDate = Date;
        
        // Before start date
        win.Date = class extends originalDate {
          constructor(...args) {
            if (args.length === 0) {
              return new originalDate('2024-12-19');
            }
            return new originalDate(...args);
          }
          static now() {
            return new originalDate('2024-12-19').getTime();
          }
        };
        expect(rollout.isFeatureActive('holiday_theme')).to.be.false;
        
        // During active period
        win.Date = class extends originalDate {
          constructor(...args) {
            if (args.length === 0) {
              return new originalDate('2024-12-25');
            }
            return new originalDate(...args);
          }
          static now() {
            return new originalDate('2024-12-25').getTime();
          }
        };
        expect(rollout.isFeatureActive('holiday_theme')).to.be.true;
        
        // After end date
        win.Date = class extends originalDate {
          constructor(...args) {
            if (args.length === 0) {
              return new originalDate('2025-01-06');
            }
            return new originalDate(...args);
          }
          static now() {
            return new originalDate('2025-01-06').getTime();
          }
        };
        expect(rollout.isFeatureActive('holiday_theme')).to.be.false;
        
        // Restore original Date
        win.Date = originalDate;
      });
    });
  });

  describe('System Cutover', () => {
    it('should handle smooth platform transition', () => {
      // Start with old platform
      cy.visit('/?platform=legacy');
      cy.getByDataCy('platform-indicator').should('contain', 'Legacy');
      
      // Create data in old platform
      cy.setupWebDAVConnection();
      cy.createTestFile('legacy-file.md', '# Created in Legacy');
      cy.getByDataCy('legacy-preference').click();
      cy.getByDataCy('legacy-setting').type('old-value');
      cy.getByDataCy('save-legacy').click();
      
      // Initiate cutover
      cy.getByDataCy('cutover-banner').should('be.visible');
      cy.getByDataCy('start-cutover').click();
      
      // Cutover wizard
      cy.getByDataCy('cutover-wizard').should('be.visible');
      cy.getByDataCy('step-1-backup').should('have.class', 'active');
      
      // Step 1: Backup
      cy.getByDataCy('create-backup').click();
      cy.getByDataCy('backup-progress').should('be.visible');
      cy.getByDataCy('backup-complete', { timeout: 10000 }).should('be.visible');
      cy.getByDataCy('next-step').click();
      
      // Step 2: Migration
      cy.getByDataCy('step-2-migration').should('have.class', 'active');
      cy.getByDataCy('migration-preview').should('be.visible');
      cy.getByDataCy('files-to-migrate').should('contain', 'legacy-file.md');
      cy.getByDataCy('settings-to-migrate').should('contain', 'legacy-setting');
      cy.getByDataCy('start-migration').click();
      cy.getByDataCy('migration-complete', { timeout: 10000 }).should('be.visible');
      cy.getByDataCy('next-step').click();
      
      // Step 3: Verification
      cy.getByDataCy('step-3-verification').should('have.class', 'active');
      cy.getByDataCy('run-verification').click();
      cy.getByDataCy('verification-checks').find('.check-passed').should('have.length.greaterThan', 0);
      cy.getByDataCy('next-step').click();
      
      // Step 4: Switch
      cy.getByDataCy('step-4-switch').should('have.class', 'active');
      cy.getByDataCy('confirm-cutover').click();
      
      // Should switch to new platform
      cy.getByDataCy('platform-indicator').should('contain', 'New Platform');
      
      // Verify data migrated
      cy.getByDataCy('file-legacy-file').should('exist');
      cy.getByDataCy('file-legacy-file').dblclick();
      cy.getByDataCy('editor-content').should('contain', 'Created in Legacy');
    });

    it('should support cutover monitoring', () => {
      // Enable monitoring
      cy.getByDataCy('admin-settings').click();
      cy.getByDataCy('monitoring-tab').click();
      cy.getByDataCy('enable-cutover-monitoring').check();
      cy.getByDataCy('save-monitoring').click();
      
      // Perform cutover
      cy.getByDataCy('start-cutover').click();
      cy.getByDataCy('quick-cutover').click(); // Skip wizard for this test
      
      // Check monitoring data
      cy.getByDataCy('monitoring-dashboard').click();
      cy.getByDataCy('cutover-metrics').should('be.visible');
      
      // Metrics should be collected
      cy.getByDataCy('metric-cutover-time').should('exist');
      cy.getByDataCy('metric-data-migrated').should('exist');
      cy.getByDataCy('metric-errors').should('contain', '0');
      cy.getByDataCy('metric-platform').should('contain', 'new');
      
      // Check event log
      cy.getByDataCy('event-log-tab').click();
      cy.getByDataCy('event-list').find('.event-cutover-started').should('exist');
      cy.getByDataCy('event-list').find('.event-cutover-completed').should('exist');
    });

    it('should handle cutover rollback', () => {
      // Start cutover
      cy.getByDataCy('start-cutover').click();
      cy.getByDataCy('quick-cutover').click();
      
      // Simulate issue with new platform
      cy.window().then((win) => {
        win.__simulateError__ = true;
      });
      
      // Error should trigger rollback option
      cy.getByDataCy('platform-error').should('be.visible');
      cy.getByDataCy('rollback-available').should('be.visible');
      cy.getByDataCy('error-details').should('contain', 'Platform instability detected');
      
      // Initiate rollback
      cy.getByDataCy('start-rollback').click();
      cy.getByDataCy('rollback-confirmation').should('be.visible');
      cy.getByDataCy('rollback-warning').should('contain', 'This will revert to the previous platform');
      cy.getByDataCy('confirm-rollback').click();
      
      // Rollback progress
      cy.getByDataCy('rollback-progress').should('be.visible');
      cy.getByDataCy('rollback-step').should('contain', 'Restoring backup');
      cy.getByDataCy('rollback-complete', { timeout: 10000 }).should('be.visible');
      
      // Should be back on old platform
      cy.getByDataCy('platform-indicator').should('contain', 'Legacy Platform');
      cy.getByDataCy('rollback-success').should('contain', 'Successfully rolled back');
    });

    it('should support automatic rollback on errors', () => {
      // Configure auto-rollback
      cy.getByDataCy('admin-settings').click();
      cy.getByDataCy('rollback-settings').click();
      cy.getByDataCy('enable-auto-rollback').check();
      cy.getByDataCy('error-threshold').clear().type('5');
      cy.getByDataCy('time-window').clear().type('60'); // 60 seconds
      cy.getByDataCy('save-rollback-settings').click();
      
      // Start cutover
      cy.getByDataCy('start-cutover').click();
      cy.getByDataCy('quick-cutover').click();
      
      // Simulate multiple errors
      for (let i = 0; i < 6; i++) {
        cy.window().then((win) => {
          win.__triggerError__(`Error ${i + 1}`);
        });
        cy.wait(100);
      }
      
      // Should trigger auto-rollback
      cy.getByDataCy('auto-rollback-triggered').should('be.visible');
      cy.getByDataCy('rollback-reason').should('contain', 'Error threshold exceeded');
      cy.getByDataCy('error-count').should('contain', '6 errors in 60 seconds');
      
      // Auto-rollback should complete
      cy.getByDataCy('rollback-complete', { timeout: 15000 }).should('be.visible');
      cy.getByDataCy('platform-indicator').should('contain', 'Legacy Platform');
    });
  });

  describe('Deprecation Management', () => {
    it('should show deprecation warnings for old features', () => {
      // Enable new platform
      cy.visit('/?feature_new_platform_enabled=true');
      
      // Use deprecated feature
      cy.getByDataCy('old-feature-button').click();
      
      // Should show deprecation warning
      cy.getByDataCy('deprecation-warning').should('be.visible');
      cy.getByDataCy('deprecation-message').should('contain', 'This feature is deprecated');
      cy.getByDataCy('migration-guide').should('be.visible');
      cy.getByDataCy('alternative-feature').should('contain', 'Use new-feature instead');
      
      // Can dismiss warning
      cy.getByDataCy('dismiss-warning').click();
      cy.getByDataCy('deprecation-warning').should('not.exist');
      
      // But warning appears in console
      cy.window().then((win) => {
        expect(win.__deprecationWarnings__).to.include('old-feature-button');
      });
    });

    it('should track deprecated feature usage', () => {
      cy.visit('/?feature_new_platform_enabled=true');
      
      // Use multiple deprecated features
      cy.getByDataCy('deprecated-api-1').click();
      cy.getByDataCy('deprecated-api-2').click();
      cy.getByDataCy('deprecated-component').click();
      
      // Check deprecation report
      cy.getByDataCy('admin-settings').click();
      cy.getByDataCy('deprecation-report').click();
      
      cy.getByDataCy('deprecation-stats').should('be.visible');
      cy.getByDataCy('total-deprecated-usage').should('contain', '3');
      cy.getByDataCy('deprecated-feature-list').find('.deprecated-item').should('have.length', 3);
      
      // Check usage details
      cy.getByDataCy('deprecated-api-1-usage').should('contain', '1 usage');
      cy.getByDataCy('deprecated-api-1-last-used').should('exist');
      cy.getByDataCy('deprecated-api-1-removal-date').should('contain', 'Planned removal');
    });

    it('should enforce deprecation timeline', () => {
      // Set deprecation deadline passed
      cy.window().then((win) => {
        win.__mockDate__ = '2025-12-31'; // After deprecation deadline
      });
      
      cy.visit('/?feature_new_platform_enabled=true');
      
      // Try to use deprecated feature
      cy.getByDataCy('deprecated-after-deadline').click();
      
      // Should be blocked
      cy.getByDataCy('feature-removed').should('be.visible');
      cy.getByDataCy('removal-message').should('contain', 'This feature has been removed');
      cy.getByDataCy('removal-date').should('contain', '2025-06-01');
      cy.getByDataCy('migration-required').should('be.visible');
      
      // Provide migration path
      cy.getByDataCy('start-migration').click();
      cy.getByDataCy('migration-wizard').should('be.visible');
    });
  });

  describe('A/B Testing', () => {
    it('should support A/B test configuration', () => {
      cy.getByDataCy('admin-settings').click();
      cy.getByDataCy('ab-testing').click();
      
      // Create new A/B test
      cy.getByDataCy('create-ab-test').click();
      cy.getByDataCy('test-name').type('New Editor Performance');
      cy.getByDataCy('variant-a').type('current-editor');
      cy.getByDataCy('variant-b').type('optimized-editor');
      cy.getByDataCy('traffic-split').clear().type('50');
      cy.getByDataCy('success-metric').select('load-time');
      cy.getByDataCy('create-test').click();
      
      // Test should be active
      cy.getByDataCy('active-tests').should('contain', 'New Editor Performance');
      cy.getByDataCy('test-status').should('contain', 'Running');
    });

    it('should assign users to test variants consistently', () => {
      // Configure A/B test
      cy.window().then((win) => {
        win.__abTests__ = {
          'editor-test': {
            variants: ['control', 'treatment'],
            split: 50
          }
        };
      });
      
      // Check variant assignment
      cy.window().then((win) => {
        const { ABTestingService } = win;
        const abTest = new ABTestingService();
        
        // User should get consistent variant
        const variant1 = abTest.getVariant('editor-test', 'user-123');
        const variant2 = abTest.getVariant('editor-test', 'user-123');
        expect(variant1).to.equal(variant2);
        expect(variant1).to.be.oneOf(['control', 'treatment']);
        
        // Different users may get different variants
        const variantOther = abTest.getVariant('editor-test', 'user-456');
        expect(variantOther).to.be.oneOf(['control', 'treatment']);
      });
    });

    it('should track A/B test metrics', () => {
      // Set up test with user in treatment
      cy.window().then((win) => {
        win.__abTestVariant__ = 'treatment';
      });
      
      cy.visit('/');
      
      // Perform actions that generate metrics
      cy.createTestFile('metric-test.md', '# Test');
      cy.getByDataCy('file-metric-test').dblclick();
      const startTime = Date.now();
      cy.getByDataCy('editor-ready').should('be.visible');
      const loadTime = Date.now() - startTime;
      
      // Metrics should be tracked
      cy.window().then((win) => {
        const metrics = win.__abTestMetrics__ || [];
        
        const editorMetric = metrics.find(m => 
          m.test === 'editor-test' && 
          m.variant === 'treatment' &&
          m.metric === 'editor-load-time'
        );
        
        expect(editorMetric).to.exist;
        expect(editorMetric.value).to.be.a('number');
      });
      
      // View test results
      cy.getByDataCy('admin-settings').click();
      cy.getByDataCy('ab-testing').click();
      cy.getByDataCy('view-results').click();
      
      cy.getByDataCy('test-results').should('be.visible');
      cy.getByDataCy('variant-treatment-metrics').should('exist');
      cy.getByDataCy('statistical-significance').should('exist');
    });
  });

  describe('Platform Health Monitoring', () => {
    it('should monitor platform health metrics', () => {
      cy.visit('/?feature_new_platform_enabled=true');
      
      // Check health dashboard
      cy.getByDataCy('health-indicator').should('be.visible');
      cy.getByDataCy('health-indicator').click();
      
      cy.getByDataCy('health-dashboard').should('be.visible');
      cy.getByDataCy('health-score').should('exist');
      cy.getByDataCy('health-score').invoke('text').then((text) => {
        const score = parseInt(text);
        expect(score).to.be.within(0, 100);
      });
      
      // Check individual metrics
      cy.getByDataCy('metric-response-time').should('exist');
      cy.getByDataCy('metric-error-rate').should('exist');
      cy.getByDataCy('metric-memory-usage').should('exist');
      cy.getByDataCy('metric-active-users').should('exist');
    });

    it('should alert on health degradation', () => {
      cy.visit('/?feature_new_platform_enabled=true');
      
      // Simulate performance degradation
      cy.window().then((win) => {
        win.__simulateSlowResponse__ = 5000; // 5 second delay
        win.__simulateHighMemory__ = true;
      });
      
      // Perform actions that trigger monitoring
      cy.createTestFile('slow-test.md', '# Test');
      cy.getByDataCy('file-slow-test').dblclick();
      
      // Should show health warning
      cy.getByDataCy('health-warning', { timeout: 10000 }).should('be.visible');
      cy.getByDataCy('degradation-notice').should('contain', 'Performance degradation detected');
      cy.getByDataCy('affected-metrics').should('contain', 'Response time');
      cy.getByDataCy('affected-metrics').should('contain', 'Memory usage');
      
      // Should offer remediation
      cy.getByDataCy('view-recommendations').click();
      cy.getByDataCy('recommendations-modal').should('be.visible');
      cy.getByDataCy('recommendation-list').find('.recommendation').should('have.length.greaterThan', 0);
    });

    it('should support custom health checks', () => {
      cy.getByDataCy('admin-settings').click();
      cy.getByDataCy('health-checks').click();
      
      // Add custom health check
      cy.getByDataCy('add-health-check').click();
      cy.getByDataCy('check-name').type('WebDAV Connectivity');
      cy.getByDataCy('check-type').select('api');
      cy.getByDataCy('check-endpoint').type('/api/webdav/health');
      cy.getByDataCy('check-interval').clear().type('30');
      cy.getByDataCy('failure-threshold').clear().type('3');
      cy.getByDataCy('save-check').click();
      
      // Verify check running
      cy.getByDataCy('health-check-list').should('contain', 'WebDAV Connectivity');
      cy.getByDataCy('check-status-webdav').should('exist');
      
      // Wait for check to run
      cy.wait(2000);
      cy.getByDataCy('check-status-webdav').should('have.class', 'healthy');
      cy.getByDataCy('last-check-time').should('exist');
    });
  });

  describe('Configuration Management', () => {
    it('should support environment-specific configurations', () => {
      // Check current environment
      cy.window().then((win) => {
        const env = win.__ENVIRONMENT__ || 'development';
        expect(env).to.be.oneOf(['development', 'staging', 'production']);
      });
      
      // Load environment config
      cy.getByDataCy('admin-settings').click();
      cy.getByDataCy('environment-config').click();
      
      cy.getByDataCy('current-environment').should('exist');
      cy.getByDataCy('config-values').should('be.visible');
      
      // Check environment-specific features
      cy.getByDataCy('env-features').within(() => {
        cy.get('.feature-item').each(($feature) => {
          const featureName = $feature.attr('data-feature');
          const isEnabled = $feature.hasClass('enabled');
          
          // Development should have more features enabled
          if (Cypress.env('environment') === 'development') {
            if (featureName === 'debug_mode') {
              expect(isEnabled).to.be.true;
            }
          } else if (Cypress.env('environment') === 'production') {
            if (featureName === 'debug_mode') {
              expect(isEnabled).to.be.false;
            }
          }
        });
      });
    });

    it('should validate configuration changes', () => {
      cy.getByDataCy('admin-settings').click();
      cy.getByDataCy('configuration').click();
      
      // Try invalid configuration
      cy.getByDataCy('config-editor').click();
      cy.getByDataCy('config-json').clear().type('{ invalid json }');
      cy.getByDataCy('validate-config').click();
      
      // Should show validation errors
      cy.getByDataCy('validation-errors').should('be.visible');
      cy.getByDataCy('error-list').should('contain', 'Invalid JSON');
      
      // Fix and validate
      cy.getByDataCy('config-json').clear().type(JSON.stringify({
        platform: {
          enabled: true,
          version: '2.0.0'
        },
        features: {
          new_editor: true
        }
      }, null, 2));
      
      cy.getByDataCy('validate-config').click();
      cy.getByDataCy('validation-success').should('be.visible');
      cy.getByDataCy('apply-config').should('not.be.disabled');
    });

    it('should support configuration hot-reload', () => {
      cy.getByDataCy('admin-settings').click();
      cy.getByDataCy('hot-reload').click();
      
      // Enable hot-reload
      cy.getByDataCy('enable-hot-reload').check();
      cy.getByDataCy('save-hot-reload').click();
      
      // Change configuration
      cy.getByDataCy('configuration').click();
      cy.getByDataCy('theme-config').select('dark');
      cy.getByDataCy('apply-without-reload').click();
      
      // Should apply without page reload
      cy.getByDataCy('applying-changes').should('be.visible');
      cy.getByDataCy('changes-applied').should('be.visible');
      
      // Verify changes applied
      cy.get('body').should('have.class', 'dark-theme');
      cy.url().should('not.include', 'reload');
    });
  });
});