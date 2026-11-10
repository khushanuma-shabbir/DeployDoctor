import type { 
  QABug, 
  QATestAction, 
  QABugSeverity, 
  QABugCategory,
  BrowserError,
  NetworkRequest
} from '../types/index.js';
import { QABrowserAgent } from './qa-browser-agent.js';
import { SourceAnalyzer } from '../source-analysis/source-analyzer.js';
import * as crypto from 'crypto';

/**
 * Bug Analyzer - Analyzes failures and classifies bugs
 * 
 * Responsibilities:
 * - Analyze failed actions
 * - Classify bug severity and category
 * - Identify root causes
 * - Suggest solutions
 * - Attempt bug reproduction
 */
export class BugAnalyzer {
  private sourceAnalyzer: SourceAnalyzer;
  
  constructor() {
    this.sourceAnalyzer = new SourceAnalyzer();
  }
  
  /**
   * Analyze a failed action and create a bug report
   */
  async analyzeFailedAction(action: QATestAction, browserAgent: QABrowserAgent): Promise<QABug | null> {
    if (action.success) return null;
    
    const runtimeErrors = browserAgent.getRuntimeErrors();
    const networkFailures = browserAgent.getNetworkFailures();
    
    // Determine bug category and severity
    let category: QABugCategory = 'functional-error';
    let severity: QABugSeverity = 'MEDIUM';
    let likelyCause = '';
    let recommendedSolution = '';
    
    if (runtimeErrors.length > 0) {
      category = 'runtime-error';
      severity = 'HIGH';
      likelyCause = `Runtime exception occurred: ${runtimeErrors[0].message}`;
      recommendedSolution = this.suggestRuntimeErrorFix(runtimeErrors[0]);
    } else if (networkFailures.some(f => f.resourceType === 'script' || f.resourceType === 'stylesheet')) {
      category = 'api-network-error';
      severity = 'CRITICAL';
      likelyCause = 'Critical resource failed to load';
      recommendedSolution = 'Check that all JavaScript and CSS files are properly deployed and accessible';
    } else if (networkFailures.length > 0) {
      category = 'api-network-error';
      severity = 'MEDIUM';
      likelyCause = 'API request failed or returned error status';
      recommendedSolution = 'Verify API endpoint is accessible and returning expected responses';
    } else {
      likelyCause = action.error || 'Element interaction failed';
      recommendedSolution = 'Verify element selector is correct and element is interactive';
    }
    
    // Get source location if available
    let sourceLocation = undefined;
    if (runtimeErrors.length > 0 && runtimeErrors[0].stack) {
      sourceLocation = await this.sourceAnalyzer.analyzeStackTrace(runtimeErrors[0].stack);
    }
    
    const bug: QABug = {
      id: this.generateBugId(),
      title: this.generateBugTitle(action, category),
      severity,
      category,
      pageUrl: action.pageUrl,
      affectedElement: action.target,
      stepsToReproduce: this.generateReproductionSteps(action),
      expectedResult: this.generateExpectedResult(action),
      actualResult: this.generateActualResult(action, runtimeErrors, networkFailures),
      reproducible: false,
      reproducedCount: 0,
      evidence: {
        screenshots: action.screenshotPath ? [action.screenshotPath] : [],
        consoleErrors: runtimeErrors.map(e => e.message),
        networkErrors: networkFailures,
        stackTrace: runtimeErrors.length > 0 ? runtimeErrors[0].stack : undefined
      },
      sourceLocation,
      likelyCause,
      recommendedSolution,
      verificationSteps: this.generateVerificationSteps(action, category),
      discovered: action.timestamp,
      confirmed: 0
    };
    
    return bug;
  }
  
  /**
   * Analyze a runtime error and create a bug report
   */
  async analyzeRuntimeError(error: BrowserError): Promise<QABug | null> {
    const sourceLocation = error.stack 
      ? await this.sourceAnalyzer.analyzeStackTrace(error.stack)
      : undefined;
    
    const bug: QABug = {
      id: this.generateBugId(),
      title: this.generateErrorTitle(error.message),
      severity: 'HIGH',
      category: 'runtime-error',
      pageUrl: 'Unknown',
      affectedElement: undefined,
      stepsToReproduce: [
        'Load the application',
        'Navigate to the affected page',
        'The error occurs automatically'
      ],
      expectedResult: 'Application should load without runtime exceptions',
      actualResult: `Uncaught runtime error: ${error.message}`,
      reproducible: false,
      reproducedCount: 0,
      evidence: {
        screenshots: [],
        consoleErrors: [error.message],
        networkErrors: [],
        stackTrace: error.stack
      },
      sourceLocation,
      likelyCause: this.identifyErrorCause(error.message),
      recommendedSolution: this.suggestRuntimeErrorFix(error),
      verificationSteps: [
        'Fix the reported error in the source code',
        'Reload the application',
        'Verify the error no longer appears in the console',
        'Test the affected functionality'
      ],
      discovered: error.timestamp,
      confirmed: 0
    };
    
    return bug;
  }
  
