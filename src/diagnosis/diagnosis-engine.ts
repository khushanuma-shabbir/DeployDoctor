import type { 
  DiagnosisResult, 
  BrowserError, 
  NetworkRequest, 
  PageState, 
  WhiteScreenAnalysis,
  IssueCategory
} from '../types/index.js';
import { SourceAnalyzer } from '../source-analysis/source-analyzer.js';

export interface DiagnosisInput {
  pageState: PageState;
  browserErrors: BrowserError[];
  networkRequests: NetworkRequest[];
  failedRequests: NetworkRequest[];
  whiteScreenAnalysis: WhiteScreenAnalysis;
}

export class DiagnosisEngine {
  private sourceAnalyzer: SourceAnalyzer;
  
  constructor() {
    this.sourceAnalyzer = new SourceAnalyzer();
  }
  
  async diagnose(input: DiagnosisInput): Promise<DiagnosisResult[]> {
    const diagnoses: DiagnosisResult[] = [];
    
    // 1. White screen diagnosis
    if (input.whiteScreenAnalysis.isWhiteScreen) {
      diagnoses.push(await this.diagnoseWhiteScreen(input));
    }
    
    // 2. Runtime errors
    const pageErrors = input.browserErrors.filter(e => e.type === 'page-error');
    for (const error of pageErrors) {
      diagnoses.push(await this.diagnoseRuntimeError(error));
    }
    
    // 3. Console errors
    const consoleErrors = input.browserErrors.filter(e => e.type === 'console-error' && e.level === 'error');
    if (consoleErrors.length > 0 && pageErrors.length === 0) {
      // Only report console errors if no page errors (to avoid duplication)
      diagnoses.push(this.diagnoseConsoleErrors(consoleErrors));
    }
    
    // 4. Failed assets
    const failedAssets = input.failedRequests.filter(r => 
      r.resourceType === 'script' || r.resourceType === 'stylesheet'
    );
    for (const asset of failedAssets) {
      diagnoses.push(this.diagnoseFailedAsset(asset));
    }
    
    // 5. API failures
    const failedAPIs = input.failedRequests.filter(r =>
      r.resourceType === 'fetch' || r.resourceType === 'xhr'
    );
    for (const api of failedAPIs) {
      diagnoses.push(this.diagnoseAPIFailure(api));
    }
    
    // 6. HTTP errors
    const httpErrors = input.networkRequests.filter(r => 
      r.status && r.status >= 400 && !r.failed
    );
    for (const error of httpErrors) {
      diagnoses.push(this.diagnoseHTTPError(error));
    }
    
    // If no issues found, add a healthy status
    if (diagnoses.length === 0 && !input.pageState.isBlank) {
      diagnoses.push(this.createHealthyDiagnosis());
    }
    
    return diagnoses;
  }
  
  private async diagnoseWhiteScreen(input: DiagnosisInput): Promise<DiagnosisResult> {
    const signals = input.whiteScreenAnalysis.signals;
    const evidence: string[] = [];
    let likelyCause = '';
    let suggestedFix = undefined;
    
    if (signals.hasFailedBundles) {
      evidence.push('JavaScript bundle failed to load');
      likelyCause = 'Critical JavaScript bundle(s) failed to load, preventing React from initializing';
      suggestedFix = {
        description: 'Check your build configuration and ensure all JavaScript files are accessible',
        explanation: 'When the main JavaScript bundle fails to load (404, network error, or CORS), React cannot initialize and the page remains blank.',
        isSpeculative: false
      };
    } else if (signals.hasUncaughtErrors) {
      evidence.push('Uncaught JavaScript exception detected');
      likelyCause = 'An uncaught error occurred during React initialization or rendering';
      suggestedFix = {
        description: 'Review the runtime errors below for the specific exception',
        explanation: 'Uncaught errors in React components or during app initialization will crash the application and result in a blank screen.',
        isSpeculative: false
      };
    } else if (signals.missingRoot) {
      evidence.push('React root element not found in DOM');
      likelyCause = 'The React root element (default: #root) is missing from the HTML';
      suggestedFix = {
        description: 'Ensure your HTML includes the root element',
        code: '<div id="root"></div>',
        language: 'html',
        explanation: 'React needs a DOM element to mount the application. Check your index.html.',
        isSpeculative: false
      };
    } else if (signals.emptyRoot) {
      evidence.push('React root element is empty');
      likelyCause = 'React mounted but rendered no content, possibly due to routing issues or conditional rendering';
      suggestedFix = {
        description: 'Check your route configuration and conditional rendering logic',
        explanation: 'The root element exists but contains no content. This often happens with incorrect route setup or conditions that evaluate to false.',
        isSpeculative: true
      };
    } else {
      evidence.push('Page appears blank with no obvious errors');
      likelyCause = 'Page is rendering but without visible content';
      suggestedFix = {
        description: 'Check for CSS issues (display: none, visibility: hidden, white text on white background)',
        explanation: 'Sometimes the content is rendering but not visible due to styling issues.',
        isSpeculative: true
      };
    }
    
    if (signals.blankScreenshot) {
      evidence.push('Screenshot captured a blank page');
    }
    if (signals.noContent) {
      evidence.push('No text content detected in page body');
    }
    
    return {
      category: 'white-screen',
      severity: 'critical',
      title: 'White Screen / Blank Page Detected',
      description: 'The application is displaying a blank white screen instead of the expected content.',
      likelyCause,
      confidence: input.whiteScreenAnalysis.confidence,
      evidence,
      suggestedFix,
      investigationSteps: [
        'Open browser DevTools and check the Console tab for errors',
        'Check the Network tab for failed requests (especially .js files)',
        'Verify the HTML contains the React root element',
        'Check if JavaScript is enabled in the browser'
      ]
    };
  }
  
