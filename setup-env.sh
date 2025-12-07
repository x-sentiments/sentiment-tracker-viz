#!/bin/bash

# Environment setup helper script
# Run this to quickly set up your .env file

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   X Sentiments - Environment Setup Helper   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file already exists!${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled. Your existing .env file was not modified."
        exit 0
    fi
fi

# Copy from example
cp .env.example .env
echo -e "${GREEN}✓${NC} Created .env from template"

# Generate internal secret
INTERNAL_SECRET=$(openssl rand -hex 32)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/INTERNAL_WEBHOOK_SECRET=.*/INTERNAL_WEBHOOK_SECRET=$INTERNAL_SECRET/" .env
else
    # Linux
    sed -i "s/INTERNAL_WEBHOOK_SECRET=.*/INTERNAL_WEBHOOK_SECRET=$INTERNAL_SECRET/" .env
fi
echo -e "${GREEN}✓${NC} Generated secure INTERNAL_WEBHOOK_SECRET"
echo ""

# Prompt for Supabase
echo -e "${BLUE}━━━ Supabase Configuration ━━━${NC}"
echo "Get these from: https://app.supabase.com (Project Settings → API)"
echo ""

read -p "Supabase URL: " SUPABASE_URL
read -p "Supabase Anon Key: " SUPABASE_ANON_KEY
read -p "Supabase Service Role Key: " SUPABASE_SERVICE_KEY

if [ ! -z "$SUPABASE_URL" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL|" .env
        sed -i '' "s|NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY|" .env
        sed -i '' "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY|" .env
    else
        sed -i "s|NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL|" .env
        sed -i "s|NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY|" .env
        sed -i "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY|" .env
    fi
    echo -e "${GREEN}✓${NC} Supabase credentials saved"
else
    echo -e "${YELLOW}⚠️  Skipped Supabase configuration${NC}"
fi
echo ""

# Prompt for Grok
echo -e "${BLUE}━━━ xAI Grok Configuration ━━━${NC}"
echo "Get your API key from: https://x.ai/"
echo "Note: You can skip this and use mock data for testing"
echo ""

read -p "Grok API Key (or press Enter to skip): " GROK_KEY

if [ ! -z "$GROK_KEY" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|GROK_API_KEY=.*|GROK_API_KEY=$GROK_KEY|" .env
    else
        sed -i "s|GROK_API_KEY=.*|GROK_API_KEY=$GROK_KEY|" .env
    fi
    echo -e "${GREEN}✓${NC} Grok API key saved"
else
    echo -e "${YELLOW}⚠️  Skipped Grok configuration (will use mock data)${NC}"
fi
echo ""

# Prompt for X API
echo -e "${BLUE}━━━ X (Twitter) API Configuration ━━━${NC}"
echo "Get these from: https://developer.x.com/"
echo "Note: Required for worker services, optional for now"
echo ""

read -p "X Bearer Token (or press Enter to skip): " X_TOKEN

if [ ! -z "$X_TOKEN" ]; then
    read -p "X API Key: " X_KEY
    read -p "X API Secret: " X_SECRET
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|X_BEARER_TOKEN=.*|X_BEARER_TOKEN=$X_TOKEN|" .env
        sed -i '' "s|X_API_KEY=.*|X_API_KEY=$X_KEY|" .env
        sed -i '' "s|X_API_SECRET=.*|X_API_SECRET=$X_SECRET|" .env
    else
        sed -i "s|X_BEARER_TOKEN=.*|X_BEARER_TOKEN=$X_TOKEN|" .env
        sed -i "s|X_API_KEY=.*|X_API_KEY=$X_KEY|" .env
        sed -i "s|X_API_SECRET=.*|X_API_SECRET=$X_SECRET|" .env
    fi
    echo -e "${GREEN}✓${NC} X API credentials saved"
else
    echo -e "${YELLOW}⚠️  Skipped X API configuration${NC}"
fi
echo ""

# Summary
echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Setup Complete! 🎉              ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo "Your .env file has been configured!"
echo ""
echo "Next steps:"
echo "  1. Set up your database:"
echo "     ${BLUE}supabase link --project-ref your-project-ref${NC}"
echo "     ${BLUE}supabase db push${NC}"
echo ""
echo "  2. Install dependencies (if not already done):"
echo "     ${BLUE}npm install${NC}"
echo ""
echo "  3. Start the dev server:"
echo "     ${BLUE}npm run dev${NC}"
echo ""
echo "  4. Open http://localhost:3000 in your browser"
echo ""
echo -e "${YELLOW}Note:${NC} Your .env file contains sensitive keys. Never commit it to git!"