  /**
   * Analyze a network failure and create a bug report
   */
  async analyzeNetworkFailure(failure: NetworkRequest): Promise<QABug | null> {
    const isCritical = failure.resourceType === 'script' || failure.resourceType === 'stylesheet';
    
    const bug: QABug = {
      id: this.generateBugId(),
      title: `${isCritical ? 'Critical ' : ''}${this.capitalize(failure.resourceType || 'Resource')} Load Failure`,
      severity: isCritical ? 'CRITICAL' : 'MEDIUM',
      category: 'api-network-error',
      pageUrl: 'Unknown',
      affectedElement: undefined,
      stepsToReproduce: [
        'Load the application',
        `Browser attempts to load: ${this.truncateUrl(failure.url)}`,
        `Request fails with: ${failure.errorText || `HTTP ${failure.status}`}`
      ],
      expectedResult: 'Resource should load successfully',
      actualResult: failure.failed 
        ? `Network request failed: ${failure.errorText}`
        : `HTTP ${failure.status}: ${failure.statusText}`,
      reproducible: false,
      reproducedCount: 0,
      evidence: {
        screenshots: [],
        consoleErrors: [],
        networkErrors: [failure],
        stackTrace: undefined
      },
      sourceLocation: undefined,
      likelyCause: this.identifyNetworkFailureCause(failure),
      recommendedSolution: this.suggestNetworkFailureFix(failure),
      verificationSteps: [
        'Verify the resource exists in your build output',
        'Check the file path is correct',
        'Verify server is serving the file correctly',
        'Check for CORS issues if cross-origin',
        'Reload the application and verify successful load'
      ],
      discovered: failure.timestamp,
      confirmed: 0
    };
    
    return bug;
  }
  
