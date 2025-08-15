#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function formatLighthouseResults() {
  const resultsDir = '.lighthouseci';
  const manifestPath = path.join(resultsDir, 'manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    console.log('No Lighthouse results found.');
    return;
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const results = [];
  
  // Process each URL's results
  for (const [url, runs] of Object.entries(manifest)) {
    const urlResults = {
      url,
      scores: {
        performance: [],
        accessibility: [],
        bestPractices: [],
        seo: []
      },
      metrics: {
        fcp: [],
        lcp: [],
        tti: [],
        tbt: [],
        cls: [],
        si: []
      }
    };
    
    // Process each run
    runs.forEach(run => {
      const reportPath = path.join(resultsDir, run.jsonPath);
      if (fs.existsSync(reportPath)) {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        
        // Extract scores
        urlResults.scores.performance.push(Math.round(report.categories.performance.score * 100));
        urlResults.scores.accessibility.push(Math.round(report.categories.accessibility.score * 100));
        urlResults.scores.bestPractices.push(Math.round(report.categories['best-practices'].score * 100));
        urlResults.scores.seo.push(Math.round(report.categories.seo.score * 100));
        
        // Extract metrics
        const metrics = report.audits;
        urlResults.metrics.fcp.push(metrics['first-contentful-paint'].numericValue);
        urlResults.metrics.lcp.push(metrics['largest-contentful-paint'].numericValue);
        urlResults.metrics.tti.push(metrics['interactive'].numericValue);
        urlResults.metrics.tbt.push(metrics['total-blocking-time'].numericValue);
        urlResults.metrics.cls.push(metrics['cumulative-layout-shift'].numericValue);
        urlResults.metrics.si.push(metrics['speed-index'].numericValue);
      }
    });
    
    results.push(urlResults);
  }
  
  // Format as markdown
  let markdown = '';
  
  // Summary table
  markdown += '### Summary\n\n';
  markdown += '| URL | Performance | Accessibility | Best Practices | SEO |\n';
  markdown += '|-----|------------|---------------|----------------|-----|\n';
  
  results.forEach(result => {
    const avgPerf = average(result.scores.performance);
    const avgA11y = average(result.scores.accessibility);
    const avgBP = average(result.scores.bestPractices);
    const avgSEO = average(result.scores.seo);
    
    markdown += `| ${shortenUrl(result.url)} | ${scoreEmoji(avgPerf)} ${avgPerf} | ${scoreEmoji(avgA11y)} ${avgA11y} | ${scoreEmoji(avgBP)} ${avgBP} | ${scoreEmoji(avgSEO)} ${avgSEO} |\n`;
  });
  
  // Performance metrics table
  markdown += '\n### Performance Metrics\n\n';
  markdown += '| URL | FCP | LCP | TTI | TBT | CLS | Speed Index |\n';
  markdown += '|-----|-----|-----|-----|-----|-----|-------------|\n';
  
  results.forEach(result => {
    const fcp = formatTime(average(result.metrics.fcp));
    const lcp = formatTime(average(result.metrics.lcp));
    const tti = formatTime(average(result.metrics.tti));
    const tbt = formatTime(average(result.metrics.tbt));
    const cls = average(result.metrics.cls).toFixed(3);
    const si = formatTime(average(result.metrics.si));
    
    markdown += `| ${shortenUrl(result.url)} | ${fcp} | ${lcp} | ${tti} | ${tbt} | ${cls} | ${si} |\n`;
  });
  
  // Performance budgets status
  markdown += '\n### Performance Budget Status\n\n';
  
  const budgetChecks = [
    { name: 'Page Load Time', target: '< 2s', actual: formatTime(Math.max(...results.map(r => average(r.metrics.lcp)))), pass: Math.max(...results.map(r => average(r.metrics.lcp))) < 2000 },
    { name: 'First Contentful Paint', target: '< 2s', actual: formatTime(Math.max(...results.map(r => average(r.metrics.fcp)))), pass: Math.max(...results.map(r => average(r.metrics.fcp))) < 2000 },
    { name: 'Total Blocking Time', target: '< 200ms', actual: formatTime(Math.max(...results.map(r => average(r.metrics.tbt)))), pass: Math.max(...results.map(r => average(r.metrics.tbt))) < 200 },
    { name: 'Cumulative Layout Shift', target: '< 0.1', actual: Math.max(...results.map(r => average(r.metrics.cls))).toFixed(3), pass: Math.max(...results.map(r => average(r.metrics.cls))) < 0.1 },
  ];
  
  budgetChecks.forEach(check => {
    const icon = check.pass ? '✅' : '❌';
    markdown += `- ${icon} **${check.name}**: ${check.actual} (target: ${check.target})\n`;
  });
  
  // Recommendations
  const recommendations = generateRecommendations(results);
  if (recommendations.length > 0) {
    markdown += '\n### 💡 Recommendations\n\n';
    recommendations.forEach(rec => {
      markdown += `- ${rec}\n`;
    });
  }
  
  // Footer
  markdown += '\n---\n';
  markdown += `*Generated at ${new Date().toISOString()}*\n`;
  
  console.log(markdown);
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function scoreEmoji(score) {
  if (score >= 90) return '🟢';
  if (score >= 50) return '🟡';
  return '🔴';
}

function shortenUrl(url) {
  return url.replace('http://localhost:3000', '').replace(/\/$/, '') || '/';
}

function formatTime(ms) {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function generateRecommendations(results) {
  const recommendations = [];
  
  results.forEach(result => {
    const avgLCP = average(result.metrics.lcp);
    const avgTBT = average(result.metrics.tbt);
    const avgCLS = average(result.metrics.cls);
    
    if (avgLCP > 2500) {
      recommendations.push(`Optimize Largest Contentful Paint for ${shortenUrl(result.url)} (currently ${formatTime(avgLCP)})`);
    }
    
    if (avgTBT > 200) {
      recommendations.push(`Reduce Total Blocking Time for ${shortenUrl(result.url)} (currently ${formatTime(avgTBT)})`);
    }
    
    if (avgCLS > 0.1) {
      recommendations.push(`Fix layout shifts for ${shortenUrl(result.url)} (CLS: ${avgCLS.toFixed(3)})`);
    }
    
    const avgPerf = average(result.scores.performance);
    if (avgPerf < 90) {
      recommendations.push(`Improve overall performance score for ${shortenUrl(result.url)} (currently ${avgPerf}/100)`);
    }
  });
  
  return recommendations;
}

// Run the formatter
formatLighthouseResults();