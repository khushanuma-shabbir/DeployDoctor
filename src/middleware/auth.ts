import { Request, Response, NextFunction } from 'express';

/**
 * Simple API Key Authentication Middleware
 * 
 * For production, use:
 * - Authorization: Bearer <API_KEY>
 * 
 * Set API_KEY environment variable
 */

export function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  // In development mode, skip authentication
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }
  
  const apiKey = process.env.API_KEY;
  
  // If no API key is configured, require it to be set
  if (!apiKey) {
    console.error('SECURITY WARNING: API_KEY not set in production!');
    return res.status(500).json({ 
      error: 'Server configuration error', 
      message: 'Authentication not configured' 
    });
  }
  
  // Check Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Missing Authorization header' 
    });
  }
  
  // Parse Bearer token
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid Authorization format. Use: Bearer <API_KEY>' 
    });
  }
  
  const providedKey = parts[1];
  
  // Constant-time comparison to prevent timing attacks
  if (providedKey.length !== apiKey.length || !constantTimeCompare(providedKey, apiKey)) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid API key' 
    });
  }
  
  // Authentication successful
  next();
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
 * Optional authentication - allows both authenticated and public access
 * Used for read-only endpoints that might need to be public
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  // In development or if API_KEY not set, allow public access
  if (process.env.NODE_ENV !== 'production' || !process.env.API_KEY) {
    return next();
  }
  
  // If auth header provided, validate it
  const authHeader = req.headers.authorization;
  if (authHeader) {
    return authenticateRequest(req, res, next);
  }
  
  // No auth provided but that's okay for this endpoint
  next();
}
