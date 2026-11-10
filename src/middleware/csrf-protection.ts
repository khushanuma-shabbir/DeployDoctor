import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';

/**
 * CSRF Protection Middleware
 * 
 * Protects against Cross-Site Request Forgery attacks
 * for state-changing operations (POST, PUT, DELETE).
 */

const {
  generateCsrfToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET || 'default-secret-change-me',
  getSessionIdentifier: (req: Request) => req.sessionID || '',
  cookieName: '__Host-csrf',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS']
});

/**
 * CSRF Token generation endpoint
 */
export function getCsrfToken(req: Request, res: Response) {
  const token = generateCsrfToken(req, res);
  res.json({ csrfToken: token });
}

/**
 * CSRF protection middleware for routes
 */
export const csrfProtect = doubleCsrfProtection;

export { generateCsrfToken as generateToken };
