// Core types for DeployDoctor

export type ScanMode = 'local' | 'production';

export type SeverityLevel = 'critical' | 'warning' | 'info' | 'healthy';

export type IssueCategory = 
  | 'white-screen'
  | 'runtime-error'
  | 'console-error'
  | 'network-failure'
  | 'http-error'
  | 'missing-asset'
  | 'broken-route'
  | 'rendering-failure'
  | 'unknown';

export type HealthStatus = 'healthy' | 'warning' | 'critical';

export interface ScanOptions {
  url: string;
  mode: ScanMode;
  timeout?: number;
  rootSelector?: string;
  expectedContent?: string;
  takeScreenshot?: boolean;
}

export interface BrowserError {
  type: 'page-error' | 'console-error';
  message: string;
  stack?: string;
  timestamp: number;
  level?: 'error' | 'warning' | 'info';
}

export interface NetworkRequest {
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  failed: boolean;
  errorText?: string;
  timestamp: number;
  resourceType?: string;
}

export interface PageState {
  title: string;
  url: string;
  hasRootElement: boolean;
  rootSelector: string;
  rootContent: string;
  bodyHTML: string;
  isBlank: boolean;
  timestamp: number;
}

export interface SourceLocation {
  file: string;
  line?: number;
  column?: number;
  snippet?: string;
  context?: string[];
  resolved: boolean;
}

export interface DiagnosisResult {
  category: IssueCategory;
  severity: SeverityLevel;
  title: string;
  description: string;
  likelyCause: string;
  confidence: number; // 0-1
  evidence: string[];
  sourceLocation?: SourceLocation;
  suggestedFix?: SuggestedFix;
  investigationSteps: string[];
}

export interface SuggestedFix {
  description: string;
  code?: string;
  language?: string;
  explanation: string;
  isSpeculative: boolean;
}

export interface WhiteScreenAnalysis {
  isWhiteScreen: boolean;
  confidence: number;
  signals: {
    blankScreenshot: boolean;
    missingRoot: boolean;
    emptyRoot: boolean;
    noContent: boolean;
    hasUncaughtErrors: boolean;
    hasFailedBundles: boolean;
  };
  status: HealthStatus;
}

export interface ScanResult {
  id: string;
  timestamp: number;
  url: string;
  mode: ScanMode;
  duration: number;
  status: 'success' | 'failed' | 'timeout';
  healthStatus: HealthStatus;
  
  // Browser monitoring data
  pageState: PageState;
  browserErrors: BrowserError[];
  networkRequests: NetworkRequest[];
  failedRequests: NetworkRequest[];
  
  // Analysis results
  whiteScreenAnalysis: WhiteScreenAnalysis;
  diagnoses: DiagnosisResult[];
  
  // Metadata
  browserInfo: {
    userAgent: string;
    viewport: { width: number; height: number };
  };
  
  // Assets
  screenshotPath?: string;
  
  // Limitations
  limitations: string[];
}

export interface ScanSummary {
  id: string;
  timestamp: number;
  url: string;
  mode: ScanMode;
  healthStatus: HealthStatus;
  issueCount: {
    critical: number;
    warning: number;
    info: number;
  };
  duration: number;
}

export interface ComparisonResult {
  previousScan: ScanSummary;
  currentScan: ScanSummary;
  resolved: DiagnosisResult[];
  remaining: DiagnosisResult[];
  new: DiagnosisResult[];
}

// ==========================================
// QA Agent Types
// ==========================================

export type QABugSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type QABugCategory = 
  | 'runtime-error'
  | 'functional-error'
  | 'ui-layout-error'
  | 'api-network-error'
  | 'navigation-error'
  | 'validation-error'
  | 'performance-issue'
  | 'accessibility-issue'
  | 'security-concern';

export type QATestScope = 
  | 'quick'      // Quick smoke test (5-10 mins)
  | 'standard'   // Standard testing (15-30 mins)
  | 'thorough';  // Deep testing (30+ mins)

