import { EventEmitter } from 'events';
import type { 
  QAAgentOptions, 
  QASessionReport, 
  QAProgressUpdate, 
  QASessionStatus,
  QABug,
  QADiscoveredPage,
  QATestAction,
  QATestScope
} from '../types/index.js';
import { QABrowserAgent } from './qa-browser-agent.js';
import { PageExplorer } from './page-explorer.js';
import { InteractionTester } from './interaction-tester.js';
import { BugAnalyzer } from './bug-analyzer.js';
import { ReportGenerator } from './report-generator.js';
import * as crypto from 'crypto';

/**
 * QA Orchestrator - Controls the entire testing lifecycle
 * 
 * Responsibilities:
 * - Coordinate all QA components
 * - Manage testing session lifecycle
 * - Emit progress updates
 * - Generate final reports
 * - Clean up resources
 */
export class QAOrchestrator extends EventEmitter {
  private sessionId: string;
  private browserAgent: QABrowserAgent;
  private pageExplorer: PageExplorer;
  private interactionTester: InteractionTester;
  private bugAnalyzer: BugAnalyzer;
  private reportGenerator: ReportGenerator;
  
  private startTime: number = 0;
  private discoveredPages: QADiscoveredPage[] = [];
  private testActions: QATestAction[] = [];
  private bugs: QABug[] = [];
  private unverifiedObservations: string[] = [];
  
  private currentStatus: QASessionStatus = 'idle';
  private options!: QAAgentOptions;
  
  constructor() {
    super();
    this.sessionId = this.generateSessionId();
    this.browserAgent = new QABrowserAgent();
    this.pageExplorer = new PageExplorer(this.browserAgent);
    this.interactionTester = new InteractionTester(this.browserAgent);
    this.bugAnalyzer = new BugAnalyzer();
    this.reportGenerator = new ReportGenerator();
  }
  
