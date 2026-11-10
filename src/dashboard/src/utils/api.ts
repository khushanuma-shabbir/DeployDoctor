// API client for DeployDoctor backend
// Uses session-based authentication with HttpOnly cookies

// Use environment variable for API base URL (configured in Vite)
const API_BASE = import.meta.env.VITE_API_BASE_URL 
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api';

// CSRF token management
let csrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  
  try {
    const response = await fetch(`${API_BASE}/auth/csrf-token`, {
      credentials: 'include' // Include session cookie
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token');
    }
    
    const data = await response.json();
    csrfToken = data.csrfToken;
    return csrfToken;
  } catch (error) {
    console.error('CSRF token fetch error:', error);
    throw error;
  }
}

// Helper to add headers for requests
async function getHeaders(includeCSRF: boolean = false): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  // Add CSRF token for state-changing operations
  if (includeCSRF) {
    try {
      const token = await getCsrfToken();
      headers['x-csrf-token'] = token;
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
    }
  }
  
  return headers;
}

// Helper for fetch with credentials
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include', // CRITICAL: Include session cookie
    headers: {
      ...options.headers
    }
  });
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

export interface User {
  username: string;
  role: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
  message?: string;
}

export const api = {
  // ==========================================
  // Authentication
  // ==========================================
  
  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await fetchWithAuth(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: await getHeaders(false),
      body: JSON.stringify({ username, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }
    
    // Clear cached CSRF token on login
    csrfToken = null;
    
    return response.json();
  },
  
  async logout(): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: await getHeaders(false)
    });
    
    if (!response.ok) {
      throw new Error('Logout failed');
    }
    
    // Clear cached CSRF token on logout
    csrfToken = null;
  },
  
  async getCurrentUser(): Promise<{ isAuthenticated: boolean; user?: User }> {
    const response = await fetchWithAuth(`${API_BASE}/auth/user`);
    
    if (!response.ok) {
      throw new Error('Failed to get user info');
    }
    
    return response.json();
  },
  
  // ==========================================
  // Scanner API
  // ==========================================
  
  async startScan(request: ScanRequest): Promise<ScanResult> {
    const response = await fetchWithAuth(`${API_BASE}/scan`, {
      method: 'POST',
      headers: await getHeaders(true), // Include CSRF token
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
    const response = await fetchWithAuth(url, {
      headers: await getHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch scans');
    }
    
    return response.json();
  },
  
  async getScan(id: string): Promise<ScanResult> {
    const response = await fetchWithAuth(`${API_BASE}/scans/${id}`, {
      headers: await getHeaders()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Scan not found');
    }
    
    return response.json();
  },
  
  async deleteScan(id: string): Promise<void> {
    const response = await fetchWithAuth(`${API_BASE}/scans/${id}`, {
      method: 'DELETE',
      headers: await getHeaders(true) // Include CSRF token
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete scan');
    }
  },
  
  async getStats(): Promise<Stats> {
    const response = await fetchWithAuth(`${API_BASE}/stats`, {
      headers: await getHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }
    
    return response.json();
  },
  
  // ==========================================
  // Health Check (Public)
  // ==========================================
  
  async health(): Promise<{ status: string; version: string }> {
    // Health check doesn't need auth or credentials
    const response = await fetch(`${API_BASE.replace('/api', '')}/health`);
    return response.json();
  }
};
