import express from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { Scanner } from '../scanner/scanner.js';
import { QAManager } from '../qa-agent/qa-manager.js';
import type { ScanOptions, QAAgentOptions } from '../types/index.js';
import { requireAuth, optionalAuth, handleLogin, handleLogout, getCurrentUser } from '../middleware/session-auth.js';
import { csrfProtect, getCsrfToken } from '../middleware/csrf-protection.js';
import { validateUrl } from '../middleware/ssrf-protection.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '10000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

// Helmet security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // React needs inline scripts
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' }
}));

// CORS Configuration with credentials
const allowedOrigins = process.env.FRONTEND_ORIGIN 
  ? process.env.FRONTEND_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) {
      // In production, be stricter
      if (IS_PRODUCTION) {
        return callback(new Error('Origin required in production'));
      }
      return callback(null, true);
    }
    
    // In development, allow all localhost
    if (!IS_PRODUCTION && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    // Check whitelist
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // CRITICAL: Allow cookies
  exposedHeaders: ['set-cookie']
}));

// Body parser with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Session configuration
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

if (IS_PRODUCTION && SESSION_SECRET === 'dev-secret-change-in-production') {
  console.error('CRITICAL SECURITY ERROR: SESSION_SECRET not set in production!');
  process.exit(1);
}

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'sessionId', // Custom name (not "connect.sid")
  cookie: {
    httpOnly: true,
    secure: IS_PRODUCTION, // HTTPS only in production
    sameSite: IS_PRODUCTION ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/'
  },
  rolling: true // Extend session on activity
}));

// Rate limiters
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

const qaLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: IS_PRODUCTION ? 3 : 10,
  message: { error: 'Too many QA sessions started. Please wait before starting another.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting
app.use('/api/', apiLimiter);

// ==========================================
// STORAGE CONFIGURATION
// ==========================================

const DATABASE_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'deploydoctor.db');
const REPORTS_DIR = process.env.REPORTS_DIR || path.join(process.cwd(), 'reports');

await fs.mkdir(path.dirname(DATABASE_PATH), { recursive: true }).catch(() => {});
await fs.mkdir(REPORTS_DIR, { recursive: true }).catch(() => {});

const scanner = new Scanner(DATABASE_PATH, REPORTS_DIR);
const qaManager = new QAManager();

const MAX_CONCURRENT_QA_SESSIONS = parseInt(process.env.MAX_CONCURRENT_QA_SESSIONS || '1', 10);
const QA_SESSION_TIMEOUT = parseInt(process.env.QA_SESSION_TIMEOUT_MS || '1800000', 10);

// ==========================================
// AUTHENTICATION ROUTES (No auth required)
// ==========================================

// Login
app.post('/api/auth/login', loginLimiter, handleLogin);

// Logout
app.post('/api/auth/logout', handleLogout);

// Get current user
app.get('/api/auth/user', getCurrentUser);

// Get CSRF token
app.get('/api/auth/csrf-token', getCsrfToken);

// ==========================================
// PUBLIC ROUTES (No auth required)
// ==========================================

// Health check
app.get('/health', async (req, res) => {
  try {
    const stats = scanner.getStats();
    const isHealthy = stats !== null;
    
    res.status(isHealthy ? 200 : 503).json({ 
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: Date.now(),
      version: '2.0.0',
      environment: NODE_ENV
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      timestamp: Date.now() 
    });
  }
});

// ==========================================
// PROTECTED SCANNER ROUTES
// ==========================================