  private async diagnoseRuntimeError(error: BrowserError): Promise<DiagnosisResult> {
    const evidence = [
      `Error message: ${error.message}`,
      `Timestamp: ${new Date(error.timestamp).toISOString()}`
    ];
    
    if (error.stack) {
      evidence.push('Stack trace available');
    }
    
    // Attempt to extract source location
    let sourceLocation = undefined;
    if (error.stack) {
      sourceLocation = await this.sourceAnalyzer.analyzeStackTrace(error.stack);
    }
    
    // Pattern matching for common errors
    let likelyCause = '';
    let suggestedFix = undefined;
    let category: IssueCategory = 'runtime-error';
    
    if (error.message.includes('undefined') || error.message.includes('null')) {
      likelyCause = 'Attempting to access a property or method on undefined or null';
      category = 'runtime-error';
      
      const match = error.message.match(/Cannot read propert(?:y|ies) of (undefined|null)/);
      if (match) {
        suggestedFix = {
          description: 'Add a null check before accessing the property',
          code: `// Add optional chaining\nif (obj?.property) {\n  // Safe to use\n}\n\n// Or use default values\nconst value = obj?.property ?? defaultValue;`,
          language: 'javascript',
          explanation: `The code is trying to access a property on ${match[1]}. Use optional chaining (?.) or null checks to prevent this error.`,
          isSpeculative: false
        };
      }
    } else if (error.message.includes('is not a function')) {
      likelyCause = 'Attempting to call something that is not a function';
      suggestedFix = {
        description: 'Verify the variable is a function before calling it',
        explanation: 'This error occurs when you try to call something like a function, but it\'s actually undefined, null, or another type.',
        isSpeculative: true
      };
    } else if (error.message.includes('is not defined')) {
      likelyCause = 'Referencing a variable or function that has not been declared';
      suggestedFix = {
        description: 'Import or declare the variable/function before using it',
        explanation: 'The code references something that doesn\'t exist in the current scope. Check for missing imports or typos.',
        isSpeculative: true
      };
    } else {
      likelyCause = 'An uncaught exception occurred during execution';
    }
    
    return {
      category,
      severity: 'critical',
      title: 'Uncaught Runtime Exception',
      description: error.message,
      likelyCause,
      confidence: 0.8,
      evidence,
      sourceLocation,
      suggestedFix,
      investigationSteps: [
        'Check the stack trace for the error origin',
        'Add error boundaries to catch React rendering errors',
        'Use try-catch blocks for async operations',
        'Add null checks before accessing properties'
      ]
    };
  }
  
  private diagnoseConsoleErrors(errors: BrowserError[]): DiagnosisResult {
    const evidence = errors.map(e => e.message);
    
    return {
      category: 'console-error',
      severity: 'warning',
      title: `${errors.length} Console Error${errors.length > 1 ? 's' : ''} Detected`,
      description: 'Errors were logged to the browser console',
      likelyCause: 'Application code or dependencies logged errors during execution',
      confidence: 0.6,
      evidence,
      investigationSteps: [
        'Review each console error message',
        'Check if errors are coming from third-party libraries',
        'Verify these are actual problems and not warning noise'
      ]
    };
  }
  
