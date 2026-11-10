import { chromium, firefox, webkit, Browser, BrowserContext, Page, ConsoleMessage } from 'playwright';
import type { QAAgentOptions, BrowserError, NetworkRequest } from '../types/index.js';
import { setupPlaywrightSSRFProtection } from '../middleware/ssrf-protection.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * QA Browser Agent - Manages Playwright browser instance
 * 
 * Responsibilities:
 * - Launch and control browser
 * - Navigate pages
 * - Capture errors and network activity
 * - Take screenshots
 * - Execute page interactions
 * - Clean up browser resources
 */
export class QABrowserAgent {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  
  private runtimeErrors: BrowserError[] = [];
  private networkRequests: NetworkRequest[] = [];
  private networkFailures: NetworkRequest[] = [];
  
  private screenshotDir: string = 'reports/qa-screenshots';
  private currentUrl: string = '';
  private currentMode: 'local' | 'production' = 'production';
  private ssrfProtectionEnabled: boolean = false;
  
  /**
   * Initialize the browser
   */
  async initialize(options: QAAgentOptions): Promise<void> {
    // Create screenshot directory
    await fs.mkdir(this.screenshotDir, { recursive: true });
    
    // Launch browser based on type
    const browserType = options.browserType || 'chromium';
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    
    switch (browserType) {
      case 'firefox':
        this.browser = await firefox.launch(launchOptions);
        break;
      case 'webkit':
        this.browser = await webkit.launch(launchOptions);
        break;
      default:
        this.browser = await chromium.launch(launchOptions);
    }
    
    // Create context
    const viewport = options.viewport || { width: 1920, height: 1080 };
    this.context = await this.browser.newContext({
      viewport,
      userAgent: 'DeployDoctor-QA-Agent/1.0 (Playwright)'
    });
    
    // Create page
    this.page = await this.context.newPage();
    
    // Store mode for SSRF protection
    this.currentMode = options.mode;
    
    // Set up listeners
    this.setupErrorListeners();
    this.setupNetworkListeners();
  }
  
  /**
   * Navigate to a URL
   */
  async navigateTo(url: string, waitUntil: 'load' | 'domcontentloaded' | 'networkidle' = 'networkidle'): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    
    this.currentUrl = url;
    
    // Set up SSRF protection on first navigation
    if (!this.ssrfProtectionEnabled) {
      await setupPlaywrightSSRFProtection(this.page, url, this.currentMode);
      this.ssrfProtectionEnabled = true;
    }
    
    try {
      await this.page.goto(url, {
        waitUntil,
        timeout: 30000
      });
      
      // Give time for dynamic content
      await this.page.waitForTimeout(1000);
    } catch (error) {
      throw new Error(`Failed to navigate to ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get current page URL
   */
  getCurrentUrl(): string {
    return this.currentUrl;
  }
  
  /**
   * Take a screenshot
   */
  async takeScreenshot(name: string): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');
    
    const filename = `${Date.now()}-${name}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    
    await this.page.screenshot({ path: filepath, fullPage: false });
    
    return filepath;
  }
  
  /**
   * Get page title
   */
  async getPageTitle(): Promise<string> {
    if (!this.page) return '';
    return await this.page.title();
  }
  
  /**
   * Execute JavaScript in page context
   */
  async evaluateInPage<T>(fn: () => T | Promise<T>): Promise<T> {
    if (!this.page) throw new Error('Browser not initialized');
    return await this.page.evaluate(fn);
  }
  
  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    if (!this.page) return false;
    const element = await this.page.$(selector);
    return element !== null;
  }
  
