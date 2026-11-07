import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ScanResult } from '../utils/api';
import './ScanResults.css';

function ScanResults() {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDiagnosis, setExpandedDiagnosis] = useState<number | null>(null);

  useEffect(() => {
    loadScan();
  }, [scanId]);

  async function loadScan() {
    if (!scanId) return;

    try {
      setLoading(true);
      const data = await api.getScan(scanId);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scan');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="scan-results-loading">
        <div className="spinner"></div>
        <p>Loading scan results...</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="scan-results-error">
        <div className="error-icon">⚠️</div>
        <h2>Scan Not Found</h2>
        <p>{error || 'Unable to load scan results'}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  const issues = result.diagnoses.filter(d => d.severity !== 'healthy');

  return (
    <div className="scan-results">
      <div className="results-header">
        <div>
          <h2>Scan Results</h2>
          <p className="scan-metadata">
            {new Date(result.timestamp).toLocaleString()} • {result.duration}ms •{' '}
            <span className="mode-badge">{result.mode}</span>
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/scan')}>
            🔄 New Scan
          </button>
        </div>
      </div>

      <div className="results-overview">
        <div className={`overview-card status-${result.healthStatus}`}>
          <div className="overview-icon">{getStatusIcon(result.healthStatus)}</div>
          <div className="overview-content">
            <div className="overview-label">Overall Health</div>
            <div className="overview-value">{result.healthStatus.toUpperCase()}</div>
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-icon">🌐</div>
          <div className="overview-content">
            <div className="overview-label">URL</div>
            <div className="overview-value-small">{result.url}</div>
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-icon">🔍</div>
          <div className="overview-content">
            <div className="overview-label">Issues Found</div>
            <div className="overview-value">{issues.length}</div>
          </div>
        </div>
      </div>

      {result.whiteScreenAnalysis.isWhiteScreen && (
        <div className="white-screen-alert">
          <div className="alert-icon">⚠️</div>
          <div className="alert-content">
            <h3>White Screen Detected</h3>
            <p>
              The application is displaying a blank screen with{' '}
              {(result.whiteScreenAnalysis.confidence * 100).toFixed(0)}% confidence.
            </p>
          </div>
        </div>
      )}

      {issues.length === 0 ? (
        <div className="no-issues-card">
          <div className="no-issues-icon">✓</div>
          <h3>No Critical Issues Detected</h3>
          <p>The application appears to be running normally</p>
        </div>
      ) : (
        <div className="issues-section">
          <h3>Diagnoses ({issues.length})</h3>
          {issues.map((diagnosis, index) => (
            <div key={index} className={`diagnosis-card severity-${diagnosis.severity}`}>
              <div className="diagnosis-header" onClick={() => 
                setExpandedDiagnosis(expandedDiagnosis === index ? null : index)
              }>
                <div className="diagnosis-title">
                  <span className="severity-icon">{getSeverityIcon(diagnosis.severity)}</span>
                  <span>{diagnosis.title}</span>
                </div>
                <span className={`badge badge-${diagnosis.severity}`}>{diagnosis.severity}</span>
              </div>

              <div className="diagnosis-description">{diagnosis.description}</div>

              {expandedDiagnosis === index && (
                <div className="diagnosis-details">
                  <div className="detail-section">
                    <h4>Likely Cause</h4>
                    <p>{diagnosis.likelyCause}</p>
                  </div>

                  {diagnosis.evidence.length > 0 && (
                    <div className="detail-section">
                      <h4>Evidence</h4>
                      <ul>
                        {diagnosis.evidence.map((ev, i) => (
                          <li key={i}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {diagnosis.sourceLocation && diagnosis.sourceLocation.resolved && (
                    <div className="detail-section">
                      <h4>📍 Source Location</h4>
                      <code className="source-location">
                        {diagnosis.sourceLocation.file}:{diagnosis.sourceLocation.line}:
                        {diagnosis.sourceLocation.column}
                      </code>
                      {diagnosis.sourceLocation.snippet && (
                        <pre className="code-snippet">{diagnosis.sourceLocation.snippet}</pre>
                      )}
                    </div>
                  )}

                  {diagnosis.suggestedFix && (
                    <div className="detail-section suggested-fix">
                      <h4>💡 Suggested Fix</h4>
                      <p>{diagnosis.suggestedFix.explanation}</p>
                      {diagnosis.suggestedFix.code && (
                        <pre className="fix-code">{diagnosis.suggestedFix.code}</pre>
                      )}
                    </div>
                  )}

                  {diagnosis.investigationSteps.length > 0 && (
                    <div className="detail-section">
                      <h4>Investigation Steps</h4>
                      <ol>
                        {diagnosis.investigationSteps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {result.failedRequests.length > 0 && (
        <div className="failed-requests-section">
          <h3>Network Issues ({result.failedRequests.length})</h3>
          <div className="requests-table">
            {result.failedRequests.slice(0, 10).map((req, index) => (
              <div key={index} className="request-row">
                <span className="request-method">{req.method}</span>
                <span className={`request-status ${req.failed ? 'failed' : 'error'}`}>
                  {req.status || 'FAILED'}
                </span>
                <span className="request-url">{truncateURL(req.url)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.screenshotPath && (
        <div className="screenshot-section">
          <h3>Screenshot</h3>
          <img src={`/${result.screenshotPath}`} alt="Page screenshot" className="screenshot" />
        </div>
      )}

      {result.limitations.length > 0 && (
        <div className="limitations-section">
          <h4>⚠️ Scan Limitations</h4>
          <ul>
            {result.limitations.map((limitation, index) => (
              <li key={index}>{limitation}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'healthy': return '✓';
    case 'warning': return '⚠';
    case 'critical': return '✗';
    default: return '?';
  }
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'warning': return '🟡';
    case 'info': return '🔵';
    default: return '⚪';
  }
}

function truncateURL(url: string): string {
  if (url.length <= 60) return url;
  return url.substring(0, 60) + '...';
}

export default ScanResults;
