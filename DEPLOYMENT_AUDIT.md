# DeployDoctor - Production Deployment Audit

**Audit Date**: 2024
**Target Deployment**: Render (Backend) + Vercel (Frontend)
**Auditor**: Senior Engineer Review

## CRITICAL SECURITY ISSUES

### 1. NO AUTHENTICATION/AUTHORIZATION ⛔ CRITICAL
**Severity**: CRITICAL  
**Affected Files**: 
- `src/server/index.ts` (all API endpoints)
- `src/dashboard/src/utils/api.ts`

**Problem**:
Every API endpoint is completely open to the public with zero authentication:
- Anyone can start expensive QA sessions
- Anyone can view all scan results
- Anyone can delete any scan/report
- Anyone can access all stored data

**Why It Matters**:
- Cost: Attackers can spawn unlimited QA sessions, exhausting server resources
- Privacy: All scan results are public
- Abuse: Anyone can delete all data
- DOS: Trivial to overload the system

**Exact Fix**:
Implement API key or JWT authentication before any production deployment.

**Verification**:
```bash
curl http://localhost:3001/api/qa/start -X POST -d '{"url":"http://evil.com"}' -H "Content-Type: application/json"
# Should return 401 Unauthorized, currently returns 200 OK
```

---

### 2. NO RATE LIMITING ⛔ CRITICAL
**Severity**: CRITICAL  
**Affected Files**: `src/server/index.ts`

**Problem**:
- No rate limiting on any endpoint
- QA sessions can be spammed infinitely
- Each QA session consumes significant CPU/memory for 15-30 minutes
- No IP-based throttling
- No session limits per user/IP

**Why It Matters**:
- DOS Attack: Single attacker can crash server in minutes
- Cost Explosion: Cloud bill will skyrocket
- Resource Exhaustion: Legitimate users blocked

**Exact Fix**:
```typescript
import rateLimit from 'express-rate-limit';

const qaLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 QA sessions per hour per IP
  message: 'Too many QA sessions. Please wait.'
});

app.post('/api/qa/start', qaLimiter, async (req, res) => {
  // ... existing code
});
```

**Verification**:
Spam POST /api/qa/start 10 times rapidly - should be blocked after 3

---

### 3. INSUFFICIENT SSRF PROTECTION ⛔ CRITICAL
**Severity**: CRITICAL  
**Affected Files**: `src/server/index.ts` lines 35-44, 172-181

**Problem**:
Current SSRF protection only checks:
```typescript
if (hostname.startsWith('192.168.') || 
    hostname.startsWith('10.') || 
    hostname.startsWith('172.')) {
  // Block
}
```

**Missing Protections**:
- ❌ No IPv6 private range checks (::1, fc00::/7)
- ❌ No localhost/127.0.0.1 blocking in production
- ❌ No link-local addresses (169.254.x.x)
- ❌ No cloud metadata endpoints (169.254.169.254)
- ❌ No redirect following checks
- ❌ Playwright can navigate to ANY URL after initial check
- ❌ No DNS rebinding protection
- ❌ 172.16.0.0/12 not fully covered (only checks 172.x)

**Why It Matters**:
Attacker can:
- Access Render internal services
- Read environment variables via cloud metadata
- Scan internal network
- Access localhost services on Render
- Bypass via URL redirects

**Exact Fix**:
Implement comprehensive SSRF protection with IP validation and Playwright request interception.

**Verification**:
Test these URLs - all should be blocked:
- http://localhost
- http://127.0.0.1
- http://[::1]
- http://169.254.169.254/latest/meta-data/
- http://metadata.google.internal
- http://10.0.0.1
- http://172.31.255.255

---

### 4. NO CONCURRENT SESSION LIMITS ⛔ CRITICAL
**Severity**: CRITICAL  
**Affected Files**: `src/qa-agent/qa-manager.ts`

**Problem**:
```typescript
async startSession(options: QAAgentOptions): Promise<string> {
  // No check for max concurrent sessions!
  const orchestrator = new QAOrchestrator();
  // ...
}
```