  /**
   * Click an element
   */
  async clickElement(selector: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    
    try {
      await this.page.click(selector, { timeout: 5000 });
      await this.page.waitForTimeout(500); // Wait for any animations/transitions
    } catch (error) {
      throw new Error(`Failed to click ${selector}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Type text into an input
   */
  async typeText(selector: string, text: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    
    try {
      await this.page.fill(selector, text);
      await this.page.waitForTimeout(300);
    } catch (error) {
      throw new Error(`Failed to type into ${selector}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Select option from dropdown
   */
  async selectOption(selector: string, value: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    
    try {
      await this.page.selectOption(selector, value);
      await this.page.waitForTimeout(300);
    } catch (error) {
      throw new Error(`Failed to select option in ${selector}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get all runtime errors captured
   */
  getRuntimeErrors(): BrowserError[] {
    return [...this.runtimeErrors];
  }
  
  /**
   * Get all network failures
   */
  getNetworkFailures(): NetworkRequest[] {
    return [...this.networkFailures];
  }
  
  /**
   * Get all network requests
   */
  getNetworkRequests(): NetworkRequest[] {
    return [...this.networkRequests];
  }
  
  /**
   * Clear captured errors and requests (for new page tests)
   */
  clearCaptures(): void {
    this.runtimeErrors = [];
    this.networkRequests = [];
    this.networkFailures = [];
  }
  
  /**
   * Check for layout issues
   */
  async checkLayoutIssues(): Promise<string[]> {
    if (!this.page) return [];
    
    try {
      return await this.page.evaluate(() => {
        const issues: string[] = [];
        
        // Check for horizontal scroll
        if (document.body.scrollWidth > window.innerWidth) {
          issues.push('Unexpected horizontal scrolling detected');
        }
        
        // Check for elements outside viewport
        const allElements = document.querySelectorAll('*');
        let elementsOutside = 0;
        
        allElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > window.innerWidth + 50) {
            elementsOutside++;
          }
        });
        
        if (elementsOutside > 0) {
          issues.push(`${elementsOutside} elements extend beyond viewport`);
        }
        
        // Check for overlapping elements (sample check)
        const buttons = document.querySelectorAll('button, a');
        const positions = new Map<string, number>();
        
        buttons.forEach(btn => {
          const rect = btn.getBoundingClientRect();
          const key = `${Math.round(rect.top)}-${Math.round(rect.left)}`;
          positions.set(key, (positions.get(key) || 0) + 1);
        });
        
        const overlapping = Array.from(positions.values()).filter(count => count > 1).length;
        if (overlapping > 0) {
          issues.push(`Potentially overlapping interactive elements detected`);
        }
        
        return issues;
      });
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Set viewport size
   */
  async setViewport(viewport: { width: number; height: number }): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.setViewportSize(viewport);
    await this.page.waitForTimeout(500);
  }
  
  /**
   * Get browser info
   */
  async getBrowserInfo(): Promise<{ type: string; userAgent: string; viewport: { width: number; height: number } }> {
    if (!this.page) {
      return {
        type: 'unknown',
        userAgent: 'unknown',
        viewport: { width: 1920, height: 1080 }
      };
    }
    
    const userAgent = await this.page.evaluate(() => navigator.userAgent);
    const viewport = this.page.viewportSize() || { width: 1920, height: 1080 };
    
    return {
      type: this.browser?.browserType().name() || 'unknown',
      userAgent,
      viewport
    };
  }
  
  /**
   * Get page instance (for advanced operations)
   */
  getPage(): Page | null {
    return this.page;
  }
  
  /**
   * Close the browser and cleanup
   */
  async close(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
  
  /**
   * Set up error listeners
   */
  private setupErrorListeners(): void {
    if (!this.page) return;
    
    // Page errors (uncaught exceptions)
    this.page.on('pageerror', (error: Error) => {
      this.runtimeErrors.push({
        type: 'page-error',
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
    });
    
    // Console errors
    this.page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type();
      if (type === 'error') {
        this.runtimeErrors.push({
          type: 'console-error',
          message: msg.text(),
          level: 'error',
          timestamp: Date.now()
        });
      }
    });
  }
  
  /**
   * Set up network listeners
   */
  private setupNetworkListeners(): void {
    if (!this.page) return;
    
    // Track responses
    this.page.on('response', async (response) => {
      const request = response.request();
      const status = response.status();
      
      const networkRequest: NetworkRequest = {
        url: request.url(),
        method: request.method(),
        status,
        statusText: response.statusText(),
        failed: false,
        timestamp: Date.now(),
        resourceType: request.resourceType()
      };
      
      this.networkRequests.push(networkRequest);
      
      // Track failures (4xx, 5xx)
      if (status >= 400) {
        this.networkFailures.push(networkRequest);
      }
    });
    
    // Track request failures
    this.page.on('requestfailed', (request) => {
      const networkRequest: NetworkRequest = {
        url: request.url(),
        method: request.method(),
        failed: true,
        errorText: request.failure()?.errorText || 'Request failed',
        timestamp: Date.now(),
        resourceType: request.resourceType()
      };
      
      this.networkRequests.push(networkRequest);
      this.networkFailures.push(networkRequest);
    });
  }
}
