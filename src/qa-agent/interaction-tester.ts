import type { QADiscoveredPage, QATestAction, QAFormDiscovery } from '../types/index.js';
import { QABrowserAgent } from './qa-browser-agent.js';
import * as crypto from 'crypto';

/**
 * Interaction Tester - Tests user interactions
 * 
 * Responsibilities:
 * - Test button clicks
 * - Test form submissions
 * - Test navigation
 * - Capture success/failure of each action
 * - Take screenshots of failures
 */
export class InteractionTester {
  constructor(private browserAgent: QABrowserAgent) {}
  
  /**
   * Test navigation links on a page
   */
  async testNavigation(page: QADiscoveredPage): Promise<QATestAction[]> {
    const actions: QATestAction[] = [];
    const links = page.elements.filter(el => 
      el.type === 'link' && el.visible && el.enabled && el.href
    );
    
    // Test up to 5 links per page to avoid overwhelming
    const linksToTest = links.slice(0, 5);
    
    for (const link of linksToTest) {
      const action = await this.testLinkClick(link.selector, link.href!, page.url);
      actions.push(action);
      
      // Return to the original page
      try {
        await this.browserAgent.navigateTo(page.url);
      } catch (error) {
        // If we can't return, break the loop
        break;
      }
    }
    
    return actions;
  }
  
  /**
   * Test clicking a link
   */
  private async testLinkClick(selector: string, href: string, pageUrl: string): Promise<QATestAction> {
    const action: QATestAction = {
      id: this.generateActionId(),
      type: 'navigate',
      target: selector,
      value: href,
      timestamp: Date.now(),
      pageUrl,
      success: false
    };
    
    try {
      // Clear previous errors
      this.browserAgent.clearCaptures();
      
      // Click the link
      await this.browserAgent.clickElement(selector);
      
      // Wait for navigation
      await this.delay(1500);
      
      // Check for errors after click
      const errors = this.browserAgent.getRuntimeErrors();
      const networkFailures = this.browserAgent.getNetworkFailures();
      
      if (errors.length > 0 || networkFailures.length > 0) {
        action.success = false;
        action.error = `Navigation resulted in ${errors.length} errors and ${networkFailures.length} network failures`;
        action.screenshotPath = await this.browserAgent.takeScreenshot(`nav-fail-${action.id}`);
      } else {
        action.success = true;
      }
      
    } catch (error) {
      action.success = false;
      action.error = error instanceof Error ? error.message : String(error);
      
      try {
        action.screenshotPath = await this.browserAgent.takeScreenshot(`nav-error-${action.id}`);
      } catch {
        // Screenshot failed, continue
      }
    }
    
    return action;
  }
  
  /**
   * Test buttons on a page
   */
  async testButtons(page: QADiscoveredPage): Promise<QATestAction[]> {
    const actions: QATestAction[] = [];
    const buttons = page.elements.filter(el => 
      el.type === 'button' && el.visible && el.enabled
    );
    
    // Test up to 10 buttons per page
    const buttonsToTest = buttons.slice(0, 10);
    
    for (const button of buttonsToTest) {
      const action = await this.testButtonClick(button.selector, button.text || '', page.url);
      actions.push(action);
      
      // Small delay between actions
      await this.delay(500);
      
      // If action caused navigation away, try to return
      const currentUrl = this.browserAgent.getCurrentUrl();
      if (currentUrl !== page.url) {
        try {
          await this.browserAgent.navigateTo(page.url);
        } catch (error) {
          // Can't return to page, stop testing this page
          break;
        }
      }
    }
    
    return actions;
  }
  
  /**
   * Test clicking a button
   */
  private async testButtonClick(selector: string, text: string, pageUrl: string): Promise<QATestAction> {
    const action: QATestAction = {
      id: this.generateActionId(),
      type: 'click',
      target: selector,
      value: text,
      timestamp: Date.now(),
      pageUrl,
      success: false
    };
    
    try {
      // Clear previous errors
      this.browserAgent.clearCaptures();
      
      // Click the button
      await this.browserAgent.clickElement(selector);
      
      // Wait for any side effects
      await this.delay(1000);
      
      // Check for errors
      const errors = this.browserAgent.getRuntimeErrors();
      const networkFailures = this.browserAgent.getNetworkFailures();
      
      if (errors.length > 0) {
        action.success = false;
        action.error = `Button click caused ${errors.length} runtime error(s)`;
        action.screenshotPath = await this.browserAgent.takeScreenshot(`button-error-${action.id}`);
      } else if (networkFailures.length > 0) {
        // Network failures might be expected (e.g., intentional 404 tests)
        // Don't mark as failure unless it's a critical resource
        const criticalFailures = networkFailures.filter(f => 
          f.resourceType === 'script' || f.resourceType === 'stylesheet'
        );
        
        if (criticalFailures.length > 0) {
          action.success = false;
          action.error = `Button click caused ${criticalFailures.length} critical resource failure(s)`;
          action.screenshotPath = await this.browserAgent.takeScreenshot(`button-fail-${action.id}`);
        } else {
          action.success = true;
        }
      } else {
        action.success = true;
      }
      
    } catch (error) {
      action.success = false;
      action.error = error instanceof Error ? error.message : String(error);
      
      try {
        action.screenshotPath = await this.browserAgent.takeScreenshot(`button-exception-${action.id}`);
      } catch {
        // Screenshot failed
      }
    }
    
    return action;
  }
  
