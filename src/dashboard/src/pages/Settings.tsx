import './Settings.css';

function Settings() {
  return (
    <div className="settings">
      <div className="settings-header">
        <h2>Settings</h2>
        <p className="subtitle">Configure DeployDoctor preferences</p>
      </div>

      <div className="settings-section card">
        <h3>Default Scan Settings</h3>
        <p className="section-description">
          These settings can be overridden when starting individual scans
        </p>

        <div className="setting-item">
          <label>Default Timeout (seconds)</label>
          <input type="number" value="30" readOnly />
          <p className="setting-help">Maximum time to wait for page load</p>
        </div>

        <div className="setting-item">
          <label>React Root Selector</label>
          <input type="text" value="#root" readOnly />
          <p className="setting-help">CSS selector for React mount point</p>
        </div>

        <div className="setting-item">
          <label>
            <input type="checkbox" checked readOnly />
            <span>Capture screenshots</span>
          </label>
        </div>
      </div>

      <div className="settings-section card">
        <h3>Storage</h3>
        <p className="section-description">
          Manage local scan data and reports
        </p>

        <div className="storage-info">
          <p>Database: <code>deploydoctor.db</code></p>
          <p>Reports directory: <code>reports/</code></p>
        </div>

        <div className="setting-actions">
          <button className="btn btn-secondary" disabled>
            Export All Scans
          </button>
          <button className="btn btn-danger" disabled>
            Clear All Scan Data
          </button>
        </div>
      </div>

      <div className="settings-section card">
        <h3>Theme</h3>
        <p className="section-description">
          Customize the dashboard appearance
        </p>

        <div className="theme-selector">
          <button className="theme-option active">
            🌙 Dark Theme
          </button>
          <button className="theme-option" disabled>
            ☀️ Light Theme (Coming Soon)
          </button>
        </div>
      </div>

      <div className="settings-section card">
        <h3>About DeployDoctor</h3>
        <p className="section-description">
          Version 1.0.0
        </p>
        <p className="about-text">
          DeployDoctor is a developer-focused debugging assistant for React applications.
          It helps detect and diagnose white screens, runtime errors, network failures,
          and other common issues.
        </p>
      </div>
    </div>
  );
}

export default Settings;
