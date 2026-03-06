# Quick Deploy to Render - 5 Minutes

## Step 1: Push to GitHub
```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

## Step 2: Deploy on Render

1. Go to https://dashboard.render.com
2. Click "New +" → "Blueprint"
3. Connect your GitHub repository
4. Render will detect `render.yaml` and show 3 services:
   - crime-heatmap-db (PostgreSQL)
   - crime-heatmap-backend (Flask)
   - crime-heatmap-frontend (Next.js)
5. Click "Apply"

## Step 3: Update Frontend URL

After backend deploys, you'll get a URL like:
`https://crime-heatmap-backend-xxxx.onrender.com`

Update the frontend environment variable:
1. Go to crime-heatmap-frontend service
2. Environment → Edit `NEXT_PUBLIC_API_BASE_URL`
3. Paste your backend URL
4. Save (triggers auto-redeploy)

## Done! 🎉

Your app will be live at:
- Frontend: `https://crime-heatmap-frontend-xxxx.onrender.com`
- Backend: `https://crime-heatmap-backend-xxxx.onrender.com`

## Important Notes

- First deploy takes 10-15 minutes
- Free tier services sleep after 15 min inactivity
- First request after sleep takes ~30 seconds
- Database has 1GB free storage

## Optional: Add Custom Domain

1. Go to service → Settings → Custom Domain
2. Add your domain (e.g., crimemap.yourdomain.com)
3. Update DNS as instructed

## Troubleshooting

**Backend won't start?**
- Check logs in Render dashboard
- Verify DATABASE_URL is set
- Ensure build.sh is executable

**Frontend can't connect?**
- Verify NEXT_PUBLIC_API_BASE_URL matches backend URL
- Check CORS settings in backend
- Look at browser console for errors

**Need help?**
See full guide: RENDER_DEPLOYMENT.md
