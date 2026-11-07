import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import './NewScan.css';

function NewScan() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [timeout, setTimeout] = useState(30);
  const [rootSelector, setRootSelector] = useState('#root');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validate URL
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setScanning(true);
    setError(null);

    try {
      const result = await api.startScan({
        url,
        timeout,
        rootSelector
      });

      // Navigate to results page
      navigate(`/results/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
      setScanning(false);
    }
  }

  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  const mode = isLocal ? 'local' : 'production';

  return (
    <div className="new-scan">
      <div className="new-scan-header">
        <h2>Start New Scan</h2>
        <p className="subtitle">Analyze your React application for errors and issues</p>
      </div>

      <div className="scan-form-container">
        <form onSubmit={handleSubmit} className="scan-form">
          <div className="form-group">
            <label htmlFor="url">URL to Scan *</label>
            <input
              id="url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:5173 or https://example.com"
              required
              disabled={scanning}
            />
            <p className="form-help">
              Enter a localhost URL for development mode or a public URL for production scanning
            </p>
          </div>

          {url && (
            <div className="mode-indicator">
              <strong>Scan Mode:</strong> <span className={`mode-badge ${mode}`}>{mode}</span>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="timeout">Timeout (seconds)</label>
              <input
                id="timeout"
                type="number"
                value={timeout}
                onChange={(e) => setTimeout(parseInt(e.target.value, 10))}
                min="10"
                max="120"
                disabled={scanning}
              />
            </div>

            <div className="form-group">
              <label htmlFor="rootSelector">React Root Selector</label>
              <input
                id="rootSelector"
                type="text"
                value={rootSelector}
                onChange={(e) => setRootSelector(e.target.value)}
                placeholder="#root"
                disabled={scanning}
              />
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/')}
              disabled={scanning}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={scanning || !url}
            >
              {scanning ? (
                <>
                  <span className="scanning-spinner"></span>
                  Scanning...
                </>
              ) : (
                <>🔍 Start Scan</>
              )}
            </button>
          </div>
        </form>

        <div className="scan-info">
          <h3>What will be scanned?</h3>
          <ul className="info-list">
            <li>✓ Page load and rendering status</li>
            <li>✓ JavaScript runtime errors</li>
            <li>✓ Console errors and warnings</li>
            <li>✓ Failed network requests</li>
            <li>✓ HTTP 4xx/5xx responses</li>
            <li>✓ Missing JavaScript/CSS assets</li>
            <li>✓ White screen detection</li>
            <li>✓ React root element presence</li>
          </ul>

          {mode === 'production' && (
            <div className="production-limitations">
              <h4>⚠️ Production Mode Limitations</h4>
              <p>When scanning public URLs, we cannot access:</p>
              <ul>
                <li>Private environment variables</li>
                <li>Server-side logs</li>
                <li>Private source code (only browser-shipped code)</li>
                <li>Hidden deployment configurations</li>
                <li>Backend service internals</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NewScan;
