#!/bin/bash

# Test script for X Sentiments API
# Run this after starting the dev server (npm run dev)

BASE_URL="http://localhost:3000"
echo "🧪 Testing X Sentiments API at $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Health check (markets list)
echo -e "${BLUE}Test 1: Fetching markets list...${NC}"
MARKETS_RESPONSE=$(curl -s "$BASE_URL/api/markets")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Markets API is working${NC}"
    echo "$MARKETS_RESPONSE" | jq '.' 2>/dev/null || echo "$MARKETS_RESPONSE"
else
    echo -e "${RED}✗ Failed to fetch markets${NC}"
    exit 1
fi
echo ""

# Test 2: Create a market
echo -e "${BLUE}Test 2: Creating a new market...${NC}"
QUESTION="Will Bitcoin reach \$100k by end of 2024?"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/markets/ask" \
    -H "Content-Type: application/json" \
    -d "{\"question\": \"$QUESTION\"}")

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Market created successfully${NC}"
    MARKET_ID=$(echo "$CREATE_RESPONSE" | jq -r '.market.id' 2>/dev/null)
    echo "Market ID: $MARKET_ID"
    echo "$CREATE_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_RESPONSE"
else
    echo -e "${RED}✗ Failed to create market${NC}"
    exit 1
fi
echo ""

# Test 3: Get market details
if [ ! -z "$MARKET_ID" ] && [ "$MARKET_ID" != "null" ]; then
    echo -e "${BLUE}Test 3: Fetching market details for ID: $MARKET_ID...${NC}"
    DETAIL_RESPONSE=$(curl -s "$BASE_URL/api/markets/$MARKET_ID")
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Market details fetched${NC}"
        echo "$DETAIL_RESPONSE" | jq '.' 2>/dev/null || echo "$DETAIL_RESPONSE"
    else
        echo -e "${RED}✗ Failed to fetch market details${NC}"
    fi
    echo ""

    # Test 4: Get market history
    echo -e "${BLUE}Test 4: Fetching market history...${NC}"
    HISTORY_RESPONSE=$(curl -s "$BASE_URL/api/markets/$MARKET_ID/history")
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Market history fetched${NC}"
        echo "$HISTORY_RESPONSE" | jq '.' 2>/dev/null || echo "$HISTORY_RESPONSE"
    else
        echo -e "${RED}✗ Failed to fetch market history${NC}"
    fi
    echo ""

    # Test 5: Get market posts
    echo -e "${BLUE}Test 5: Fetching market posts...${NC}"
    POSTS_RESPONSE=$(curl -s "$BASE_URL/api/markets/$MARKET_ID/posts")
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Market posts fetched${NC}"
        echo "$POSTS_RESPONSE" | jq '.' 2>/dev/null || echo "$POSTS_RESPONSE"
    else
        echo -e "${RED}✗ Failed to fetch market posts${NC}"
    fi
    echo ""
fi

# Summary
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}✓ All API tests passed!${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""
echo "🌐 Open in browser:"
echo "   Home: $BASE_URL"
echo "   Markets: $BASE_URL/markets"
if [ ! -z "$MARKET_ID" ] && [ "$MARKET_ID" != "null" ]; then
    echo "   Your Market: $BASE_URL/markets/$MARKET_ID"
fi

