# 📊 X Sentiments - AI-Powered Prediction Markets

> **Real-time probability predictions powered by X (Twitter) sentiment and Grok AI**

A Kalshi-like prediction market platform that analyzes X posts to generate continuously updating probability estimates for future events.

![Status](https://img.shields.io/badge/status-alpha-orange)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)
![Supabase](https://img.shields.io/badge/Supabase-2.48-green)

---

## 🌟 Features

- **🤖 AI-Powered Markets** - Ask any question, get AI-generated outcomes via Grok
- **📈 Real-Time Probabilities** - Continuously updated predictions based on X sentiment
- **🎨 Beautiful Kalshi-Like UI** - Dark mode, responsive design, interactive charts
- **📊 Probability Charts** - Visualize how predictions change over time
- **💬 Curated Posts** - See the most influential X posts with AI-generated labels
- **⚡ Fast & Modern** - Built with Next.js 14, Turbopack, and TypeScript
- **🔒 Secure** - Row-level security with Supabase, validated inputs with Zod

---

## 🚀 Quick Start

Get started in 5 minutes! See [QUICKSTART.md](./QUICKSTART.md) for the fastest setup.

### Prerequisites

- Node.js 18+
- Supabase account (free tier)
- API keys: xAI Grok, X/Twitter (optional for testing)

### Installation

```bash
# Clone and install
git clone <your-repo>
cd sentiment-tracker-viz
npm install

# Setup environment
cp .env.example .env
# Add your API keys to .env

# Setup database
supabase link --project-ref your-project-ref
supabase db push

# Run dev server
npm run dev
```

**Open http://localhost:3000** 🎉

For detailed setup instructions, see [SETUP.md](./SETUP.md)

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Web App                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Home Page   │  │ Markets List │  │Market Detail │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ /api/markets │  │ /api/markets │  │  /api/       │      │
│  │              │  │    /ask      │  │  internal/*  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────┬────────────────┬────────────────┬──────────────┘
             │                │                │
             ▼                ▼                ▼
┌────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ markets  │ │ outcomes │ │raw_posts │ │ scored   │      │
│  │          │ │          │ │          │ │ _posts   │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└────────────────────────────────────────────────────────────┘
             ▲                                ▲
             │                                │
┌────────────┴────────┐          ┌───────────┴──────────┐
│ Ingestion Worker    │          │  Scoring Worker      │
│ (X Filtered Stream) │          │  (Grok AI Scoring)   │
└─────────────────────┘          └──────────────────────┘
             ▲                                ▲
             │                                │
      ┌──────┴──────┐                 ┌──────┴──────┐
      │  X API      │                 │  Grok API   │
      └─────────────┘                 └─────────────┘
```

### Data Flow

1. **User asks question** → Market created with AI-generated outcomes
2. **X posts ingested** → Filtered by keywords, stored in database
3. **Posts scored** → Grok AI evaluates relevance, stance, credibility
4. **Probabilities computed** → Evidence aggregated, softmax applied
5. **UI updates** → Real-time charts and post displays

---

## 🗂️ Project Structure

```
sentiment-tracker-viz/
├── apps/
│   └── web/                    # Next.js application (Vercel)
│       ├── app/
│       │   ├── api/           # API routes
│       │   │   ├── markets/   # Public endpoints
│       │   │   └── internal/  # Worker endpoints (secured)
│       │   ├── markets/       # Market pages
│       │   │   ├── page.tsx   # Markets list
│       │   │   └── [id]/      # Market detail
│       │   ├── page.tsx       # Home page
│       │   ├── layout.tsx     # Root layout
│       │   └── globals.css    # Styles
│       └── src/
│           └── lib/           # Utilities
│               ├── supabase.ts
│               ├── grokClient.ts
│               └── xClient.ts
│
├── packages/
│   └── shared/                # Shared utilities
│       └── src/
│           ├── contracts/     # Database types
│           ├── llm/          # Grok schemas (Zod)
│           ├── probability/  # Probability engine
│           └── db/           # Generated types
│
├── services/
│   ├── ingestion-worker/     # X stream consumer (TODO)
│   └── scoring-worker/       # Post scorer (TODO)
│
└── supabase/
    └── migrations/            # Database schema
        └── 0001_init.sql
```

---

## 🎨 UI Components

### Home Page
- Hero section with question input
- Featured active markets grid
- Feature highlights

### Markets List
- All active markets
- Real-time probability display
- Sorting and filtering

### Market Detail
- Outcome probability cards
- Historical probability chart (SVG)
- Influential posts with AI labels
- Breadcrumb navigation

### Styling
- Dark mode design
- Responsive (mobile & desktop)
- Kalshi-inspired aesthetics
- Custom CSS variables for theming

---

## 🔌 API Endpoints

### Public Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/markets` | GET | List all active markets |
| `/api/markets/ask` | POST | Create new market |
| `/api/markets/[id]` | GET | Get market details |
| `/api/markets/[id]/history` | GET | Get probability snapshots |
| `/api/markets/[id]/posts` | GET | Get curated posts |

### Internal Endpoints (Secured)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/internal/posts/ingest` | POST | Ingest raw X posts |
| `/api/internal/posts/score` | POST | Score posts batch |
| `/api/internal/probability/compute` | POST | Update probabilities |
| `/api/internal/markets/[id]/update` | POST | Update market state |

All internal endpoints require `x-internal-secret` header.

---

## 🧪 Testing

### Run the dev server
```bash
npm run dev
```

### Test API endpoints
```bash
# Make script executable
chmod +x test-api.sh

# Run tests (requires dev server running)
./test-api.sh
```

### Manual testing
```bash
# Create a market
curl -X POST http://localhost:3000/api/markets/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Will Bitcoin reach $100k by end of 2024?"}'

# Get all markets
curl http://localhost:3000/api/markets

# Get market detail
curl http://localhost:3000/api/markets/{market-id}
```

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **React** - UI components
- **Custom CSS** - Styling (no UI library bloat)

### Backend
- **Next.js API Routes** - Serverless functions
- **Supabase** - PostgreSQL database + Auth
- **Zod** - Schema validation
- **Node.js** - Runtime

### AI & External APIs
- **xAI Grok** - Market creation + post scoring
- **X (Twitter) API** - Post ingestion (filtered stream)

### Infrastructure
- **Vercel** - Web app hosting (serverless)
- **Supabase Cloud** - Database hosting
- **Long-lived worker** - For X stream (separate service)

---

## 📊 Database Schema

Key tables:

- **markets** - Prediction markets with questions
- **outcomes** - Possible outcomes per market
- **raw_posts** - Ingested X posts (deduplicated)
- **scored_posts** - AI-scored posts with labels
- **probability_snapshots** - Historical probabilities
- **market_state** - Current market probabilities

See [supabase/migrations/0001_init.sql](./supabase/migrations/0001_init.sql) for full schema.

---

## 🔐 Security

- **Row Level Security (RLS)** - Enforced on all Supabase tables
- **Input Validation** - Zod schemas on all API boundaries
- **Secret Authentication** - Internal endpoints require shared secret
- **No Exposed Secrets** - All keys in environment variables
- **HTTPS Only** - Production uses secure connections

---

## 🚧 TODO / Roadmap

### Phase 1: Core Functionality ✅
- [x] Database schema
- [x] Beautiful UI components
- [x] Market creation API
- [x] Market list & detail pages
- [x] API integration

### Phase 2: Data Pipeline (In Progress)
- [ ] X filtered stream ingestion worker
- [ ] Grok scoring worker
- [ ] Probability computation engine
- [ ] Real-time UI updates (Supabase Realtime)

### Phase 3: Polish & Features
- [ ] User authentication
- [ ] Market resolution logic
- [ ] Advanced filtering & search
- [ ] Share markets on X
- [ ] Mobile app (React Native)

### Phase 4: Production
- [ ] Deploy workers to production
- [ ] Set up monitoring & alerts
- [ ] Rate limiting & abuse prevention
- [ ] SEO optimization
- [ ] Analytics integration

---

## 📝 Environment Variables

Required:
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROK_API_KEY=
X_BEARER_TOKEN=
INTERNAL_WEBHOOK_SECRET=
```

See [.env.example](./.env.example) for full list.

---

## 📚 Documentation

- [QUICKSTART.md](./QUICKSTART.md) - Get running in 5 minutes
- [SETUP.md](./SETUP.md) - Detailed setup guide
- [docs/cursor-instructions.md](./docs/cursor-instructions.md) - Development rules

---

## 🤝 Contributing

This is a private project, but contributions are welcome!

1. Create a feature branch
2. Make your changes
3. Ensure types pass: `npm run typecheck`
4. Submit a pull request

---

## 📄 License

Private project - All rights reserved.

---

## 🙏 Acknowledgments

- **Kalshi** - UI/UX inspiration
- **xAI** - Grok API for AI-powered analysis
- **X (Twitter)** - Real-time data source
- **Supabase** - Database & infrastructure
- **Vercel** - Hosting & deployment

---

## 📞 Support

For questions or issues, check:
1. The terminal logs where `npm run dev` is running
2. Supabase dashboard for database errors
3. [SETUP.md](./SETUP.md) troubleshooting section

---

**Built with ❤️ using Next.js, TypeScript, and AI**

