# Deploying Crime Heatmap to Render

This guide walks you through deploying both the Flask backend and Next.js frontend to Render.

## Prerequisites

- A [Render account](https://render.com) (free tier works)
- Your code pushed to a GitHub/GitLab repository
- MapTiler API key (for maps)

## Deployment Options

### Option 1: Blueprint (Automated - Recommended)

This uses the `render.yaml` file for automated deployment.

1. Push your code to GitHub/GitLab
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New" → "Blueprint"
4. Connect your repository
5. Render will automatically detect `render.yaml` and create all services
6. Update environment variables (see below)

### Option 2: Manual Deployment

#### Step 1: Deploy PostgreSQL Database

1. Go to Render Dashboard → "New" → "PostgreSQL"
2. Name: `crime-heatmap-db`
3. Database: `crime_heatmap`
4. User: `crime_user` (or leave default)
5. Region: Choose closest to you
6. Plan: Free
7. Click "Create Database"
8. Copy the "Internal Database URL" (you'll need this)

#### Step 2: Deploy Flask Backend

1. Go to Render Dashboard → "New" → "Web Service"
2. Connect your repository
3. Configure:
   - Name: `crime-heatmap-backend`
   - Region: Same as database
   - Root Directory: `crime-heatmap-flask`
   - Runtime: `Python 3`
   - Build Command: `./build.sh`
   - Start Command: `gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:$PORT app:app`
   - Plan: Free

4. Add Environment Variables:
   ```
   PYTHON_VERSION=3.11.0
   SECRET_KEY=<generate-random-string>
   DATABASE_URL=<paste-internal-database-url>
   DEBUG=false
   REQUIRE_REPORT_OTP=false
   OTP_PROVIDER=console
   OTP_DEV_MODE=true
   UPLOAD_FOLDER=/opt/render/project/src/crime-heatmap-flask/instance/uploads
   ```

5. Click "Create Web Service"
6. Wait for deployment (5-10 minutes)
7. Copy your backend URL (e.g., `https://crime-heatmap-backend.onrender.com`)

#### Step 3: Deploy Next.js Frontend

1. Go to Render Dashboard → "New" → "Web Service"
2. Connect your repository
3. Configure:
   - Name: `crime-heatmap-frontend`
   - Region: Same as backend
   - Root Directory: `frontend`
   - Runtime: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Plan: Free

4. Add Environment Variables:
   ```
   NODE_VERSION=18.17.0
   NEXT_PUBLIC_API_BASE_URL=<your-backend-url>
   ```
   Replace `<your-backend-url>` with the URL from Step 2

5. Click "Create Web Service"
6. Wait for deployment (5-10 minutes)

## Environment Variables Reference

### Backend (Flask)

Required:
- `SECRET_KEY` - Random string for session security (generate with `python -c "import secrets; print(secrets.token_hex(32))"`)
- `DATABASE_URL` - PostgreSQL connection string from Render database

Optional:
- `DEBUG` - Set to `false` in production
- `REQUIRE_REPORT_OTP` - Enable OTP verification (`true`/`false`)
- `OTP_PROVIDER` - `console` (dev) or `twilio` (production)
- `OTP_DEV_MODE` - `true` for testing, `false` for production
- `TWILIO_ACCOUNT_SID` - Twilio account SID (if using SMS)
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_FROM_NUMBER` - Twilio phone number
- `HYPERVERGE_FIR_VERIFY_URL` - FIR verification endpoint
- `HYPERVERGE_APP_ID` - HyperVerge app ID
- `HYPERVERGE_APP_KEY` - HyperVerge app key

### Frontend (Next.js)

Required:
- `NEXT_PUBLIC_API_BASE_URL` - Your backend URL (e.g., `https://crime-heatmap-backend.onrender.com`)

## Post-Deployment Steps

### 1. Update CORS Settings

The backend needs to allow requests from your frontend domain. Update `crime-heatmap-flask/app/__init__.py`:

```python
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:3000",
            "https://your-frontend-url.onrender.com"  # Add this
        ]
    }
})
```

### 2. Test the Deployment

1. Visit your frontend URL
2. Try creating a test report
3. Check the heatmap loads correctly
4. Verify real-time updates work

### 3. Enable Custom Domain (Optional)

In Render Dashboard:
1. Go to your service → Settings → Custom Domain
2. Add your domain
3. Update DNS records as instructed

## Troubleshooting

### Backend Issues

**Database connection errors:**
- Verify `DATABASE_URL` is set correctly
- Check database is in the same region
- Ensure database is running

**Build fails:**
```bash
# Make build.sh executable
chmod +x crime-heatmap-flask/build.sh
```

**Import errors:**
- Check all dependencies in `requirements.txt`
- Verify Python version is 3.11+

### Frontend Issues

**API connection errors:**
- Verify `NEXT_PUBLIC_API_BASE_URL` is set
- Check backend is deployed and running
- Verify CORS settings allow your frontend domain

**Build fails:**
- Check Node version (18.x recommended)
- Clear build cache in Render dashboard
- Verify all dependencies in `package.json`

### Free Tier Limitations

- Services spin down after 15 minutes of inactivity
- First request after spin-down takes 30-60 seconds
- 750 hours/month free (enough for 1 service 24/7)
- Database: 1GB storage, 97 hours/month

## Monitoring

1. View logs: Render Dashboard → Your Service → Logs
2. Check metrics: Render Dashboard → Your Service → Metrics
3. Set up alerts: Render Dashboard → Your Service → Settings → Notifications

## Updating Your Deployment

Render auto-deploys on git push:
1. Make changes locally
2. Commit and push to your repository
3. Render automatically rebuilds and deploys

Manual deploy:
- Render Dashboard → Your Service → Manual Deploy → Deploy latest commit

## Cost Optimization

Free tier is sufficient for development/testing. For production:
- Upgrade to Starter plan ($7/month per service)
- Keeps services always running (no spin-down)
- Better performance and reliability

## Security Checklist

- [ ] Set strong `SECRET_KEY`
- [ ] Set `DEBUG=false` in production
- [ ] Use PostgreSQL (not SQLite) in production
- [ ] Enable HTTPS (automatic on Render)
- [ ] Configure CORS properly
- [ ] Use environment variables for secrets
- [ ] Enable OTP verification for reports
- [ ] Set up database backups (paid plans)

## Support

- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)
- Check service logs for errors
