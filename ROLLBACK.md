# System Cutover Rollback Procedures

## Overview
This document outlines the procedures for rolling back from the new platform to the old system in case of critical issues during the cutover process.

## Rollback Triggers

### Automatic Rollback Conditions
The system will automatically trigger a rollback when:
- **Error Rate Threshold**: New system error rate exceeds 5% (configurable)
- **Performance Degradation**: New system performs 50% worse than old system
- **Critical Service Failure**: Core services fail health checks for >30 seconds
- **User Impact**: >10% of users report critical issues within 1 hour

### Manual Rollback Triggers
Manual rollback should be initiated when:
- Customer complaints spike significantly
- Data integrity issues are detected
- Security vulnerabilities are discovered
- Business-critical features fail

## Rollback Procedures

### 1. Immediate Rollback (Emergency)
**Time to Execute**: < 1 minute
**Impact**: All users immediately switched to old system

```bash
# Emergency rollback command
curl -X POST https://api.example.com/api/rollback/emergency \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true, "reason": "emergency"}'
```

**Steps**:
1. Execute emergency rollback API call
2. Verify all users switched to old system
3. Check system health metrics
4. Notify stakeholders
5. Begin incident investigation

### 2. Gradual Rollback (Controlled)
**Time to Execute**: 5-30 minutes
**Impact**: Users gradually moved back to old system

```javascript
// Gradual rollback using feature flag service
const featureFlags = useFeatureFlags();

// Step 1: Stop new users from entering new system
featureFlags.updateFlagPercentage('new_platform_enabled', 0);

// Step 2: Monitor existing users
// Wait for natural session expiry or force refresh

// Step 3: Verify all users on old system
const status = featureFlags.getRolloutStatus('new_platform_enabled');
console.log('Rollback complete:', status.percentage === 0);
```

**Steps**:
1. Set feature flag percentage to 0%
2. Monitor active sessions on new system
3. Wait for sessions to expire (or force refresh)
4. Verify all traffic on old system
5. Document rollback reason and timeline

### 3. Partial Rollback (Targeted)
**Time to Execute**: Variable
**Impact**: Specific user segments or features rolled back

```javascript
// Target specific user groups for rollback
const rollbackConfig = {
  targetGroups: ['beta_users', 'internal_users'],
  excludeGroups: ['vip_users'],
  percentage: 0
};

// Apply targeted rollback
await applyTargetedRollback(rollbackConfig);
```

**Steps**:
1. Identify affected user segments
2. Configure targeted rollback
3. Apply rollback to specific groups
4. Monitor impact on targeted users
5. Evaluate if full rollback needed

## Rollback Verification

### Health Checks Post-Rollback
```bash
# Run health check suite
npm run health-check:rollback

# Expected output:
# ✓ Old system responding
# ✓ Database connections stable
# ✓ API endpoints functional
# ✓ User sessions preserved
# ✓ No data loss detected
```

### Metrics to Monitor
- Error rates return to baseline
- Performance metrics stabilize
- User complaints decrease
- System resources normalize
- No data inconsistencies

## Communication Plan

### Internal Communication
1. **Immediate** (0-5 min):
   - Engineering team via Slack/PagerDuty
   - Product team via email
   - Leadership via SMS/phone

2. **Short-term** (5-30 min):
   - All-hands notification
   - Status page update
   - Incident channel created

3. **Follow-up** (30 min - 2 hours):
   - Detailed incident report
   - Root cause analysis started
   - Timeline documented

### External Communication
1. **Status Page Update**:
   ```
   Title: System Maintenance - Temporary Rollback
   Status: Investigating
   Message: We've temporarily reverted to our classic system while investigating an issue. No data has been lost and all services remain operational.
   ```

2. **Customer Email Template**:
   ```
   Subject: Brief System Update

   Dear [Customer],

   We've temporarily switched back to our classic system to ensure the best possible experience while we fine-tune some new features. 

   What this means for you:
   • All your data is safe and intact
   • You can continue using the service normally
   • Some new features may be temporarily unavailable

   We expect to resume the upgrade shortly and will keep you informed.

   Thank you for your patience.
   ```

## Data Consistency Checks

### Pre-Rollback Validation
```sql
-- Check data integrity before rollback
SELECT COUNT(*) as total_records,
       SUM(CASE WHEN sync_status = 'pending' THEN 1 ELSE 0 END) as pending_syncs,
       MAX(last_modified) as latest_change
FROM data_sync_log
WHERE system_version = 'new';
```