**Why It Matters**:
- Each QA session launches a Chromium instance
- Memory: ~200-400MB per session
- CPU: Heavy load per session
- 10 concurrent sessions = 4GB RAM = OOM crash on Render

**Exact Fix**:
```typescript
private maxConcurrentSessions = 1; // Safe for Render basic tier

async startSession(options: QAAgentOptions): Promise<string> {
  if (this.activeSessions.size >= this.maxConcurrentSessions) {
    throw new Error('Maximum concurrent sessions reached');
  }
  // ...
}
```

**Verification**:
Start 2 QA sessions simultaneously - second should fail

---

### 5. HARDCODED API URLs ⛔ CRITICAL
**Severity**: CRITICAL  
**Affected Files**: `src/dashboard/src/utils/api.ts` line 3

**Problem**:
```typescript
const API_BASE = '/api';
```

This only works when frontend and backend are on same domain. Vercel and Render are different domains.

**Why It Matters**:
- API calls will fail with 404
- CORS errors
- Complete application failure in production

**Exact Fix**:
```typescript
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
```

**Verification**:
Deploy to Vercel, check browser console - should see API calls to Render, not Vercel

---

### 6. WILDCARD CORS ⛔ CRITICAL
**Severity**: CRITICAL  
**Affected Files**: `src/server/index.ts` line 15

**Problem**:
```typescript
app.use(cors());
```

This accepts requests from ANY origin.

**Why It Matters**:
- Any website can call your API
- Attackers can steal user data
- CSRF attacks possible
- Unauthorized access from anywhere

**Exact Fix**:
```typescript
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
```

**Verification**:
```bash
curl -H "Origin: http://evil.com" http://localhost:3001/api/health
# Should return CORS error, currently returns 200
```

---

### 7. NO INPUT VALIDATION 🔴 HIGH
**Severity**: HIGH  
**Affected Files**: All API endpoints in `src/server/index.ts`

**Problem**:
No validation of request bodies:
- `timeout` can be 999999999
- `maxPages` can be 999999
- `maxDuration` can crash server
- No schema validation

**Why It Matters**:
Resource exhaustion attacks via malformed input

**Exact Fix**:
Use express-validator or zod for request validation

**Verification**:
Send malformed payloads - should be rejected

---

### 8. HARDCODED PORT 🔴 HIGH
**Severity**: HIGH  
**Affected Files**: `src/server/index.ts` line 12

**Problem**:
```typescript
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
```

Render requires:
- Binding to `0.0.0.0`, not localhost
- Using exact `process.env.PORT`
- No fallback port

**Why It Matters**:
App won't start on Render (binds to wrong address)

**Exact Fix**:
```typescript
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
```

**Verification**:
Start with PORT=10000, verify listening on 0.0.0.0:10000

---

### 9. DATABASE/REPORTS IN WORKING DIRECTORY 🔴 HIGH
**Severity**: HIGH  
**Affected Files**: 
- `src/storage/database.ts` line 6
- `src/scanner/scanner.ts` line 14

**Problem**:
```typescript
constructor(dbPath: string = 'deploydoctor.db') {
  this.db = new Database(dbPath);
}
```

Render's filesystem is ephemeral. Data deleted on each deploy.

**Why It Matters**:
- All scans lost on restart
- All reports deleted on deploy
- No persistence

**Exact Fix**:
```typescript
const dbPath = process.env.DATABASE_PATH || '/var/data/deploydoctor.db';
const reportsDir = process.env.REPORTS_DIR || '/var/data/reports';
```

**Verification**:
Restart app, verify data persists

---

### 10. NO HEALTH CHECK ENDPOINT 🔴 HIGH
**Severity**: HIGH  
**Affected Files**: `src/server/index.ts`

**Problem**:
`/api/health` exists but:
- Doesn't check database connectivity
- Doesn't check disk space
- Doesn't check Playwright availability
- Just returns static JSON

**Why It Matters**:
Render can't determine if app is actually healthy

**Exact Fix**:
```typescript
app.get('/health', async (req, res) => {
  try {
    scanner.getStats(); // Verify DB works
    res.json({ status: 'ok', timestamp: Date.now() });
  } catch (error) {
    res.status(503).json({ status: 'error' });
  }
});
```

