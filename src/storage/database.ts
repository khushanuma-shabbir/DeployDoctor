import Database from 'better-sqlite3';
import type { ScanResult, ScanSummary } from '../types/index.js';

export class ScanDatabase {
  private db: Database.Database;
  
  constructor(dbPath: string = 'deploydoctor.db') {
    this.db = new Database(dbPath);
    this.initialize();
  }
  
  private initialize(): void {
    // Create scans table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scans (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        url TEXT NOT NULL,
        mode TEXT NOT NULL,
        duration INTEGER NOT NULL,
        status TEXT NOT NULL,
        health_status TEXT NOT NULL,
        result_json TEXT NOT NULL,
        screenshot_path TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_scans_timestamp ON scans(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_scans_url ON scans(url);
      CREATE INDEX IF NOT EXISTS idx_scans_health_status ON scans(health_status);
    `);
  }
  
  saveScan(result: ScanResult): void {
    const stmt = this.db.prepare(`
      INSERT INTO scans (
        id, timestamp, url, mode, duration, status, health_status, result_json, screenshot_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      result.id,
      result.timestamp,
      result.url,
      result.mode,
      result.duration,
      result.status,
      result.healthStatus,
      JSON.stringify(result),
      result.screenshotPath || null
    );
  }
  
  getScan(id: string): ScanResult | null {
    const stmt = this.db.prepare('SELECT result_json FROM scans WHERE id = ?');
    const row = stmt.get(id) as { result_json: string } | undefined;
    
    if (!row) return null;
    
    return JSON.parse(row.result_json);
  }
  
  getAllScans(limit: number = 100): ScanSummary[] {
    const stmt = this.db.prepare(`
      SELECT id, timestamp, url, mode, health_status, duration, result_json 
      FROM scans 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    
    const rows = stmt.all(limit) as any[];
    
    return rows.map(row => {
      const result = JSON.parse(row.result_json) as ScanResult;
      return {
        id: row.id,
        timestamp: row.timestamp,
        url: row.url,
        mode: row.mode,
        healthStatus: row.health_status,
        duration: row.duration,
        issueCount: this.countIssues(result.diagnoses)
      };
    });
  }
  
  getRecentScans(url: string, limit: number = 10): ScanSummary[] {
    const stmt = this.db.prepare(`
      SELECT id, timestamp, url, mode, health_status, duration, result_json 
      FROM scans 
      WHERE url = ?
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    
    const rows = stmt.all(url, limit) as any[];
    
    return rows.map(row => {
      const result = JSON.parse(row.result_json) as ScanResult;
      return {
        id: row.id,
        timestamp: row.timestamp,
        url: row.url,
        mode: row.mode,
        healthStatus: row.health_status,
        duration: row.duration,
        issueCount: this.countIssues(result.diagnoses)
      };
    });
  }
  
  deleteScan(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM scans WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
  
  getStats(): {
    totalScans: number;
    healthyScans: number;
    warningScans: number;
    criticalScans: number;
  } {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN health_status = 'healthy' THEN 1 ELSE 0 END) as healthy,
        SUM(CASE WHEN health_status = 'warning' THEN 1 ELSE 0 END) as warning,
        SUM(CASE WHEN health_status = 'critical' THEN 1 ELSE 0 END) as critical
      FROM scans
    `);
    
    const result = stmt.get() as any;
    
    return {
      totalScans: result.total || 0,
      healthyScans: result.healthy || 0,
      warningScans: result.warning || 0,
      criticalScans: result.critical || 0
    };
  }
  
  private countIssues(diagnoses: any[]): { critical: number; warning: number; info: number } {
    return {
      critical: diagnoses.filter(d => d.severity === 'critical').length,
      warning: diagnoses.filter(d => d.severity === 'warning').length,
      info: diagnoses.filter(d => d.severity === 'info').length
    };
  }
  
  close(): void {
    this.db.close();
  }
}
