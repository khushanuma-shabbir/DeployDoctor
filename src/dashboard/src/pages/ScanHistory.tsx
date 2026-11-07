import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ScanSummary } from '../utils/api';
import './ScanHistory.css';

function ScanHistory() {
  const navigate = useNavigate();
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'healthy' | 'warning' | 'critical'>('all');

  useEffect(() => {
    loadScans();
  }, []);

  async function loadScans() {
    try {
      setLoading(true);
      const data = await api.getScans(100);
      setScans(data);
    } catch (error) {
      console.error('Failed to load scans:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredScans = scans.filter(scan => {
    if (filter === 'all') return true;
    return scan.healthStatus === filter;
  });

  if (loading) {
    return (
      <div className="history-loading">
        <div className="spinner"></div>
        <p>Loading scan history...</p>
      </div>
    );
  }

  return (
    <div className="scan-history">
      <div className="history-header">
        <div>
          <h2>Scan History</h2>
          <p className="subtitle">View all previous scans</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/scan')}>
          ➕ New Scan
        </button>
      </div>

      {scans.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3 className="empty-state-title">No Scans Yet</h3>
          <p className="empty-state-description">
            Start scanning your React applications to see history here
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/scan')}>
            Run Your First Scan
          </button>
        </div>
      ) : (
        <>
          <div className="filter-bar">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({scans.length})
            </button>
            <button
              className={`filter-btn ${filter === 'healthy' ? 'active' : ''}`}
              onClick={() => setFilter('healthy')}
            >
              ✓ Healthy ({scans.filter(s => s.healthStatus === 'healthy').length})
            </button>
            <button
              className={`filter-btn ${filter === 'warning' ? 'active' : ''}`}
              onClick={() => setFilter('warning')}
            >
              ⚠ Warnings ({scans.filter(s => s.healthStatus === 'warning').length})
            </button>
            <button
              className={`filter-btn ${filter === 'critical' ? 'active' : ''}`}
              onClick={() => setFilter('critical')}
            >
              ✗ Critical ({scans.filter(s => s.healthStatus === 'critical').length})
            </button>
          </div>

          <div className="history-list">
            {filteredScans.length === 0 ? (
              <div className="no-results">
                <p>No scans found with status: {filter}</p>
              </div>
            ) : (
              filteredScans.map(scan => (
                <div
                  key={scan.id}
                  className="history-card"
                  onClick={() => navigate(`/results/${scan.id}`)}
                >
                  <div className="history-card-header">
                    <div className={`status-badge ${scan.healthStatus}`}>
                      {getStatusIcon(scan.healthStatus)} {scan.healthStatus}
                    </div>
                    <div className="scan-date">
                      {new Date(scan.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <div className="history-url">{scan.url}</div>

                  <div className="history-footer">
                    <div className="history-stats">
                      {scan.issueCount.critical > 0 && (
                        <span className="stat-badge critical">
                          {scan.issueCount.critical} critical
                        </span>
                      )}
                      {scan.issueCount.warning > 0 && (
                        <span className="stat-badge warning">
                          {scan.issueCount.warning} warnings
                        </span>
                      )}
                      {scan.issueCount.critical === 0 && scan.issueCount.warning === 0 && (
                        <span className="stat-badge healthy">No issues</span>
                      )}
                    </div>
                    <div className="history-mode">
                      {scan.mode} • {scan.duration}ms
                    </div>
                  </div>
                </div>
              ))
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

export default ScanHistory;