**Verification**:
Stop database, health check should fail

---

### 11. NO GRACEFUL SHUTDOWN FOR QA SESSIONS 🔴 HIGH
**Severity**: HIGH  
**Affected Files**: `src/server/index.ts`, `src/qa-agent/qa-manager.ts`

**Problem**:
SIGTERM handler only closes scanner:
```typescript
process.on('SIGTERM', async () => {
  await scanner.close();
  process.exit(0);
});
```

QA sessions not terminated!

**Why It Matters**:
- Zombie browser processes
- Memory leaks
- Incomplete reports
- Resource not released

**Exact Fix**:
```typescript
process.on('SIGTERM', async () => {
  await scanner.close();
  await qaManager.shutdown(); // Need to add this
  process.exit(0);
});
```

**Verification**:
Start QA session, send SIGTERM, verify browsers closed

---

### 12. PLAYWRIGHT NOT CONFIGURED FOR DOCKER 🔴 HIGH
**Severity**: HIGH  
**Affected Files**: `src/qa-agent/qa-browser-agent.ts`

**Problem**:
```typescript
const launchOptions = {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
};
```

Missing Docker-specific flags for Render.

**Why It Matters**:
Playwright won't work in Docker without additional dependencies and flags

**Exact Fix**:
```typescript
const launchOptions = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--no-first-run',
    '--no-zygote'
  ]
};
```

**Verification**:
Run in Docker, verify Playwright launches

---

### 13. NO DOCKER CONFIGURATION ⛔ CRITICAL
**Severity**: CRITICAL  
**Affected Files**: Missing `Dockerfile`

**Problem**:
No Dockerfile exists. Render needs Docker for Playwright.

**Why It Matters**:
Cannot deploy to Render without Docker

**Exact Fix**:
Create production-ready Dockerfile with Playwright dependencies

**Verification**:
`docker build .` should succeed

---

### 14. MISSING ENVIRONMENT VARIABLE CONFIGURATION 🔴 HIGH
**Severity**: HIGH  
**Affected Files**: Missing `.env.example`

**Problem**:
No documentation of required environment variables

**Why It Matters**:
Deployment will fail due to missing configuration

**Exact Fix**:
Create comprehensive .env.example

**Verification**:
All env vars documented and used

---

### 15. REPORTS EXPOSED VIA STATIC ROUTE 🟡 MEDIUM
**Severity**: MEDIUM  
**Affected Files**: `src/server/index.ts` line 20

**Problem**:
```typescript
app.use('/reports', express.static(reportsPath));
```

Anyone can list and download all reports if they guess IDs.

**Why It Matters**:
Data leakage, privacy violations

**Exact Fix**:
Serve reports through authenticated endpoint only

**Verification**:
Try accessing /reports/{scan-id}.json without auth - should fail

---

## DEPLOYMENT BLOCKERS

### Missing Files:
- ❌ `Dockerfile` - CRITICAL
- ❌ `.dockerignore` - HIGH
- ❌ `.env.example` - HIGH
- ❌ `render.yaml` - MEDIUM
- ❌ `vercel.json` - MEDIUM (may not be needed)

### Missing Security:
- ❌ Authentication system
- ❌ Rate limiting
- ❌ Proper SSRF protection
- ❌ Request validation
- ❌ Secure CORS

### Configuration Issues:
- ❌ Hardcoded API URLs
- ❌ Wrong port binding
- ❌ No persistent storage paths
- ❌ No environment variable support

### Playwright Issues:
- ❌ Docker configuration
- ❌ Browser isolation
- ❌ Resource limits
- ❌ Cleanup on shutdown

---

## PRODUCTION READINESS: ⛔ NOT READY

**Status**: NOT READY FOR ANY DEPLOYMENT

**Must Fix Before ANY Deployment**:
1. Authentication/Authorization
2. Rate limiting
3. SSRF protection
4. Docker configuration
5. Environment variables
6. API URL configuration
7. CORS configuration
8. Database persistence
9. Concurrent session limits
10. Graceful shutdown

**Estimated Time to Production Ready**: 2-3 days

**Next Steps**: Implement fixes in order of severity (CRITICAL first)

