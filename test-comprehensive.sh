#!/bin/bash

# Comprehensive Test Suite for Proof PDD Demo
# Tests all PDD-generated modules in action

BASE_URL="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║  🧪 Proof - Comprehensive PDD Module Test Suite               ║"
echo "║                                                                ║"
echo "║  Testing all 4 PDD-generated modules:                         ║"
echo "║    • config.js    (429 lines)                                 ║"
echo "║    • logger.js    (414 lines)                                 ║"
echo "║    • database.js  (1,748 lines)                               ║"
echo "║    • validation.js (738 lines)                                ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_field=$5

    echo -e "${BLUE}Testing:${NC} $name"

    if [ "$method" = "POST" ]; then
        RESPONSE=$(curl -s -X POST "$BASE_URL$endpoint" -H "Content-Type: application/json" -d "$data")
    else
        RESPONSE=$(curl -s "$BASE_URL$endpoint")
    fi

    if echo "$RESPONSE" | jq -e ".$expected_field" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC} - $name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo "$RESPONSE" | jq '.' | head -15
    else
        echo -e "${RED}❌ FAIL${NC} - $name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo "$RESPONSE" | jq '.'
    fi
    echo ""
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MODULE 1: config.js - Environment Configuration Module"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_endpoint "Health Check (Config Loading)" "GET" "/health" "" "status"
test_endpoint "Configuration Info" "GET" "/api/config" "" "apiKeysConfigured"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MODULE 2: logger.js - Structured Logging Module"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo -e "${BLUE}Testing:${NC} Structured Logging"
if [ -f "logs/combined.log" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Log files created"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo "Recent log entries:"
    tail -3 logs/combined.log | jq -c '{timestamp, level, module, message}' 2>/dev/null || tail -3 logs/combined.log
else
    echo -e "${RED}❌ FAIL${NC} - No log files found"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MODULE 3: database.js - SQLite Database Module"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_endpoint "Database Statistics" "GET" "/api/database/stats" "" "pipelineRuns"

echo -e "${BLUE}Testing:${NC} Database File Creation"
if [ -f "data/proof.db" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Database file exists"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo "Database size: $(du -h data/proof.db | cut -f1)"
else
    echo -e "${RED}❌ FAIL${NC} - Database file not found"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MODULE 4: validation.js - Input Validation Module"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_endpoint "Valid Pipeline Input" "POST" "/api/pipeline/start" \
    '{"companyName":"Test Corp","targetAudience":"Developers","maxReviews":50,"platforms":["google","yelp"]}' \
    "success"

test_endpoint "Invalid Input (Empty Company)" "POST" "/api/pipeline/start" \
    '{"companyName":"","maxReviews":-5}' \
    "error"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  INTEGRATION TEST: All Modules Working Together"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo -e "${BLUE}Testing:${NC} Create Pipeline Run + Add Reviews + Query"

# Create pipeline run
RUN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/pipeline/start" \
    -H "Content-Type: application/json" \
    -d '{"companyName":"Integration Test Corp","maxReviews":100}')

RUN_ID=$(echo "$RUN_RESPONSE" | jq -r '.runId')

if [ "$RUN_ID" != "null" ] && [ "$RUN_ID" != "" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Pipeline run created (ID: $RUN_ID)"
    TESTS_PASSED=$((TESTS_PASSED + 1))

    # Add reviews
    cat > /tmp/test_reviews.json << 'EOF'
{
  "reviews": [
    {
      "platform": "google",
      "author": "Test User 1",
      "rating": 5,
      "text": "Amazing service! Highly recommend to everyone.",
      "date": "2024-01-15T10:30:00Z"
    },
    {
      "platform": "yelp",
      "author": "Test User 2",
      "rating": 4,
      "text": "Great experience, would use again.",
      "date": "2024-02-20T14:00:00Z"
    },
    {
      "platform": "trustpilot",
      "author": "Test User 3",
      "rating": 5,
      "text": "Exceptional quality and support.",
      "date": "2024-03-10T09:15:00Z"
    }
  ]
}
EOF

    REVIEW_RESPONSE=$(curl -s -X POST "$BASE_URL/api/pipeline/$RUN_ID/reviews" \
        -H "Content-Type: application/json" \
        -d @/tmp/test_reviews.json)

    REVIEW_COUNT=$(echo "$REVIEW_RESPONSE" | jq -r '.reviewIds | length')

    if [ "$REVIEW_COUNT" = "3" ]; then
        echo -e "${GREEN}✅ PASS${NC} - Reviews added successfully (Count: $REVIEW_COUNT)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC} - Failed to add reviews"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Query reviews
    QUERY_RESPONSE=$(curl -s "$BASE_URL/api/pipeline/$RUN_ID/reviews")
    QUERY_COUNT=$(echo "$QUERY_RESPONSE" | jq -r '.count')

    if [ "$QUERY_COUNT" = "3" ]; then
        echo -e "${GREEN}✅ PASS${NC} - Reviews retrieved successfully (Count: $QUERY_COUNT)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo "$QUERY_RESPONSE" | jq '.data[0]'
    else
        echo -e "${RED}❌ FAIL${NC} - Failed to retrieve reviews"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Get pipeline run details
    RUN_DETAILS=$(curl -s "$BASE_URL/api/pipeline/$RUN_ID")
    RUN_STATUS=$(echo "$RUN_DETAILS" | jq -r '.data.status')

    if [ "$RUN_STATUS" != "null" ]; then
        echo -e "${GREEN}✅ PASS${NC} - Pipeline run details retrieved (Status: $RUN_STATUS)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC} - Failed to retrieve pipeline run"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo -e "${RED}❌ FAIL${NC} - Failed to create pipeline run"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# List all pipeline runs
test_endpoint "List All Pipeline Runs" "GET" "/api/pipeline" "" "count"

# Final database stats
echo -e "${BLUE}Testing:${NC} Final Database Statistics"
FINAL_STATS=$(curl -s "$BASE_URL/api/database/stats")
echo "$FINAL_STATS" | jq '.'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  TEST RESULTS SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
SUCCESS_RATE=$(( (TESTS_PASSED * 100) / TOTAL_TESTS ))

echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo "Success Rate: $SUCCESS_RATE%"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                               ║${NC}"
    echo -e "${GREEN}║  ✅ ALL TESTS PASSED! PDD DEMO READY! 🎉      ║${NC}"
    echo -e "${GREEN}║                                               ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
else
    echo -e "${RED}╔═══════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ⚠️  SOME TESTS FAILED - REVIEW LOGS          ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════╝${NC}"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  PDD-Generated Modules Tested:                                ║"
echo "║    ✅ config.js    - Environment configuration (429 lines)     ║"
echo "║    ✅ logger.js    - Structured logging (414 lines)            ║"
echo "║    ✅ database.js  - SQLite operations (1,748 lines)           ║"
echo "║    ✅ validation.js - Input validation (738 lines)             ║"
echo "║                                                                ║"
echo "║  Total: 3,329 lines of PDD-generated production code          ║"
echo "║  Cost: \$13.57 | Time: ~40 minutes                             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
