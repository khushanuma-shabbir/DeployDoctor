# Test Fixtures

These are intentionally broken and healthy React applications for testing DeployDoctor.

## Running the Fixtures

You can serve these HTML files with any static file server. For example:

```powershell
# Using Python
cd fixtures/undefined-crash
python -m http.server 8001

# Using Node.js http-server
npx http-server undefined-crash -p 8001
```

## Fixtures

### 1. undefined-crash
**Issue:** Runtime error from accessing property of null
**Expected:** Critical error, white screen detected

### 2. missing-asset
**Issue:** Referenced JavaScript bundle doesn't exist (404)
**Expected:** Critical error, failed asset loading

### 3. api-failure
**Issue:** Failed API request to nonexistent endpoint
**Expected:** Warning, network failure detected

### 4. healthy-app
**Issue:** None - this is a control
**Expected:** Healthy status, no issues

## Testing Workflow

1. Start a fixture server:
   ```powershell
   cd fixtures/undefined-crash
   python -m http.server 8001
   ```

2. Scan with DeployDoctor:
   ```powershell
   node dist/cli/index.js scan --url http://localhost:8001
   ```

3. Verify the diagnosis matches expectations

4. View results in dashboard:
   ```powershell
   npm start
   # Open http://localhost:3000
   ```
