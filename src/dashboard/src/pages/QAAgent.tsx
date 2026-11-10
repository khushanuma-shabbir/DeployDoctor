import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './QAAgent.css';

interface QAAgentState {
  status: 'idle' | 'configuring' | 'running' | 'completed' | 'error';
  sessionId?: string;
  progress?: {
    status: string;
    currentPage?: string;
    currentActivity?: string;
    pagesDiscovered: number;
    pagesTested: number;
    actionsPerformed: number;
    bugsFound: number;
    bugsConfirmed: number;
    elapsedTime: number;
  };
  error?: string;
}

function QAAgent() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [scope, setScope] = useState<'quick' | 'standard' | 'thorough'>('standard');
  const [testForms, setTestForms] = useState(true);
  const [testNavigation, setTestNavigation] = useState(true);
  const [testResponsive, setTestResponsive] = useState(false);
  
  const [agentState, setAgentState] = useState<QAAgentState>({ status: 'idle' });
  const [recentReports, setRecentReports] = useState<any[]>([]);
  
  useEffect(() => {
    loadRecentReports();
  }, []);
  
  useEffect(() => {
    if (agentState.status === 'running' && agentState.sessionId) {
      const interval = setInterval(() => {
        pollSessionStatus(agentState.sessionId!);
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [agentState.status, agentState.sessionId]);
  
  const loadRecentReports = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/qa/reports?limit=5');
      if (response.ok) {
        const data = await response.json();
        setRecentReports(data);
      }
    } catch (error) {
      console.error('Failed to load recent reports:', error);
    }
  };
  
  const pollSessionStatus = async (sessionId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/qa/session/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'completed') {
          setAgentState({ 
            status: 'completed', 
            sessionId,
            progress: data.progress 
          });
          loadRecentReports();
        } else if (data.status === 'failed') {
          setAgentState({ 
            status: 'error', 
            error: data.error || 'Testing failed' 
          });
        } else {
          setAgentState({ 
            status: 'running', 
            sessionId,
            progress: data.progress 
          });
        }
      }
    } catch (error) {
      console.error('Failed to poll session status:', error);
    }
  };
  
  const startTesting = async () => {
    if (!url.trim()) {
      alert('Please enter a URL');
      return;
    }
    
    setAgentState({ status: 'running' });
    
    try {
      const response = await fetch('http://localhost:3001/api/qa/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          scope,
          testForms,
          testNavigation,
          testResponsive
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start QA session');
      }
      
      const data = await response.json();
      setAgentState({ 
        status: 'running', 
        sessionId: data.sessionId 
      });
      
    } catch (error) {
      setAgentState({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Failed to start testing' 
      });
    }
  };
  
  const viewReport = (sessionId: string) => {
    navigate(`/qa-report/${sessionId}`);
  };
  
  const resetAgent = () => {
    setAgentState({ status: 'idle' });
  };
  
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  const formatHealth = (health: string) => {
    const colors: Record<string, string> = {
      healthy: '#10b981',
      warning: '#eab308',
      critical: '#ef4444'
    };
    
    return (
      <span style={{ 
        color: colors[health] || '#60a5fa',
        fontWeight: 'bold',
        textTransform: 'uppercase'
      }}>
        {health}
      </span>
    );
  };
  
  return (
    <div className="qa-agent-page">
      <div className="page-header">
        <h2>🤖 Autonomous QA Agent</h2>
        <p>Intelligent software testing agent that finds bugs automatically</p>
      </div>
      
      {agentState.status === 'idle' && (
        <div className="qa-config-section">
          <div className="card">
            <h3>Configure Testing Session</h3>
            
            <div className="form-group">
              <label>Application URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:5173"
                className="input"
              />
              <span className="help-text">
                Enter the URL of the application you want to test
              </span>
            </div>
            
            <div className="form-group">
              <label>Testing Scope</label>
              <select 
                value={scope} 
                onChange={(e) => setScope(e.target.value as any)}
                className="select"
              >
                <option value="quick">Quick (5-10 minutes)</option>
                <option value="standard">Standard (15-30 minutes)</option>
                <option value="thorough">Thorough (30+ minutes)</option>
              </select>
              <span className="help-text">
                Determines how many pages and interactions to test
              </span>
            </div>
            
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={testNavigation}
                  onChange={(e) => setTestNavigation(e.target.checked)}
                />
                Test Navigation Links
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={testForms}
                  onChange={(e) => setTestForms(e.target.checked)}
                />
                Test Forms and Inputs
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={testResponsive}
                  onChange={(e) => setTestResponsive(e.target.checked)}
                />
                Test Responsive Layouts (Mobile/Tablet/Desktop)
              </label>
            </div>
            
            <button onClick={startTesting} className="btn btn-primary">
              🚀 Start Testing
            </button>
          </div>
          
          <div className="info-card">
            <h4>What the QA Agent Tests</h4>
            <ul>
              <li>✅ Functional testing (buttons, links, forms)</li>
              <li>✅ UI and layout issues</li>
              <li>✅ JavaScript runtime errors</li>
              <li>✅ API and network failures</li>
              <li>✅ Navigation and routing</li>
              <li>✅ Form validation</li>
              <li>✅ User experience issues</li>
            </ul>
            
            <h4>What the Agent Does NOT Do</h4>
            <ul>
              <li>❌ Modify your application code</li>
              <li>❌ Delete files or data</li>
              <li>❌ Submit real payments</li>
              <li>❌ Send emails or messages</li>
              <li>❌ Change production settings</li>
            </ul>
          </div>
        </div>
      )}
      
      {agentState.status === 'running' && agentState.progress && (
        <div className="qa-progress-section">
          <div className="card">
            <h3>🔍 Testing In Progress...</h3>
            
            <div className="progress-status">
              <div className="status-badge">{agentState.progress.status}</div>
              {agentState.progress.currentActivity && (
                <p className="current-activity">{agentState.progress.currentActivity}</p>
              )}
              {agentState.progress.currentPage && (
                <p className="current-page">Testing: {agentState.progress.currentPage}</p>
              )}
            </div>
            
            <div className="progress-stats">
              <div className="stat-item">
                <div className="stat-value">{agentState.progress.pagesDiscovered}</div>
                <div className="stat-label">Pages Discovered</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{agentState.progress.pagesTested}</div>
                <div className="stat-label">Pages Tested</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{agentState.progress.actionsPerformed}</div>
                <div className="stat-label">Actions Performed</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{agentState.progress.bugsFound}</div>
                <div className="stat-label">Bugs Found</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{agentState.progress.bugsConfirmed}</div>
                <div className="stat-label">Bugs Confirmed</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{formatDuration(agentState.progress.elapsedTime)}</div>
                <div className="stat-label">Elapsed Time</div>
              </div>
            </div>
            
            <div className="progress-note">
              <p>⏳ The agent is working autonomously. This may take several minutes.</p>
              <p>You can close this page and come back later - testing will continue in the background.</p>
            </div>
          </div>
        </div>
      )}
      
      {agentState.status === 'completed' && (
        <div className="qa-completed-section">
          <div className="card success-card">
            <h3>✅ Testing Completed!</h3>
            <p>The QA Agent has finished testing your application.</p>
            
            {agentState.progress && (
              <div className="completion-summary">
                <p><strong>Pages Tested:</strong> {agentState.progress.pagesTested}</p>
                <p><strong>Actions Performed:</strong> {agentState.progress.actionsPerformed}</p>
                <p><strong>Bugs Found:</strong> {agentState.progress.bugsFound}</p>
                <p><strong>Bugs Confirmed:</strong> {agentState.progress.bugsConfirmed}</p>
                <p><strong>Duration:</strong> {formatDuration(agentState.progress.elapsedTime)}</p>
              </div>
            )}
            
            <div className="action-buttons">
              <button 
                onClick={() => viewReport(agentState.sessionId!)} 
                className="btn btn-primary"
              >
                📊 View Full Report
              </button>
              <button onClick={resetAgent} className="btn btn-secondary">
                🔄 Start New Test
              </button>
            </div>
          </div>
        </div>
      )}
      
      {agentState.status === 'error' && (
        <div className="qa-error-section">
          <div className="card error-card">
            <h3>❌ Testing Failed</h3>
            <p className="error-message">{agentState.error}</p>
            <button onClick={resetAgent} className="btn btn-secondary">
              Try Again
            </button>
          </div>
        </div>
      )}
      
      {recentReports.length > 0 && agentState.status !== 'running' && (
        <div className="recent-reports-section">
          <h3>Recent QA Reports</h3>
          <div className="reports-list">
            {recentReports.map((report) => (
              <div key={report.sessionId} className="report-item">
                <div className="report-info">
                  <div className="report-url">{report.url}</div>
                  <div className="report-meta">
                    <span>{new Date(report.timestamp).toLocaleString()}</span>
                    <span>•</span>
                    <span>{report.bugsFound} bugs found</span>
                    <span>•</span>
                    <span>Health: {formatHealth(report.overallHealth)}</span>
                  </div>
                </div>
                <button 
                  onClick={() => viewReport(report.sessionId)}
                  className="btn btn-small"
                >
                  View Report
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default QAAgent;
