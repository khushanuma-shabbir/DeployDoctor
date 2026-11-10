import { parse as parseUrl } from 'url';
import { isIP } from 'net';
import ipaddr from 'ipaddr.js';
import dns from 'dns/promises';

/**
 * Comprehensive SSRF Protection
 * 
 * Blocks access to:
 * - Private IPv4 ranges (10.x, 172.16-31.x, 192.168.x)
 * - Localhost (127.x, ::1)
 * - Link-local (169.254.x, fe80::)
 * - Cloud metadata endpoints
 * - Internal network services
 */

const BLOCKED_DOMAINS = [
  'metadata.google.internal',
  'metadata.azure.com',
  'metadata',
  'localhost'
];

const CLOUD_METADATA_IPS = [
  '169.254.169.254', // AWS, Azure, GCP
  '169.254.169.253', // AWS
  'fd00:ec2::254'    // AWS IPv6
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
