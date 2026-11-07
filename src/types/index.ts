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
