import type { 
  QASessionReport, 
  QABug, 
  QADiscoveredPage, 
  QATestAction,
  QATestScope
} from '../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ReportInput {
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  url: string;
  scope: QATestScope;
  mode: 'local' | 'production';
  discoveredPages: QADiscoveredPage[];
  testActions: QATestAction[];
  bugs: QABug[];
  unverifiedObservations: string[];
  browserInfo: {
    type: string;
    userAgent: string;
    viewport: { width: number; height: number };
  };
}

/**
 * Report Generator - Generates final QA test reports
 * 
 * Responsibilities:
 * - Generate structured test reports
 * - Calculate statistics
 * - Determine overall health
 * - Save reports to disk
 */
export class ReportGenerator {
  private reportsDir: string = 'reports/qa-reports';
  
  constructor() {}
  
  /**
   * Generate a complete QA session report
   */
  generate(input: ReportInput): QASessionReport {
    const confirmedBugs = input.bugs.filter(b => b.reproducible);
    
    const bugsBySeverity = {
      critical: input.bugs.filter(b => b.severity === 'CRITICAL').length,
      high: input.bugs.filter(b => b.severity === 'HIGH').length,
      medium: input.bugs.filter(b => b.severity === 'MEDIUM').length,
      low: input.bugs.filter(b => b.severity === 'LOW').length
    };
    
    const testsPassed = input.testActions.filter(a => a.success).length;
    const testsFailed = input.testActions.filter(a => !a.success).length;
    const testsBlocked = 0; // Would track blocked tests in advanced implementation
    
    const overallHealth = this.determineOverallHealth(bugsBySeverity);
    
    const report: QASessionReport = {
      sessionId: input.sessionId,
      startTime: input.startTime,
      endTime: input.endTime,
      duration: input.duration,
      url: input.url,
      scope: input.scope,
      mode: input.mode,
      overallHealth,
      pagesDiscovered: input.discoveredPages.length,
      pagesTested: input.discoveredPages.filter(p => p.tested).length,
      actionsPerformed: input.testActions.length,
      bugs: input.bugs,
      bugsBySeverity,
      testsPassed,
      testsFailed,
      testsBlocked,
      discoveredPages: input.discoveredPages,
      testActions: input.testActions,
      unverifiedObservations: input.unverifiedObservations,
      browserInfo: input.browserInfo,
      limitations: this.getLimitations(input.mode)
    };
    
    return report;
  }
  
