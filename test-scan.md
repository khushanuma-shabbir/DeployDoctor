# Testing DeployDoctor

## Quick Test

### 1. Serve a test fixture

Open a new PowerShell terminal and run:

```powershell
cd d:\Project\DeployDoctor\fixtures\healthy-app
python -m http.server 8001
```

Leave this running.

### 2. Run a scan (in another terminal)

```powershell
cd d:\Project\DeployDoctor
node dist/cli/index.js scan --url http://localhost:8001
```

Expected output:
- Status: HEALTHY
- No critical issues detected

### 3. Test a broken app

In the first terminal, stop the server (Ctrl+C) and start a different fixture:

```powershell
cd d:\Project\DeployDoctor\fixtures\undefined-crash
python -m http.server 8002
```

Then scan:

```powershell
node dist/cli/index.js scan --url http://localhost:8002
```

Expected output:
- Status: CRITICAL
- White screen detected
- Runtime error detected

### 4. View results in dashboard

```powershell
npm start
```

Open `http://localhost:3001` in your browser.

You should see:
- Dashboard with scan statistics
- Recent scans list
- Click on a scan to view detailed results

### 5. View all scans

```powershell
node dist/cli/index.js list
```

### 6. View specific scan details

```powershell
node dist/cli/index.js show <scan-id>
```

## Complete Test Suite

Test all fixtures:

```powershell
# Healthy app (control)
cd fixtures/healthy-app
python -m http.server 8001
# In another terminal: node dist/cli/index.js scan --url http://localhost:8001

# Undefined crash
cd fixtures/undefined-crash
python -m http.server 8002
# Scan: node dist/cli/index.js scan --url http://localhost:8002

# Missing asset
cd fixtures/missing-asset
python -m http.server 8003
# Scan: node dist/cli/index.js scan --url http://localhost:8003

# API failure
cd fixtures/api-failure
python -m http.server 8004
# Scan: node dist/cli/index.js scan --url http://localhost:8004
```

## Verification Checklist

- [ ] CLI scans complete without crashing
- [ ] Scan results are saved to database
- [ ] JSON reports generated in `reports/` directory
- [ ] Screenshots saved
- [ ] Dashboard loads without errors
- [ ] Can view scan list in dashboard
- [ ] Can view detailed scan results
- [ ] Can start new scan from dashboard
- [ ] Healthy fixture reports as HEALTHY
- [ ] Broken fixtures report as CRITICAL with correct diagnoses
- [ ] White screen detection works
- [ ] Network failure detection works
- [ ] Runtime error detection works
