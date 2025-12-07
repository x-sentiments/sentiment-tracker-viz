# X Filtered Stream Ingestion Worker

Long-running worker that connects to X's Filtered Stream API and ingests matching tweets.

## How it works

1. Syncs stream rules with active markets in Supabase
2. Connects to X Filtered Stream with those rules
3. When tweets match rules, sends them to the ingest webhook
4. Handles reconnection with exponential backoff
5. Periodically re-syncs rules (every 5 minutes)

## Setup

1. Copy `.env.example` to `.env` and fill in values
2. Install dependencies: `npm install`
3. Run: `npm start`

## Deployment Options

### Railway
```bash
railway login
railway init
railway up
```

### Fly.io
```bash
fly launch
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... X_BEARER_TOKEN=...
fly deploy
```

### Docker (self-hosted)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "start"]
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Service role key for DB access |
| X_BEARER_TOKEN | Yes | X API Bearer Token |
| WEBHOOK_URL | Yes | Base URL of your Vercel deployment |
| INTERNAL_WEBHOOK_SECRET | Yes | Secret for authenticating with ingest endpoint |
| LOG_LEVEL | No | debug, info, warn, error (default: info) |
| RECONNECT_DELAY_MS | No | Base reconnect delay (default: 5000) |
| MAX_RECONNECT_ATTEMPTS | No | Max reconnects before exit (default: 10) |