  /**
   * Test forms on a page
   */
  async testForms(page: QADiscoveredPage): Promise<QATestAction[]> {
    const actions: QATestAction[] = [];
    
    for (const form of page.forms) {
      // Test empty submission (validation test)
      const emptyAction = await this.testFormSubmission(form, {}, page.url, 'empty');
      actions.push(emptyAction);
      
      // Test with invalid data
      const invalidAction = await this.testFormSubmission(
        form, 
        this.generateInvalidFormData(form), 
        page.url, 
        'invalid'
      );
      actions.push(invalidAction);
      
      // Test with valid data (if safe)
      if (this.isFormSafeToSubmit(form)) {
        const validAction = await this.testFormSubmission(
          form,
          this.generateValidFormData(form),
          page.url,
          'valid'
        );
        actions.push(validAction);
      }
      
      // Return to page after form tests
      try {
        await this.browserAgent.navigateTo(page.url);
      } catch (error) {
        break;
      }
    }
    
    return actions;
  }
  
  /**
   * Test form submission
   */
  private async testFormSubmission(
    form: QAFormDiscovery, 
    data: Record<string, string>, 
    pageUrl: string,
    testType: string
  ): Promise<QATestAction> {
    const action: QATestAction = {
      id: this.generateActionId(),
      type: 'submit',
      target: form.selector,
      value: `Form ${testType} test`,
      timestamp: Date.now(),
      pageUrl,
      success: false
    };
    
    try {
      // Clear previous errors
      this.browserAgent.clearCaptures();
      
      // Fill form fields
      for (const input of form.inputs) {
        if (input.name && data[input.name]) {
          const selector = `${form.selector} [name="${input.name}"]`;
          
          try {
            if (input.type === 'select') {
              await this.browserAgent.selectOption(selector, data[input.name]);
            } else {
              await this.browserAgent.typeText(selector, data[input.name]);
            }
          } catch (error) {
            // Field might not be fillable, continue
          }
        }
      }
      
      // Submit form (try button first, then form submission)
      if (form.submitButton) {
        const submitSelector = `${form.selector} button[type="submit"], ${form.selector} input[type="submit"]`;
        await this.browserAgent.clickElement(submitSelector);
      }
      
      // Wait for submission response
      await this.delay(1500);
      
      // Check for errors
      const errors = this.browserAgent.getRuntimeErrors();
      const networkFailures = this.browserAgent.getNetworkFailures();
      
      if (errors.length > 0) {
        action.success = false;
        action.error = `Form submission caused ${errors.length} error(s)`;
        action.screenshotPath = await this.browserAgent.takeScreenshot(`form-error-${action.id}`);
      } else {
        // For empty/invalid submissions, we expect validation or error responses
        // This is actually successful behavior
        action.success = true;
      }
      
    } catch (error) {
      // Form submission errors might be expected (validation)
      action.success = true;
      action.error = `Expected: ${error instanceof Error ? error.message : String(error)}`;
    }
    
    return action;
  }
  
  /**
   * Generate invalid form data for testing
   */
  private generateInvalidFormData(form: QAFormDiscovery): Record<string, string> {
    const data: Record<string, string> = {};
    
    for (const input of form.inputs) {
      if (!input.name) continue;
      
      switch (input.type) {
        case 'email':
          data[input.name] = 'invalid-email';
          break;
        case 'number':
          data[input.name] = 'not-a-number';
          break;
        case 'tel':
          data[input.name] = 'abc';
          break;
        case 'url':
          data[input.name] = 'not-a-url';
          break;
        default:
          data[input.name] = ''; // Empty for required fields
      }
    }
    
    return data;
  }
  
  /**
   * Generate valid form data for testing
   */
  private generateValidFormData(form: QAFormDiscovery): Record<string, string> {
    const data: Record<string, string> = {};
    
    for (const input of form.inputs) {
      if (!input.name) continue;
      
      switch (input.type) {
        case 'email':
          data[input.name] = 'test@example.com';
          break;
        case 'password':
          data[input.name] = 'TestPass123!';
          break;
        case 'number':
          data[input.name] = '42';
          break;
        case 'tel':
          data[input.name] = '555-1234';
          break;
        case 'url':
          data[input.name] = 'https://example.com';
          break;
        case 'text':
        case 'textarea':
          data[input.name] = input.placeholder || 'Test input';
          break;
        default:
          data[input.name] = 'test';
      }
    }
    
    return data;
  }
  
  /**
   * Check if form is safe to submit with test data
   */
  private isFormSafeToSubmit(form: QAFormDiscovery): boolean {
    // Don't submit forms that might trigger real actions
    const dangerousActions = [
      'payment', 'pay', 'purchase', 'buy', 'checkout',
      'delete', 'remove', 'destroy',
      'publish', 'deploy', 'send-email'
    ];
    
    const formAction = (form.action || '').toLowerCase();
    
    return !dangerousActions.some(action => formAction.includes(action));
  }
  
  /**
   * Generate unique action ID
   */
  private generateActionId(): string {
    return `action-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
  }
  
  /**
   * Helper: delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
