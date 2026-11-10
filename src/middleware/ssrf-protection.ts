import { parse as parseUrl } from 'url';
import { isIP } from 'net';
import ipaddr from 'ipaddr.js';
import dns from 'dns/promises';
import type { Page, Route } from 'playwright';

/**
 * Comprehensive SSRF Protection
 * 
 * Blocks access to:
 * - Private IPv4 ranges (10.x, 172.16-31.x, 192.168.x)
 * - Localhost (127.x, ::1)
 * - Link-local (169.254.x, fe80::)
 * - Cloud metadata endpoints
 * - Internal network services
 * - Post-load navigation to blocked URLs
 * - Redirects to internal addresses
 */

const BLOCKED_DOMAINS = [
  'metadata.google.internal',
  'metadata.azure.com',
  'metadata',
  'localhost',
  '169.254.169.254', // Explicit IP blocking
  '0.0.0.0'
];

const CLOUD_METADATA_IPS = [
  '169.254.169.254', // AWS, Azure, GCP
  '169.254.169.253', // AWS
  'fd00:ec2::254',   // AWS IPv6
  '169.254.170.2',   // ECS task metadata
  '100.100.100.200'  // Alibaba Cloud
];

export async function validateUrl(url: string, mode: 'local' | 'production'): Promise<{ valid: boolean; error?: string }> {
  try {
    const parsed = parseUrl(url);
    
    // Check protocol
    if (!parsed.protocol || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
      return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
    }
    
    const hostname = parsed.hostname;
    if (!hostname) {
      return { valid: false, error: 'Invalid URL: missing hostname' };
    }
    
    // Check blocked domains
    const lowerHostname = hostname.toLowerCase();
    if (BLOCKED_DOMAINS.some(blocked => lowerHostname === blocked || lowerHostname.endsWith(`.${blocked}`))) {
      return { valid: false, error: 'Access to this domain is not allowed' };
    }
    
    // In production mode, apply strict restrictions
    if (mode === 'production') {
      // Block localhost in production
      if (lowerHostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return { valid: false, error: 'Localhost access not allowed in production mode' };
      }
      
      // Check if it's an IP address
      if (isIP(hostname)) {
        const ipCheck = validateIP(hostname);
        if (!ipCheck.valid) {
          return ipCheck;
        }
      } else {
        // Resolve DNS and check IPs
        try {
          const addresses = await dns.resolve(hostname);
          for (const address of addresses) {
            const ipCheck = validateIP(address);
            if (!ipCheck.valid) {
              return { valid: false, error: `Domain resolves to blocked IP: ${ipCheck.error}` };
            }
          }
        } catch (dnsError) {
          // DNS resolution failed - this is acceptable, let it fail naturally
        }
      }
    } else {
      // Local mode: allow localhost but still block private networks
      const isLocalhost = lowerHostname === 'localhost' || 
                         hostname.startsWith('127.') || 
                         hostname === '::1';
      
      if (!isLocalhost && isIP(hostname)) {
        const ipCheck = validateIP(hostname);
        if (!ipCheck.valid) {
          return ipCheck;
        }
      }
    }
    
    return { valid: true };
    
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

function validateIP(ip: string): { valid: boolean; error?: string } {
  try {
    // Check cloud metadata IPs
    if (CLOUD_METADATA_IPS.includes(ip)) {
      return { valid: false, error: 'Access to cloud metadata endpoint is not allowed' };
    }
    
    const addr = ipaddr.process(ip);
    
    // Check IPv4
    if (addr.kind() === 'ipv4') {
      const range = addr.range();
      
      if (range === 'private') {
        return { valid: false, error: 'Private IPv4 addresses are not allowed' };
      }
      if (range === 'loopback') {
        return { valid: false, error: 'Loopback addresses are not allowed' };
      }
      if (range === 'linkLocal') {
        return { valid: false, error: 'Link-local addresses are not allowed' };
      }
      if (range === 'broadcast') {
        return { valid: false, error: 'Broadcast addresses are not allowed' };
      }
      if (range === 'multicast') {
        return { valid: false, error: 'Multicast addresses are not allowed' };
      }
      
      // Additional check for 172.16.0.0/12 range
      if (addr.kind() === 'ipv4') {
        const ipv4 = addr as ipaddr.IPv4;
        const octets = ipv4.octets;
        if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
          return { valid: false, error: 'Private IPv4 addresses are not allowed' };
        }
      }
    }
    
    // Check IPv6
    if (addr.kind() === 'ipv6') {
      const range = addr.range();
      
      if (range === 'loopback' || ip === '::1') {
        return { valid: false, error: 'Loopback addresses are not allowed' };
      }
      if (range === 'linkLocal' || ip.startsWith('fe80:')) {
        return { valid: false, error: 'Link-local addresses are not allowed' };
      }
      if (range === 'uniqueLocal' || ip.startsWith('fc') || ip.startsWith('fd')) {
        return { valid: false, error: 'Private IPv6 addresses are not allowed' };
      }
      if (range === 'multicast') {
        return { valid: false, error: 'Multicast addresses are not allowed' };
      }
    }
    
    return { valid: true };
    
  } catch (error) {
    return { valid: false, error: 'Invalid IP address' };
  }
}

/**
 * Validate redirect URL (for Playwright navigation interception)
 */
export async function validateRedirectUrl(url: string, originalUrl: string, mode: 'local' | 'production'): Promise<boolean> {
  try {
    const parsed = parseUrl(url);
    const originalParsed = parseUrl(originalUrl);
    
    // Must be same origin in production
    if (mode === 'production') {
      if (parsed.hostname !== originalParsed.hostname) {
        return false;
      }
    }
    
    // Check if redirect URL would be blocked
    const validation = await validateUrl(url, mode);
    return validation.valid;
    
  } catch (error) {
    return false;
  }
}

/**
 * Setup Playwright page-level SSRF protection
 * 
 * Intercepts all navigation and requests to block:
 * - JavaScript-triggered navigation
 * - Redirects to blocked URLs
 * - Iframe navigation
 * - Subresource requests to private networks
 * 
 * WARNING: This provides defense-in-depth but is not 100% foolproof.
 * For maximum security, run Playwright in a sandboxed environment
 * with network-level restrictions.
 */
export async function setupPlaywrightSSRFProtection(
  page: Page,
  allowedOrigin: string,
  mode: 'local' | 'production'
): Promise<void> {
  const allowedHostname = parseUrl(allowedOrigin).hostname;
  
  // Intercept all requests
  await page.route('**/*', async (route: Route) => {
    const request = route.request();
    const url = request.url();
    
    try {
      // Parse URL
      const parsed = parseUrl(url);
      const hostname = parsed.hostname;
      
      if (!hostname) {
        console.warn(`[SSRF] Blocked request with no hostname: ${url}`);
        return route.abort('failed');
      }
      
      // In production, enforce same-origin for navigation
      if (mode === 'production' && request.isNavigationRequest()) {
        if (hostname !== allowedHostname) {
          console.warn(`[SSRF] Blocked cross-origin navigation: ${url}`);
          return route.abort('blockedbyclient');
        }
      }
      
      // Check all requests against SSRF rules
      const validation = await validateUrl(url, mode);
      if (!validation.valid) {
        console.warn(`[SSRF] Blocked request: ${url} - ${validation.error}`);
        return route.abort('blockedbyclient');
      }
      
      // Allow the request
      route.continue();
      
    } catch (error) {
      console.warn(`[SSRF] Error validating request ${url}:`, error);
      route.abort('failed');
    }
  });
  
  // Monitor console for suspicious activity
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('Failed to load') || text.includes('blocked')) {
      console.log(`[SSRF] Console message: ${text}`);
    }
  });
}

/**
 * Get network isolation recommendations for deployment
 */
export function getNetworkIsolationRecommendations(): string[] {
  return [
    'CRITICAL: Run Playwright browser processes in isolated containers/VMs',
    'Configure firewall rules to block outbound connections to:',
    '  - 10.0.0.0/8 (private class A)',
    '  - 172.16.0.0/12 (private class B)',
    '  - 192.168.0.0/16 (private class C)',
    '  - 127.0.0.0/8 (loopback)',
    '  - 169.254.0.0/16 (link-local)',
    '  - 169.254.169.254/32 (cloud metadata)',
    '  - ::1/128 (IPv6 loopback)',
    '  - fe80::/10 (IPv6 link-local)',
    '  - fc00::/7 (IPv6 private)',
    'Consider using AWS Lambda or similar sandboxed environments',
    'Implement egress proxy for additional logging and control',
    'Monitor for DNS rebinding attacks',
    'Set short DNS TTLs and re-validate IPs before requests'
  ];
}
