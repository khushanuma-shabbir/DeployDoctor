# DeployDoctor Test Suite

## Prerequisites

1. **Generate admin credentials:**
```bash
node -e "const b=require('bcrypt');b.hash('testpassword123',12).then(console.log)"
```

2. **Set environment variables:**
```bash
# Windows PowerShell
$env:NODE_ENV="development"
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD_HASH="<hash from above>"
$env:SESSION_SECRET="test-secret-for-development-only"
$env:TEST_PASSWORD="testpassword123"
```

3. **Start the server:**
```bash
npm run build
node dist/server/index.js
```

## Running Tests

### Security Integration Tests
```bash
node test/integration/security-tests.mjs
```

Tests:
- ✅ Health check
- ✅ Authentication (correct/wrong credentials)
- ✅ Session cookie attributes
- ✅ Unauthorized/authorized access
- ✅ CSRF token generation and validation
- ✅ Logout and session invalidation
- ✅ Login rate limiting

### Scanner Tests
```bash
# Start test applications first
cd test-apps/healthy-react-app
npm install
npm run dev

# In another terminal
cd test-apps/broken-react-app
npm install
npm run dev

# Run scanner tests
node test/integration/scanner-tests.mjs
```

### Manual SSRF Tests

Test URLs that should be **BLOCKED**:
- `http://localhost:3000`
- `http://127.0.0.1`
- `http://10.0.0.1`
- `http://172.16.0.1`
- `http://192.168.1.1`
- `http://169.254.169.254`
- `http://metadata.google.internal`

Test URLs that should be **ALLOWED**:
- `https://example.com`
- `https://www.google.com`
- `http://localhost:3100` (in local mode only)

## Test Coverage

| Area | Status |
|------|--------|
| Authentication | ✅ Tested |
| Session Management | ✅ Tested |
| CSRF Protection | ✅ Tested |
| Cookie Security | ✅ Tested |
| Rate Limiting | ✅ Tested |
| CORS | ⚠️ Manual test required |
| SSRF Protection | ⚠️ Manual test required |
| Scanner Functionality | ⚠️ Requires live apps |
| QA Agent | ⚠️ Requires live apps |
| Database Persistence | ⚠️ Requires restart test |

## Known Limitations

1. **Session Store**: Uses MemoryStore (not production-ready)
   - Sessions lost on server restart
   - Not suitable for multi-instance deployments
   - **FIX REQUIRED**: Add `connect-sqlite3` or `connect-pg-simple`

2. **SSRF Protection**: Browser-level only
   - Network-level isolation needed for production
   - Firewall rules recommended

3. **Dev Dependencies**: Some vulnerabilities remain
   - esbuild, minimatch, tinypool (dev-only)
   - No production impact
