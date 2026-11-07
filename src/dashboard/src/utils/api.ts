// API client for DeployDoctor backend

const API_BASE = '/api';

export interface ScanRequest {
  url: string;
  timeout?: number;
  rootSelector?: string;
}

export interface ScanResult {
  id: string;
  timestamp: number;
  url: string;
  mode: 'local' | 'production';
  duration: number;
  status: 'success' | 'failed' | 'timeout';
  healthStatus: 'healthy' | 'warning' | 'critical';
  pageState: any;
  browserErrors: any[];
  networkRequests: any[];
  failedRequests: any[];
  whiteScreenAnalysis: any;
  diagnoses: any[];
  browserInfo: any;
  screenshotPath?: string;
  limitations: string[];
}

export interface ScanSummary {
  id: string;
  timestamp: number;
  url: string;
  mode: string;
  healthStatus: string;
  duration: number;
  issueCount: {
    critical: number;
    warning: number;
    info: number;
  };
}

export interface Stats {
  totalScans: number;
  healthyScans: number;
  warningScans: number;
  criticalScans: number;
}

export const api = {
  async startScan(request: ScanRequest): Promise<ScanResult> {
    const response = await fetch(`${API_BASE}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Scan failed');
    }
    
    return response.json();
  },
  
  async getScans(limit?: number): Promise<ScanSummary[]> {
    const url = limit ? `${API_BASE}/scans?limit=${limit}` : `${API_BASE}/scans`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch scans');
    }
    
    return response.json();
  },
  
  async getScan(id: string): Promise<ScanResult> {
    const response = await fetch(`${API_BASE}/scans/${id}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Scan not found');
    }
    
    return response.json();
  },
  
  async deleteScan(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/scans/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete scan');
    }
  },
  
  async getStats(): Promise<Stats> {
    const response = await fetch(`${API_BASE}/stats`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }
    
    return response.json();
  },
  
  async health(): Promise<{ status: string; version: string }> {
    const response = await fetch(`${API_BASE}/health`);
    return response.json();
  }
};
