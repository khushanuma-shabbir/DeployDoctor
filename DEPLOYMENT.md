# DeployDoctor - Production Deployment Guide

## Overview

DeployDoctor uses a split architecture:
- **Backend**: Render (Node.js + Playwright + SQLite)
- **Frontend**: Vercel (React + Vite)

## Prerequisites

1. GitHub account with repository
2. Render account (https://render.com)
3. Vercel account (https://vercel.com)
4. Strong API key generated

## Part 1: Deploy Backend to Render

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit for production deployment"
git branch -M main
git remote add origin your-github-repo-url
git push -u origin main
```

### Step 2: Create Render Web Service

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `deploydoctor`
   - **Region**: Choose nearest to your users
   - **Branch**: `main`
   - **Runtime**: `Docker`
   - **Plan**: Start with "Starter" ($7/month)

### Step 3: Add Persistent Disk

1. In service settings, go to "Disks"
2. Click "Add Disk"
3. Configure:
   - **Name**: `deploydoctor-data`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB` (increase as needed)

### Step 4: Set Environment Variables

In Render dashboard, add these environment variables:

**Required**:
```
NODE_ENV=production
DATABASE_PATH=/var/data/deploydoctor.db
REPORTS_DIR=/var/data/reports
MAX_CONCURRENT_QA_SESSIONS=1
QA_SESSION_TIMEOUT_MS=1800000
```

**Generate API Key**:
```bash
# On your local machine:
openssl rand -base64 32
# Copy the output
```

```
API_KEY=<paste-generated-key-here>
```

**Leave empty for now** (will set after Vercel deployment):
```
FRONTEND_ORIGIN=
```

### Step 5: Deploy

1. Click "Create Web Service"
2. Wait 5-10 minutes for build and deployment
3. Note your Render URL: `https://deploydoctor-xxxx.onrender.com`

### Step 6: Verify Deployment

```bash
# Check health endpoint
curl https://deploydoctor-xxxx.onrender.com/health

# Expected response:
# {"status":"ok","timestamp":1234567890,"version":"1.0.0","environment":"production"}
```

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Prepare Frontend

Create `.env.production` in `src/dashboard/`:

```bash
VITE_API_BASE_URL=https://deploydoctor-xxxx.onrender.com
VITE_API_KEY=<your-api-key-from-render>
```

**IMPORTANT**: Add `.env.production` to `.gitignore`!

### Step 2: Create Vercel Project

1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `src/dashboard`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### Step 3: Set Environment Variables in Vercel

Add these in Vercel project settings → Environment Variables:

```
VITE_API_BASE_URL=https://deploydoctor-xxxx.onrender.com
VITE_API_KEY=<your-api-key>
```

**For all environments**: Production, Preview, Development

### Step 4: Deploy

1. Click "Deploy"
2. Wait 2-3 minutes
3. Note your Vercel URL: `https://your-app.vercel.app`

### Step 5: Update Render CORS

Go back to Render dashboard:

1. Open your `deploydoctor` service
2. Go to "Environment"
3. Update `FRONTEND_ORIGIN`:

```
FRONTEND_ORIGIN=https://your-app.vercel.app
```

4. Save changes (will trigger redeploy)

---

## Part 3: Verify Everything Works

### Test Backend

```bash
# Health check (no auth)
curl https://deploydoctor-xxxx.onrender.com/health

# API check (with auth)
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://deploydoctor-xxxx.onrender.com/api/stats
```

### Test Frontend

1. Open `https://your-app.vercel.app`
2. Should see DeployDoctor dashboard
3. Try starting a scan with `http://example.com`
4. Check browser console for errors

### Test QA Agent

1. Navigate to QA Agent page
2. Enter URL: `https://example.com`
3. Click "Start Testing"
4. Verify session starts (check Render logs if issues)

---

## Part 4: Monitoring and Maintenance

### View Logs

**Render**:
1. Dashboard → Your Service → Logs tab
2. Real-time logs of backend activity

**Vercel**:
1. Project → Deployments → Click deployment → Functions tab
2. View function logs

### Check Disk Usage

**Render**:
1. Dashboard → Your Service → Metrics tab
2. Monitor disk usage under "Disk" section

### Database Backup

SSH into Render (if needed):

```bash
# Via Render shell
cat /var/data/deploydoctor.db > backup.db
```

Or use Render's backup feature for the persistent disk.

### Update Application

```bash
git add .
git commit -m "Update: description"
git push origin main

# Render and Vercel will auto-deploy
```

---

## Troubleshooting

### Backend Issues

**Issue**: "Authentication not configured"
**Fix**: Ensure `API_KEY` environment variable is set in Render

**Issue**: "CORS error in browser"
**Fix**: Check `FRONTEND_ORIGIN` matches exact Vercel URL (including https://)

**Issue**: "Playwright browser not found"
**Fix**: Verify Dockerfile uses correct Playwright image (`mcr.microsoft.com/playwright:v1.44.0-jammy`)

**Issue**: "Database locked"
**Fix**: Only one instance should write to SQLite. Check `MAX_CONCURRENT_QA_SESSIONS=1`

**Issue**: "Out of memory"
**Fix**: Upgrade Render plan or reduce `MAX_CONCURRENT_QA_SESSIONS`

### Frontend Issues

**Issue**: "API calls failing"
**Fix**: Check `VITE_API_BASE_URL` is set correctly in Vercel environment variables

**Issue**: "404 on page refresh"
**Fix**: Verify `vercel.json` rewrite rules are in place

**Issue**: "Unauthorized errors"
**Fix**: Ensure `VITE_API_KEY` matches backend `API_KEY`

### QA Agent Issues

**Issue**: "Maximum concurrent sessions"
**Fix**: Wait for existing session to complete or increase `MAX_CONCURRENT_QA_SESSIONS` (requires more RAM)

**Issue**: "Session timeout"
**Fix**: Increase `QA_SESSION_TIMEOUT_MS` or reduce test scope

**Issue**: "Browser launch failed"
**Fix**: Check Render logs, verify Playwright dependencies installed

---

## Security Checklist

Before going live:

- [ ] Strong API_KEY set (32+ characters, random)
- [ ] FRONTEND_ORIGIN set to exact Vercel URL
- [ ] .env files not committed to git
- [ ] HTTPS enabled (automatic on Render/Vercel)
- [ ] Rate limiting active (check Render logs)
- [ ] Test SSRF protection (try scanning `http://169.254.169.254`)
- [ ] Database backed up
- [ ] Logs monitored

---

## Cost Estimate

**Render** (Backend):
- Starter: $7/month (512 MB RAM)
- Standard: $25/month (2 GB RAM) - recommended for heavy QA use
- Disk: $0.25/GB/month

**Vercel** (Frontend):
- Hobby: Free (personal projects)
- Pro: $20/month (teams)

**Total**: $7-45/month depending on tier

---

## Scaling Considerations

### Current Limits
- 1 concurrent QA session
- SQLite (single-writer)
- No horizontal scaling

### To Scale Up
1. **More QA Sessions**: Upgrade Render plan, increase `MAX_CONCURRENT_QA_SESSIONS`
2. **Database**: Migrate to PostgreSQL for multi-instance support
3. **Horizontal**: Use queue system (Redis/BullMQ) for QA jobs
4. **Reports**: Store in S3/Cloud Storage instead of filesystem

---

## Production Ready Status

✅ Authentication enabled
✅ Rate limiting active
✅ SSRF protection implemented
✅ CORS configured
✅ Persistent storage configured
✅ Graceful shutdown
✅ Health checks
✅ Docker optimized for Playwright
✅ Environment variables
✅ Logging enabled

**Status**: ✅ Ready for production deployment

---

## Support

- Render Docs: https://render.com/docs
- Vercel Docs: https://vercel.com/docs
- Playwright Docs: https://playwright.dev/docs/docker

