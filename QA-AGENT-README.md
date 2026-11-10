# 🤖 Autonomous QA Agent - DeployDoctor

## Overview

The Autonomous QA Agent is an intelligent software testing agent that automatically finds bugs in your web applications. It behaves like an experienced human QA tester, exploring your application, testing interactions, and generating detailed bug reports.

## Features

### What the QA Agent Tests

✅ **Functional Testing**
- Button clicks and interactions
- Navigation links
- Form submissions and validation
- Dropdown selectors
- Input fields
- User workflows

✅ **UI/Layout Testing**
- Responsive layouts (mobile, tablet, desktop)
- Layout issues and overlapping elements
- Missing or broken images
- Elements outside viewport
- Unexpected horizontal scrolling

✅ **JavaScript/Runtime Testing**
- Uncaught JavaScript exceptions
- Console errors
- Runtime failures
- Stack trace analysis
- Source location mapping

✅ **API/Network Testing**
- Failed API requests
- HTTP 400/500 errors
- Missing assets (JS, CSS)
- Network timeouts
- CORS issues

✅ **Navigation Testing**
- Route testing
- Broken links
- Navigation errors
- Page refresh behavior

✅ **User Experience Testing**
- Form validation
- Error messages
- Empty states
- Loading states

### What the Agent Does NOT Do

❌ Does not modify your application code
❌ Does not delete files or data
❌ Does not submit real payments
❌ Does not send emails or messages
❌ Does not change production settings
❌ Does not perform destructive actions

## Getting Started

### 1. Start the Server

```powershell
npm start
```

The dashboard will be available at `http://localhost:3001`

### 2. Navigate to QA Agent

Click "QA Agent" in the navigation menu

### 3. Configure Testing Session

- **Application URL**: Enter the URL you want to test (e.g., `http://localhost:5173`)
- **Testing Scope**: Choose how thorough the testing should be
  - **Quick**: 5-10 minutes, tests 5 pages, 20 actions
  - **Standard**: 15-30 minutes, tests 15 pages, 50 actions
  - **Thorough**: 30+ minutes, tests 30 pages, 100 actions

- **Testing Options**:
  - ☑ Test Navigation Links
  - ☑ Test Forms and Inputs
  - ☑ Test Responsive Layouts (Mobile/Tablet/Desktop)

### 4. Start Testing

Click "🚀 Start Testing" and the agent will begin working autonomously.

You can close the page and come back later - testing continues in the background.

### 5. View Results

When testing completes, click "📊 View Full Report" to see:
- Overall application health
- Bugs found with severity levels
- Detailed reproduction steps
- Root cause analysis
- Recommended solutions
- Source code locations
- Evidence (screenshots, console errors, network failures)

## Testing Workflow

The agent follows an intelligent testing process:

1. **Initialize**: Launch browser and navigate to application
2. **Discover**: Find all pages and interactive elements
3. **Test**: Execute interactions systematically
4. **Analyze**: Identify suspicious behavior
5. **Reproduce**: Confirm bugs are genuine
6. **Report**: Generate detailed bug report with evidence

## Bug Report Format

Each bug includes:

**BUG ID**: Unique identifier (e.g., `BUG-1234567890-ABC123`)

**Severity**:
- **CRITICAL**: Application unusable, major security issue, data loss
- **HIGH**: Important functionality broken
- **MEDIUM**: Feature works incorrectly under certain conditions
- **LOW**: Minor functional or visual issue

**Category**:
- Runtime Error
- Functional Error
- UI/Layout Error
- API/Network Error
- Navigation Error
- Validation Error
- Performance Issue
- Accessibility Issue
- Security Concern

**Evidence**:
- Screenshots
- Console errors
- Network failures
- Stack traces
- DOM state

**Reproduction Steps**: Exact steps to reproduce the bug

**Expected vs Actual**: What should happen vs what actually happens

**Root Cause**: Analysis of why the bug occurs

**Recommended Solution**: How to fix the bug

**Verification Steps**: How to verify the fix works

**Source Location**: File and line number (when available)

## Example Bug Report

