#!/bin/bash

# Proof PDD Demo - API Test Script
# This script demonstrates all endpoints using the PDD-generated modules

BASE_URL="http://localhost:3001"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Proof - PDD Hackathon Demo API Test                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Health check
echo "1️⃣  Testing /health endpoint..."
curl -s "$BASE_URL/health" | jq '.'
echo ""

# Get config
echo "2️⃣  Testing /api/config endpoint..."
curl -s "$BASE_URL/api/config" | jq '.'
echo ""

# Get database stats
echo "3️⃣  Testing /api/database/stats endpoint..."
curl -s "$BASE_URL/api/database/stats" | jq '.'
echo ""

# Create pipeline run (with validation)
echo "4️⃣  Testing /api/pipeline/start endpoint (with validation)..."
RUN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/pipeline/start" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Acme Corporation",
    "targetAudience": "Small business owners",
    "maxReviews": 100,
    "platforms": ["google", "yelp"]
  }')
echo "$RUN_RESPONSE" | jq '.'
RUN_ID=$(echo "$RUN_RESPONSE" | jq -r '.runId')
echo ""

# List all pipeline runs
echo "5️⃣  Testing /api/pipeline endpoint (list all runs)..."
curl -s "$BASE_URL/api/pipeline" | jq '.'
echo ""

# Get specific pipeline run
echo "6️⃣  Testing /api/pipeline/$RUN_ID endpoint..."
curl -s "$BASE_URL/api/pipeline/$RUN_ID" | jq '.'
echo ""

# Add reviews (with validation)
echo "7️⃣  Testing /api/pipeline/$RUN_ID/reviews endpoint (add reviews)..."
curl -s -X POST "$BASE_URL/api/pipeline/$RUN_ID/reviews" \
  -H "Content-Type: application/json" \
  -d '{
    "reviews": [
      {
        "platform": "google",
        "author": "John Doe",
        "rating": 5,
        "text": "Excellent service! Highly recommend.",
        "date": "2024-01-15T10:30:00Z",
        "metadata": {
          "sourceUrl": "https://google.com/review/123",
          "verified": true
        }
      },
      {
        "platform": "yelp",
        "author": "Jane Smith",
        "rating": 4,
        "text": "Great experience overall.",
        "date": "2024-02-20T14:00:00Z"
      }
    ]
  }' | jq '.'
echo ""

# Get reviews
echo "8️⃣  Testing /api/pipeline/$RUN_ID/reviews endpoint (get reviews)..."
curl -s "$BASE_URL/api/pipeline/$RUN_ID/reviews" | jq '.'
echo ""

# Test validation error
echo "9️⃣  Testing validation error (invalid input)..."
curl -s -X POST "$BASE_URL/api/pipeline/start" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "",
    "maxReviews": -5
  }' | jq '.'
echo ""

echo "✅ All tests completed!"
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  PDD-Generated Modules Demonstrated:                       ║"
echo "║    ✅ config.js - Environment configuration                ║"
echo "║    ✅ logger.js - Structured logging                       ║"
echo "║    ✅ database.js - SQLite persistence                     ║"
echo "║    ✅ validation.js - Zod input validation                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
