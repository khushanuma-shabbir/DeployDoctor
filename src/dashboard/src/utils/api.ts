// API client for DeployDoctor backend

// Use environment variable for API base URL (configured in Vite)
const API_BASE = import.meta.env.VITE_API_BASE_URL 
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api';

// Get API key from environment (only for authenticated requests in production)
const API_KEY = import.meta.env.VITE_API_KEY || '';

// Helper to add auth header if needed
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }
  
  return headers;
}

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
      headers: getHeaders(),
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
    const response = await fetch(url, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch scans');
    }
    
    return response.json();
  },
  
  async getScan(id: string): Promise<ScanResult> {
    const response = await fetch(`${API_BASE}/scans/${id}`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Scan not found');
    }
    
    return response.json();
  },
  
  async deleteScan(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/scans/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete scan');
    }
  },
  
  async getStats(): Promise<Stats> {
    const response = await fetch(`${API_BASE}/stats`, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }
    
    return response.json();
  },
  
  async health(): Promise<{ status: string; version: string }> {
    // Health check doesn't need auth
    const response = await fetch(`${API_BASE}/health`);
    return response.json();
  }
};
