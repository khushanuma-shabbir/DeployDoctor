import { BrowserMonitor } from '../monitor/browser-monitor.js';
import { DiagnosisEngine } from '../diagnosis/diagnosis-engine.js';
import { WhiteScreenDetector } from '../diagnosis/white-screen-detector.js';
import { ScanDatabase } from '../storage/database.js';
import type { ScanOptions, ScanResult, HealthStatus } from '../types/index.js';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export class Scanner {
  private monitor: BrowserMonitor;
  private diagnosisEngine: DiagnosisEngine;
  private whiteScreenDetector: WhiteScreenDetector;
  private database: ScanDatabase;
  private reportsDir: string;
  
  constructor(dbPath?: string, reportsDir: string = 'reports') {
    this.monitor = new BrowserMonitor();
    this.diagnosisEngine = new DiagnosisEngine();
    this.whiteScreenDetector = new WhiteScreenDetector();
    this.database = new ScanDatabase(dbPath);
    this.reportsDir = reportsDir;
    
    // Ensure reports directory exists
    this.ensureReportsDir();
  }
  
  private async ensureReportsDir(): Promise<void> {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
  
  async scan(options: ScanOptions): Promise<ScanResult> {
    const startTime = Date.now();
    const scanId = this.generateScanId();
    
    try {
      // Step 1: Monitor the page with Playwright
      const monitorResult = await this.monitor.scan(options);
      
      if (!monitorResult.success) {
        // Browser monitoring failed
        return this.createFailedResult(scanId, options, monitorResult.error || 'Browser monitoring failed', startTime);
      }
      
      // Step 2: Detect white screen
      const whiteScreenAnalysis = this.whiteScreenDetector.detect(
        monitorResult.pageState,
        monitorResult.browserErrors,
        monitorResult.failedRequests,
        monitorResult.screenshotBuffer
      );
      
      // Step 3: Run diagnosis engine
      const diagnoses = await this.diagnosisEngine.diagnose({
        pageState: monitorResult.pageState,
        browserErrors: monitorResult.browserErrors,
        networkRequests: monitorResult.networkRequests,
        failedRequests: monitorResult.failedRequests,
        whiteScreenAnalysis
      });
      
      // Step 4: Determine overall health status
      const healthStatus = this.determineHealthStatus(diagnoses, whiteScreenAnalysis);
      
      // Step 5: Save screenshot
      let screenshotPath: string | undefined;
      if (monitorResult.screenshotBuffer) {
        screenshotPath = await this.saveScreenshot(scanId, monitorResult.screenshotBuffer);
      }
      
      // Step 6: Create scan result
      const duration = Date.now() - startTime;
      
      const result: ScanResult = {
        id: scanId,
        timestamp: startTime,
        url: options.url,
        mode: options.mode,
        duration,
        status: 'success',
        healthStatus,
        pageState: monitorResult.pageState,
        browserErrors: monitorResult.browserErrors,
        networkRequests: monitorResult.networkRequests,
        failedRequests: monitorResult.failedRequests,
        whiteScreenAnalysis,
        diagnoses,
        browserInfo: {
          userAgent: monitorResult.userAgent,
          viewport: { width: 1920, height: 1080 }
        },
        screenshotPath,
        limitations: this.getLimitations(options.mode)
      };
      
      // Step 7: Save to database
      this.database.saveScan(result);
      
      // Step 8: Save JSON report
      await this.saveJSONReport(scanId, result);
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createFailedResult(scanId, options, errorMessage, startTime);
    }
  }
  
  private createFailedResult(
    id: string,
    options: ScanOptions,
    error: string,
    startTime: number
  ): ScanResult {
    const result: ScanResult = {
      id,
      timestamp: startTime,
      url: options.url,
      mode: options.mode,
      duration: Date.now() - startTime,
      status: 'failed',
      healthStatus: 'critical',
      pageState: {
        title: '',
        url: options.url,
        hasRootElement: false,
        rootSelector: options.rootSelector || '#root',
        rootContent: '',
        bodyHTML: '',
        isBlank: true,
        timestamp: Date.now()
      },
      browserErrors: [],
      networkRequests: [],
      failedRequests: [],
      whiteScreenAnalysis: {
        isWhiteScreen: true,
        confidence: 1.0,
        signals: {
          blankScreenshot: true,
          missingRoot: true,
          emptyRoot: true,
          noContent: true,
          hasUncaughtErrors: false,
          hasFailedBundles: false
        },
        status: 'critical'
      },
      diagnoses: [{
        category: 'unknown',
        severity: 'critical',
        title: 'Scan Failed',
        description: error,
        likelyCause: 'Unable to access or monitor the target URL',
        confidence: 1.0,
        evidence: [error],
        investigationSteps: [
          'Verify the URL is correct and accessible',
          'Check if the server is running (for local URLs)',
          'Check network connectivity (for production URLs)',
          'Verify there are no firewall or CORS restrictions'
        ]
      }],
      browserInfo: {
        userAgent: 'unknown',
        viewport: { width: 1920, height: 1080 }
      },
      limitations: this.getLimitations(options.mode)
    };
    
    // Still save failed scans
    try {
      this.database.saveScan(result);
      this.saveJSONReport(id, result);
    } catch (e) {
      // Ignore save errors for failed scans
    }
    
    return result;
  }
  
  private determineHealthStatus(diagnoses: any[], whiteScreenAnalysis: any): HealthStatus {
    // If white screen is detected with high confidence, it's critical
    if (whiteScreenAnalysis.isWhiteScreen && whiteScreenAnalysis.confidence > 0.7) {
      return 'critical';
    }
    
    // Check for critical diagnoses
    const hasCritical = diagnoses.some(d => d.severity === 'critical');
    if (hasCritical) return 'critical';
    
    // Check for warnings
    const hasWarning = diagnoses.some(d => d.severity === 'warning');
    if (hasWarning) return 'warning';
    
    return 'healthy';
  }
  
  private async saveScreenshot(scanId: string, buffer: Buffer): Promise<string> {
    const filename = `${scanId}.png`;
    const filepath = path.join(this.reportsDir, filename);
    await fs.writeFile(filepath, buffer);
    return filepath;
  }
  
  private async saveJSONReport(scanId: string, result: ScanResult): Promise<void> {
    const filename = `${scanId}.json`;
    const filepath = path.join(this.reportsDir, filename);
    await fs.writeFile(filepath, JSON.stringify(result, null, 2));
  }
  
  private generateScanId(): string {
    return `scan-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }
  
  private getLimitations(mode: string): string[] {
    const common = [
      'Source mapping requires accessible source maps',
      'Can only analyze client-side errors visible in the browser'
    ];
    
    if (mode === 'production') {
      return [
        ...common,
        'Cannot access private environment variables',
        'Cannot access server-side logs',
        'Cannot access private source code not shipped to browser',
        'Cannot access hidden deployment configurations',
        'Cannot access backend service internals'
      ];
    }
    
    return common;
  }
  
  getScan(id: string): ScanResult | null {
    return this.database.getScan(id);
  }
  
  getAllScans(limit?: number): any[] {
    return this.database.getAllScans(limit);
  }
  
  getRecentScans(url: string, limit?: number): any[] {
    return this.database.getRecentScans(url, limit);
  }
  
  deleteScan(id: string): boolean {
    return this.database.deleteScan(id);
  }
  
  getStats(): any {
    return this.database.getStats();
  }
  
  async close(): Promise<void> {
    await this.monitor.close();
    this.database.close();
  }
}
