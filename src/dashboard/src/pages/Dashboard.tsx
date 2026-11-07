import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ScanSummary, Stats } from '../utils/api';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentScans, setRecentScans] = useState<ScanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [statsData, scansData] = await Promise.all([
        api.getStats(),
        api.getScans(5)
      ]);
      setStats(statsData);
      setRecentScans(scansData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <div className="error-icon">⚠️</div>
        <h2>Failed to Load Dashboard</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={loadData}>
          Retry
        </button>
      </div>
    );
  }

  const hasScans = stats && stats.totalScans > 0;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h2>Dashboard</h2>
          <p className="subtitle">Monitor and debug your React applications</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/scan')}>
          ➕ Start New Scan
        </button>
      </div>

      {!hasScans ? (
        <div className="empty-state">
          <div className="empty-state-icon">🩺</div>
          <h3 className="empty-state-title">Welcome to DeployDoctor</h3>
          <p className="empty-state-description">
            DeployDoctor helps you detect and diagnose issues in your React applications.
            Start by running your first scan.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/scan')}>
            Run Your First Scan
          </button>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-value">{stats!.totalScans}</div>
                <div className="stat-label">Total Scans</div>
              </div>
            </div>

            <div className="stat-card stat-healthy">
              <div className="stat-icon">✓</div>
              <div className="stat-content">
                <div className="stat-value">{stats!.healthyScans}</div>
                <div className="stat-label">Healthy</div>
              </div>
            </div>

            <div className="stat-card stat-warning">
              <div className="stat-icon">⚠</div>
              <div className="stat-content">
                <div className="stat-value">{stats!.warningScans}</div>
                <div className="stat-label">Warnings</div>
              </div>
            </div>

            <div className="stat-card stat-critical">
              <div className="stat-icon">✗</div>
              <div className="stat-content">
                <div className="stat-value">{stats!.criticalScans}</div>
                <div className="stat-label">Critical</div>
              </div>
            </div>
          </div>

          <div className="recent-scans-section">
            <div className="section-header">
              <h3>Recent Scans</h3>
              <button className="btn btn-secondary" onClick={() => navigate('/history')}>
                View All
              </button>
            </div>

            {recentScans.length === 0 ? (
              <div className="card">
                <p className="text-muted">No recent scans</p>
              </div>
            ) : (
              <div className="scans-list">
                {recentScans.map(scan => (
                  <div 
                    key={scan.id} 
                    className="scan-card"
                    onClick={() => navigate(`/results/${scan.id}`)}
                  >
                    <div className="scan-card-header">
                      <div className={`status-badge ${scan.healthStatus}`}>
                        {getStatusIcon(scan.healthStatus)} {scan.healthStatus}
                      </div>
                      <div className="scan-time">
                        {formatTime(scan.timestamp)}
                      </div>
                    </div>
                    <div className="scan-url">{scan.url}</div>
                    <div className="scan-issues">
                      {scan.issueCount.critical > 0 && (
                        <span className="issue-count critical">
                          {scan.issueCount.critical} critical
                        </span>
                      )}
                      {scan.issueCount.warning > 0 && (
                        <span className="issue-count warning">
                          {scan.issueCount.warning} warnings
                        </span>
                      )}
                      {scan.issueCount.critical === 0 && scan.issueCount.warning === 0 && (
                        <span className="issue-count healthy">No issues</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
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

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

export default Dashboard;