  /**
   * Start the QA testing session
   */
  async startTesting(options: QAAgentOptions): Promise<QASessionReport> {
    this.options = options;
    this.startTime = Date.now();
    
    try {
      // Phase 1: Initialize
      await this.updateStatus('initializing', 'Launching browser...');
      await this.browserAgent.initialize(options);
      await this.browserAgent.navigateTo(options.url);
      
      // Phase 2: Discovery
      await this.updateStatus('discovering', 'Discovering application pages and elements...');
      await this.discoverApplication();
      
      // Phase 3: Testing
      await this.updateStatus('testing', 'Testing interactions and functionality...');
      await this.runTests();
      
      // Phase 4: Analysis
      await this.updateStatus('analyzing', 'Analyzing failures and potential bugs...');
      await this.analyzeBugs();
      
      // Phase 5: Reproduction
      await this.updateStatus('reproducing', 'Reproducing suspected bugs...');
      await this.reproduceBugs();
      
      // Phase 6: Reporting
      await this.updateStatus('reporting', 'Generating final report...');
      const report = await this.generateReport();
      
      // Phase 7: Complete
      await this.updateStatus('completed', 'Testing completed successfully');
      
      return report;
      
    } catch (error) {
      await this.updateStatus('failed', `Testing failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      // Always cleanup
      await this.cleanup();
    }
  }
  
  /**
   * Discover pages and interactive elements
   */
  private async discoverApplication(): Promise<void> {
    const maxPages = this.options.maxPages || this.getMaxPagesForScope(this.options.scope);
    
    // Start with the initial page
    const initialPage = await this.pageExplorer.explorePage(this.options.url);
    this.discoveredPages.push(initialPage);
    this.emitProgress();
    
    // Collect all unique URLs from links
    const urlsToVisit = new Set<string>();
    for (const element of initialPage.elements) {
      if (element.type === 'link' && element.href) {
        // Only include same-origin URLs
        if (this.isSameOrigin(element.href, this.options.url)) {
          urlsToVisit.add(element.href);
        }
      }
    }
    
    // Visit discovered pages (up to limit)
    let visitedCount = 1;
    for (const url of Array.from(urlsToVisit)) {
      if (visitedCount >= maxPages) break;
      
      try {
        await this.browserAgent.navigateTo(url);
        const page = await this.pageExplorer.explorePage(url);
        this.discoveredPages.push(page);
        visitedCount++;
        this.emitProgress();
        
        // Small delay to avoid overwhelming the app
        await this.delay(500);
      } catch (error) {
        // Log navigation errors but continue
        this.unverifiedObservations.push(`Failed to navigate to ${url}: ${error}`);
      }
    }
  }
  
  /**
   * Run interaction tests on all discovered pages
   */
  private async runTests(): Promise<void> {
    const maxActions = this.options.maxActions || this.getMaxActionsForScope(this.options.scope);
    let actionCount = 0;
    
    for (const page of this.discoveredPages) {
      if (actionCount >= maxActions) break;
      
      try {
        await this.browserAgent.navigateTo(page.url);
        
        // Test navigation links
        if (this.options.testNavigation !== false) {
          const navigationActions = await this.interactionTester.testNavigation(page);
          this.testActions.push(...navigationActions);
          actionCount += navigationActions.length;
          this.emitProgress();
        }
        
        // Test buttons
        const buttonActions = await this.interactionTester.testButtons(page);
        this.testActions.push(...buttonActions);
        actionCount += buttonActions.length;
        this.emitProgress();
        
        // Test forms
        if (this.options.testForms !== false) {
          const formActions = await this.interactionTester.testForms(page);
          this.testActions.push(...formActions);
          actionCount += formActions.length;
          this.emitProgress();
        }
        
        // Mark page as tested
        page.tested = true;
        
        if (actionCount >= maxActions) break;
        
      } catch (error) {
        this.unverifiedObservations.push(`Failed to test page ${page.url}: ${error}`);
      }
    }
    
    // Test responsive layouts if requested
    if (this.options.testResponsive) {
      await this.testResponsiveLayouts();
    }
  }
  
  /**
   * Test responsive layouts at different viewports
   */
  private async testResponsiveLayouts(): Promise<void> {
    const viewports = [
      { width: 375, height: 667, name: 'Mobile' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 1920, height: 1080, name: 'Desktop' }
    ];
    
    for (const viewport of viewports) {
      await this.browserAgent.setViewport(viewport);
      
      // Re-check first few pages for layout issues
      const pagesToCheck = this.discoveredPages.slice(0, 3);
      
      for (const page of pagesToCheck) {
        try {
          await this.browserAgent.navigateTo(page.url);
          await this.delay(1000);
          
          // Check for layout issues
          const layoutIssues = await this.browserAgent.checkLayoutIssues();
          
          if (layoutIssues.length > 0) {
            this.unverifiedObservations.push(
              `Potential layout issues on ${page.url} at ${viewport.name} (${viewport.width}x${viewport.height}): ${layoutIssues.join(', ')}`
            );
          }
        } catch (error) {
          // Continue on error
        }
      }
    }
    
    // Reset to original viewport
    if (this.options.viewport) {
      await this.browserAgent.setViewport(this.options.viewport);
    }
  }
  
  /**
   * Analyze test results to identify bugs
   */
  private async analyzeBugs(): Promise<void> {
    // Analyze failed actions
    const failedActions = this.testActions.filter(a => !a.success);
    
    for (const action of failedActions) {
      const bug = await this.bugAnalyzer.analyzeFailedAction(action, this.browserAgent);
      if (bug) {
        this.bugs.push(bug);
        this.emitProgress();
      }
    }
    
    // Check for runtime errors
    const runtimeErrors = await this.browserAgent.getRuntimeErrors();
    for (const error of runtimeErrors) {
      const bug = await this.bugAnalyzer.analyzeRuntimeError(error);
      if (bug) {
        this.bugs.push(bug);
        this.emitProgress();
      }
    }
    
    // Check for network failures
    const networkFailures = await this.browserAgent.getNetworkFailures();
    for (const failure of networkFailures) {
      const bug = await this.bugAnalyzer.analyzeNetworkFailure(failure);
      if (bug) {
        this.bugs.push(bug);
        this.emitProgress();
      }
    }
  }
  
  /**
   * Reproduce bugs to confirm they are genuine
   */
  private async reproduceBugs(): Promise<void> {
    for (const bug of this.bugs) {
      if (bug.reproducedCount === 0) {
        const reproduced = await this.bugAnalyzer.reproduceBug(bug, this.browserAgent);
        
        if (reproduced) {
          bug.reproducible = true;
          bug.reproducedCount = 1;
          bug.confirmed = Date.now();
        }
        
        this.emitProgress();
      }
    }
  }
  
  /**
   * Generate the final test report
   */
  private async generateReport(): Promise<QASessionReport> {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    
    const report = this.reportGenerator.generate({
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime,
      duration,
      url: this.options.url,
      scope: this.options.scope,
      mode: this.options.mode,
      discoveredPages: this.discoveredPages,
      testActions: this.testActions,
      bugs: this.bugs,
      unverifiedObservations: this.unverifiedObservations,
      browserInfo: await this.browserAgent.getBrowserInfo()
    });
    
    return report;
  }
  
  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      await this.browserAgent.close();
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  
  /**
   * Update status and emit progress
   */
  private async updateStatus(status: QASessionStatus, activity?: string): Promise<void> {
    this.currentStatus = status;
    this.emitProgress(activity);
  }
  
  /**
   * Emit progress update
   */
  private emitProgress(currentActivity?: string): void {
    const progress: QAProgressUpdate = {
      status: this.currentStatus,
      currentPage: this.browserAgent.getCurrentUrl(),
      currentActivity,
      pagesDiscovered: this.discoveredPages.length,
      pagesTested: this.discoveredPages.filter(p => p.tested).length,
      actionsPerformed: this.testActions.length,
      bugsFound: this.bugs.length,
      bugsConfirmed: this.bugs.filter(b => b.reproducible).length,
      elapsedTime: Date.now() - this.startTime
    };
    
    this.emit('progress', progress);
  }
  
  /**
   * Helper: Generate session ID
   */
  private generateSessionId(): string {
    return `qa-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }
  
  /**
   * Helper: Check if URL is same origin
   */
  private isSameOrigin(url1: string, url2: string): boolean {
    try {
      const u1 = new URL(url1);
      const u2 = new URL(url2);
      return u1.origin === u2.origin;
    } catch {
      return false;
    }
  }
  
  /**
   * Helper: Get max pages based on scope
   */
  private getMaxPagesForScope(scope: QATestScope): number {
    switch (scope) {
      case 'quick': return 5;
      case 'standard': return 15;
      case 'thorough': return 30;
      default: return 15;
    }
  }
  
  /**
   * Helper: Get max actions based on scope
   */
  private getMaxActionsForScope(scope: QATestScope): number {
    switch (scope) {
      case 'quick': return 20;
      case 'standard': return 50;
      case 'thorough': return 100;
      default: return 50;
    }
  }
  
  /**
   * Helper: Delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}
