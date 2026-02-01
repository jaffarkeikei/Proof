# Quick Deploy Guide

## Current Status
- ❌ Vercel account suspended (payment required)
- ✅ Code ready to deploy
- ✅ All APIs integrated

---

## **Option 1: Render.com (Free Tier - EASIEST)**

1. **Push to GitHub** (already done ✅)

2. **Go to Render.com**:
   - Visit https://render.com
   - Sign up with GitHub
   - Click "New +" → "Web Service"

3. **Deploy Backend**:
   - Connect your `jaffarkeikei/Proof` repo
   - Name: `proof-backend`
   - Build Command: `npm install`
   - Start Command: `node server-full.js`
   - Add all environment variables from `.env`

4. **Deploy Frontend**:
   - New Web Service
   - Same repo
   - Name: `proof-frontend`
   - Build Command: `npm install && npx next build`
   - Start Command: `npx next start`

5. **Update Frontend URLs**:
   - Edit `app/page.js` lines 25 & 39
   - Replace `localhost:3000` with your Render backend URL

---

## **Option 2: Railway (Recommended for Production)**

1. **Login**:
```bash
railway login
```

2. **Deploy Backend**:
```bash
railway init
railway up
```

3. **Set Environment Variables**:
   - Go to Railway dashboard
   - Add all keys from `.env` file

4. **Get Backend URL** from Railway

5. **Update Frontend** in `app/page.js`

6. **Deploy Frontend** to Vercel (after fixing payment):
```bash
vercel --prod --yes
```

---

## **Option 3: Vercel (After Fixing Payment)**

1. **Fix Vercel Account**:
   - https://vercel.com/teams/ponti-fi/settings/billing
   - Add payment method

2. **Deploy**:
```bash
vercel --prod --yes
```

3. **Note**: Vercel is frontend-only. You'll need Railway/Render for backend.

---

## **Fastest Path (5 minutes)**

### Use Render.com:
1. Sign up: https://render.com
2. Connect GitHub repo
3. Create Web Service for backend
4. Copy backend URL
5. Update `app/page.js` with backend URL
6. Create Web Service for frontend
7. Done!

---

## **What to Update in Code**

In `app/page.js`, replace both instances of `http://localhost:3000`:

```javascript
// Line 25
const response = await fetch('https://YOUR-BACKEND-URL.onrender.com/api/pipeline/run', {

// Line 39
const eventSource = new EventSource(`https://YOUR-BACKEND-URL.onrender.com/api/pipeline/${data.runId}/progress`);
```

---

## **After Deployment**

1. Test the live app
2. Enter "Stripe" or any company
3. Watch 8-second video generate
4. Share your deployment URL!

---

## **Need Help?**

- **Render docs**: https://render.com/docs
- **Railway docs**: https://docs.railway.app
- **Vercel payment**: https://vercel.com/teams/ponti-fi/settings/billing

---

**TL;DR**: Use Render.com (free, no payment required)