### Post-Rollback Validation
```sql
-- Verify no data loss after rollback
SELECT 
  old.count as old_system_records,
  new.count as new_system_records,
  (old.count - new.count) as difference
FROM 
  (SELECT COUNT(*) as count FROM old_system.data) old,
  (SELECT COUNT(*) as count FROM new_system.data) new;
```

## Recovery Procedures

### After Successful Rollback
1. **Stabilization** (0-2 hours):
   - Monitor system metrics
   - Gather user feedback
   - Document issues encountered

2. **Investigation** (2-24 hours):
   - Root cause analysis
   - Code review
   - Test scenario review

3. **Remediation** (1-5 days):
   - Fix identified issues
   - Enhanced testing
   - Staging environment validation

4. **Re-attempt** (5+ days):
   - Gradual re-rollout plan
   - Enhanced monitoring
   - Smaller percentage increments

## Rollback Testing Procedures

### Test Scenarios
1. **Load Test During Rollback**:
   ```bash
   # Simulate high load during rollback
   npm run test:rollback-load
   ```

2. **Data Integrity Test**:
   ```bash
   # Verify data consistency
   npm run test:rollback-data
   ```

3. **Session Preservation Test**:
   ```bash
   # Ensure user sessions survive rollback
   npm run test:rollback-sessions
   ```

### Rollback Drills
- **Weekly**: Test rollback API endpoints
- **Monthly**: Partial rollback simulation
- **Quarterly**: Full rollback drill with all teams

## Automation Scripts

### Automated Rollback Script
```bash
#!/bin/bash
# auto-rollback.sh

# Configuration
THRESHOLD_ERROR_RATE=0.05
THRESHOLD_RESPONSE_TIME=2000
CHECK_INTERVAL=60

while true; do
  # Get current metrics
  ERROR_RATE=$(curl -s https://api.example.com/metrics/error-rate)
  RESPONSE_TIME=$(curl -s https://api.example.com/metrics/response-time)
  
  # Check thresholds
  if (( $(echo "$ERROR_RATE > $THRESHOLD_ERROR_RATE" | bc -l) )); then
    echo "Error rate threshold exceeded: $ERROR_RATE"
    curl -X POST https://api.example.com/api/rollback/auto \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -d '{"reason": "high_error_rate", "value": "'$ERROR_RATE'"}'
    break
  fi
  
  if (( $(echo "$RESPONSE_TIME > $THRESHOLD_RESPONSE_TIME" | bc -l) )); then
    echo "Response time threshold exceeded: $RESPONSE_TIME"
    curl -X POST https://api.example.com/api/rollback/auto \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -d '{"reason": "slow_response", "value": "'$RESPONSE_TIME'"}'
    break
  fi
  
  sleep $CHECK_INTERVAL
done
```

## Rollback Metrics and KPIs

### Success Criteria
- **Time to Rollback**: < 5 minutes for emergency, < 30 minutes for gradual
- **Data Loss**: Zero tolerance
- **User Impact**: < 1% of users experience issues during rollback
- **Recovery Time**: System fully stable within 1 hour

### Tracking Metrics
```javascript
// Track rollback metrics
const rollbackMetrics = {
  triggerTime: Date.now(),
  completionTime: null,
  affectedUsers: 0,
  dataIntegrity: true,
  errorsDuringRollback: [],
  
  complete() {
    this.completionTime = Date.now();
    const duration = this.completionTime - this.triggerTime;
    
    // Send metrics
    monitoringService.track('rollback_completed', {
      duration,
      affectedUsers: this.affectedUsers,
      dataIntegrity: this.dataIntegrity,
      errors: this.errorsDuringRollback.length
    });
  }
};
```

## Appendix

### Emergency Contacts
- **Engineering Lead**: [Phone] [Email]
- **Product Manager**: [Phone] [Email]
- **DevOps On-Call**: [PagerDuty]
- **Customer Success**: [Phone] [Email]

### Related Documentation
- [System Architecture](./docs/architecture.md)
- [Feature Flag Configuration](./docs/feature-flags.md)
- [Monitoring Dashboard](./docs/monitoring.md)
- [Incident Response Plan](./docs/incident-response.md)

### Revision History
| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2024-01-14 | 1.0 | Initial rollback procedures | DevOps Team |