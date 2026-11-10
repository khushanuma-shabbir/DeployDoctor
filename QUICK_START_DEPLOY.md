# Quick Start - Deploy to Production

## Prerequisites
- GitHub repository
- Render account (https://render.com)
- Vercel account (https://vercel.com)

## Step 1: Push to GitHub

```bash
cd d:\Project\DeployDoctor

# Initialize git (if not already done)
git init
git add .
git commit -m "Production-ready deployment"

# Create GitHub repo and push
git remote add origin https://github.com/yourusername/deploydoctor.git
git branch -M main
git push -u origin main
```

## Step 2: Generate API Key

```bash
# Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Or use online: https://generate-random.org/api-key-generator
```

Copy the generated key - you'll need it for both Render and Vercel.

## Step 3: Deploy to Render

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect GitHub repository
4. Configure:
   - **Name**: `deploydoctor`
   - **Region**: Oregon (or nearest)
   - **Branch**: `main`
   - **Runtime**: Docker
   - **Plan**: Starter ($7/month)

5. Add Disk:
   - Go to "Disks" tab
   - Click "Add Disk"
   - **Name**: `deploydoctor-data`
   - **Mount Path**: `/var/data`
   - **Size**: 1 GB

6. Add Environment Variables:
   ```
   NODE_ENV=production
   DATABASE_PATH=/var/data/deploydoctor.db
   REPORTS_DIR=/var/data/reports
   MAX_CONCURRENT_QA_SESSIONS=1
   QA_SESSION_TIMEOUT_MS=1800000
   API_KEY=<paste-your-generated-key>
   FRONTEND_ORIGIN=
   ```
   (Leave FRONTEND_ORIGIN empty for now)

7. Click "Create Web Service"
8. Wait 10-15 minutes for deploy
9. **Save your Render URL**: `https://deploydoctor-xxxx.onrender.com`

## Step 4: Verify Render Deployment

```bash
# Test health endpoint
curl https://deploydoctor-xxxx.onrender.com/health

# Expected response:
# {"status":"ok","timestamp":...,"version":"1.0.0","environment":"production"}

# Test API with authentication
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://deploydoctor-xxxx.onrender.com/api/stats
```

## Step 5: Deploy to Vercel

1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `src/dashboard`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. Add Environment Variables:
   ```
   VITE_API_BASE_URL=https://deploydoctor-xxxx.onrender.com
   VITE_API_KEY=<same-key-as-render>
   ```
   **Important**: Set for ALL environments (Production, Preview, Development)

6. Click "Deploy"
7. Wait 2-3 minutes
8. **Save your Vercel URL**: `https://your-app.vercel.app`

## Step 6: Update Render CORS

1. Go back to Render dashboard
2. Open your `deploydoctor` service
3. Go to "Environment" tab
4. Update `FRONTEND_ORIGIN`:
   ```
   FRONTEND_ORIGIN=https://your-app.vercel.app
   ```
5. Click "Save Changes" (will trigger automatic redeploy)
6. Wait 5 minutes for redeploy

## Step 7: Final Verification

### Test Backend
```bash
# Health check
curl https://deploydoctor-xxxx.onrender.com/health

# Stats (authenticated)
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://deploydoctor-xxxx.onrender.com/api/stats
```

### Test Frontend
1. Open `https://your-app.vercel.app`
2. Open browser DevTools (F12) → Console
3. Check for errors (should be none)
4. Try starting a scan:
   - URL: `https://example.com`
   - Click "Start Scan"
   - Should work without CORS errors

### Test QA Agent
1. Navigate to "QA Agent" page
2. Enter URL: `https://example.com`
3. Scope: Quick
4. Click "Start Testing"
5. Should see "Session started" message
6. Check Render logs for activity

## Step 8: Save Your Configuration

Create a `.env.production` file locally (DO NOT COMMIT):

```bash
# Backend (Render)
NODE_ENV=production
DATABASE_PATH=/var/data/deploydoctor.db
REPORTS_DIR=/var/data/reports
MAX_CONCURRENT_QA_SESSIONS=1
API_KEY=<your-key>
FRONTEND_ORIGIN=https://your-app.vercel.app

# Frontend (Vercel)
VITE_API_BASE_URL=https://deploydoctor-xxxx.onrender.com
VITE_API_KEY=<your-key>
```

## Troubleshooting

### "CORS error" in browser console
**Fix**: Verify `FRONTEND_ORIGIN` in Render matches exact Vercel URL (including https://)

### "Unauthorized" errors
**Fix**: Ensure `VITE_API_KEY` in Vercel matches `API_KEY` in Render

### "Cannot connect to API"
**Fix**: Check `VITE_API_BASE_URL` is set correctly in Vercel environment variables

### Render build fails
**Fix**: Check Render logs. Common issues:
- Docker not selected as runtime
- Build timeout (increase in settings)

### Playwright errors
**Fix**: Verify Dockerfile uses correct Playwright image version

## Monitoring

### View Logs
**Render**: Dashboard → Your Service → Logs tab
**Vercel**: Project → Deployments → Click deployment → Functions tab

### Check Health
```bash
# Render health
curl https://deploydoctor-xxxx.onrender.com/health

# Check every 5 minutes
watch -n 300 'curl -s https://deploydoctor-xxxx.onrender.com/health | jq'
```

### Monitor Disk Usage
**Render**: Dashboard → Your Service → Metrics tab → Disk section

## Updating Application

```bash
# Make changes
git add .
git commit -m "Update: description"
git push origin main

# Render and Vercel will auto-deploy (2-5 minutes)
```

## Cost Summary

**Render** (Backend):
- Starter: $7/month
- Disk: $0.25/GB/month
- Total: ~$7.25/month

**Vercel** (Frontend):
- Hobby: Free
- Pro: $20/month (if commercial)

**Total**: $7-27/month

## Security Checklist

- [ ] Strong API_KEY generated (32+ characters)
- [ ] FRONTEND_ORIGIN set to exact Vercel URL
- [ ] .env files not in git
- [ ] Health endpoint returns 200
- [ ] CORS working (no errors in browser)
- [ ] Authentication working (401 without API key)
- [ ] Rate limiting active (429 after limit)

## Success Criteria

✅ Render deployment successful
✅ Vercel deployment successful
✅ Health check returns 200
✅ Frontend loads without errors
✅ Can create scans
✅ Can start QA sessions
✅ No CORS errors
✅ Authentication working

## Next Steps

1. Test thoroughly with real applications
2. Monitor logs for errors
3. Set up alerts (optional)
4. Consider upgrading to Standard plan for production
5. Backup database regularly

---

**Deployment Complete! 🎉**

Your URLs:
- **Frontend**: https://your-app.vercel.app
- **Backend**: https://deploydoctor-xxxx.onrender.com
- **Health**: https://deploydoctor-xxxx.onrender.com/health

For detailed documentation, see `DEPLOYMENT.md`
