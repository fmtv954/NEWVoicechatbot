# 🎯 Environment Variables - Complete Schema Guide

## Table of Contents
1. [Visual Schema Map](#visual-schema-map)
2. [Tier System Explained](#tier-system-explained)
3. [Variable Reference](#variable-reference)
4. [Security Model](#security-model)
5. [File Usage Map](#file-usage-map)
6. [Troubleshooting Matrix](#troubleshooting-matrix)

---

## Visual Schema Map

\`\`\`
┌─────────────────────────────────────────────────────────────────────┐
│                     VOICE AI CHAT WIDGET                            │
│                    Environment Architecture                          │
└─────────────────────────────────────────────────────────────────────┘

🔴 CRITICAL TIER (App Core - 10 variables)
├── 🤖 AI Voice Engine
│   └── OPENAI_API_KEY ──────────────────┐
│                                         ├──> /api/session/route.ts
├── 🗄️  Database (Supabase)               │
│   ├── SUPABASE_URL ─────────────────────┤
│   ├── NEXT_PUBLIC_SUPABASE_URL ─────────┤
│   ├── SUPABASE_SERVICE_ROLE_KEY ────────┤
│   └── NEXT_PUBLIC_SUPABASE_ANON_KEY ────┤
│                                         │
├── 📞 WebRTC Connection (LiveKit)        │
│   ├── LIVEKIT_API_KEY ──────────────────┤
│   ├── LIVEKIT_API_SECRET ───────────────┤
│   └── LIVEKIT_URL ──────────────────────┤
│                                         │
└── ⚙️  App Configuration                 │
    ├── NEXT_PUBLIC_APP_URL ──────────────┤
    └── JWT_SECRET ───────────────────────┘


🟡 IMPORTANT TIER (Feature Enablers - 2 variables)
├── 💬 Human Handoff
│   └── SLACK_WEBHOOK_URL ───────────────> lib/slack.ts
│
└── 🔍 Web Search Tool
    └── TAVILY_API_KEY ─────────────────> /api/tools/searchWeb/route.ts


🟢 OPTIONAL TIER (Dev Features - 2 variables)
├── 🛠️  Admin Panel
│   └── ADMIN_DEV_ENABLED ──────────────> /admin/dev/page.tsx
│
└── 🧪 Demo Configuration
    ├── DEMO_AGENT_ID (optional)
    └── DEMO_CAMPAIGN_ID (optional)


🔵 AUTO-GENERATED TIER (Vercel Managed - 3 variables)
└── 🐘 Postgres Storage
    ├── POSTGRES_PRISMA_URL
    ├── POSTGRES_URL_NON_POOLING
    └── POSTGRES_PASSWORD
\`\`\`

---

## Tier System Explained

### 🔴 CRITICAL TIER
**What it means:** App will not function without these variables
**When to use:** Always required, set these first
**Testing:** App won't start if missing
**Priority:** P0 - Set immediately

### 🟡 IMPORTANT TIER
**What it means:** Core features won't work without these
**When to use:** Set after CRITICAL tier
**Testing:** App starts but features fail
**Priority:** P1 - Set before production

### 🟢 OPTIONAL TIER
**What it means:** Only affects dev/testing features
**When to use:** During development or debugging
**Testing:** Can be omitted in production
**Priority:** P2 - Set as needed

### 🔵 AUTO-GENERATED TIER
**What it means:** Vercel manages these automatically
**When to use:** Never manually set these
**Testing:** Auto-configured by Vercel
**Priority:** P3 - Don't touch

---

## Variable Reference

### 🔴 CRITICAL VARIABLES

#### OPENAI_API_KEY
\`\`\`yaml
Type: Secret (Server-only)
Format: sk-proj-[48 characters]
Where to get: https://platform.openai.com/api-keys
Used in:
  - app/api/session/route.ts (Line 48)
Purpose: Authenticates with OpenAI Realtime API for voice AI
Cost: $0.06 per minute of audio processing
Security: NEVER expose to client - charges to your account
Testing: Required for /demo page to work
Fallback: None - app fails without this
\`\`\`

#### SUPABASE_URL
\`\`\`yaml
Type: Server-only
Format: https://[project-ref].supabase.co
Where to get: Supabase Dashboard → Settings → API
Used in:
  - lib/supabaseAdmin.ts (Line 7)
  - Fallback for NEXT_PUBLIC_SUPABASE_URL
Purpose: Server-side database URL
Security: Safe but prefer NEXT_PUBLIC for new code
Testing: Check with: curl $SUPABASE_URL/rest/v1/
Fallback: Uses NEXT_PUBLIC_SUPABASE_URL if not set
\`\`\`

#### NEXT_PUBLIC_SUPABASE_URL
\`\`\`yaml
Type: Public (Client-accessible)
Format: https://[project-ref].supabase.co
Where to get: Same as SUPABASE_URL
Used in:
  - lib/supabase.ts (Line 4)
  - lib/supabaseAdmin.ts (fallback check)
Purpose: Client-side database URL
Security: Safe to expose - protected by RLS
Testing: Accessible in browser console
Fallback: Falls back to SUPABASE_URL in admin client
Note: MUST match SUPABASE_URL exactly
\`\`\`

#### SUPABASE_SERVICE_ROLE_KEY
\`\`\`yaml
Type: Secret (Server-only)
Format: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.[long base64]
Where to get: Supabase Dashboard → Settings → API
Used in:
  - lib/supabaseAdmin.ts (Line 16)
Purpose: Bypasses Row Level Security for admin operations
Security: CRITICAL - Never expose! Full database access
Testing: Should work in server-side API routes only
Fallback: None - admin operations fail without this
Warning: Can read/write ALL tables regardless of RLS
\`\`\`

#### NEXT_PUBLIC_SUPABASE_ANON_KEY
\`\`\`yaml
Type: Public (Client-accessible)
Format: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.[long base64]
Where to get: Supabase Dashboard → Settings → API
Used in:
  - lib/supabase.ts (Line 5)
Purpose: Public database access with RLS protection
Security: Safe to expose - RLS enforces permissions
Testing: Works in browser, respects RLS policies
Fallback: None - client queries fail without this
\`\`\`

#### LIVEKIT_API_KEY
\`\`\`yaml
Type: Secret (Server-only)
Format: APIxxxxxxxxxxxxx
Where to get: LiveKit Cloud → Project → Settings → Keys
Used in:
  - app/api/session/route.ts (Line 34)
Purpose: Creates LiveKit room tokens for WebRTC
Security: Server-only - can create unlimited rooms
Testing: Used to generate connection tokens
Fallback: None - WebRTC connection fails
\`\`\`

#### LIVEKIT_API_SECRET
\`\`\`yaml
Type: Secret (Server-only)
Format: [random string ~32 chars]
Where to get: LiveKit Cloud (paired with API_KEY)
Used in:
  - app/api/session/route.ts (paired with API_KEY)
Purpose: Signs LiveKit JWT tokens
Security: CRITICAL - Never expose! Verifies token authenticity
Testing: Must match API_KEY from same project
Fallback: None - token generation fails
\`\`\`

#### LIVEKIT_URL
\`\`\`yaml
Type: Public (Client-accessible)
Format: wss://your-project.livekit.cloud
Where to get: LiveKit Cloud → Project → Settings
Used in:
  - app/api/session/route.ts (returned to client)
  - lib/callClient.ts (WebRTC connection)
Purpose: WebSocket URL for voice connection
Security: Safe to expose - auth handled by token
Testing: Check with: wscat -c $LIVEKIT_URL
Fallback: None - client can't connect without this
\`\`\`

#### NEXT_PUBLIC_APP_URL
\`\`\`yaml
Type: Public (Client-accessible)
Format: https://your-domain.vercel.app
Where to get: Your Vercel deployment URL
Used in:
  - app/api/campaigns/[id]/qr/route.ts (QR code generation)
  - app/widget.js/route.ts (embed script)
Purpose: Base URL for redirects, QR codes, embeds
Security: Safe to expose - just your domain
Testing: Should match your actual deployed URL
Fallback: Defaults to localhost:3000 in dev
Production: MUST set to actual Vercel URL
\`\`\`

#### JWT_SECRET
\`\`\`yaml
Type: Secret (Server-only)
Format: [random string minimum 32 characters]
Where to get: Generate with: openssl rand -base64 32
Used in:
  - Authentication token signing
  - Session security
Purpose: Signs JWT tokens for authentication
Security: CRITICAL - Never expose! Can forge tokens
Testing: Any random 32+ char string works
Fallback: None - auth fails without this
Rotation: Change periodically for security
\`\`\`

---

### 🟡 IMPORTANT VARIABLES

#### SLACK_WEBHOOK_URL
\`\`\`yaml
Type: Secret (Server-only)
Format: https://hooks.slack.com/services/T.../B.../xxx
Where to get: Slack API → Create App → Incoming Webhooks
Used in:
  - lib/slack.ts (Line 36)
  - app/api/handoff/request/route.ts (Line 151)
Purpose: Sends handoff notifications to Slack
Security: Server-only - can post to your Slack
Testing: curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"test"}'
Fallback: Handoff requests fail silently
Feature Impact: Human agent handoff won't work
\`\`\`

#### TAVILY_API_KEY
\`\`\`yaml
Type: Secret (Server-only)
Format: tvly-[alphanumeric]
Where to get: https://tavily.com → Sign up → API Keys
Used in:
  - app/api/tools/searchWeb/route.ts (Line 26)
Purpose: Powers AI web search tool
Security: Server-only - usage counts against your quota
Testing: Call /api/tools/searchWeb with test query
Fallback: searchWeb tool returns error
Feature Impact: AI can't search web for information
\`\`\`

---

### 🟢 OPTIONAL VARIABLES

#### ADMIN_DEV_ENABLED
\`\`\`yaml
Type: Feature flag
Format: "1" (enabled) or "0"/empty (disabled)
Where to set: Vercel env settings or .env.local
Used in:
  - app/admin/dev/page.tsx (Line 6-7)
Purpose: Shows/hides admin development panel
Security: Disable in production unless needed
Testing: Visit /admin/dev to verify
Fallback: Page shows "disabled" message
Production: Set to "0" or omit for public apps
\`\`\`

#### DEMO_AGENT_ID (Optional)
\`\`\`yaml
Type: UUID
Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Default: a0000000-0000-0000-0000-000000000001 (seed data)
Where to get: From your agents table
Used in:
  - app/demo/page.tsx (Line 4)
Purpose: Default agent for demo page
Security: Public - just affects demo
Testing: Visit /demo to test
Fallback: Uses seed data UUID
When to set: Only if you want different demo agent
\`\`\`

#### DEMO_CAMPAIGN_ID (Optional)
\`\`\`yaml
Type: UUID
Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Default: c0000000-0000-0000-0000-000000000001 (seed data)
Where to get: From your campaigns table
Used in:
  - app/demo/page.tsx (Line 5)
Purpose: Default campaign for demo page
Security: Public - just affects demo
Testing: Visit /demo to test
Fallback: Uses seed data UUID
When to set: Only if you want different demo campaign
\`\`\`

---

## Security Model

### Client-Accessible Variables (NEXT_PUBLIC_*)
\`\`\`
Browser Console ──> Can read these
                   ├── NEXT_PUBLIC_SUPABASE_URL
                   ├── NEXT_PUBLIC_SUPABASE_ANON_KEY
                   └── NEXT_PUBLIC_APP_URL

Protected by:
├── Row Level Security (RLS) on Supabase
├── API rate limiting
└── CORS policies
\`\`\`

### Server-Only Variables
\`\`\`
API Routes Only ──> Can read these
                   ├── OPENAI_API_KEY
                   ├── SUPABASE_SERVICE_ROLE_KEY
                   ├── LIVEKIT_API_SECRET
                   ├── JWT_SECRET
                   ├── SLACK_WEBHOOK_URL
                   └── TAVILY_API_KEY

Protected by:
├── Next.js runtime isolation
├── Never sent to client
└── Only accessible in server components/API routes
\`\`\`

### Security Threat Matrix

| Variable | Exposure Risk | Impact | Mitigation |
|----------|--------------|--------|------------|
| OPENAI_API_KEY | 🔴 Critical | Unlimited API charges | Never log, rotate regularly |
| SUPABASE_SERVICE_ROLE_KEY | 🔴 Critical | Full DB access | Strict RLS, audit logs |
| LIVEKIT_API_SECRET | 🔴 Critical | Unlimited rooms | Rate limit, monitor usage |
| JWT_SECRET | 🔴 Critical | Forge tokens | 32+ chars, rotate quarterly |
| SLACK_WEBHOOK_URL | 🟡 High | Spam your Slack | Validate requests, monitor |
| TAVILY_API_KEY | 🟡 High | API quota drain | Rate limit tool calls |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 🟢 Low | RLS protected | Enable RLS on all tables |
| NEXT_PUBLIC_APP_URL | 🟢 None | Just your domain | No risk |

---

## File Usage Map

### Database Layer
\`\`\`
lib/supabase.ts
├── Uses: NEXT_PUBLIC_SUPABASE_URL
├── Uses: NEXT_PUBLIC_SUPABASE_ANON_KEY
└── Purpose: Client-side database queries

lib/supabaseAdmin.ts
├── Uses: SUPABASE_URL (with fallback)
├── Uses: SUPABASE_SERVICE_ROLE_KEY
└── Purpose: Server-side admin operations

lib/calls.ts
├── Imports: supabaseAdmin from lib/supabaseAdmin.ts
└── Purpose: Call/lead tracking operations
\`\`\`

### AI & Voice Layer
\`\`\`
app/api/session/route.ts (THE MAIN ENGINE)
├── Uses: OPENAI_API_KEY ────────> OpenAI Realtime API
├── Uses: LIVEKIT_API_KEY ───────> Token generation
├── Uses: LIVEKIT_API_SECRET ────> Token signing
├── Uses: LIVEKIT_URL ───────────> Returned to client
└── Purpose: Creates WebRTC + AI session

lib/callClient.ts
├── Receives: LIVEKIT_URL (from session endpoint)
└── Purpose: Browser-side WebRTC connection

lib/prompt.ts
├── No env vars directly
└── Purpose: AI persona configuration
\`\`\`

### Tools & Integrations
\`\`\`
lib/slack.ts
├── Uses: SLACK_WEBHOOK_URL
└── Purpose: Send handoff notifications

app/api/tools/searchWeb/route.ts
├── Uses: TAVILY_API_KEY
└── Purpose: Web search for AI

lib/tools.ts
├── No env vars directly
└── Purpose: Tool definitions (saveLead, searchWeb, requestHandoff)
\`\`\`

### Pages & UI
\`\`\`
app/demo/page.tsx
├── Uses: DEMO_AGENT_ID (optional)
├── Uses: DEMO_CAMPAIGN_ID (optional)
└── Purpose: Interactive demo interface

app/admin/dev/page.tsx
├── Uses: ADMIN_DEV_ENABLED
└── Purpose: Dev tools panel

app/api/campaigns/[id]/qr/route.ts
├── Uses: NEXT_PUBLIC_APP_URL
└── Purpose: Generate campaign QR codes
\`\`\`

---

## Troubleshooting Matrix

### Error Resolution Table

| Error Message | Missing Variable | Priority | Solution |
|--------------|------------------|----------|----------|
| "Missing SUPABASE_URL" | NEXT_PUBLIC_SUPABASE_URL | 🔴 Critical | Set both SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL |
| "OpenAI API error" | OPENAI_API_KEY | 🔴 Critical | Add valid OpenAI key, check billing |
| "LiveKit connection failed" | LIVEKIT_URL or keys | 🔴 Critical | Verify all 3 LiveKit variables |
| "Database connection failed" | Supabase keys | 🔴 Critical | Check URL matches keys from same project |
| "Handoff notification failed" | SLACK_WEBHOOK_URL | 🟡 Important | Test webhook with curl |
| "Search tool failed" | TAVILY_API_KEY | 🟡 Important | Verify API key and quota |
| "Admin page disabled" | ADMIN_DEV_ENABLED | 🟢 Optional | Set to "1" if needed |
| "Invalid agent/campaign ID" | DEMO_*_ID format | 🟢 Optional | Use proper UUID format |

### Debug Commands

\`\`\`bash
# Test Supabase connection
curl https://YOUR_PROJECT.supabase.co/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"

# Test Slack webhook
curl -X POST $SLACK_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"text":"Test from Voice AI"}'

# Test LiveKit endpoint
wscat -c $LIVEKIT_URL
# Should respond with WebSocket connection

# Verify env vars are loaded (in API route)
console.log({
  hasOpenAI: !!process.env.OPENAI_API_KEY,
  hasSupabase: !!process.env.SUPABASE_URL,
  hasLiveKit: !!process.env.LIVEKIT_URL
})
\`\`\`

### Common Pitfalls

1. **Trailing Slashes**: Don't add trailing "/" to URLs
   \`\`\`bash
   ✅ https://project.supabase.co
   ❌ https://project.supabase.co/
   \`\`\`

2. **URL Mismatch**: SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL must match exactly
   \`\`\`bash
   ✅ Both: https://same.supabase.co
   ❌ Different projects or typos
   \`\`\`

3. **Wrong Key Type**: Don't use SERVICE_ROLE_KEY in client
   \`\`\`bash
   ✅ Client: NEXT_PUBLIC_SUPABASE_ANON_KEY
   ✅ Server: SUPABASE_SERVICE_ROLE_KEY
   ❌ Mixed up: Security breach!
   \`\`\`

4. **Dev vs Prod**: Different values needed
   \`\`\`bash
   Dev:  NEXT_PUBLIC_APP_URL=http://localhost:3000
   Prod: NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   \`\`\`

---

## Quick Reference Cards

### Deployment Checklist
\`\`\`
□ Set all 🔴 CRITICAL variables (10 total)
□ Set all 🟡 IMPORTANT variables (2 total)
□ Double-check SUPABASE_URL = NEXT_PUBLIC_SUPABASE_URL
□ Verify LIVEKIT_URL starts with wss://
□ Confirm NEXT_PUBLIC_APP_URL matches deployment
□ Test /demo page loads
□ Test call connects
□ Test handoff posts to Slack
□ Disable ADMIN_DEV_ENABLED in production
\`\`\`

### Variable Count Summary
\`\`\`
🔴 CRITICAL:  10 variables (Must have)
🟡 IMPORTANT:  2 variables (Should have)
🟢 OPTIONAL:   2 variables (Nice to have)
🔵 AUTO:       3 variables (Don't touch)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TOTAL:     17 variables
\`\`\`

### Priority Order
\`\`\`
1. OPENAI_API_KEY           (P0 - AI won't work)
2. Supabase URLs (both)     (P0 - Database fails)
3. Supabase keys (both)     (P0 - Auth fails)
4. LiveKit credentials (3)  (P0 - No calls)
5. NEXT_PUBLIC_APP_URL      (P0 - QR codes broken)
6. JWT_SECRET               (P0 - Auth broken)
7. SLACK_WEBHOOK_URL        (P1 - Handoff fails)
8. TAVILY_API_KEY           (P1 - Search fails)
9. ADMIN_DEV_ENABLED        (P2 - Optional)
10. DEMO_*_ID               (P2 - Optional)
\`\`\`

---

## Version History

- v1.0 - Initial schema based on working implementation
- Reflects actual codebase as of successful demo connection
- All variables tested and verified working
</markdown>