export type QASessionStatus = 
  | 'idle'
  | 'initializing'
  | 'discovering'
  | 'testing'
  | 'analyzing'
  | 'reproducing'
  | 'reporting'
  | 'completed'
  | 'failed';

export interface QATestCredentials {
  username?: string;
  password?: string;
  apiKey?: string;
}

export interface QAAgentOptions {
  url: string;
  scope: QATestScope;
  mode: 'local' | 'production';
  viewport?: { width: number; height: number };
  browserType?: 'chromium' | 'firefox' | 'webkit';
  credentials?: QATestCredentials;
  maxPages?: number;
  maxActions?: number;
  maxDuration?: number; // in minutes
  testLogin?: boolean;
  testForms?: boolean;
  testNavigation?: boolean;
  testResponsive?: boolean;
}

export interface QADiscoveredElement {
  type: 'button' | 'link' | 'input' | 'form' | 'select' | 'checkbox' | 'radio' | 'other';
  selector: string;
  text?: string;
  href?: string;
  visible: boolean;
  enabled: boolean;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface QADiscoveredPage {
  url: string;
  title: string;
  discovered: number;
  tested: boolean;
  elements: QADiscoveredElement[];
  forms: QAFormDiscovery[];
  hasErrors: boolean;
}

export interface QAFormDiscovery {
  selector: string;
  action?: string;
  method?: string;
  inputs: Array<{
    type: string;
    name?: string;
    required: boolean;
    placeholder?: string;
  }>;
  submitButton?: string;
}

export interface QATestAction {
  id: string;
  type: 'click' | 'type' | 'select' | 'navigate' | 'scroll' | 'submit';
  target: string;
  value?: string;
  timestamp: number;
  pageUrl: string;
  success: boolean;
  error?: string;
  screenshotPath?: string;
}

export interface QABugEvidence {
  screenshots: string[];
  consoleErrors: string[];
  networkErrors: NetworkRequest[];
  stackTrace?: string;
  domState?: string;
  videoPath?: string;
}

export interface QABug {
  id: string;
  title: string;
  severity: QABugSeverity;
  category: QABugCategory;
  pageUrl: string;
  affectedElement?: string;
  stepsToReproduce: string[];
  expectedResult: string;
  actualResult: string;
  reproducible: boolean;
  reproducedCount: number;
  evidence: QABugEvidence;
  sourceLocation?: SourceLocation;
  likelyCause: string;
  recommendedSolution: string;
  verificationSteps: string[];
  discovered: number;
  confirmed: number;
}

export interface QATestResult {
  action: QATestAction;
  passed: boolean;
  bugId?: string;
  notes?: string;
}

export interface QAProgressUpdate {
  status: QASessionStatus;
  currentPage?: string;
  currentActivity?: string;
  pagesDiscovered: number;
  pagesTested: number;
  actionsPerformed: number;
  bugsFound: number;
  bugsConfirmed: number;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
}

export interface QASessionReport {
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  url: string;
  scope: QATestScope;
  mode: 'local' | 'production';
  
  // Summary
  overallHealth: 'healthy' | 'warning' | 'critical';
  pagesDiscovered: number;
  pagesTested: number;
  actionsPerformed: number;
  
  // Bugs
  bugs: QABug[];
  bugsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  
  // Test Results
  testsPassed: number;
  testsFailed: number;
  testsBlocked: number;
  
  // Pages and Actions
  discoveredPages: QADiscoveredPage[];
  testActions: QATestAction[];
  
  // Observations
  unverifiedObservations: string[];
  
  // Metadata
  browserInfo: {
    type: string;
    userAgent: string;
    viewport: { width: number; height: number };
  };
  
  limitations: string[];
}

export interface QASessionState {
  sessionId: string;
  status: QASessionStatus;
  options: QAAgentOptions;
  progress: QAProgressUpdate;
  report?: QASessionReport;
  error?: string;
}
