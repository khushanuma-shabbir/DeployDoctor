import express from 'express';
import cors from 'cors';
import { Scanner } from '../scanner/scanner.js';
import type { ScanOptions } from '../types/index.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Static files (dashboard)
const dashboardPath = path.join(__dirname, '../../src/dashboard/dist');
app.use(express.static(dashboardPath));

// Reports directory (for screenshots and JSON)
const reportsPath = path.join(process.cwd(), 'reports');
app.use('/reports', express.static(reportsPath));

// Initialize scanner
const scanner = new Scanner();

// API Routes

// POST /api/scan - Start a new scan
app.post('/api/scan', async (req, res) => {
  try {
    const { url, timeout, rootSelector } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    // Determine mode
    const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
    const mode = isLocal ? 'local' : 'production';
    
    // Security: Block private networks in production mode (basic SSRF protection)
    if (!isLocal) {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      // Block obvious private IPs
      if (hostname.startsWith('192.168.') || 
          hostname.startsWith('10.') || 
          hostname.startsWith('172.')) {
        return res.status(403).json({ 
          error: 'Scanning private network addresses is not allowed in production mode' 
        });
      }
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
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/scans - Get all scans
app.get('/api/scans', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const scans = scanner.getAllScans(limit);
    res.json(scans);
  } catch (error) {
    console.error('Error fetching scans:', error);
    res.status(500).json({ error: 'Failed to fetch scans' });
  }
});

// GET /api/scans/:id - Get a specific scan
app.get('/api/scans/:id', (req, res) => {
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

// DELETE /api/scans/:id - Delete a scan
app.delete('/api/scans/:id', async (req, res) => {
  try {
    const scanId = req.params.id;
    const scan = scanner.getScan(scanId);
    
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    
    // Delete from database
    const deleted = scanner.deleteScan(scanId);
    
    if (deleted) {
      // Delete associated files
      try {
        if (scan.screenshotPath) {
          await fs.unlink(scan.screenshotPath);
        }
        await fs.unlink(path.join(reportsPath, `${scanId}.json`));
      } catch (fileError) {
        // Files might not exist, ignore
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

// GET /api/stats - Get statistics
app.get('/api/stats', (req, res) => {
  try {
    const stats = scanner.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/health - Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Serve dashboard for all other routes (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(dashboardPath, 'index.html'));
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🩺 DeployDoctor Server`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🌐 API Server:   http://localhost:${PORT}/api`);
  console.log(`📊 Dashboard:    http://localhost:${PORT}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await scanner.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await scanner.close();
  process.exit(0);
});
