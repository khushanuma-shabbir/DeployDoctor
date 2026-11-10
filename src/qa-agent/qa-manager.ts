import { EventEmitter } from 'events';
import type { 
  QAAgentOptions, 
  QASessionReport, 
  QAProgressUpdate,
  QASessionState
} from '../types/index.js';
import { QAOrchestrator } from './qa-orchestrator.js';
import { ReportGenerator } from './report-generator.js';
import * as fs from 'fs/promises';

/**
 * QA Manager - Manages QA testing sessions
 * 
 * Responsibilities:
 * - Manage active sessions
 * - Provide session status
 * - Store and retrieve reports
 * - Clean up completed sessions
 */
export class QAManager extends EventEmitter {
  private activeSessions: Map<string, QASessionState> = new Map();
  private reportGenerator: ReportGenerator;
  private reportsDir: string = 'reports/qa-reports';
  
  constructor() {
    super();
    this.reportGenerator = new ReportGenerator();
    this.ensureReportsDir();
  }
  
  private async ensureReportsDir(): Promise<void> {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
  
  /**
   * Start a new QA testing session
   */
  async startSession(options: QAAgentOptions): Promise<string> {
    const orchestrator = new QAOrchestrator();
    const sessionId = orchestrator.getSessionId();
    
    // Initialize session state
    const sessionState: QASessionState = {
      sessionId,
      status: 'initializing',
      options,
      progress: {
        status: 'initializing',
        pagesDiscovered: 0,
        pagesTested: 0,
        actionsPerformed: 0,
        bugsFound: 0,
        bugsConfirmed: 0,
        elapsedTime: 0
      }
    };
    
    this.activeSessions.set(sessionId, sessionState);
    
    // Listen to progress updates
    orchestrator.on('progress', (progress: QAProgressUpdate) => {
      sessionState.progress = progress;
      this.emit('progress', sessionId, progress);
    });
    
    // Start testing in background
    this.runSession(orchestrator, sessionState, options).catch(error => {
      sessionState.status = 'failed';
      sessionState.error = error instanceof Error ? error.message : String(error);
      this.emit('error', sessionId, sessionState.error);
    });
    
    return sessionId;
  }
  
  /**
   * Run the QA session
   */
  private async runSession(
    orchestrator: QAOrchestrator,
    sessionState: QASessionState,
    options: QAAgentOptions
  ): Promise<void> {
    try {
      // Run the testing
      const report = await orchestrator.startTesting(options);
      
      // Save reports
      await this.reportGenerator.saveReport(report);
      await this.reportGenerator.generateHTMLReport(report);
      
      // Update session state
      sessionState.status = 'completed';
      sessionState.report = report;
      
      this.emit('completed', sessionState.sessionId, report);
      
      // Clean up after a delay
      setTimeout(() => {
        this.activeSessions.delete(sessionState.sessionId);
      }, 60000); // Keep in memory for 1 minute after completion
      
    } catch (error) {
      sessionState.status = 'failed';
      sessionState.error = error instanceof Error ? error.message : String(error);
      this.emit('error', sessionState.sessionId, sessionState.error);
      
      // Clean up failed session
      setTimeout(() => {
        this.activeSessions.delete(sessionState.sessionId);
      }, 30000);
    }
  }
  
  /**
   * Get session state
   */
  getSessionState(sessionId: string): QASessionState | null {
    return this.activeSessions.get(sessionId) || null;
  }
  
  /**
   * Get all active sessions
   */
  getActiveSessions(): QASessionState[] {
    return Array.from(this.activeSessions.values());
  }
  
  /**
   * Get session report (from memory or disk)
   */
  async getReport(sessionId: string): Promise<QASessionReport | null> {
    // Check active sessions first
    const sessionState = this.activeSessions.get(sessionId);
    if (sessionState?.report) {
      return sessionState.report;
    }
    
    // Try to load from disk
    try {
      const reportPath = `${this.reportsDir}/${sessionId}.json`;
      const data = await fs.readFile(reportPath, 'utf-8');
      return JSON.parse(data) as QASessionReport;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * List all saved reports
   */
  async listReports(limit: number = 50): Promise<Array<{
    sessionId: string;
    timestamp: number;
    url: string;
    overallHealth: string;
    bugsFound: number;
  }>> {
    try {
      const files = await fs.readdir(this.reportsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      const reports = await Promise.all(
        jsonFiles.slice(0, limit).map(async (file) => {
          try {
            const data = await fs.readFile(`${this.reportsDir}/${file}`, 'utf-8');
            const report = JSON.parse(data) as QASessionReport;
            return {
              sessionId: report.sessionId,
              timestamp: report.startTime,
              url: report.url,
              overallHealth: report.overallHealth,
              bugsFound: report.bugs.length
            };
          } catch {
            return null;
          }
        })
      );
      
      return reports
        .filter(r => r !== null)
        .sort((a, b) => b!.timestamp - a!.timestamp) as any;
      
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Delete a report
   */
  async deleteReport(sessionId: string): Promise<boolean> {
    try {
      // Remove from active sessions
      this.activeSessions.delete(sessionId);
      
      // Delete files
      await fs.unlink(`${this.reportsDir}/${sessionId}.json`);
      
      try {
        await fs.unlink(`${this.reportsDir}/${sessionId}.html`);
      } catch {
        // HTML might not exist
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get QA statistics
   */
  async getStats(): Promise<{
    totalReports: number;
    totalBugsFound: number;
    averageBugsPerReport: number;
    healthDistribution: {
      healthy: number;
      warning: number;
      critical: number;
    };
  }> {
    try {
      const files = await fs.readdir(this.reportsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      let totalBugs = 0;
      const healthDist = { healthy: 0, warning: 0, critical: 0 };
      
      for (const file of jsonFiles) {
        try {
          const data = await fs.readFile(`${this.reportsDir}/${file}`, 'utf-8');
          const report = JSON.parse(data) as QASessionReport;
          totalBugs += report.bugs.length;
          healthDist[report.overallHealth]++;
        } catch {
          continue;
        }
      }
      
      return {
        totalReports: jsonFiles.length,
        totalBugsFound: totalBugs,
        averageBugsPerReport: jsonFiles.length > 0 ? Math.round(totalBugs / jsonFiles.length) : 0,
        healthDistribution: healthDist
      };
      
    } catch (error) {
      return {
        totalReports: 0,
        totalBugsFound: 0,
        averageBugsPerReport: 0,
        healthDistribution: { healthy: 0, warning: 0, critical: 0 }
      };
    }
  }
}
