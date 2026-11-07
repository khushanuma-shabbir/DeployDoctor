import type { 
  WhiteScreenAnalysis, 
  PageState, 
  BrowserError, 
  NetworkRequest,
  HealthStatus 
} from '../types/index.js';

export class WhiteScreenDetector {
  
  detect(
    pageState: PageState,
    browserErrors: BrowserError[],
    failedRequests: NetworkRequest[],
    screenshotBuffer?: Buffer
  ): WhiteScreenAnalysis {
    
    const signals = {
      blankScreenshot: this.isScreenshotBlank(screenshotBuffer),
      missingRoot: !pageState.hasRootElement,
      emptyRoot: pageState.hasRootElement && !pageState.rootContent && pageState.bodyHTML.length < 100,
      noContent: pageState.bodyHTML.length < 50,
      hasUncaughtErrors: browserErrors.some(e => e.type === 'page-error'),
      hasFailedBundles: failedRequests.some(r => 
        r.resourceType === 'script' && (r.url.includes('.js') || r.url.includes('bundle'))
      )
    };
    
    // Calculate confidence based on multiple signals
    let confidence = 0;
    let positiveSignals = 0;
    
    if (signals.blankScreenshot) {
      positiveSignals++;
      confidence += 0.25;
    }
    
    if (signals.missingRoot) {
      positiveSignals++;
      confidence += 0.3;
    } else if (signals.emptyRoot) {
      positiveSignals++;
      confidence += 0.25;
    }
    
    if (signals.noContent) {
      positiveSignals++;
      confidence += 0.2;
    }
    
    if (signals.hasUncaughtErrors) {
      positiveSignals++;
      confidence += 0.3;
    }
    
    if (signals.hasFailedBundles) {
      positiveSignals++;
      confidence += 0.4;
    }
    
    // Normalize confidence
    confidence = Math.min(confidence, 1.0);
    
    // Determine if it's a white screen
    // Need at least 2 signals or 1 very strong signal (failed bundles or missing root)
    const isWhiteScreen = 
      positiveSignals >= 2 || 
      signals.hasFailedBundles || 
      signals.missingRoot;
    
    // Determine status
    let status: HealthStatus;
    if (isWhiteScreen && confidence > 0.7) {
      status = 'critical';
    } else if (isWhiteScreen || positiveSignals >= 1) {
      status = 'warning';
    } else {
      status = 'healthy';
    }
    
    return {
      isWhiteScreen,
      confidence,
      signals,
      status
    };
  }
  
  private isScreenshotBlank(buffer?: Buffer): boolean {
    if (!buffer) return false;
    
    // Simple heuristic: very small screenshots are likely blank
    // A more sophisticated approach would analyze pixel data
    // For MVP, we'll use size as a proxy
    const sizeKB = buffer.length / 1024;
    
    // Blank/white screenshots are typically very small (< 10KB for 1920x1080)
    // This is a rough heuristic and could be improved with actual image analysis
    return sizeKB < 15;
  }
}
