import { chromium, Browser, Page, ConsoleMessage, Request, Response } from 'playwright';
import type { BrowserError, NetworkRequest, PageState, ScanOptions } from '../types/index.js';

export interface MonitorResult {
  pageState: PageState;
  browserErrors: BrowserError[];
  networkRequests: NetworkRequest[];
  failedRequests: NetworkRequest[];
  screenshotBuffer?: Buffer;
  userAgent: string;
  success: boolean;
  error?: string;
}

export class BrowserMonitor {
  private browser: Browser | null = null;
  private page: Page | null = null;
  
  private errors: BrowserError[] = [];
  private requests: NetworkRequest[] = [];
  
  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  
  async scan(options: ScanOptions): Promise<MonitorResult> {
    if (!this.browser) {
      await this.initialize();
    }
    
    this.errors = [];
    this.requests = [];
    
    const context = await this.browser!.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'DeployDoctor/1.0 (Playwright)'
    });
    
    this.page = await context.newPage();
    
    // Set up error listeners
    this.setupErrorListeners();
    this.setupNetworkListeners();
    
    const timeout = (options.timeout || 30) * 1000;
    
    try {
      // Navigate to the URL
      await this.page!.goto(options.url, {
        waitUntil: 'networkidle',
        timeout
      });
      
      // Give React time to render
      await this.page!.waitForTimeout(2000);
      
      // Capture page state
      const pageState = await this.capturePageState(options.rootSelector || '#root');
      
      // Take screenshot if requested
      let screenshotBuffer: Buffer | undefined;
      if (options.takeScreenshot !== false) {
        screenshotBuffer = await this.page!.screenshot({ fullPage: false });
      }
      
      const userAgent = await this.page!.evaluate(() => navigator.userAgent);
      
      await context.close();
      
      return {
        pageState,
        browserErrors: this.errors,
        networkRequests: this.requests,
        failedRequests: this.requests.filter(r => r.failed || (r.status && r.status >= 400)),
        screenshotBuffer,
        userAgent,
        success: true
      };
      
    } catch (error) {
      await context.close();
      
      return {
        pageState: this.getErrorPageState(options.url),
        browserErrors: this.errors,
        networkRequests: this.requests,
        failedRequests: this.requests,
        userAgent: 'unknown',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  private setupErrorListeners(): void {
    if (!this.page) return;
    
    // Page errors (uncaught exceptions)
    this.page.on('pageerror', (error: Error) => {
      this.errors.push({
        type: 'page-error',
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
    });
    
    // Console errors
    this.page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        this.errors.push({
          type: 'console-error',
          message: msg.text(),
          level: type as 'error' | 'warning',
          timestamp: Date.now()
        });
      }
    });
  }
  
  private setupNetworkListeners(): void {
    if (!this.page) return;
    
    this.page.on('request', (request: Request) => {
      // Track all requests
    });
    
    this.page.on('response', async (response: Response) => {
      const request = response.request();
      const status = response.status();
      
      this.requests.push({
        url: request.url(),
        method: request.method(),
        status,
        statusText: response.statusText(),
        failed: false,
        timestamp: Date.now(),
        resourceType: request.resourceType()
      });
    });
    
    this.page.on('requestfailed', (request: Request) => {
      this.requests.push({
        url: request.url(),
        method: request.method(),
        failed: true,
        errorText: request.failure()?.errorText || 'Request failed',
        timestamp: Date.now(),
        resourceType: request.resourceType()
      });
    });
  }
  
  private async capturePageState(rootSelector: string): Promise<PageState> {
    if (!this.page) {
      return this.getErrorPageState('unknown');
    }
    
    try {
      const state = await this.page.evaluate((selector) => {
        const root = document.querySelector(selector);
        const title = document.title;
        const url = window.location.href;
        
        return {
          title,
          url,
          hasRootElement: !!root,
          rootContent: root ? root.textContent?.trim() || '' : '',
          rootHTML: root ? root.innerHTML.substring(0, 1000) : '',
          bodyHTML: document.body.innerHTML.substring(0, 2000),
          bodyText: document.body.textContent?.trim() || ''
        };
      }, rootSelector);
      
      const isBlank = this.isPageBlank(state);
      
      return {
        title: state.title,
        url: state.url,
        hasRootElement: state.hasRootElement,
        rootSelector,
        rootContent: state.rootContent,
        bodyHTML: state.bodyHTML,
        isBlank,
        timestamp: Date.now()
      };
      
    } catch (error) {
      return this.getErrorPageState(rootSelector);
    }
  }
  
  private isPageBlank(state: any): boolean {
    // Multiple signals for blank page
    if (!state.hasRootElement) return true;
    if (!state.rootContent && !state.rootHTML) return true;
    if (state.bodyText.length < 10) return true;
    return false;
  }
  
  private getErrorPageState(url: string): PageState {
    return {
      title: '',
      url,
      hasRootElement: false,
      rootSelector: '#root',
      rootContent: '',
      bodyHTML: '',
      isBlank: true,
      timestamp: Date.now()
    };
  }
  
  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
