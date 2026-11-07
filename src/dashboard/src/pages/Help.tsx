import './Help.css';

function Help() {
  return (
    <div className="help">
      <div className="help-header">
        <h2>Help & Documentation</h2>
        <p className="subtitle">Learn how to use DeployDoctor effectively</p>
      </div>

      <div className="help-section card">
        <h3>🚀 Getting Started</h3>
        <p>
          DeployDoctor helps you detect and diagnose issues in your React applications.
          Simply provide a URL (localhost or production) and DeployDoctor will scan
          for common problems.
        </p>
      </div>

      <div className="help-section card">
        <h3>🔍 What Does DeployDoctor Scan?</h3>
        <ul>
          <li>White screen / blank page detection</li>
          <li>JavaScript runtime errors and exceptions</li>
          <li>Console errors and warnings</li>
          <li>Failed network requests</li>
          <li>HTTP 4xx/5xx error responses</li>
          <li>Missing JavaScript and CSS assets</li>
          <li>React root element presence</li>
          <li>Page rendering status</li>
        </ul>
      </div>

      <div className="help-section card">
        <h3>📋 Common Issues Explained</h3>
        
        <div className="issue-explanation">
          <h4>White Screen / Blank Page</h4>
          <p>
            <strong>What it is:</strong> Your application shows a blank white screen instead of content.
          </p>
          <p>
            <strong>Common causes:</strong>
          </p>
          <ul>
            <li>JavaScript bundle failed to load (404 error)</li>
            <li>Uncaught exception during React initialization</li>
            <li>Missing or incorrectly configured React root element</li>
            <li>Critical rendering error in a component</li>
          </ul>
        </div>

        <div className="issue-explanation">
          <h4>Runtime Errors</h4>
          <p>
            <strong>What it is:</strong> JavaScript exceptions that crash your application.
          </p>
          <p>
            <strong>Common examples:</strong>
          </p>
          <ul>
            <li>"Cannot read property 'x' of undefined"</li>
            <li>"x is not a function"</li>
            <li>"x is not defined"</li>
          </ul>
          <p>
            <strong>How to fix:</strong> Add null checks, use optional chaining (?.),
            or implement error boundaries.
          </p>
        </div>

        <div className="issue-explanation">
          <h4>Network Failures</h4>
          <p>
            <strong>What it is:</strong> Failed API requests or resource loading errors.
          </p>
          <p>
            <strong>Common causes:</strong>
          </p>
          <ul>
            <li>CORS issues (cross-origin requests blocked)</li>
            <li>API server is down or unreachable</li>
            <li>Network connectivity problems</li>
            <li>Incorrect API endpoint URLs</li>
          </ul>
        </div>

        <div className="issue-explanation">
          <h4>Missing Assets</h4>
          <p>
            <strong>What it is:</strong> JavaScript or CSS files that fail to load (404).
          </p>
          <p>
            <strong>Common causes:</strong>
          </p>
          <ul>
            <li>Incorrect file paths in your HTML or build output</li>
            <li>Files not deployed to production</li>
            <li>CDN or hosting configuration issues</li>
          </ul>
        </div>
      </div>

      <div className="help-section card">
        <h3>⚠️ Production Scanning Limitations</h3>
        <p>
          When scanning public production URLs, DeployDoctor has limited visibility:
        </p>
        <ul>
          <li>Cannot access private environment variables</li>
          <li>Cannot access server-side logs</li>
          <li>Can only analyze code shipped to the browser</li>
          <li>Cannot access backend service internals</li>
          <li>Cannot see hidden deployment configurations</li>
        </ul>
        <p>
          For the most complete diagnosis, scan your application in local development mode.
        </p>
      </div>

      <div className="help-section card">
        <h3>💡 Best Practices</h3>
        <ul>
          <li>Scan regularly during development to catch issues early</li>
          <li>Keep source maps enabled for better error tracking</li>
          <li>Use error boundaries in React to catch rendering errors</li>
          <li>Add proper null checks and type validation</li>
          <li>Handle network errors gracefully with try-catch</li>
          <li>Test your production build locally before deploying</li>
        </ul>
      </div>

      <div className="help-section card">
        <h3>🛠️ CLI Usage</h3>
        <p>You can also use DeployDoctor from the command line:</p>
        <pre className="cli-example">
{`# Scan a local development server
node dist/cli/index.js scan --url http://localhost:5173

# Scan a production URL
node dist/cli/index.js scan --url https://example.com

# View scan history
node dist/cli/index.js list

# Show specific scan details
node dist/cli/index.js show <scan-id>`}
        </pre>
      </div>

      <div className="help-section card">
        <h3>❓ Troubleshooting</h3>
        
        <div className="faq-item">
          <h4>The scan times out</h4>
          <p>
            Increase the timeout value in scan settings or check if the URL is accessible.
            For slow-loading applications, use a timeout of 60+ seconds.
          </p>
        </div>

        <div className="faq-item">
          <h4>No issues detected but my app is broken</h4>
          <p>
            Some issues may not be detectable by automated scanning. Check for:
            styling problems, incorrect data rendering, or logic bugs that don't
            throw exceptions.
          </p>
        </div>

        <div className="faq-item">
          <h4>Source mapping isn't working</h4>
          <p>
            Ensure source maps are generated during build and are accessible alongside
            your JavaScript bundles. Check your bundler configuration (Vite, webpack, etc.).
          </p>
        </div>
      </div>
    </div>
  );
}

export default Help;