```
BUG-1731024567-A1B2C3: Button click fails on Login page

Severity: HIGH
Category: Runtime Error
Reproducible: Yes

Page: http://localhost:5173/login
Element: #loginButton

Steps to Reproduce:
1. Navigate to http://localhost:5173/login
2. Enter email: test@example.com
3. Enter password: password123
4. Click the Login button

Expected Result:
User should be redirected to the dashboard

Actual Result:
Uncaught TypeError: Cannot read property 'user' of undefined

Technical Evidence:
- Console error: "TypeError: Cannot read property 'user' of undefined"
- Source: src/components/Login.tsx:42
- Network: No failed requests

Likely Cause:
The login response handler tries to access response.data.user but 
response.data is undefined when the API returns an error status.

Recommended Solution:
Add null checks before accessing response.data:

if (response?.data?.user) {
  // Process user data
} else {
  // Handle missing data
}

Verification Steps:
1. Apply the recommended solution
2. Rebuild the application
3. Navigate to /login
4. Repeat the login test
5. Verify successful login or proper error handling
```

## Testing Your Application

### Quick Test

```powershell
# Serve test application
cd fixtures/qa-test-app
python -m http.server 8002

# In dashboard:
# URL: http://localhost:8002
# Scope: Quick
# Start Testing
```

### Testing Production Applications

The agent can test production URLs, but with limitations:
- Cannot access private environment variables
- Cannot access server-side logs
- Cannot test features requiring production-only credentials
- Operates in read-only mode by default

**Security**: The agent will not:
- Test private network addresses in production mode
- Perform destructive actions
- Submit forms that trigger payments, deletions, or emails
- Change application settings

## API Endpoints

The QA Agent exposes REST API endpoints:

### Start Testing Session
```
POST /api/qa/start
{
  "url": "http://localhost:5173",
  "scope": "standard",
  "testForms": true,
  "testNavigation": true,
  "testResponsive": false
}

Response:
{
  "sessionId": "qa-1731024567-a1b2c3d4",
  "status": "started"
}
```

### Get Session Status
```
GET /api/qa/session/:sessionId

Response:
{
  "sessionId": "qa-1731024567-a1b2c3d4",
  "status": "testing",
  "progress": {
    "status": "testing",
    "currentPage": "http://localhost:5173/about",
    "currentActivity": "Testing form validation...",
    "pagesDiscovered": 8,
    "pagesTested": 3,
    "actionsPerformed": 15,
    "bugsFound": 2,
    "bugsConfirmed": 1,
    "elapsedTime": 45000
  }
}
```

### Get Report
```
GET /api/qa/report/:sessionId

Response: Full QA session report with all bugs
```

### List Reports
```
GET /api/qa/reports?limit=20

Response: Array of recent reports
```

### Delete Report
```
DELETE /api/qa/report/:sessionId

Response: { "success": true }
```

### Get Statistics
```
GET /api/qa/stats

Response:
{
  "totalReports": 42,
  "totalBugsFound": 127,
  "averageBugsPerReport": 3,
  "healthDistribution": {
    "healthy": 15,
    "warning": 18,
    "critical": 9
  }
}
```

## Architecture

### Components

1. **QA Orchestrator** (`qa-orchestrator.ts`)
   - Controls testing lifecycle
   - Coordinates all components
   - Emits progress updates

2. **QA Browser Agent** (`qa-browser-agent.ts`)
   - Manages Playwright browser
   - Captures errors and network activity
   - Takes screenshots

3. **Page Explorer** (`page-explorer.ts`)
   - Discovers pages and elements
   - Identifies interactive components
   - Maps application structure

4. **Interaction Tester** (`interaction-tester.ts`)
   - Tests buttons, links, forms
   - Validates form inputs
   - Captures interaction failures

5. **Bug Analyzer** (`bug-analyzer.ts`)
   - Analyzes failures
   - Classifies bug severity
   - Suggests solutions
   - Reproduces bugs

6. **Report Generator** (`report-generator.ts`)
   - Generates JSON reports
   - Creates HTML reports
   - Calculates statistics

7. **QA Manager** (`qa-manager.ts`)
   - Manages sessions
   - Stores reports
   - Provides API interface

