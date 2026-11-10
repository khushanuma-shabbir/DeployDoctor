import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './QAReport.css';

interface QABug {
  id: string;
  title: string;
  severity: string;
  category: string;
  pageUrl: string;
  affectedElement?: string;
  stepsToReproduce: string[];
  expectedResult: string;
  actualResult: string;
  reproducible: boolean;
  evidence: {
    screenshots: string[];
    consoleErrors: string[];
    networkErrors: any[];
  };
  sourceLocation?: {
    file: string;
    line?: number;
    snippet?: string;
  };
  likelyCause: string;
  recommendedSolution: string;
  verificationSteps: string[];
}

interface QAReport {
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  url: string;
  scope: string;
  mode: string;
  overallHealth: string;
  pagesDiscovered: number;
  pagesTested: number;
  actionsPerformed: number;
  bugs: QABug[];
  bugsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  testsPassed: number;
  testsFailed: number;
  unverifiedObservations: string[];
}

function QAReport() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<QAReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBug, setSelectedBug] = useState<QABug | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  
  useEffect(() => {
    loadReport();
  }, [sessionId]);
  
  const loadReport = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/qa/report/${sessionId}`);
      
      if (!response.ok) {
        throw new Error('Report not found');
      }
      
      const data = await response.json();
      setReport(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
      setLoading(false);
    }
  };
  
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      CRITICAL: '#dc2626',
      HIGH: '#f97316',
      MEDIUM: '#eab308',
      LOW: '#60a5fa'
    };
    return colors[severity] || '#60a5fa';
  };
  
  const getHealthColor = (health: string) => {
    const colors: Record<string, string> = {
      healthy: '#10b981',
      warning: '#eab308',
      critical: '#ef4444'
    };
    return colors[health] || '#60a5fa';
  };
  
  const filteredBugs = report?.bugs.filter(bug => {
    if (filterSeverity === 'all') return true;
    return bug.severity === filterSeverity;
  }) || [];
  
  if (loading) {
    return (
      <div className="qa-report-page">
        <div className="loading">Loading report...</div>
      </div>
    );
  }
  
  if (error || !report) {
    return (
      <div className="qa-report-page">
        <div className="error-state">
          <h2>❌ Error</h2>
          <p>{error || 'Report not found'}</p>
          <button onClick={() => navigate('/qa-agent')} className="btn btn-secondary">
            Back to QA Agent
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="qa-report-page">
      <div className="report-header">
        <div>
          <h2>🩺 QA Test Report</h2>
          <p className="session-id">Session: {report.sessionId}</p>
        </div>
        <button onClick={() => navigate('/qa-agent')} className="btn btn-secondary">
          ← Back to QA Agent
        </button>
      </div>
      
      <div className="report-summary">
        <div className="summary-card health-card" style={{ borderLeftColor: getHealthColor(report.overallHealth) }}>
          <div className="summary-label">Overall Health</div>
          <div className="summary-value" style={{ color: getHealthColor(report.overallHealth) }}>
            {report.overallHealth.toUpperCase()}
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-label">URL Tested</div>
          <div className="summary-value small">{report.url}</div>
          <div className="summary-meta">
            {report.mode} • {report.scope} scope • {formatDuration(report.duration)}
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-label">Pages</div>
          <div className="summary-value">{report.pagesTested} / {report.pagesDiscovered}</div>
          <div className="summary-meta">tested / discovered</div>
        </div>
        
        <div className="summary-card">
          <div className="summary-label">Actions</div>
          <div className="summary-value">{report.actionsPerformed}</div>
          <div className="summary-meta">{report.testsPassed} passed • {report.testsFailed} failed</div>
        </div>
        
        <div className="summary-card">
          <div className="summary-label">Bugs Found</div>
          <div className="summary-value">{report.bugs.length}</div>
          <div className="summary-meta">
            {report.bugsBySeverity.critical} critical • {report.bugsBySeverity.high} high
          </div>
        </div>
      </div>
      
      <div className="severity-breakdown">
        <h3>Bugs by Severity</h3>
        <div className="severity-bars">
          <div className="severity-bar">
            <div className="severity-bar-label">
              <span style={{ color: getSeverityColor('CRITICAL') }}>■</span> Critical
            </div>
            <div className="severity-bar-fill" style={{ 
              width: `${(report.bugsBySeverity.critical / Math.max(report.bugs.length, 1)) * 100}%`,
              background: getSeverityColor('CRITICAL')
            }}></div>
            <div className="severity-bar-count">{report.bugsBySeverity.critical}</div>
          </div>
          
          <div className="severity-bar">
            <div className="severity-bar-label">
              <span style={{ color: getSeverityColor('HIGH') }}>■</span> High
            </div>
            <div className="severity-bar-fill" style={{ 
              width: `${(report.bugsBySeverity.high / Math.max(report.bugs.length, 1)) * 100}%`,
              background: getSeverityColor('HIGH')
            }}></div>
            <div className="severity-bar-count">{report.bugsBySeverity.high}</div>
          </div>
          
          <div className="severity-bar">
            <div className="severity-bar-label">
              <span style={{ color: getSeverityColor('MEDIUM') }}>■</span> Medium
            </div>
            <div className="severity-bar-fill" style={{ 
              width: `${(report.bugsBySeverity.medium / Math.max(report.bugs.length, 1)) * 100}%`,
              background: getSeverityColor('MEDIUM')
            }}></div>
            <div className="severity-bar-count">{report.bugsBySeverity.medium}</div>
          </div>
          
          <div className="severity-bar">
            <div className="severity-bar-label">
              <span style={{ color: getSeverityColor('LOW') }}>■</span> Low
            </div>
            <div className="severity-bar-fill" style={{ 
              width: `${(report.bugsBySeverity.low / Math.max(report.bugs.length, 1)) * 100}%`,
              background: getSeverityColor('LOW')
            }}></div>
            <div className="severity-bar-count">{report.bugsBySeverity.low}</div>
          </div>
        </div>
      </div>
      
      <div className="bugs-section">
        <div className="bugs-header">
          <h3>Discovered Bugs</h3>
          <select 
            value={filterSeverity} 
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Only</option>
            <option value="MEDIUM">Medium Only</option>
            <option value="LOW">Low Only</option>
          </select>
        </div>
        
        {filteredBugs.length === 0 ? (
          <div className="no-bugs">
            <p>✅ No bugs found at this severity level!</p>
          </div>
        ) : (
          <div className="bugs-list">
            {filteredBugs.map((bug) => (
              <div 
                key={bug.id} 
                className="bug-card"
                style={{ borderLeftColor: getSeverityColor(bug.severity) }}
                onClick={() => setSelectedBug(bug)}
              >
                <div className="bug-header">
                  <div>
                    <div className="bug-id">{bug.id}</div>
                    <div className="bug-title">{bug.title}</div>
                  </div>
                  <div className="bug-badges">
                    <span 
                      className="severity-badge" 
                      style={{ background: getSeverityColor(bug.severity) }}
                    >
                      {bug.severity}
                    </span>
                    {bug.reproducible && (
                      <span className="reproduced-badge">✓ REPRODUCED</span>
                    )}
                  </div>
                </div>
                
                <div className="bug-meta">
                  <span className="category-badge">{bug.category}</span>
                  <span>•</span>
                  <span className="bug-page">{bug.pageUrl}</span>
                </div>
                
                <div className="bug-preview">
                  <strong>Cause:</strong> {bug.likelyCause}
                </div>
                
                <div className="bug-action">
                  <span className="view-details">Click for full details →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {report.unverifiedObservations.length > 0 && (
        <div className="observations-section">
          <h3>Additional Observations</h3>
          <ul className="observations-list">
            {report.unverifiedObservations.map((obs, idx) => (
              <li key={idx}>{obs}</li>
            ))}
          </ul>
        </div>
      )}
      
      {selectedBug && (
        <div className="bug-modal-overlay" onClick={() => setSelectedBug(null)}>
          <div className="bug-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedBug.id}: {selectedBug.title}</h3>
              <button onClick={() => setSelectedBug(null)} className="close-btn">×</button>
            </div>
            
            <div className="modal-content">
              <div className="bug-detail-section">
                <h4>Steps to Reproduce</h4>
                <ol className="steps-list">
                  {selectedBug.stepsToReproduce.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
              
              <div className="bug-detail-section">
                <h4>Expected vs Actual</h4>
                <div className="comparison">
                  <div className="expected">
                    <strong>Expected:</strong>
                    <p>{selectedBug.expectedResult}</p>
                  </div>
                  <div className="actual">
                    <strong>Actual:</strong>
                    <p>{selectedBug.actualResult}</p>
                  </div>
                </div>
              </div>
              
              <div className="bug-detail-section">
                <h4>Root Cause</h4>
                <p>{selectedBug.likelyCause}</p>
              </div>
              
              <div className="bug-detail-section recommendation">
                <h4>💡 Recommended Solution</h4>
                <p>{selectedBug.recommendedSolution}</p>
              </div>
              
              {selectedBug.sourceLocation && (
                <div className="bug-detail-section">
                  <h4>Source Location</h4>
                  <div className="source-location">
                    <div><strong>File:</strong> <code>{selectedBug.sourceLocation.file}</code></div>
                    {selectedBug.sourceLocation.line && (
                      <div><strong>Line:</strong> {selectedBug.sourceLocation.line}</div>
                    )}
                    {selectedBug.sourceLocation.snippet && (
                      <pre><code>{selectedBug.sourceLocation.snippet}</code></pre>
                    )}
                  </div>
                </div>
              )}
              
              {selectedBug.evidence.consoleErrors.length > 0 && (
                <div className="bug-detail-section">
                  <h4>Console Errors</h4>
                  <ul className="error-list">
                    {selectedBug.evidence.consoleErrors.map((err, idx) => (
                      <li key={idx}><code>{err}</code></li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="bug-detail-section">
                <h4>Verification Steps</h4>
                <ol className="steps-list">
                  {selectedBug.verificationSteps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QAReport;
