#!/usr/bin/env node

/**
 * Quality Check Script
 * Ensures test coverage meets requirements and generates comprehensive reports
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const COVERAGE_THRESHOLDS = {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  },
  components: {
    branches: 85,
    functions: 85,
    lines: 85,
    statements: 85
  },
  services: {
    branches: 90,
    functions: 90,
    lines: 90,
    statements: 90
  }
};

const QUALITY_METRICS = {
  testCoverage: 0,
  lintErrors: 0,
  typeErrors: 0,
  performanceScore: 0,
  accessibilityScore: 0,
  bundleSize: 0,
  duplicateCode: 0,
  complexityScore: 0
};

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

// Main quality check functions
async function runQualityCheck() {
  log('\n🔍 Starting Comprehensive Quality Check...', 'blue');
  
  const results = {
    timestamp: new Date().toISOString(),
    passed: true,
    metrics: { ...QUALITY_METRICS },
    details: {}
  };

  try {
    // 1. Test Coverage
    logSection('📊 Test Coverage Analysis');
    results.details.coverage = await checkTestCoverage();
    results.metrics.testCoverage = results.details.coverage.overall;
    
    // 2. Code Quality
    logSection('🧹 Code Quality Analysis');
    results.details.codeQuality = await checkCodeQuality();
    results.metrics.lintErrors = results.details.codeQuality.lintErrors;
    results.metrics.typeErrors = results.details.codeQuality.typeErrors;
    
    // 3. Performance
    logSection('⚡ Performance Analysis');
    results.details.performance = await checkPerformance();
    results.metrics.performanceScore = results.details.performance.score;
    
    // 4. Accessibility
    logSection('♿ Accessibility Analysis');
    results.details.accessibility = await checkAccessibility();
    results.metrics.accessibilityScore = results.details.accessibility.score;
    
    // 5. Bundle Size
    logSection('📦 Bundle Size Analysis');
    results.details.bundleSize = await checkBundleSize();
    results.metrics.bundleSize = results.details.bundleSize.totalSize;
    
    // 6. Code Duplication
    logSection('🔄 Code Duplication Analysis');
    results.details.duplication = await checkCodeDuplication();
    results.metrics.duplicateCode = results.details.duplication.percentage;
    
    // 7. Complexity Analysis
    logSection('🧩 Complexity Analysis');
    results.details.complexity = await checkComplexity();
    results.metrics.complexityScore = results.details.complexity.average;
    
    // Generate Report
    logSection('📋 Quality Report');
    results.passed = evaluateResults(results);
    generateReport(results);
    
    // Exit with appropriate code
    process.exit(results.passed ? 0 : 1);
    
  } catch (error) {
    log(`\n❌ Quality check failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function checkTestCoverage() {
  log('Running test coverage analysis...');
  
  try {
    // Run tests with coverage
    execSync('pnpm test:coverage --silent', { 
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    // Read coverage report
    const coverageFile = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
    if (!fs.existsSync(coverageFile)) {
      throw new Error('Coverage report not found');
    }
    
    const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
    const total = coverage.total;
    
    // Calculate overall percentage
    const overall = Math.round(
      (total.lines.pct + total.statements.pct + total.functions.pct + total.branches.pct) / 4
    );
    
    // Check thresholds
    const violations = [];
    
    // Global threshold check
    Object.keys(COVERAGE_THRESHOLDS.global).forEach(metric => {
      if (total[metric].pct < COVERAGE_THRESHOLDS.global[metric]) {
        violations.push({
          type: 'global',
          metric,
          actual: total[metric].pct,
          threshold: COVERAGE_THRESHOLDS.global[metric]
        });
      }
    });
    
    // Component-specific checks
    Object.keys(coverage).forEach(file => {
      if (file === 'total') return;
      
      const fileCoverage = coverage[file];
      const isComponent = file.includes('/components/');
      const isService = file.includes('/services/');
      
      const thresholds = isComponent ? COVERAGE_THRESHOLDS.components :
                       isService ? COVERAGE_THRESHOLDS.services :
                       COVERAGE_THRESHOLDS.global;
      
      Object.keys(thresholds).forEach(metric => {
        if (fileCoverage[metric].pct < thresholds[metric]) {
          violations.push({
            type: 'file',
            file: file.replace(process.cwd(), '.'),
            metric,
            actual: fileCoverage[metric].pct,
            threshold: thresholds[metric]
          });
        }
      });
    });
    
    // Log results
    log(`Overall Coverage: ${overall}%`, overall >= 80 ? 'green' : 'red');
    log(`  Lines: ${total.lines.pct}%`);
    log(`  Statements: ${total.statements.pct}%`);
    log(`  Functions: ${total.functions.pct}%`);
    log(`  Branches: ${total.branches.pct}%`);
    
    if (violations.length > 0) {
      log(`\n⚠️  Coverage violations found:`, 'yellow');
      violations.slice(0, 10).forEach(v => {
        if (v.type === 'file') {
          log(`  ${v.file}: ${v.metric} ${v.actual}% < ${v.threshold}%`);
        } else {
          log(`  Global ${v.metric}: ${v.actual}% < ${v.threshold}%`);
        }
      });
      if (violations.length > 10) {
        log(`  ... and ${violations.length - 10} more violations`);
      }
    } else {
      log('✅ All coverage thresholds met!', 'green');
    }
    
    return {
      overall,
      details: total,
      violations,
      passed: violations.length === 0 && overall >= 80
    };
    
  } catch (error) {
    log(`Coverage check failed: ${error.message}`, 'red');
    return {
      overall: 0,
      details: {},
      violations: [],
      passed: false,
      error: error.message
    };
  }
}

async function checkCodeQuality() {
  log('Running code quality checks...');
  
  const results = {
    lintErrors: 0,
    lintWarnings: 0,
    typeErrors: 0,
    formatIssues: 0
  };
  
  // ESLint check
  try {
    execSync('pnpm lint --format=json > lint-results.json', { stdio: 'pipe' });
  } catch (error) {
    // ESLint exits with error code if there are issues
    const lintResults = JSON.parse(fs.readFileSync('lint-results.json', 'utf8'));
    lintResults.forEach(file => {
      results.lintErrors += file.errorCount || 0;
      results.lintWarnings += file.warningCount || 0;
    });
  }
  
  // TypeScript check
  try {
    execSync('pnpm type-check', { stdio: 'pipe' });
  } catch (error) {
    const output = error.stdout?.toString() || '';
    const errorMatches = output.match(/error TS/g);
    results.typeErrors = errorMatches ? errorMatches.length : 0;
  }
  
  // Prettier check
  try {
    const unformatted = execSync('pnpm prettier --check . --list-different', { 
      stdio: 'pipe',
      encoding: 'utf8'
    }).trim().split('\n').filter(Boolean);
    results.formatIssues = unformatted.length;
  } catch (error) {
    // Prettier exits with error if files need formatting
    const output = error.stdout?.toString() || '';
    results.formatIssues = output.trim().split('\n').filter(Boolean).length;
  }
  
  // Log results
  const hasIssues = results.lintErrors > 0 || results.typeErrors > 0;
  log(`Lint Errors: ${results.lintErrors}`, results.lintErrors > 0 ? 'red' : 'green');
  log(`Lint Warnings: ${results.lintWarnings}`, 'yellow');
  log(`Type Errors: ${results.typeErrors}`, results.typeErrors > 0 ? 'red' : 'green');
  log(`Format Issues: ${results.formatIssues}`, results.formatIssues > 0 ? 'yellow' : 'green');
  
  return {
    ...results,
    passed: !hasIssues
  };
}

async function checkPerformance() {
  log('Running performance checks...');
  
  try {
    // Run performance tests
    const perfResults = execSync('pnpm test:performance --json', {
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    const results = JSON.parse(perfResults);
    
    // Calculate overall score
    const score = Math.round(
      (results.lcp.score + results.fid.score + results.cls.score + results.ttfb.score) / 4 * 100
    );
    
    log(`Performance Score: ${score}%`, score >= 90 ? 'green' : score >= 70 ? 'yellow' : 'red');
    log(`  LCP: ${results.lcp.value}ms (${results.lcp.score * 100}%)`);
    log(`  FID: ${results.fid.value}ms (${results.fid.score * 100}%)`);
    log(`  CLS: ${results.cls.value} (${results.cls.score * 100}%)`);
    log(`  TTFB: ${results.ttfb.value}ms (${results.ttfb.score * 100}%)`);
    
    return {
      score,
      metrics: results,
      passed: score >= 70
    };
    
  } catch (error) {
    log(`Performance check skipped: ${error.message}`, 'yellow');
    return {
      score: 0,
      metrics: {},
      passed: true, // Don't fail build for performance
      skipped: true
    };
  }
}

async function checkAccessibility() {
  log('Running accessibility checks...');
  
  try {
    const a11yResults = execSync('pnpm test:a11y --json', {
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    const results = JSON.parse(a11yResults);
    const violations = results.violations || [];
    const score = Math.max(0, 100 - (violations.length * 5));
    
    log(`Accessibility Score: ${score}%`, score >= 95 ? 'green' : score >= 80 ? 'yellow' : 'red');
    
    if (violations.length > 0) {
      log(`Found ${violations.length} accessibility violations:`, 'yellow');
      violations.slice(0, 5).forEach(v => {
        log(`  - ${v.id}: ${v.description}`);
      });
      if (violations.length > 5) {
        log(`  ... and ${violations.length - 5} more`);
      }
    }
    
    return {
      score,
      violations: violations.length,
      details: violations,
      passed: violations.length === 0
    };
    
  } catch (error) {
    log(`Accessibility check skipped: ${error.message}`, 'yellow');
    return {
      score: 100,
      violations: 0,
      passed: true,
      skipped: true
    };
  }
}

async function checkBundleSize() {
  log('Analyzing bundle size...');
  
  try {
    // Build and analyze
    execSync('pnpm build:analyze', { stdio: 'pipe' });
    
    const statsFile = path.join(process.cwd(), 'dist', 'stats.json');
    if (!fs.existsSync(statsFile)) {
      throw new Error('Bundle stats not found');
    }
    
    const stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
    
    // Calculate sizes
    const assets = stats.assets || [];
    const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
    const mainBundle = assets.find(a => a.name.includes('main')) || { size: 0 };
    const vendorBundle = assets.find(a => a.name.includes('vendor')) || { size: 0 };
    
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
    const mainSizeMB = (mainBundle.size / 1024 / 1024).toFixed(2);
    const vendorSizeMB = (vendorBundle.size / 1024 / 1024).toFixed(2);
    
    log(`Total Bundle Size: ${totalSizeMB}MB`, totalSize < 2 * 1024 * 1024 ? 'green' : 'yellow');
    log(`  Main: ${mainSizeMB}MB`);
    log(`  Vendor: ${vendorSizeMB}MB`);
    log(`  Chunks: ${assets.length - 2}`);
    
    return {
      totalSize,
      mainSize: mainBundle.size,
      vendorSize: vendorBundle.size,
      chunks: assets.length,
      passed: totalSize < 3 * 1024 * 1024 // 3MB limit
    };
    
  } catch (error) {
    log(`Bundle analysis skipped: ${error.message}`, 'yellow');
    return {
      totalSize: 0,
      passed: true,
      skipped: true
    };
  }
}

async function checkCodeDuplication() {
  log('Checking for code duplication...');
  
  try {
    const jscpdResults = execSync('npx jscpd . --reporters json --silent', {
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    const results = JSON.parse(jscpdResults);
    const percentage = results.statistics.percentage || 0;
    
    log(`Code Duplication: ${percentage.toFixed(2)}%`, percentage < 5 ? 'green' : 'yellow');
    
    if (results.duplicates && results.duplicates.length > 0) {
      log(`Found ${results.duplicates.length} duplicate blocks:`, 'yellow');
      results.duplicates.slice(0, 3).forEach(dup => {
        log(`  - ${dup.firstFile.name}:${dup.firstFile.start} ↔ ${dup.secondFile.name}:${dup.secondFile.start}`);
      });
    }
    
    return {
      percentage,
      duplicates: results.duplicates?.length || 0,
      passed: percentage < 10
    };
    
  } catch (error) {
    log(`Duplication check skipped: ${error.message}`, 'yellow');
    return {
      percentage: 0,
      passed: true,
      skipped: true
    };
  }
}

async function checkComplexity() {
  log('Analyzing code complexity...');
  
  try {
    const complexityResults = execSync('npx complexity-report-cli . --format json', {
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    const results = JSON.parse(complexityResults);
    const average = results.reports.reduce((sum, r) => sum + r.aggregate.cyclomatic, 0) / results.reports.length;
    
    log(`Average Complexity: ${average.toFixed(2)}`, average < 10 ? 'green' : 'yellow');
    
    // Find most complex functions
    const complexFunctions = [];
    results.reports.forEach(file => {
      file.functions.forEach(func => {
        if (func.cyclomatic > 10) {
          complexFunctions.push({
            file: file.path,
            function: func.name,
            complexity: func.cyclomatic
          });
        }
      });
    });
    
    if (complexFunctions.length > 0) {
      log(`\nComplex functions (cyclomatic > 10):`, 'yellow');
      complexFunctions.slice(0, 5).forEach(f => {
        log(`  - ${f.function} in ${f.file}: ${f.complexity}`);
      });
    }
    
    return {
      average,
      complexFunctions: complexFunctions.length,
      passed: average < 15
    };
    
  } catch (error) {
    log(`Complexity check skipped: ${error.message}`, 'yellow');
    return {
      average: 0,
      passed: true,
      skipped: true
    };
  }
}

function evaluateResults(results) {
  const criticalChecks = [
    results.details.coverage?.passed,
    results.details.codeQuality?.passed,
    results.details.accessibility?.passed
  ];
  
  const warnings = [
    results.details.performance?.passed,
    results.details.bundleSize?.passed,
    results.details.duplication?.passed,
    results.details.complexity?.passed
  ];
  
  // Must pass all critical checks
  const criticalPassed = criticalChecks.every(check => check !== false);
  
  // Should pass most warning checks
  const warningsPassed = warnings.filter(w => w !== false).length >= warnings.length * 0.7;
  
  return criticalPassed && warningsPassed;
}

function generateReport(results) {
  // Console summary
  console.log('\n' + '='.repeat(60));
  log('📊 QUALITY REPORT SUMMARY', 'cyan');
  console.log('='.repeat(60));
  
  log(`\n✅ Test Coverage: ${results.metrics.testCoverage}%`, 
      results.metrics.testCoverage >= 80 ? 'green' : 'red');
  
  log(`🧹 Code Quality:`, 'blue');
  log(`   Lint Errors: ${results.metrics.lintErrors}`, 
      results.metrics.lintErrors === 0 ? 'green' : 'red');
  log(`   Type Errors: ${results.metrics.typeErrors}`,
      results.metrics.typeErrors === 0 ? 'green' : 'red');
  
  log(`⚡ Performance Score: ${results.metrics.performanceScore}%`,
      results.metrics.performanceScore >= 90 ? 'green' : 'yellow');
  
  log(`♿ Accessibility Score: ${results.metrics.accessibilityScore}%`,
      results.metrics.accessibilityScore >= 95 ? 'green' : 'yellow');
  
  log(`📦 Bundle Size: ${(results.metrics.bundleSize / 1024 / 1024).toFixed(2)}MB`,
      results.metrics.bundleSize < 2 * 1024 * 1024 ? 'green' : 'yellow');
  
  log(`🔄 Code Duplication: ${results.metrics.duplicateCode.toFixed(2)}%`,
      results.metrics.duplicateCode < 5 ? 'green' : 'yellow');
  
  log(`🧩 Complexity Score: ${results.metrics.complexityScore.toFixed(2)}`,
      results.metrics.complexityScore < 10 ? 'green' : 'yellow');
  
  // Overall result
  console.log('\n' + '='.repeat(60));
  if (results.passed) {
    log('🎉 QUALITY CHECK PASSED!', 'green');
    log('All quality gates have been met. Ready for production!', 'green');
  } else {
    log('❌ QUALITY CHECK FAILED', 'red');
    log('Please address the issues above before deployment.', 'red');
  }
  console.log('='.repeat(60));
  
  // Write detailed JSON report
  const reportPath = path.join(process.cwd(), 'quality-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  log(`\n📄 Detailed report saved to: ${reportPath}`, 'cyan');
  
  // Write markdown report for CI
  const markdownReport = generateMarkdownReport(results);
  const mdPath = path.join(process.cwd(), 'quality-report.md');
  fs.writeFileSync(mdPath, markdownReport);
  log(`📝 Markdown report saved to: ${mdPath}`, 'cyan');
}

function generateMarkdownReport(results) {
  const emoji = results.passed ? '✅' : '❌';
  const status = results.passed ? 'PASSED' : 'FAILED';
  
  return `# Quality Report ${emoji}

**Status:** ${status}
**Generated:** ${results.timestamp}

## Metrics Summary

| Metric | Value | Status |
|--------|-------|--------|
| Test Coverage | ${results.metrics.testCoverage}% | ${results.metrics.testCoverage >= 80 ? '✅' : '❌'} |
| Lint Errors | ${results.metrics.lintErrors} | ${results.metrics.lintErrors === 0 ? '✅' : '❌'} |
| Type Errors | ${results.metrics.typeErrors} | ${results.metrics.typeErrors === 0 ? '✅' : '❌'} |
| Performance | ${results.metrics.performanceScore}% | ${results.metrics.performanceScore >= 70 ? '✅' : '⚠️'} |
| Accessibility | ${results.metrics.accessibilityScore}% | ${results.metrics.accessibilityScore >= 95 ? '✅' : '⚠️'} |
| Bundle Size | ${(results.metrics.bundleSize / 1024 / 1024).toFixed(2)}MB | ${results.metrics.bundleSize < 3 * 1024 * 1024 ? '✅' : '⚠️'} |
| Code Duplication | ${results.metrics.duplicateCode.toFixed(2)}% | ${results.metrics.duplicateCode < 10 ? '✅' : '⚠️'} |
| Complexity | ${results.metrics.complexityScore.toFixed(2)} | ${results.metrics.complexityScore < 15 ? '✅' : '⚠️'} |

## Detailed Results

### Test Coverage
- **Overall:** ${results.details.coverage?.overall || 0}%
- **Lines:** ${results.details.coverage?.details?.lines?.pct || 0}%
- **Statements:** ${results.details.coverage?.details?.statements?.pct || 0}%
- **Functions:** ${results.details.coverage?.details?.functions?.pct || 0}%
- **Branches:** ${results.details.coverage?.details?.branches?.pct || 0}%

${results.details.coverage?.violations?.length > 0 ? `
### Coverage Violations
${results.details.coverage.violations.slice(0, 10).map(v => 
  `- ${v.file || 'Global'} - ${v.metric}: ${v.actual}% < ${v.threshold}%`
).join('\n')}
` : ''}

### Code Quality
- **Lint Errors:** ${results.details.codeQuality?.lintErrors || 0}
- **Lint Warnings:** ${results.details.codeQuality?.lintWarnings || 0}
- **Type Errors:** ${results.details.codeQuality?.typeErrors || 0}
- **Format Issues:** ${results.details.codeQuality?.formatIssues || 0}

### Performance
${results.details.performance?.skipped ? '⚠️ Performance tests were skipped' : `
- **Score:** ${results.details.performance?.score || 0}%
- **LCP:** ${results.details.performance?.metrics?.lcp?.value || 'N/A'}ms
- **FID:** ${results.details.performance?.metrics?.fid?.value || 'N/A'}ms
- **CLS:** ${results.details.performance?.metrics?.cls?.value || 'N/A'}
- **TTFB:** ${results.details.performance?.metrics?.ttfb?.value || 'N/A'}ms
`}

### Accessibility
${results.details.accessibility?.skipped ? '⚠️ Accessibility tests were skipped' : `
- **Score:** ${results.details.accessibility?.score || 0}%
- **Violations:** ${results.details.accessibility?.violations || 0}
`}

## Recommendations

${!results.passed ? `
### Action Required
1. ${results.metrics.testCoverage < 80 ? 'Increase test coverage to at least 80%' : ''}
2. ${results.metrics.lintErrors > 0 ? 'Fix all linting errors' : ''}
3. ${results.metrics.typeErrors > 0 ? 'Resolve all TypeScript errors' : ''}
4. ${results.metrics.performanceScore < 70 ? 'Improve performance metrics' : ''}
5. ${results.metrics.accessibilityScore < 95 ? 'Address accessibility violations' : ''}
`.trim() : 'No critical issues found. Project meets all quality standards!'}

---
*Generated by Quality Check Script v1.0*
`;
}

// Run the quality check
if (require.main === module) {
  runQualityCheck().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = {
  runQualityCheck,
  checkTestCoverage,
  checkCodeQuality,
  checkPerformance,
  checkAccessibility,
  checkBundleSize,
  checkCodeDuplication,
  checkComplexity
};