### Session Lifecycle

```
Start Session
    ↓
Initialize Browser
    ↓
Discover Pages & Elements
    ↓
Test Interactions
    ↓
Analyze Failures
    ↓
Reproduce Bugs
    ↓
Generate Report
    ↓
Cleanup & Terminate
    ↓
Session Complete
```

## Testing the QA Agent Itself

### Test Fixtures

1. **Healthy Application** (`fixtures/healthy-app/`)
   - No bugs, should pass all tests

2. **QA Test Application** (`fixtures/qa-test-app/`)
   - Contains intentional bugs for QA Agent testing
   - Tests console errors, runtime exceptions, broken links, form validation

### Running Tests

```powershell
# Serve the QA test app
cd fixtures/qa-test-app
python -m http.server 8002

# Start DeployDoctor
cd ../..
npm start

# In dashboard:
# Navigate to QA Agent
# URL: http://localhost:8002
# Scope: Standard
# Start Testing

# Expected Results:
# - Should discover all pages
# - Should find intentional bugs
# - Should NOT flag healthy behavior as bugs
# - Should generate comprehensive report
# - Should cleanup resources after completion
```

### Verification Checklist

✅ Agent discovers pages and elements
✅ Agent tests buttons and interactions
✅ Agent detects intentional bugs
✅ Agent reproduces bugs successfully
✅ Agent generates detailed reports
✅ Agent includes screenshots and evidence
✅ Agent suggests actionable solutions
✅ Agent terminates cleanly after completion
✅ Reports are saved and accessible
✅ Dashboard shows progress updates
✅ Healthy applications not incorrectly flagged

## Limitations

Current known limitations:

1. **Source Mapping**: Only works for local files with accessible source maps
2. **Single Session**: Only one QA session can run at a time
3. **Browser Type**: Currently uses Chromium (Firefox/WebKit available but not default)
4. **Authentication**: Cannot test authenticated features without credentials
5. **Dark Theme**: Dashboard is dark theme only
6. **Real-Time**: Progress updates via polling (2-second interval)

## Troubleshooting

### Agent Won't Start

**Symptom**: Click "Start Testing" but nothing happens

**Solution**:
- Check browser console for errors
- Verify the server is running on port 3001
- Check that the target URL is accessible
- Ensure Playwright browsers are installed: `npx playwright install chromium`

### Session Stuck in "Running" State

**Symptom**: Progress doesn't update, session appears frozen

**Solution**:
- Check server logs for errors
- Verify the target application is accessible
- Try stopping and restarting the server
- Check system resources (memory, CPU)

### No Bugs Found (But You Know There Are Bugs)

**Symptom**: QA Agent reports "Healthy" but bugs exist

**Solution**:
- Increase testing scope (use "Thorough")
- Enable all testing options (forms, navigation, responsive)
- Check if bugs require specific user actions not covered by agent
- Manually test the specific flow to confirm reproducibility

### Report Not Loading

**Symptom**: "Report not found" error

**Solution**:
- Verify the session ID is correct
- Check that `reports/qa-reports/` directory exists
- Ensure the report file was generated (check filesystem)
- Try refreshing the reports list

## Future Enhancements

Potential improvements for v2:

- [ ] Visual regression testing
- [ ] Accessibility (WCAG) testing
- [ ] Performance testing (Lighthouse integration)
- [ ] Screenshot comparison
- [ ] Video recording of failures
- [ ] Multi-browser testing (parallel)
- [ ] Test credential management
- [ ] Custom test scripts
- [ ] Integration with issue trackers
- [ ] Scheduled testing runs
- [ ] Slack/email notifications
- [ ] Machine learning bug prediction
- [ ] React component-specific analysis
- [ ] Real-time WebSocket updates

## Credits

Built with:
- **Playwright**: Browser automation
- **TypeScript**: Type-safe development
- **Express**: API server
- **React**: Dashboard UI
- **Node.js**: Runtime environment

## Support

For issues, questions, or feature requests:
1. Check this documentation
2. Review the console logs
3. Check the GitHub issues
4. Contact the development team

## License

MIT License - See LICENSE file for details
