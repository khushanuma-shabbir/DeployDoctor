# DeployDoctor 🩺

A developer-focused debugging assistant for React applications. DeployDoctor detects blank/white screens, JavaScript runtime exceptions, console errors, failed network requests, and rendering failures in both local and production environments.

## Features

- 🔍 **Automated Scanning**: Scan local development servers or production URLs
- 🎯 **Smart Detection**: White-screen detection, runtime errors, network failures, missing assets
- 🗺️ **Source Mapping**: Maps errors to original source code with line numbers
- 💡 **Fix Suggestions**: Provides actionable recommendations for common issues
- 📊 **Scan History**: Local SQLite storage of all scans with comparison tools
- 🎨 **Modern Dashboard**: Clean, developer-friendly interface
- 🔒 **Security-First**: No external APIs, works completely offline

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- Windows PowerShell (or your preferred shell)

### Setup

```powershell
# Clone or navigate to the DeployDoctor directory
cd d:\Project\DeployDoctor

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Build the project
npm run build
```

## Usage

### CLI Commands

#### Scan a Local Development Server

```powershell
# Scan a localhost URL
node dist/cli/index.js scan --url http://localhost:5173

# Scan with custom timeout (in seconds)
node dist/cli/index.js scan --url http://localhost:3000 --timeout 30
```

#### Scan a Production URL

```powershell
# Scan a deployed website
node dist/cli/index.js scan --url https://example.com
```

#### View Scan History

```powershell
# List all previous scans
node dist/cli/index.js list

# Show details of a specific scan
node dist/cli/index.js show <scan-id>
```

### Dashboard

Start the dashboard server to view results in a browser:

```powershell
# Start the API server and dashboard
npm start

# Or run in development mode with hot reload
# Terminal 1: Start the API server
npm run dev:server

# Terminal 2: Start the dashboard dev server
npm run dev:dashboard
```

Then open `http://localhost:3000` in your browser.

## How It Works

1. **Browser Automation**: Uses Playwright to load and monitor your application
2. **Evidence Collection**: Captures console errors, network failures, DOM state, screenshots
3. **Analysis**: Rules-based diagnosis engine identifies common issues
4. **Source Mapping**: Parses stack traces and source maps to find original code
5. **Reporting**: Generates detailed JSON reports and visual dashboard summaries

## Architecture

```
deploydoctor/
├── src/
│   ├── cli/              # Command-line interface
│   ├── monitor/          # Playwright browser monitoring
│   ├── diagnosis/        # Rules-based diagnosis engine
│   ├── source-analysis/  # Stack trace parsing & source maps
│   ├── storage/          # SQLite database layer
│   ├── server/           # Express API server
│   └── dashboard/        # React + Vite frontend
├── fixtures/             # Test React applications
├── tests/                # Test suite
└── reports/              # Generated scan reports
```

## Common Issues Detected

- **White Screen/Blank Page**: Missing React root, failed bundle loading, uncaught render errors
- **Runtime Exceptions**: Undefined property access, null references, type errors
- **Network Failures**: Failed API requests, 4xx/5xx responses, CORS errors
- **Missing Assets**: 404 errors for JavaScript bundles, CSS files, images
- **Broken Routes**: Navigation failures, route not found errors
- **Rendering Failures**: Component crashes, infinite loops, memory issues

## Security & Privacy

- All scanning is done locally - no data sent to external services
- Sensitive headers (Authorization, Cookie) are redacted from reports
- Production scanning respects same-origin policies
- No arbitrary code execution from scanned sites
- Local-only API server (not exposed to external networks)

## Limitations

### Production Scanning Limitations

When scanning production URLs, DeployDoctor cannot access:
- Private environment variables
- Server-side logs
- Private source code (only what's shipped to the browser)
- Hidden deployment configurations
- Backend service internals

### Source Mapping Limitations

- Requires source maps to be available and accessible
- Cannot map minified code without source maps
- Some bundlers may not include full source content

## Development

### Run Tests

```powershell
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch
```

### Build

```powershell
# Build CLI and backend
npm run build

# Build dashboard only
npm run build:dashboard
```

### Lint

```powershell
npm run lint
```

## Test Fixtures

The `fixtures/` directory contains intentionally broken React applications for testing:

1. **undefined-crash**: Runtime error from accessing undefined property
2. **missing-asset**: Failed JavaScript bundle loading
3. **api-failure**: Failed API request
4. **broken-route**: Route navigation error
5. **render-exception**: Component rendering crash
6. **healthy-app**: Properly working React application (control)

## Troubleshooting

### Playwright Installation Issues

```powershell
# Install only Chromium (smaller download)
npx playwright install chromium

# Or install all browsers
npx playwright install
```

### Port Already in Use

If port 3000 is occupied:
```powershell
# Set custom port in .env file
echo "PORT=3001" > .env
```

### Build Errors

```powershell
# Clean and rebuild
Remove-Item -Recurse -Force dist
npm run build
```

### Database Locked

```powershell
# Delete and reinitialize database
Remove-Item deploydoctor.db
npm start
```

## License

MIT

## Contributing

Contributions welcome! Please ensure all tests pass before submitting PRs.

## Support

For issues and questions, please file an issue on the repository.
