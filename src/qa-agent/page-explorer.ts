import type { QADiscoveredPage, QADiscoveredElement, QAFormDiscovery } from '../types/index.js';
import { QABrowserAgent } from './qa-browser-agent.js';

/**
 * Page Explorer - Discovers pages and interactive elements
 * 
 * Responsibilities:
 * - Explore page structure
 * - Identify interactive elements (buttons, links, forms)
 * - Collect element metadata
 * - Discover navigation paths
 */
export class PageExplorer {
  constructor(private browserAgent: QABrowserAgent) {}
  
  /**
   * Explore a page and discover all testable elements
   */
  async explorePage(url: string): Promise<QADiscoveredPage> {
    const page = this.browserAgent.getPage();
    if (!page) throw new Error('Browser not initialized');
    
    const title = await this.browserAgent.getPageTitle();
    
    // Discover all interactive elements
    const elements = await page.evaluate(() => {
      const discovered: any[] = [];
      
      // Helper to check visibility
      const isVisible = (el: Element): boolean => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0';
      };
      
      // Helper to check if element is enabled
      const isEnabled = (el: Element): boolean => {
        return !(el as HTMLButtonElement | HTMLInputElement).disabled;
      };
      
      // Helper to get unique selector
      const getSelector = (el: Element): string => {
        if (el.id) return `#${el.id}`;
        
        const classes = Array.from(el.classList).join('.');
        if (classes) {
          const selector = `${el.tagName.toLowerCase()}.${classes}`;
          if (document.querySelectorAll(selector).length === 1) {
            return selector;
          }
        }
        
        // Fallback: use index-based selector
        let index = 0;
        let sibling = el.previousElementSibling;
        while (sibling) {
          if (sibling.tagName === el.tagName) index++;
          sibling = sibling.previousElementSibling;
        }
        
        return `${el.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
      };
      
      // Discover buttons
      document.querySelectorAll('button').forEach(button => {
        const rect = button.getBoundingClientRect();
        discovered.push({
          type: 'button',
          selector: getSelector(button),
          text: button.textContent?.trim() || button.getAttribute('aria-label') || '',
          visible: isVisible(button),
          enabled: isEnabled(button),
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        });
      });
      
      // Discover links
      document.querySelectorAll('a[href]').forEach(link => {
        const rect = link.getBoundingClientRect();
        discovered.push({
          type: 'link',
          selector: getSelector(link),
          text: link.textContent?.trim() || '',
          href: (link as HTMLAnchorElement).href,
          visible: isVisible(link),
          enabled: true,
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        });
      });
      
      // Discover inputs
      document.querySelectorAll('input, textarea').forEach(input => {
        const rect = input.getBoundingClientRect();
        const inputEl = input as HTMLInputElement;
        discovered.push({
          type: 'input',
          selector: getSelector(input),
          text: inputEl.placeholder || inputEl.name || '',
          visible: isVisible(input),
          enabled: isEnabled(input),
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        });
      });
      
      // Discover selects
      document.querySelectorAll('select').forEach(select => {
        const rect = select.getBoundingClientRect();
        discovered.push({
          type: 'select',
          selector: getSelector(select),
          text: (select as HTMLSelectElement).name || '',
          visible: isVisible(select),
          enabled: isEnabled(select),
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        });
      });
      
      return discovered;
    });
    
    // Discover forms
    const forms = await this.discoverForms();
    
    // Check for errors on page
    const hasErrors = (await this.browserAgent.getRuntimeErrors()).length > 0 ||
                      (await this.browserAgent.getNetworkFailures()).length > 0;
    
    return {
      url,
      title,
      discovered: Date.now(),
      tested: false,
      elements: elements as QADiscoveredElement[],
      forms,
      hasErrors
    };
  }
  
  /**
   * Discover forms and their structure
   */
  private async discoverForms(): Promise<QAFormDiscovery[]> {
    const page = this.browserAgent.getPage();
    if (!page) return [];
    
    return await page.evaluate(() => {
      const forms: any[] = [];
      
      document.querySelectorAll('form').forEach((form, index) => {
        const inputs: any[] = [];
        
        form.querySelectorAll('input, textarea, select').forEach(input => {
          const inputEl = input as HTMLInputElement;
          inputs.push({
            type: inputEl.type || 'text',
            name: inputEl.name || '',
            required: inputEl.required || false,
            placeholder: inputEl.placeholder || ''
          });
        });
        
        const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
        
        forms.push({
          selector: form.id ? `#${form.id}` : `form:nth-of-type(${index + 1})`,
          action: (form as HTMLFormElement).action || undefined,
          method: (form as HTMLFormElement).method || 'get',
          inputs,
          submitButton: submitButton ? submitButton.textContent?.trim() || 'Submit' : undefined
        });
      });
      
      return forms;
    });
  }
  
  /**
   * Get visible interactive elements only
   */
  getVisibleElements(page: QADiscoveredPage): QADiscoveredElement[] {
    return page.elements.filter(el => el.visible && el.enabled);
  }
  
  /**
   * Get testable links (same origin, not anchors)
   */
  getTestableLinks(page: QADiscoveredPage, baseUrl: string): QADiscoveredElement[] {
    const baseOrigin = new URL(baseUrl).origin;
    
    return page.elements.filter(el => {
      if (el.type !== 'link' || !el.href) return false;
      if (!el.visible || !el.enabled) return false;
      
      try {
        const linkUrl = new URL(el.href);
        // Same origin and not an anchor link
        return linkUrl.origin === baseOrigin && !el.href.includes('#');
      } catch {
        return false;
      }
    });
  }
  
  /**
   * Get testable buttons
   */
  getTestableButtons(page: QADiscoveredPage): QADiscoveredElement[] {
    return page.elements.filter(el => 
      el.type === 'button' && el.visible && el.enabled
    );
  }
  
  /**
   * Get testable forms
   */
  getTestableForms(page: QADiscoveredPage): QAFormDiscovery[] {
    return page.forms;
  }
}