  /**
   * Save report to disk as JSON
   */
  async saveReport(report: QASessionReport): Promise<string> {
    await fs.mkdir(this.reportsDir, { recursive: true });
    
    const filename = `${report.sessionId}.json`;
    const filepath = path.join(this.reportsDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    
    return filepath;
  }
  
  /**
   * Generate human-readable HTML report
   */
  async generateHTMLReport(report: QASessionReport): Promise<string> {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QA Report - ${report.sessionId}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #0a0e27;
      color: #e0e6f0;
    }
    h1, h2, h3 { color: #60a5fa; }
    .summary {
      background: #1a1f3a;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .stat-card {
      background: #1a1f3a;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #60a5fa;
    }
    .stat-label {
      font-size: 0.9em;
      color: #9ca3af;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 2em;
      font-weight: bold;
    }
    .bug {
      background: #1a1f3a;
      padding: 20px;
      border-radius: 8px;
      margin: 15px 0;
      border-left: 4px solid #ef4444;
    }
    .bug.critical { border-left-color: #dc2626; }
    .bug.high { border-left-color: #f97316; }
    .bug.medium { border-left-color: #eab308; }
    .bug.low { border-left-color: #60a5fa; }
    .severity {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 0.85em;
      font-weight: bold;
      margin-right: 10px;
    }
    .severity.critical { background: #dc2626; }
    .severity.high { background: #f97316; }
    .severity.medium { background: #eab308; color: #000; }
    .severity.low { background: #60a5fa; color: #000; }
    .category {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 0.85em;
      background: #374151;
    }
    .health {
      font-size: 1.5em;
      font-weight: bold;
      padding: 10px 20px;
      border-radius: 8px;
      display: inline-block;
    }
    .health.healthy { background: #10b981; color: #000; }
    .health.warning { background: #eab308; color: #000; }
    .health.critical { background: #ef4444; }
    code {
      background: #111827;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    pre {
      background: #111827;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
    }
    ul { margin: 10px 0; }
    li { margin: 5px 0; }
  </style>
</head>
<body>
  <h1>🩺 DeployDoctor QA Report</h1>
  
  <div class="summary">
    <h2>Test Summary</h2>
    <p><strong>Session ID:</strong> ${report.sessionId}</p>
    <p><strong>URL Tested:</strong> ${report.url}</p>
    <p><strong>Mode:</strong> ${report.mode}</p>
    <p><strong>Scope:</strong> ${report.scope}</p>
    <p><strong>Duration:</strong> ${this.formatDuration(report.duration)}</p>
    <p><strong>Completed:</strong> ${new Date(report.endTime).toLocaleString()}</p>
    <p><strong>Overall Health:</strong> <span class="health ${report.overallHealth}">${report.overallHealth.toUpperCase()}</span></p>
  </div>
  
  <div class="stats">
    <div class="stat-card">
      <div class="stat-label">Pages Discovered</div>
      <div class="stat-value">${report.pagesDiscovered}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Pages Tested</div>
      <div class="stat-value">${report.pagesTested}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Actions Performed</div>
      <div class="stat-value">${report.actionsPerformed}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Bugs Found</div>
      <div class="stat-value">${report.bugs.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Tests Passed</div>
      <div class="stat-value">${report.testsPassed}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Tests Failed</div>
      <div class="stat-value">${report.testsFailed}</div>
    </div>
  </div>
  
  <h2>Bugs Discovered</h2>
  <p><strong>Critical:</strong> ${report.bugsBySeverity.critical} | 
     <strong>High:</strong> ${report.bugsBySeverity.high} | 
     <strong>Medium:</strong> ${report.bugsBySeverity.medium} | 
     <strong>Low:</strong> ${report.bugsBySeverity.low}</p>
  
  ${report.bugs.map(bug => this.generateBugHTML(bug)).join('')}
  
  ${report.unverifiedObservations.length > 0 ? `
    <h2>Additional Observations</h2>
    <ul>
      ${report.unverifiedObservations.map(obs => `<li>${this.escapeHtml(obs)}</li>`).join('')}
    </ul>
  ` : ''}
  
  <h2>Test Details</h2>
  <p>Tested ${report.pagesTested} of ${report.pagesDiscovered} discovered pages</p>
  <p>Performed ${report.actionsPerformed} test actions</p>
  
  <h3>Browser Information</h3>
  <p><strong>Type:</strong> ${report.browserInfo.type}</p>
  <p><strong>Viewport:</strong> ${report.browserInfo.viewport.width}x${report.browserInfo.viewport.height}</p>
  
  ${report.limitations.length > 0 ? `
    <h3>Limitations</h3>
    <ul>
      ${report.limitations.map(lim => `<li>${this.escapeHtml(lim)}</li>`).join('')}
    </ul>
  ` : ''}
</body>
</html>`;
    
    const filename = `${report.sessionId}.html`;
    const filepath = path.join(this.reportsDir, filename);
    
    await fs.mkdir(this.reportsDir, { recursive: true });
    await fs.writeFile(filepath, html);
    
    return filepath;
  }
  
  /**
   * Generate HTML for a single bug
   */
  private generateBugHTML(bug: QABug): string {
    return `
      <div class="bug ${bug.severity.toLowerCase()}">
        <h3>
          ${this.escapeHtml(bug.id)}: ${this.escapeHtml(bug.title)}
        </h3>
        <p>
          <span class="severity ${bug.severity.toLowerCase()}">${bug.severity}</span>
          <span class="category">${bug.category}</span>
          ${bug.reproducible ? '<span class="category" style="background: #10b981; color: #000;">✓ REPRODUCED</span>' : ''}
        </p>
        
        <p><strong>Page:</strong> <code>${this.escapeHtml(bug.pageUrl)}</code></p>
        ${bug.affectedElement ? `<p><strong>Element:</strong> <code>${this.escapeHtml(bug.affectedElement)}</code></p>` : ''}
        
        <h4>Steps to Reproduce:</h4>
        <ol>
          ${bug.stepsToReproduce.map(step => `<li>${this.escapeHtml(step)}</li>`).join('')}
        </ol>
        
        <p><strong>Expected Result:</strong> ${this.escapeHtml(bug.expectedResult)}</p>
        <p><strong>Actual Result:</strong> ${this.escapeHtml(bug.actualResult)}</p>
        
        <h4>Root Cause:</h4>
        <p>${this.escapeHtml(bug.likelyCause)}</p>
        
        <h4>Recommended Solution:</h4>
        <p>${this.escapeHtml(bug.recommendedSolution)}</p>
        
        ${bug.sourceLocation && bug.sourceLocation.resolved ? `
          <h4>Source Location:</h4>
          <p><strong>File:</strong> <code>${this.escapeHtml(bug.sourceLocation.file)}</code></p>
          ${bug.sourceLocation.line ? `<p><strong>Line:</strong> ${bug.sourceLocation.line}</p>` : ''}
          ${bug.sourceLocation.snippet ? `<pre><code>${this.escapeHtml(bug.sourceLocation.snippet)}</code></pre>` : ''}
        ` : ''}
        
        ${bug.evidence.consoleErrors.length > 0 ? `
          <h4>Console Errors:</h4>
          <ul>
            ${bug.evidence.consoleErrors.map(err => `<li><code>${this.escapeHtml(err)}</code></li>`).join('')}
          </ul>
        ` : ''}
        
        ${bug.evidence.networkErrors.length > 0 ? `
          <h4>Network Errors:</h4>
          <ul>
            ${bug.evidence.networkErrors.map(err => 
              `<li><code>${this.escapeHtml(err.url)}</code> - ${err.status || err.errorText}</li>`
            ).join('')}
          </ul>
        ` : ''}
        
        <h4>Verification Steps:</h4>
        <ol>
          ${bug.verificationSteps.map(step => `<li>${this.escapeHtml(step)}</li>`).join('')}
        </ol>
      </div>
    `;
  }
  
  /**
   * Determine overall health from bug severity counts
   */
  private determineOverallHealth(bugsBySeverity: { critical: number; high: number; medium: number; low: number }): 'healthy' | 'warning' | 'critical' {
    if (bugsBySeverity.critical > 0) return 'critical';
    if (bugsBySeverity.high > 0) return 'warning';
    if (bugsBySeverity.medium > 3) return 'warning';
    return 'healthy';
  }
  
  /**
   * Get limitations based on mode
   */
  private getLimitations(mode: 'local' | 'production'): string[] {
    const common = [
      'QA Agent performs read-only testing by default',
      'Cannot test authenticated features without credentials',
      'Source mapping requires accessible source maps',
      'Cannot modify application code or database',
      'Limited to client-side testing visible in the browser'
    ];
    
    if (mode === 'production') {
      return [
        ...common,
        'Cannot access private environment variables',
        'Cannot access server-side logs',
        'Cannot test features requiring production-only access'
      ];
    }
    
    return common;
  }
  
  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes === 0) {
      return `${seconds}s`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
