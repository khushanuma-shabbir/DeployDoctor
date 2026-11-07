# DeployDoctor Setup Guide

## Quick Start (Windows PowerShell)

### 1. Install Dependencies

```powershell
# Main project dependencies
npm install --legacy-peer-deps

# Dashboard dependencies
cd src/dashboard
npm install
cd ../..

# Install Playwright browsers
npx playwright install chromium
```

### 2. Build the Project

```powershell
# Build TypeScript backend
npx tsc

# Build React dashboard
cd src/dashboard
npm run build
cd ../..
```

### 3. Test the CLI

```powershell
# Scan the healthy test fixture
# First, serve the fixture in another terminal:
cd fixtures/healthy-app
python -m http.server 8001

# Then run the scan
node dist/cli/index.js scan --url http://localhost:8001
```

### 4. Start the Dashboard

```powershell
# Start the API server and dashboard
npm start

# Open browser to http://localhost:3001
```

## Development Mode

### Watch Mode for TypeScript

```powershell
npm run dev
```

### Dashboard Development

```powershell
# Terminal 1: Run the API server
npm run dev:server

# Terminal 2: Run Vite dev server
npm run dev:dashboard

# Open browser to http://localhost:3000
```

## Testing Fixtures

The `fixtures/` directory contains test HTML files:

1. **healthy-app**: No errors (control)
2. **undefined-crash**: Runtime error
3. **api-failure**: Failed network request
4. **missing-asset**: 404 for JavaScript file

To test:

```powershell
# Serve a fixture
cd fixtures/undefined-crash
python -m http.server 8002

# Scan it
node ../../dist/cli/index.js scan --url http://localhost:8002
```

## Troubleshooting

### "Cannot find module" errors

Run the build step:
```powershell
npx tsc
```

### Port 3001 already in use

Set a custom port:
```powershell
$env:PORT=3002
npm start
```

### Playwright installation issues

Install only Chromium:
```powershell
npx playwright install chromium
```

### npm install timeouts

Use legacy peer deps flag:
```powershell
npm install --legacy-peer-deps
```

## Project Structure

```
deploydoctor/
├── src/
│   ├── cli/              # Command-line interface
│   ├── monitor/          # Playwright browser monitoring
│   ├── diagnosis/        # Rules-based diagnosis engine
│   ├── source-analysis/  # Stack trace & source map parsing
│   ├── storage/          # SQLite database
│   ├── scanner/          # Main scanner orchestrator
│   ├── server/           # Express API server
│   ├── dashboard/        # React frontend
│   └── types/            # TypeScript definitions
├── fixtures/             # Test applications
├── reports/              # Generated scan reports (created at runtime)
├── dist/                 # Compiled JavaScript (created by tsc)
└── deploydoctor.db       # SQLite database (created at runtime)
```

## Next Steps

1. Run a scan on one of the test fixtures
2. View results in the dashboard
3. Try scanning your own React application
4. Review the generated JSON reports in `reports/`
5. Explore the database with any SQLite viewer

## Known Limitations (MVP)

- No React-specific component analysis (generic JavaScript error detection)
- Source mapping only works for local files (not URLs)
- No automatic dev server startup (coming in future version)
- No real-time monitoring (single scan at a time)
- Dark theme only (light theme planned)
