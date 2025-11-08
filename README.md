# Voice AI Call Widget POC

Browser-based voice agent with lead capture, web search, and human handoff capabilities.

## Features

- 🎙️ Natural voice conversation using OpenAI Realtime API
- 📝 Lead capture with read-back confirmation
- 🔍 Web search fallback via Tavily
- 👤 Human handoff via Twilio SMS + LiveKit
- 🔒 Privacy-first: transcripts only, no audio recording
- 📊 Full event logging and metrics

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Voice**: OpenAI Realtime API (WebRTC)
- **Handoff**: LiveKit (browser-to-browser)
- **SMS**: Twilio Programmable Messaging
- **Search**: Tavily API
- **Database**: Supabase (Postgres + RLS)
- **Hosting**: Vercel

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+

### Installation

1. Clone the repository:
\`\`\`bash
git clone <your-repo-url>
cd voice-campaign-poc
\`\`\`

2. Install dependencies:
\`\`\`bash
pnpm install
\`\`\`

3. Set up environment variables:

Copy `.env.example` to `.env.local` and configure:

\`\`\`bash
cp .env.example .env.local
\`\`\`

Required environment variables:
- `OPENAI_API_KEY` - OpenAI Realtime API key
- `SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_URL` - Same as above (public)
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Same as above (public)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_FROM_NUMBER` - Twilio phone number
- `TAVILY_API_KEY` - Tavily search API key
- `LIVEKIT_API_KEY` - LiveKit API key
- `LIVEKIT_API_SECRET` - LiveKit API secret
- `LIVEKIT_URL` - LiveKit server URL
- `JWT_SECRET` - Secret for JWT tokens
- `NEXT_PUBLIC_APP_URL` - Your app URL (e.g., http://localhost:3000)

4. Set up the database:

Run the SQL scripts in your Supabase project:
- `scripts/sql/001_initial_schema.sql`
- `scripts/sql/002_seed_data.sql`

5. Run the development server:
\`\`\`bash
pnpm dev
\`\`\`

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm test` - Run tests

### Git Hooks

This project uses Husky and lint-staged for pre-commit hooks:
- Automatically runs linting and type checking on staged files
- Formats code with Prettier before commit

### Smoke Test

After completing a test run, verify performance metrics and event completeness:

#### 1. Run Performance Queries

Open Supabase SQL Editor and run queries from `scripts/queries.md`:

\`\`\`bash
# View queries in your editor
cat scripts/queries.md

# Or open in Supabase dashboard
https://supabase.com/dashboard/project/[your-project]/sql
\`\`\`

#### 2. Verify Metrics

Copy p95 results and paste below:

\`\`\`
Performance Metrics (Last Test):
- First AI Audio: p95 = ___ ms (target ≤1000ms)
- Tool Execution:
  - saveLead: p95 = ___ ms (target ≤500ms)
  - searchWeb: p95 = ___ ms (target ≤3000ms)
  - requestHandoff: p95 = ___ ms (target ≤2000ms)
- Call Completion: ___/10 (___%)
- Lead Capture: ___/10 (___%)
- Handoff Acceptance: ___/___ (___%)
\`\`\`

#### 3. Check Event Completeness

Run the "Last 10 Calls" query from `scripts/queries.md` to verify all events logged correctly.

**Healthy calls should have:**
- `started = 1`
- `first_audio = 1`
- `function_calls = tool_results`
- `ended = 1`

See `docs/SMOKE_TEST.md` for full test procedures and acceptance criteria.

## Project Structure

\`\`\`
voice-campaign-poc/
├── .github/
│   └── workflows/
│       └── ci.yml         # GitHub Actions CI workflow
├── app/                   # Next.js App Router pages
│   ├── page.tsx          # Home page
│   ├── demo/             # Demo call UI
│   └── a/[campaignId]/   # Campaign-specific call page
├── lib/                  # Utilities and types
├── public/               # Static assets (ring.mp3)
├── scripts/sql/          # Database schema and seed data
├── test/                 # Test files
└── .env.example          # Environment variables template
\`\`\`

## Routes

- `/` - Landing page with feature overview
- `/demo` - Demo call UI for testing
- `/a/[campaignId]` - Campaign-specific call page (QR code destination)

## CI/CD

GitHub Actions workflow runs on every push and PR:
- Type checking with TypeScript
- Linting with ESLint
- Running tests

Workflow file: `.github/workflows/ci.yml`

## Database Setup

1. Create a Supabase project at https://supabase.com
2. Copy your project URL and keys to `.env.local`
3. Run the SQL scripts in order via Supabase SQL Editor or CLI:
   - `scripts/sql/001_initial_schema.sql` - Creates tables and RLS policies
   - `scripts/sql/002_seed_data.sql` - Adds demo data

## Documentation

See `/docs` folder for detailed specifications:
- Vision and Goals
- Product Requirements Document (PRD)
- Technical Design RFC
- API Specification
- Data Model / ERD

## Next Steps

Refer to Phase A bootstrap instructions for detailed implementation phases.

## License

MIT

## Production Security Audit

Before deploying to production, verify that no secrets are leaked in the build output:

\`\`\`bash
# Check for exposed secrets in Next.js build
grep -R "OPENAI_\|SUPABASE_SERVICE_ROLE\|TWILIO_\|LIVEKIT_\|TAVILY_" .next/ -n || echo "✓ Security check passed - no secrets found"
\`\`\`

### Security Checklist

- [ ] All provider API keys use server-only access (no `NEXT_PUBLIC_` prefix)
- [ ] `/api/dev/*` routes return 403 in production (`NODE_ENV === "production"`)
- [ ] Widget enforces origin allowlist from `campaign.allowed_origins`
- [ ] IP rate limiting active on `/api/session` (10 req/min in dev)
- [ ] No secrets in client bundle (verified by grep above)
- [ ] Environment variables configured in Vercel Project Settings
- [ ] SMS links use correct `NEXT_PUBLIC_APP_URL` for production domain

### Protected Routes

The following routes are automatically blocked in production:
- `POST /api/dev/apply-sql` - Database migration endpoint (403 when `NODE_ENV=production`)

### Rate Limits

- `POST /api/session`: 10 requests per IP per 60 seconds (dev mode only)
- Widget renders only on allowed origins per campaign configuration

### Environment Variables

Server-only (NEVER add `NEXT_PUBLIC_` prefix):
- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `TAVILY_API_KEY`
- `JWT_SECRET`

Public (safe for client bundle):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