  /**
   * Attempt to reproduce a bug
   */
  async reproduceBug(bug: QABug, browserAgent: QABrowserAgent): Promise<boolean> {
    try {
      // Navigate to the page where bug was found
      await browserAgent.navigateTo(bug.pageUrl);
      await this.delay(1000);
      
      // Clear previous captures
      browserAgent.clearCaptures();
      
      // Try to trigger the bug again
      if (bug.affectedElement) {
        try {
          await browserAgent.clickElement(bug.affectedElement);
          await this.delay(1000);
        } catch (error) {
          // Element interaction might fail again
        }
      }
      
      // Check if same errors occurred
      const errors = browserAgent.getRuntimeErrors();
      const failures = browserAgent.getNetworkFailures();
      
      // Check if we see similar evidence
      const hasMatchingError = errors.some(e => 
        bug.evidence.consoleErrors.some(bugError => 
          e.message.includes(bugError) || bugError.includes(e.message)
        )
      );
      
      const hasMatchingNetworkFailure = failures.some(f =>
        bug.evidence.networkErrors.some(bugFailure =>
          f.url === bugFailure.url
        )
      );
      
      return hasMatchingError || hasMatchingNetworkFailure;
      
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Generate bug title
   */
  private generateBugTitle(action: QATestAction, category: QABugCategory): string {
    switch (action.type) {
      case 'click':
        return `Button click fails: ${action.value || action.target}`;
      case 'navigate':
        return `Navigation failure: ${action.value || action.target}`;
      case 'submit':
        return `Form submission error: ${action.target}`;
      case 'type':
        return `Input interaction fails: ${action.target}`;
      default:
        return `${this.capitalize(category)}: ${action.target}`;
    }
  }
  
  /**
   * Generate error title from error message
   */
  private generateErrorTitle(message: string): string {
    // Keep it short and descriptive
    const shortMessage = message.substring(0, 80);
    return `Runtime Error: ${shortMessage}${message.length > 80 ? '...' : ''}`;
  }
  
  /**
   * Generate reproduction steps
   */
  private generateReproductionSteps(action: QATestAction): string[] {
    const steps: string[] = [
      `Navigate to ${action.pageUrl}`
    ];
    
    switch (action.type) {
      case 'click':
        steps.push(`Click the element: ${action.value || action.target}`);
        break;
      case 'navigate':
        steps.push(`Click the link: ${action.value || action.target}`);
        break;
      case 'submit':
        steps.push(`Fill and submit the form: ${action.target}`);
        break;
      case 'type':
        steps.push(`Type into input: ${action.target}`);
        if (action.value) steps.push(`Value: ${action.value}`);
        break;
    }
    
    steps.push('Observe the error');
    
    return steps;
  }
  
  /**
   * Generate expected result
   */
  private generateExpectedResult(action: QATestAction): string {
    switch (action.type) {
      case 'click':
        return 'Button should perform its intended action without errors';
      case 'navigate':
        return 'Navigation should complete successfully to the target page';
      case 'submit':
        return 'Form should submit and show appropriate response or validation';
      case 'type':
        return 'Input should accept text without errors';
      default:
        return 'Action should complete successfully';
    }
  }
  
  /**
   * Generate actual result
   */
  private generateActualResult(
    action: QATestAction, 
    errors: BrowserError[], 
    failures: NetworkRequest[]
  ): string {
    const parts: string[] = [];
    
    if (action.error) {
      parts.push(action.error);
    }
    
    if (errors.length > 0) {
      parts.push(`${errors.length} runtime error(s) occurred`);
    }
    
    if (failures.length > 0) {
      parts.push(`${failures.length} network request(s) failed`);
    }
    
    return parts.join('. ') || 'Action failed without specific error message';
  }
  
  /**
   * Generate verification steps
   */
  private generateVerificationSteps(action: QATestAction, category: QABugCategory): string[] {
    return [
      'Apply the recommended solution',
      'Rebuild and restart the application',
      `Navigate to ${action.pageUrl}`,
      'Repeat the reproduction steps',
      'Verify the action completes successfully without errors',
      'Check browser console for any remaining errors'
    ];
  }
  
  /**
   * Identify error cause from message
   */
  private identifyErrorCause(message: string): string {
    if (message.includes('undefined') || message.includes('null')) {
      return 'Attempting to access property or method on undefined/null value';
    }
    if (message.includes('is not a function')) {
      return 'Attempting to call something that is not a function';
    }
    if (message.includes('is not defined')) {
      return 'Referencing undeclared variable or function';
    }
    if (message.includes('Cannot read propert')) {
      return 'Attempting to read property from undefined or null object';
    }
    return 'Uncaught runtime exception';
  }
  
  /**
   * Suggest runtime error fix
   */
  private suggestRuntimeErrorFix(error: BrowserError): string {
    const message = error.message;
    
    if (message.includes('undefined') || message.includes('null')) {
      return 'Add null/undefined checks before accessing properties. Use optional chaining (?.) or default values.';
    }
    if (message.includes('is not a function')) {
      return 'Verify the variable is a function before calling it. Check imports and function definitions.';
    }
    if (message.includes('is not defined')) {
      return 'Import or declare the variable/function before use. Check for typos in variable names.';
    }
    
    return 'Review the stack trace to identify the source of the error. Add appropriate error handling and validation.';
  }
  
  /**
   * Identify network failure cause
   */
  private identifyNetworkFailureCause(failure: NetworkRequest): string {
    if (failure.status === 404) {
      return 'Resource not found (404) - file may be missing or path incorrect';
    }
    if (failure.status === 403) {
      return 'Access forbidden (403) - check permissions';
    }
    if (failure.status === 401) {
      return 'Unauthorized (401) - authentication required';
    }
    if (failure.status && failure.status >= 500) {
      return `Server error (${failure.status}) - backend issue`;
    }
    if (failure.failed) {
      return failure.errorText || 'Network request failed - connectivity or CORS issue';
    }
    return 'Request failed with HTTP error status';
  }
  
  /**
   * Suggest network failure fix
   */
  private suggestNetworkFailureFix(failure: NetworkRequest): string {
    if (failure.status === 404) {
      return 'Verify the file exists in your build output and the path is correct in your HTML or bundle configuration.';
    }
    if (failure.resourceType === 'script' || failure.resourceType === 'stylesheet') {
      return 'Check your build configuration and ensure all assets are being copied to the output directory.';
    }
    if (failure.failed) {
      return 'Check network connectivity, verify CORS configuration if cross-origin, and ensure the server is running.';
    }
    return 'Investigate server logs and verify the endpoint is functioning correctly.';
  }
  
  /**
   * Helper: generate bug ID
   */
  private generateBugId(): string {
    return `BUG-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }
  
  /**
   * Helper: capitalize string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  /**
   * Helper: truncate URL
   */
  private truncateUrl(url: string, maxLength: number = 60): string {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  }
  
  /**
   * Helper: delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
