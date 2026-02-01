# Render Deployment - Step by Step

## Step 1: Create Render Account

1. Go to https://render.com
2. Click "Get Started for Free"
3. Sign up with your GitHub account (jaffarkeikei)
4. Authorize Render to access your repositories

---

## Step 2: Deploy Backend API

### Create Web Service:

1. Click **"New +"** button (top right)
2. Select **"Web Service"**
3. Connect your **GitHub** account if not already connected
4. Find and select **"Proof"** repository
5. Click **"Connect"**

### Configure Backend:

**Basic Settings**:
- **Name**: `proof-backend`
- **Region**: Oregon (US West) - or closest to you
- **Branch**: `main`
- **Root Directory**: leave blank
- **Runtime**: `Node`

**Build Settings**:
- **Build Command**: `npm install`
- **Start Command**: `node server-full.js`

**Instance Type**:
- Select **"Free"** (or Starter if you want faster)

### Environment Variables:

Click **"Advanced"** → **"Add Environment Variable"** and add each:

**📝 Copy these values from your `.env` file:**

```
PORT=3000
NODE_ENV=production
RTRVR_API_KEY=<from .env>
ELEVENLABS_API_KEY=<from .env>
TOOLHOUSE_API_KEY=<from .env>
OPENAI_API_KEY=<from .env>
CEREBRAS_API_KEY=<from .env>
GROK_API_KEY=<from .env>
TWILIO_ACCOUNT_SID=<from .env>
TWILIO_AUTH_TOKEN=<from .env>
TWILIO_PHONE_NUMBER=<from .env>
```

### Deploy:

8. Click **"Create Web Service"**
9. Wait for deployment (2-3 minutes)
10. **Copy your backend URL** (e.g., `https://proof-backend.onrender.com`)

---

## Step 3: Update Frontend Code

Before deploying frontend, we need to update it to use your Render backend URL.

**You'll do this in the next step after we get the backend URL.**

---

## Step 4: Deploy Frontend

### Create Second Web Service:

1. Click **"New +"** again
2. Select **"Web Service"**
3. Select **"Proof"** repository again
4. Click **"Connect"**

### Configure Frontend:

**Basic Settings**:
- **Name**: `proof-frontend`
- **Region**: Same as backend
- **Branch**: `main`
- **Root Directory**: leave blank
- **Runtime**: `Node`

**Build Settings**:
- **Build Command**: `npm install && npx next build`
- **Start Command**: `npx next start -p 10000`

**Environment Variables**:
```
NODE_ENV=production
PORT=10000
```

**Instance Type**:
- Select **"Free"**

### Deploy:

5. Click **"Create Web Service"**
6. Wait for deployment (3-5 minutes)

---

## Step 5: Connect Frontend to Backend

After backend deploys, you'll have a URL like:
`https://proof-backend.onrender.com`

You need to update `app/page.js` to use this URL instead of localhost.

**I'll help you with this in the next step!**

---

## What Happens Next

1. ✅ Backend deploys (2-3 min)
2. ✅ You get backend URL
3. 🔄 Update frontend code with backend URL
4. 🔄 Push changes to GitHub
5. ✅ Frontend auto-redeploys
6. 🎉 App is live!

---

## Important Notes

- **Free tier**: Backend sleeps after 15 min of inactivity
- **First request**: May take 30-60s to wake up
- **Storage**: Videos stored in ephemeral storage (lost on restart)
- **Upgrade**: $7/month for persistent service

---

## Troubleshooting

### Backend won't start:
- Check logs in Render dashboard
- Verify all environment variables are set
- Check `node server-full.js` runs locally

### Frontend can't reach backend:
- Verify backend URL in `app/page.js`
- Check CORS settings in `server-full.js`
- Look for errors in browser console

### CORS errors:
Update `server-full.js`:
```javascript
app.use(cors({
  origin: ['https://proof-frontend.onrender.com']
}));
```

---

**Ready?** Start with Step 1 and let me know once your backend is deployed!