  private diagnoseFailedAsset(request: NetworkRequest): DiagnosisResult {
    const isJS = request.resourceType === 'script';
    const isCSS = request.resourceType === 'stylesheet';
    
    return {
      category: 'missing-asset',
      severity: isJS ? 'critical' : 'warning',
      title: `Failed to Load ${isJS ? 'JavaScript' : 'CSS'} Asset`,
      description: `Asset failed to load: ${this.truncateURL(request.url)}`,
      likelyCause: request.errorText || 'Network failure or 404 error',
      confidence: 0.9,
      evidence: [
        `URL: ${request.url}`,
        `Method: ${request.method}`,
        `Error: ${request.errorText || 'Unknown'}`
      ],
      suggestedFix: isJS ? {
        description: 'Verify the file exists and the path is correct',
        explanation: 'JavaScript bundle failures prevent your application from running. Check your build output and deployment.',
        isSpeculative: false
      } : undefined,
      investigationSteps: [
        'Check if the file exists in your build output',
        'Verify the file path in your HTML or bundle',
        'Check for CORS issues if loading from a different domain',
        'Review your build configuration'
      ]
    };
  }
  
  private diagnoseAPIFailure(request: NetworkRequest): DiagnosisResult {
    return {
      category: 'network-failure',
      severity: 'warning',
      title: 'API Request Failed',
      description: `Request to ${this.truncateURL(request.url)} failed`,
      likelyCause: request.errorText || 'Network error, timeout, or CORS issue',
      confidence: 0.8,
      evidence: [
        `URL: ${request.url}`,
        `Method: ${request.method}`,
        `Error: ${request.errorText || 'Request failed'}`
      ],
      suggestedFix: {
        description: 'Add error handling for failed requests',
        code: `try {\n  const response = await fetch(url);\n  if (!response.ok) throw new Error('Request failed');\n  const data = await response.json();\n} catch (error) {\n  console.error('API error:', error);\n  // Handle error appropriately\n}`,
        language: 'javascript',
        explanation: 'Always handle network errors gracefully to prevent crashes.',
        isSpeculative: false
      },
      investigationSteps: [
        'Check if the API endpoint is accessible',
        'Verify CORS configuration if calling a different domain',
        'Check network connectivity',
        'Review API authentication if required'
      ]
    };
  }
  
  private diagnoseHTTPError(request: NetworkRequest): DiagnosisResult {
    const status = request.status!;
    const isClientError = status >= 400 && status < 500;
    const isServerError = status >= 500;
    
    let likelyCause = '';
    if (status === 404) {
      likelyCause = 'Resource not found (404)';
    } else if (status === 403) {
      likelyCause = 'Access forbidden (403) - check permissions';
    } else if (status === 401) {
      likelyCause = 'Unauthorized (401) - authentication required';
    } else if (isClientError) {
      likelyCause = `Client error (${status})`;
    } else if (isServerError) {
      likelyCause = `Server error (${status})`;
    } else {
      likelyCause = `HTTP error ${status}`;
    }
    
    return {
      category: 'http-error',
      severity: isServerError ? 'critical' : 'warning',
      title: `HTTP ${status} Error`,
      description: `${request.method} ${this.truncateURL(request.url)}`,
      likelyCause,
      confidence: 0.9,
      evidence: [
        `Status: ${status} ${request.statusText}`,
        `URL: ${request.url}`,
        `Method: ${request.method}`
      ],
      investigationSteps: [
        'Check the server logs for details',
        'Verify the URL and endpoint are correct',
        status === 401 || status === 403 ? 'Check authentication/authorization' : 'Review API documentation',
        isServerError ? 'Contact backend team or check server health' : 'Review request parameters'
      ]
    };
  }
  
  private createHealthyDiagnosis(): DiagnosisResult {
    return {
      category: 'unknown',
      severity: 'healthy',
      title: 'No Critical Issues Detected',
      description: 'The application loaded successfully without critical errors',
      likelyCause: 'Application is functioning normally',
      confidence: 0.7,
      evidence: [
        'No uncaught exceptions',
        'No failed critical assets',
        'Page rendered content'
      ],
      investigationSteps: []
    };
  }
  
  private truncateURL(url: string, maxLength: number = 80): string {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  }
}
