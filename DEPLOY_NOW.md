# 🚀 Deploy DeployDoctor Now

## Quick Setup (5 Minutes)

### 1. Generate Credentials

```powershell
# Generate admin password hash
node -e "const b=require('bcrypt');b.hash('YourSecurePassword123!',12).then(console.log)"
# Copy the output (starts with $2b$12$)

# Generate session secret
$bytes = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)
# Copy the output
```

### 2. Deploy Backend to Render

1. Go to https://render.com/dashboard
2. Click **"New +"** → **"Web Service"**
3. Connect repository: `khushanuma-shabbir/DeployDoctor`
4. Settings:
   - **Name:** `deploydoctor-api`
   - **Environment:** `Docker`
   - **Plan:** Starter ($7/month)
   - **Region:** Choose closest

5. **Add Disk** (CRITICAL):
   - Mount Path: `/var/data`
   - Size: `1 GB`

6. **Environment Variables:**
```bash
NODE_ENV=production
SESSION_SECRET=<paste-generated-secret>
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<paste-generated-hash>
FRONTEND_ORIGIN=https://deploydoctor.vercel.app
DATABASE_PATH=/var/data/deploydoctor.db
REPORTS_DIR=/var/data/reports
MAX_CONCURRENT_QA_SESSIONS=1
```

7. Click **"Create Web Service"**
8. Wait 5-10 minutes for build
9. Note your URL: `https://deploydoctor-api.onrender.com`

### 3. Deploy Frontend to Vercel

1. Go to https://vercel.com/new
2. Import `khushanuma-shabbir/DeployDoctor`
3. Settings:
   - **Framework:** Vite
   - **Root Directory:** `src/dashboard`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

4. **Environment Variables:**
```bash
VITE_API_BASE_URL=https://deploydoctor-api.onrender.com
```
   ⚠️ Replace with your actual Render URL!

5. Click **"Deploy"**
6. Wait 2-3 minutes
7. Note your URL: `https://deploydoctor.vercel.app`

### 4. Update Render with Vercel URL

1. Go back to Render dashboard
2. Open `deploydoctor-api` service
3. Go to **"Environment"**
4. Update:
```bash
FRONTEND_ORIGIN=https://deploydoctor.vercel.app
```
   ⚠️ Use your actual Vercel URL!

5. Save (will auto-redeploy)

### 5. Test Your Deployment

1. Open `https://deploydoctor.vercel.app`
2. You should see the login page
3. Login with:
   - Username: `admin`
   - Password: (the one you used to generate the hash)
4. You should be redirected to the dashboard
5. Try running a scan: `https://example.com`

## ✅ Done!

Your DeployDoctor is now deployed securely with:
- ✅ Session-based authentication
- ✅ CSRF protection
- ✅ Secure cookies
- ✅ SSRF protection
- ✅ No exposed secrets

## 🔒 Security Notes

- Your password hash is stored securely with bcrypt
- Sessions use HttpOnly cookies (invisible to JavaScript)
- CSRF tokens protect against cross-site attacks
- All communication over HTTPS

## 📝 Important

**First time cold start:** Render may take 30-60 seconds to spin up on first request. This is normal.

**If login fails:**
1. Check browser console for CORS errors
2. Verify `FRONTEND_ORIGIN` matches your Vercel URL exactly
3. Verify `VITE_API_BASE_URL` in Vercel matches your Render URL exactly
4. Check Render logs for authentication errors

## 🆘 Troubleshooting

### Login shows 500 error
- Check Render logs
- Verify `ADMIN_PASSWORD_HASH` is set
- Verify `SESSION_SECRET` is set

### CORS error in browser
- Check `FRONTEND_ORIGIN` in Render
- Must match Vercel URL exactly (no trailing slash)

### Can't reach API
- Check Render service is "Live"
- Verify `VITE_API_BASE_URL` in Vercel

### Database errors
- Verify persistent disk mounted at `/var/data`
- Check Render logs

## 📚 Full Documentation

- **Security Report:** `PRE_DEPLOYMENT_SECURITY_REPORT.md`
- **Quick Summary:** `SECURITY_FIXES_SUMMARY.md`
- **Detailed Guide:** `DEPLOYMENT.md`
