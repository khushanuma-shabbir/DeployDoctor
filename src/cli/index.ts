#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { Scanner } from '../scanner/scanner.js';
import type { ScanOptions } from '../types/index.js';

const program = new Command();

program
  .name('deploydoctor')
  .description('A developer-focused debugging assistant for React applications')
  .version('1.0.0');

// Scan command
program
  .command('scan')
  .description('Scan a URL for errors and issues')
  .requiredOption('--url <url>', 'URL to scan (e.g., http://localhost:5173 or https://example.com)')
  .option('--timeout <seconds>', 'Timeout in seconds', '30')
  .option('--root <selector>', 'React root selector', '#root')
  .action(async (options) => {
    const url = options.url;
    
    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      console.error(chalk.red('✗ Invalid URL:'), url);
      process.exit(1);
    }
    
    // Determine mode
    const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
    const mode = isLocal ? 'local' : 'production';
    
    console.log(chalk.blue.bold('\n🩺 DeployDoctor'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.white(`URL:     ${url}`));
    console.log(chalk.white(`Mode:    ${mode}`));
    console.log(chalk.white(`Timeout: ${options.timeout}s`));
    console.log(chalk.gray('─'.repeat(50)) + '\n');
    
    const spinner = ora('Starting browser...').start();
    
    const scanner = new Scanner();
    
    try {
      spinner.text = 'Loading page...';
      
      const scanOptions: ScanOptions = {
        url,
        mode,
        timeout: parseInt(options.timeout, 10),
        rootSelector: options.root,
        takeScreenshot: true
      };
      
      const result = await scanner.scan(scanOptions);
      
      spinner.stop();
      
      // Display results
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.bold('\n📊 Scan Results\n'));
      
      // Health status
      const statusIcon = getStatusIcon(result.healthStatus);
      const statusColor = getStatusColor(result.healthStatus);
      console.log(chalk.bold('Overall Status: ') + chalk[statusColor](statusIcon + ' ' + result.healthStatus.toUpperCase()));
      console.log(chalk.gray(`Scan ID: ${result.id}`));
      console.log(chalk.gray(`Duration: ${result.duration}ms`));
      console.log();
      
      // White screen analysis
      if (result.whiteScreenAnalysis.isWhiteScreen) {
        console.log(chalk.red.bold('⚠ WHITE SCREEN DETECTED'));
        console.log(chalk.gray(`Confidence: ${(result.whiteScreenAnalysis.confidence * 100).toFixed(0)}%`));
        console.log();
      }
      
      // Issues
      const issues = result.diagnoses.filter(d => d.severity !== 'healthy');
      
      if (issues.length === 0) {
        console.log(chalk.green('✓ No critical issues detected'));
        console.log(chalk.gray('  The application appears to be running normally'));
      } else {
        console.log(chalk.bold(`Found ${issues.length} issue${issues.length > 1 ? 's' : ''}:\n`));
        
        issues.forEach((diagnosis, index) => {
          const icon = getSeverityIcon(diagnosis.severity);
          const color = getSeverityColor(diagnosis.severity);
          
          console.log(chalk[color](`${icon} ${diagnosis.title}`));
          console.log(chalk.gray(`  Category: ${diagnosis.category}`));
          console.log(chalk.white(`  ${diagnosis.description}`));
          
          if (diagnosis.likelyCause) {
            console.log(chalk.yellow(`  → ${diagnosis.likelyCause}`));
          }
          
          if (diagnosis.sourceLocation && diagnosis.sourceLocation.resolved) {
            console.log(chalk.cyan(`  📍 ${diagnosis.sourceLocation.file}:${diagnosis.sourceLocation.line}:${diagnosis.sourceLocation.column}`));
          }
          
          console.log();
        });
      }
      
      // Failed requests summary
      if (result.failedRequests.length > 0) {
        console.log(chalk.yellow.bold(`\n🌐 Network Issues (${result.failedRequests.length}):\n`));
        result.failedRequests.slice(0, 5).forEach(req => {
          const status = req.status ? `${req.status}` : 'FAILED';
          console.log(chalk.gray(`  ${req.method} ${status} ${truncateURL(req.url)}`));
        });
        if (result.failedRequests.length > 5) {
          console.log(chalk.gray(`  ... and ${result.failedRequests.length - 5} more`));
        }
        console.log();
      }
      
      // Browser errors summary
      const criticalErrors = result.browserErrors.filter(e => e.type === 'page-error');
      if (criticalErrors.length > 0) {
        console.log(chalk.red.bold(`\n💥 Runtime Errors (${criticalErrors.length}):\n`));
        criticalErrors.slice(0, 3).forEach(err => {
          console.log(chalk.gray(`  ${err.message}`));
        });
        if (criticalErrors.length > 3) {
          console.log(chalk.gray(`  ... and ${criticalErrors.length - 3} more`));
        }
        console.log();
      }
      
      // Screenshot
      if (result.screenshotPath) {
        console.log(chalk.gray(`📸 Screenshot saved: ${result.screenshotPath}`));
      }
      
      // Report
      console.log(chalk.gray(`📄 Report saved: reports/${result.id}.json`));
      
      console.log(chalk.gray('\n' + '─'.repeat(50)));
      console.log(chalk.white('\n💡 View detailed results in the dashboard:'));
      console.log(chalk.cyan('   npm start'));
      console.log(chalk.cyan('   Open http://localhost:3000\n'));
      
      await scanner.close();
      
      // Exit code based on health status
      if (result.healthStatus === 'critical') {
        process.exit(1);
      } else if (result.healthStatus === 'warning') {
        process.exit(0); // Warnings don't fail the build
      } else {
        process.exit(0);
      }
      
    } catch (error) {
      spinner.fail('Scan failed');
      console.error(chalk.red('\n✗ Error:'), error instanceof Error ? error.message : String(error));
      await scanner.close();
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List all previous scans')
  .option('-l, --limit <number>', 'Number of scans to show', '20')
  .action(async (options) => {
    const scanner = new Scanner();
    const scans = scanner.getAllScans(parseInt(options.limit, 10));
    
    if (scans.length === 0) {
      console.log(chalk.yellow('No scans found. Run a scan first:'));
      console.log(chalk.cyan('  deploydoctor scan --url http://localhost:5173'));
      process.exit(0);
    }
    
    console.log(chalk.blue.bold('\n🩺 DeployDoctor - Scan History\n'));
    console.log(chalk.gray('─'.repeat(80)));
    
    scans.forEach(scan => {
      const date = new Date(scan.timestamp).toLocaleString();
      const statusIcon = getStatusIcon(scan.healthStatus);
      const statusColor = getStatusColor(scan.healthStatus);
      
      console.log(chalk.bold(`\n${statusIcon} ${scan.id}`));
      console.log(chalk.gray(`   ${date}`));
      console.log(chalk.white(`   ${scan.url}`));
      console.log(chalk[statusColor](`   Status: ${scan.healthStatus.toUpperCase()}`));
      console.log(chalk.gray(`   Issues: ${scan.issueCount.critical} critical, ${scan.issueCount.warning} warnings`));
    });
    
    console.log(chalk.gray('\n' + '─'.repeat(80) + '\n'));
    
    scanner.close();
  });

// Show command
program
  .command('show <scan-id>')
  .description('Show detailed results for a specific scan')
  .action(async (scanId) => {
    const scanner = new Scanner();
    const result = scanner.getScan(scanId);
    
    if (!result) {
      console.error(chalk.red(`✗ Scan not found: ${scanId}`));
      process.exit(1);
    }
    
    console.log(chalk.blue.bold('\n🩺 DeployDoctor - Scan Details\n'));
    console.log(chalk.gray('─'.repeat(80)));
    console.log(chalk.bold(`\nScan ID: ${result.id}`));
    console.log(chalk.gray(`Date: ${new Date(result.timestamp).toLocaleString()}`));
    console.log(chalk.white(`URL: ${result.url}`));
    console.log(chalk.white(`Mode: ${result.mode}`));
    
    const statusIcon = getStatusIcon(result.healthStatus);
    const statusColor = getStatusColor(result.healthStatus);
    console.log(chalk[statusColor](`Status: ${statusIcon} ${result.healthStatus.toUpperCase()}`));
    
    console.log(chalk.bold('\n📋 Diagnoses:\n'));
    
    result.diagnoses.forEach(diagnosis => {
      const icon = getSeverityIcon(diagnosis.severity);
      const color = getSeverityColor(diagnosis.severity);
      
      console.log(chalk[color](`${icon} ${diagnosis.title}`));
      console.log(chalk.white(`   ${diagnosis.description}`));
      console.log(chalk.yellow(`   ${diagnosis.likelyCause}`));
      
      if (diagnosis.sourceLocation) {
        console.log(chalk.cyan(`   Location: ${diagnosis.sourceLocation.file}:${diagnosis.sourceLocation.line}`));
      }
      
      console.log();
    });
    
    console.log(chalk.gray('─'.repeat(80) + '\n'));
    
    scanner.close();
  });

// Stats command
program
  .command('stats')
  .description('Show scan statistics')
  .action(async () => {
    const scanner = new Scanner();
    const stats = scanner.getStats();
    
    console.log(chalk.blue.bold('\n🩺 DeployDoctor - Statistics\n'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.white(`Total Scans:    ${stats.totalScans}`));
    console.log(chalk.green(`Healthy:        ${stats.healthyScans}`));
    console.log(chalk.yellow(`Warnings:       ${stats.warningScans}`));
    console.log(chalk.red(`Critical:       ${stats.criticalScans}`));
    console.log(chalk.gray('─'.repeat(50) + '\n'));
    
    scanner.close();
  });

program.parse();

// Helper functions

function getStatusIcon(status: string): string {
  switch (status) {
    case 'healthy': return '✓';
    case 'warning': return '⚠';
    case 'critical': return '✗';
    default: return '?';
  }
}

function getStatusColor(status: string): 'green' | 'yellow' | 'red' | 'gray' {
  switch (status) {
    case 'healthy': return 'green';
    case 'warning': return 'yellow';
    case 'critical': return 'red';
    default: return 'gray';
  }
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'warning': return '🟡';
    case 'info': return '🔵';
    case 'healthy': return '🟢';
    default: return '⚪';
  }
}

function getSeverityColor(severity: string): 'red' | 'yellow' | 'blue' | 'green' | 'gray' {
  switch (severity) {
    case 'critical': return 'red';
    case 'warning': return 'yellow';
    case 'info': return 'blue';
    case 'healthy': return 'green';
    default: return 'gray';
  }
}

function truncateURL(url: string, max: number = 60): string {
  if (url.length <= max) return url;
  return url.substring(0, max - 3) + '...';
}
