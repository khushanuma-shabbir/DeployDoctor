import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';

/**
 * Session-Based Authentication Middleware
 * 
 * Secure authentication using HttpOnly cookies and sessions.
 * For single-user MVP - admin login only.
 * 
 * Environment Variables Required:
 * - ADMIN_USERNAME: Administrator username
 * - ADMIN_PASSWORD_HASH: Bcrypt hash of admin password
 * - SESSION_SECRET: Secret for session signing
 */

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    username?: string;
    isAuthenticated?: boolean;
    createdAt?: number;
  }
}

/**
 * Check if user is authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.isAuthenticated) {
    return next();
  }
  
  res.status(401).json({ 
    error: 'Unauthorized',
    message: 'Authentication required. Please log in.'
  });
}

/**
 * Optional authentication - allows both authenticated and public access
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  // No validation needed - just pass through
  // Session will be checked if it exists
  next();
}

/**
 * Login handler
 */
export async function handleLogin(req: Request, res: Response) {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Username and password are required'
    });
  }
  
  // Get admin credentials from environment
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  
  if (!adminUsername || !adminPasswordHash) {
    console.error('SECURITY ERROR: Admin credentials not configured!');
    return res.status(500).json({
      error: 'Server Configuration Error',
      message: 'Authentication not properly configured'
    });
  }
  
  // Verify username (constant-time comparison)
  if (!constantTimeCompare(username, adminUsername)) {
    // Add small delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, 1000));
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid username or password'
    });
  }
  
  // Verify password using bcrypt
  try {
    const isValid = await bcrypt.compare(password, adminPasswordHash);
    
    if (!isValid) {
      // Add small delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 1000));
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid username or password'
      });
    }
    
    // Create session
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({
          error: 'Server Error',
          message: 'Failed to create session'
        });
      }
      
      req.session.userId = 'admin';
      req.session.username = adminUsername;
      req.session.isAuthenticated = true;
      req.session.createdAt = Date.now();
      
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({
            error: 'Server Error',
            message: 'Failed to save session'
          });
        }
        
        res.json({
          success: true,
          user: {
            username: adminUsername,
            role: 'admin'
          }
        });
      });
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Server Error',
      message: 'Authentication failed'
    });
  }
}

/**
 * Logout handler
 */
export function handleLogout(req: Request, res: Response) {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({
        error: 'Server Error',
        message: 'Failed to logout'
      });
    }
    
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
}

/**
 * Get current user info
 */
export function getCurrentUser(req: Request, res: Response) {
  if (req.session?.isAuthenticated) {
    res.json({
      isAuthenticated: true,
      user: {
        username: req.session.username,
        role: 'admin'
      }
    });
  } else {
    res.json({
      isAuthenticated: false
    });
  }
}

/**
 * Constant-time string comparison
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Generate password hash (utility function for setup)
 * Usage: node -e "require('./dist/middleware/session-auth.js').generateHash('your-password')"
 */
export async function generateHash(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}