// Start a new scan
app.post('/api/scan', 
  requireAuth,
  csrfProtect,
  [
    body('url').isURL().withMessage('Valid URL is required'),
    body('timeout').optional().isInt({ min: 5, max: 120 }).withMessage('Timeout must be between 5-120 seconds'),
    body('rootSelector').optional().isString().isLength({ max: 200 })
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }
      
      const { url, timeout, rootSelector } = req.body;
      
      const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
      const mode = isLocal ? 'local' : 'production';
      
      const urlValidation = await validateUrl(url, mode);
      if (!urlValidation.valid) {
        return res.status(403).json({ 
          error: 'URL not allowed', 
          message: urlValidation.error 
        });
      }
      
      const scanOptions: ScanOptions = {
        url,
        mode,
        timeout: timeout || 30,
        rootSelector: rootSelector || '#root',
        takeScreenshot: true
      };
      
      const result = await scanner.scan(scanOptions);
      res.json(result);
      
    } catch (error) {
      console.error('Scan error:', error);
      res.status(500).json({ 
        error: 'Scan failed', 
        message: IS_PRODUCTION ? 'Internal server error' : (error instanceof Error ? error.message : String(error))
      });
    }
});

// Get all scans
app.get('/api/scans', requireAuth, (req, res) => {
  try {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 1000) : 100;
    const scans = scanner.getAllScans(limit);
    res.json(scans);
  } catch (error) {
    console.error('Error fetching scans:', error);
    res.status(500).json({ error: 'Failed to fetch scans' });
  }
});

// Get a specific scan
app.get('/api/scans/:id', requireAuth, (req, res) => {
  try {
    const scan = scanner.getScan(req.params.id);
    
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    
    res.json(scan);
  } catch (error) {
    console.error('Error fetching scan:', error);
    res.status(500).json({ error: 'Failed to fetch scan' });
  }
});

// Delete a scan
app.delete('/api/scans/:id', requireAuth, csrfProtect, async (req, res) => {
  try {
    const scanId = req.params.id;
    const scan = scanner.getScan(scanId);
    
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    
    const deleted = scanner.deleteScan(scanId);
    
    if (deleted) {
      try {
        if (scan.screenshotPath) {
          await fs.unlink(scan.screenshotPath);
        }
        await fs.unlink(path.join(REPORTS_DIR, `${scanId}.json`));
      } catch (fileError) {
        // Files might not exist
      }
      
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to delete scan' });
    }
  } catch (error) {
    console.error('Error deleting scan:', error);
    res.status(500).json({ error: 'Failed to delete scan' });
  }
});

