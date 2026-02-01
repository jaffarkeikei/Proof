# Deployment Guide - Vercel

## Architecture

**Frontend**: Next.js (Vercel)
**Backend**: Express.js (Railway/Render/Fly.io)

You need to deploy them separately because Vercel is optimized for frontend, and the backend needs persistent storage for videos.

---

## Option 1: Frontend (Vercel) + Backend (Railway) - RECOMMENDED

### Step 1: Deploy Backend to Railway

1. **Install Railway CLI**:
```bash
npm i -g @railway/cli
```

2. **Login to Railway**:
```bash
railway login
```

3. **Create new project**:
```bash
railway init
```

4. **Set environment variables**:
```bash
railway variables set PORT=3000
railway variables set RTRVR_API_KEY=your_rtrvr_api_key_here
railway variables set ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
railway variables set TOOLHOUSE_API_KEY=your_toolhouse_api_key_here
railway variables set OPENAI_API_KEY=your_openai_api_key_here
railway variables set CEREBRAS_API_KEY=your_cerebras_api_key_here
railway variables set GROK_API_KEY=your_grok_api_key_here
railway variables set TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
railway variables set TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
railway variables set TWILIO_PHONE_NUMBER=your_twilio_phone_number_here
```

**📝 Copy your API keys from `.env` file**

5. **Deploy**:
```bash
railway up
```

6. **Get backend URL** (e.g., `https://proof-backend-production.up.railway.app`)

---

### Step 2: Deploy Frontend to Vercel

1. **Install Vercel CLI**:
```bash
npm i -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Update frontend to use Railway backend URL**:

Edit `app/page.js` - replace `http://localhost:3000` with your Railway URL:

```javascript
// Line 25
const response = await fetch('https://YOUR-RAILWAY-URL.railway.app/api/pipeline/run', {

// Line 39
const eventSource = new EventSource(`https://YOUR-RAILWAY-URL.railway.app/api/pipeline/${data.runId}/progress`);
```

4. **Deploy to Vercel**:
```bash
vercel
```

5. **Set environment variable** (if needed):
```bash
vercel env add NEXT_PUBLIC_API_URL
# Enter your Railway backend URL
```

6. **Production deploy**:
```bash
vercel --prod
```

---

## Option 2: Quick Deploy (Vercel Only - Development)

**⚠️ Note**: This won't support video storage properly, use for demo only.

1. **Update `app/page.js`**:
```javascript
// Use Vercel serverless function
const response = await fetch('/api/pipeline/run', { ... });
```

2. **Create API route** at `app/api/pipeline/route.js`:
```javascript
export async function POST(request) {
  // Proxy to your local backend or Railway
  const body = await request.json();
  const response = await fetch('http://YOUR-BACKEND-URL/api/pipeline/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response;
}
```

3. **Deploy**:
```bash
vercel --prod
```

---

## Quick Commands

### Deploy Everything:

```bash
# Backend (Railway)
cd /Users/jaffars/Desktop/Proof
railway login
railway init
railway up

# Frontend (Vercel)
vercel login
vercel --prod
```

---

## Environment Variables Needed

### Backend (Railway):
```
PORT=3000
RTRVR_API_KEY=<from .env file>
ELEVENLABS_API_KEY=<from .env file>
TOOLHOUSE_API_KEY=<from .env file>
OPENAI_API_KEY=<from .env file>
CEREBRAS_API_KEY=<from .env file>
GROK_API_KEY=<from .env file>
TWILIO_ACCOUNT_SID=<from .env file>
TWILIO_AUTH_TOKEN=<from .env file>
TWILIO_PHONE_NUMBER=<from .env file>
```

### Frontend (Vercel):
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

---

## Post-Deployment

1. **Test the pipeline**:
   - Visit your Vercel URL
   - Enter a company name
   - Check video generation works

2. **Monitor logs**:
```bash
# Backend logs
railway logs

# Frontend logs
vercel logs
```

3. **Check storage**:
   - Videos saved to Railway's ephemeral storage
   - For persistent storage, add Railway volume

---

## Troubleshooting

### CORS Errors:
Update `server-full.js` to allow your Vercel domain:
```javascript
app.use(cors({
  origin: ['https://your-app.vercel.app']
}));
```

### Video Not Found:
- Check Railway backend is serving `/videos` route
- Verify video storage directory exists
- Check Railway logs for errors

### API Key Errors:
- Verify all env vars are set in Railway dashboard
- Use `railway variables` to check

---

## Cost Estimates

- **Vercel**: Free (Hobby tier)
- **Railway**: $5/month (includes 500 execution hours)
- **Total**: ~$5/month

---

## Alternative: All-in-One (Not Recommended)

Deploy both frontend + backend to single Railway instance:
```bash
railway init
railway up
```

Set `start` script in package.json:
```json
"start": "concurrently \"npx next start -p 3001\" \"node server-full.js\""
```

**⚠️ Not recommended**: Harder to scale, worse performance.

---

## Production Checklist

- [ ] Backend deployed to Railway
- [ ] Frontend deployed to Vercel
- [ ] All API keys set in Railway
- [ ] Frontend URL updated in `app/page.js`
- [ ] CORS configured for Vercel domain
- [ ] Test video generation end-to-end
- [ ] Monitor logs for errors

---

**Ready to deploy!** Start with Railway backend, then Vercel frontend.
