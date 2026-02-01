#!/bin/bash
# Quick Deployment Script

echo "🚀 Proof Deployment Script"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

echo ""
echo "Choose deployment option:"
echo "1. Deploy Backend to Railway"
echo "2. Deploy Frontend to Vercel"
echo "3. Deploy Both"
echo ""
read -p "Enter option (1/2/3): " option

case $option in
  1)
    echo ""
    echo "🚂 Deploying Backend to Railway..."
    echo ""
    railway login
    railway up
    echo ""
    echo "✅ Backend deployed!"
    echo "📝 Copy the URL and update app/page.js with your backend URL"
    ;;
  2)
    echo ""
    echo "⚡ Deploying Frontend to Vercel..."
    echo ""
    vercel login
    vercel --prod
    echo ""
    echo "✅ Frontend deployed!"
    ;;
  3)
    echo ""
    echo "🚂 Deploying Backend to Railway..."
    railway login
    railway up
    echo ""
    echo "⚡ Deploying Frontend to Vercel..."
    vercel login
    vercel --prod
    echo ""
    echo "✅ Both deployed!"
    echo "📝 Update app/page.js with your Railway backend URL"
    ;;
  *)
    echo "Invalid option"
    exit 1
    ;;
esac

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Set environment variables in Railway dashboard"
echo "2. Update app/page.js with backend URL"
echo "3. Test your deployment!"