// Get statistics
app.get('/api/stats', requireAuth, (req, res) => {
  try {
    const stats = scanner.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ==========================================
// PROTECTED QA AGENT ROUTES
// ==========================================

// Start QA session
app.post('/api/qa/start', 
  requireAuth,
  csrfProtect,
  qaLimiter,
  [
    body('url').isURL().withMessage('Valid URL is required'),
    body('scope').optional().isIn(['quick', 'standard', 'thorough']).withMessage('Invalid scope'),
    body('maxPages').optional().isInt({ min: 1, max: 50 }).withMessage('maxPages must be between 1-50'),
    body('maxActions').optional().isInt({ min: 1, max: 200 }).withMessage('maxActions must be between 1-200'),
    body('maxDuration').optional().isInt({ min: 60000, max: 3600000 }).withMessage('maxDuration must be between 1-60 minutes')
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }
      
      const activeSessions = qaManager.getActiveSessions();
      if (activeSessions.length >= MAX_CONCURRENT_QA_SESSIONS) {
        return res.status(429).json({ 
          error: 'Maximum concurrent QA sessions reached', 
          message: `Please wait for an existing session to complete. Limit: ${MAX_CONCURRENT_QA_SESSIONS}`,
          activeSessions: activeSessions.length
        });
      }
      
      const { url, scope, viewport, browserType, credentials, maxPages, maxActions, maxDuration } = req.body;
      
      const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
      const mode = isLocal ? 'local' : 'production';
      
      const urlValidation = await validateUrl(url, mode);
      if (!urlValidation.valid) {
        return res.status(403).json({ 
          error: 'URL not allowed', 
          message: urlValidation.error 
        });
      }
      
      const qaOptions: QAAgentOptions = {
        url,
        scope: scope || 'standard',
        mode,
        viewport,
        browserType,
        credentials,
        maxPages: maxPages || undefined,
        maxActions: maxActions || undefined,
        maxDuration: Math.min(maxDuration || QA_SESSION_TIMEOUT, QA_SESSION_TIMEOUT),
        testLogin: false,
        testForms: true,
        testNavigation: true,
        testResponsive: false
      };
      
      const sessionId = await qaManager.startSession(qaOptions);
      res.json({ sessionId, status: 'started' });
      
    } catch (error) {
      console.error('QA start error:', error);
      res.status(500).json({ 
        error: 'Failed to start QA session', 
        message: IS_PRODUCTION ? 'Internal server error' : (error instanceof Error ? error.message : String(error))
      });
    }
});

// Get QA session status
app.get('/api/qa/session/:id', requireAuth, (req, res) => {
  try {
    const sessionState = qaManager.getSessionState(req.params.id);
    
    if (!sessionState) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(sessionState);
  } catch (error) {
    console.error('Error fetching QA session:', error);
    res.status(500).json({ error: 'Failed to fetch session status' });
  }
});

// Get all active sessions
app.get('/api/qa/sessions', requireAuth, (req, res) => {
  try {
    const sessions = qaManager.getActiveSessions();
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching QA sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get QA report
app.get('/api/qa/report/:id', requireAuth, async (req, res) => {
  try {
    const report = await qaManager.getReport(req.params.id);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json(report);
  } catch (error) {
    console.error('Error fetching QA report:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// List all QA reports
app.get('/api/qa/reports', requireAuth, async (req, res) => {
  try {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 1000) : 50;
    const reports = await qaManager.listReports(limit);
    res.json(reports);
  } catch (error) {
    console.error('Error fetching QA reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Delete QA report
app.delete('/api/qa/report/:id', requireAuth, csrfProtect, async (req, res) => {
  try {
    const deleted = await qaManager.deleteReport(req.params.id);
    
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Report not found' });
    }
  } catch (error) {
    console.error('Error deleting QA report:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// Get QA statistics
app.get('/api/qa/stats', requireAuth, async (req, res) => {
  try {
    const stats = await qaManager.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching QA stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ==========================================
// STATIC FILES & SPA ROUTING
// ==========================================

const dashboardPath = path.join(__dirname, '../../src/dashboard/dist');
app.use(express.static(dashboardPath));

// Serve dashboard for all other routes (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(dashboardPath, 'index.html'));
});

// ==========================================
// ERROR HANDLER
// ==========================================

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ==========================================
// START SERVER
// ==========================================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🩺 DeployDoctor Server v2.0`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Environment:     ${NODE_ENV}`);
  console.log(`API Server:      http://0.0.0.0:${PORT}/api`);
  console.log(`Dashboard:       http://0.0.0.0:${PORT}`);
  console.log(`Database:        ${DATABASE_PATH}`);
  console.log(`Reports:         ${REPORTS_DIR}`);
  console.log(`Auth:            Session-based (${IS_PRODUCTION ? 'Production' : 'Development'} mode)`);
  console.log(`CORS Origins:    ${allowedOrigins.join(', ')}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  if (IS_PRODUCTION) {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH) {
      console.error('❌ CRITICAL: ADMIN_USERNAME and ADMIN_PASSWORD_HASH not set!');
      console.error('   Server will not accept logins until credentials are configured.');
    } else {
      console.log(`✅ Admin authentication configured`);
    }
  }
});

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  try {
    console.log('Closing scanner...');
    await scanner.close();
    
    console.log('Terminating QA sessions...');
    const activeSessions = qaManager.getActiveSessions();
    for (const session of activeSessions) {
      console.log(`  Terminating session ${session.sessionId}...`);
    }
    
    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ==========================================
// QA MANAGER EVENT HANDLERS
// ==========================================

qaManager.on('progress', (sessionId, progress) => {
  console.log(`[QA ${sessionId}] ${progress.status}: ${progress.currentActivity || ''}`);
});

qaManager.on('completed', (sessionId, report) => {
  console.log(`[QA ${sessionId}] Completed - Found ${report.bugs.length} bugs`);
});

qaManager.on('error', (sessionId, error) => {
  console.error(`[QA ${sessionId}] Error: ${error}`);
});
