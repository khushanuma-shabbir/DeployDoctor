import { SourceMapConsumer } from 'source-map';
import type { SourceLocation } from '../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class SourceAnalyzer {
  
  async analyzeStackTrace(stackTrace: string): Promise<SourceLocation | undefined> {
    // Parse stack trace to extract file, line, column
    const parsed = this.parseStackTrace(stackTrace);
    if (!parsed) return undefined;
    
    // Try to resolve with source maps if available
    const mapped = await this.trySourceMap(parsed);
    if (mapped) return mapped;
    
    // Return raw location if source mapping failed
    return {
      file: parsed.file,
      line: parsed.line,
      column: parsed.column,
      resolved: false
    };
  }
  
  private parseStackTrace(stackTrace: string): { file: string; line: number; column: number } | null {
    // Handle various stack trace formats
    
    // Chrome/V8 format: "at functionName (file.js:line:column)"
    const chromeMatch = stackTrace.match(/at\s+(?:.*?\s+)?\(?([^)]+):(\d+):(\d+)\)?/);
    if (chromeMatch) {
      return {
        file: chromeMatch[1],
        line: parseInt(chromeMatch[2], 10),
        column: parseInt(chromeMatch[3], 10)
      };
    }
    
    // Firefox format: "functionName@file.js:line:column"
    const firefoxMatch = stackTrace.match(/(@.+):(\d+):(\d+)/);
    if (firefoxMatch) {
      return {
        file: firefoxMatch[1].substring(1), // Remove @
        line: parseInt(firefoxMatch[2], 10),
        column: parseInt(firefoxMatch[3], 10)
      };
    }
    
    // Generic format: "file.js:line:column"
    const genericMatch = stackTrace.match(/([^:\s]+):(\d+):(\d+)/);
    if (genericMatch) {
      return {
        file: genericMatch[1],
        line: parseInt(genericMatch[2], 10),
        column: parseInt(genericMatch[3], 10)
      };
    }
    
    return null;
  }
  
  private async trySourceMap(location: { file: string; line: number; column: number }): Promise<SourceLocation | undefined> {
    try {
      // Source maps are typically adjacent to the compiled file
      const sourceMapPath = `${location.file}.map`;
      
      // Try to read the source map
      const sourceMapContent = await this.readSourceMap(sourceMapPath);
      if (!sourceMapContent) return undefined;
      
      const consumer = await new SourceMapConsumer(sourceMapContent);
      
      const original = consumer.originalPositionFor({
        line: location.line,
        column: location.column
      });
      
      consumer.destroy();
      
      if (!original.source) return undefined;
      
      // Try to read the original source file
      const snippet = await this.readSourceSnippet(original.source, original.line || 0);
      
      return {
        file: original.source,
        line: original.line || undefined,
        column: original.column || undefined,
        snippet: snippet?.line,
        context: snippet?.context,
        resolved: true
      };
      
    } catch (error) {
      // Source mapping failed - this is expected in many cases
      return undefined;
    }
  }
  
  private async readSourceMap(filePath: string): Promise<any | null> {
    try {
      // For URLs, we can't read them directly in this MVP
      // In production, we'd need to fetch them
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        return null;
      }
      
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }
  
  private async readSourceSnippet(
    filePath: string, 
    line: number, 
    contextLines: number = 3
  ): Promise<{ line: string; context: string[] } | undefined> {
    try {
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        return undefined;
      }
      
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      if (line < 1 || line > lines.length) return undefined;
      
      const targetLine = lines[line - 1];
      const context: string[] = [];
      
      const start = Math.max(0, line - 1 - contextLines);
      const end = Math.min(lines.length, line + contextLines);
      
      for (let i = start; i < end; i++) {
        const prefix = i === line - 1 ? '→ ' : '  ';
        context.push(`${prefix}${i + 1}: ${lines[i]}`);
      }
      
      return {
        line: targetLine,
        context
      };
      
    } catch (error) {
      return undefined;
    }
  }
  
  /**
   * Safely read a source file and extract a code snippet
   * This prevents reading arbitrary files and exposing secrets
   */
  async readSafeSnippet(
    projectRoot: string,
    relativeFile: string,
    line: number
  ): Promise<string | undefined> {
    try {
      // Prevent path traversal
      const safePath = path.join(projectRoot, relativeFile);
      const normalized = path.normalize(safePath);
      
      if (!normalized.startsWith(path.normalize(projectRoot))) {
        // Attempted path traversal
        return undefined;
      }
      
      // Don't read sensitive files
      const basename = path.basename(normalized).toLowerCase();
      const sensitiveFiles = ['.env', 'secrets', 'credentials', '.key', '.pem'];
      if (sensitiveFiles.some(s => basename.includes(s))) {
        return undefined;
      }
      
      const snippet = await this.readSourceSnippet(normalized, line);
      return snippet?.context.join('\n');
      
    } catch (error) {
      return undefined;
    }
  }
}
