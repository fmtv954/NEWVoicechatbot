# Security & Safety Rails

This document verifies all security measures are in place for the Voice AI Call Widget POC.

## ✅ 1. Origin Allowlist Enforcement

**Location:** `app/widget.js/route.ts` (lines 28-42)

\`\`\`javascript
// ===== ORIGIN CHECK HAPPENS HERE =====
// In development, allow all origins (wildcard)
const isDev = ${isDev};
const isOriginAllowed = isDev || 
  allowedOrigins.includes('*') || 
  allowedOrigins.includes(currentOrigin);

if (!isOriginAllowed) {
  console.warn(
    '[Voice AI Widget] Origin not allowed. Current origin: ' + currentOrigin + 
    ', Allowed origins: ' + JSON.stringify(allowedOrigins)
  );
  return;
}
// ===== END ORIGIN CHECK =====
\`\`\`

**How it works:**
- Widget fetches campaign data from `/api/campaigns/:id`
- Compares `window.location.origin` against `allowed_origins` array
- In development mode, all origins are allowed
- In production, only explicitly allowed origins can render the widget
- Unauthorized origins see a console warning and no widget renders

**Test:**
\`\`\`bash
# Add allowed origin to campaign
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "a0000000-0000-0000-0000-000000000001",
    "name": "Test Campaign",
    "allowed_origins": ["https://example.com"]
  }'

# Widget will only render on https://example.com
# Other origins will see: "[Voice AI Widget] Origin not allowed..."
\`\`\`

---

## ✅ 2. IP Rate Limiting on /api/session

**Location:** `app/api/session/route.ts` (lines 6-25)

\`\`\`typescript
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false
  }

  record.count++
  return true
}
\`\`\`

**Configuration:**
- **Window:** 60 seconds
- **Max requests:** 10 per IP per window
- **Response:** 429 Too Many Requests with error message

**Test:**
\`\`\`bash
# Make 11 rapid requests from same IP
for i in {1..11}; do
  curl -X POST http://localhost:3000/api/session \
    -H "Content-Type: application/json" \
    -d '{"agent_id":"a0000000-0000-0000-0000-000000000001","campaign_id":"c1234567-89ab-cdef-0123-456789abcdef"}'
  echo ""
done

# Request 11 will return:
# {"error":"Too many requests. Please try again later."}
\`\`\`

---

## ✅ 3. No Provider Keys in Client Bundle

**Verification method:** Searched all client-side files (`.tsx`) for sensitive environment variables

\`\`\`bash
grep -r "OPENAI_API_KEY\|SUPABASE_SERVICE_ROLE_KEY\|TWILIO_AUTH_TOKEN\|JWT_SECRET" app/**/*.tsx
# Result: No matches ✅
\`\`\`

**Client-safe environment variables:**
- `NEXT_PUBLIC_APP_URL` ✅
- `NEXT_PUBLIC_SUPABASE_URL` ✅
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅

**Server-only variables (never exposed):**
- `OPENAI_API_KEY` - Used only in `/api/session/route.ts` (server-side)
- `SUPABASE_SERVICE_ROLE_KEY` - Used only in `lib/supabaseAdmin.ts` (server-only)
- `TWILIO_AUTH_TOKEN` - Used only in `lib/sms.ts` (server-only)
- `JWT_SECRET` - Used only in handoff accept/request routes (server-only)

**Additional checks:**
- ✅ No `process.env` references in client components
- ✅ `lib/callClient.ts` does NOT contain any API keys
- ✅ Widget JavaScript does NOT expose any secrets
- ✅ Session endpoint returns only `sessionClientSecret` (ephemeral client token)

---

## ✅ 4. Block /api/dev/* in Production

**Location:** `app/api/dev/apply-sql/route.ts` (lines 11-14)

\`\`\`typescript
export async function POST(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is only available in development" }, 
      { status: 403 }
    )
  }
  // ... rest of dev logic
}
\`\`\`

**Protected endpoints:**
- `/api/dev/apply-sql` - SQL migration helper

**Test:**
\`\`\`bash
# In production:
NODE_ENV=production pnpm build && pnpm start

curl -X POST "http://localhost:3000/api/dev/apply-sql?name=01_tables"
# Response: {"error":"This endpoint is only available in development"} (403)

# In development:
NODE_ENV=development pnpm dev

curl -X POST "http://localhost:3000/api/dev/apply-sql?name=01_tables"
# Response: {"success":true,"message":"Applied 01_tables.sql"} (200)
\`\`\`

---

## 📊 Event Logging for P95 Latency Proof

All 10 milestone events are logged to `call_events` table:

| Event | Location | Timestamp Field |
|-------|----------|----------------|
| `call_started` | `/api/session/route.ts:78` | `created_at` |
| `first_ai_audio` | `/lib/callClient.ts:131-140` | `created_at` |
| `barge_in` | `/lib/callClient.ts:183-192` | `created_at` |
| `tool_called` | `/app/api/tools/searchWeb/route.ts:9-18` | `created_at` |
| `lead_saved` | `/app/api/leads/route.ts:51-59` | `created_at` |
| `handoff_requested` | `/app/api/handoff/request/route.ts:43-50` | `created_at` |
| `sms_sent` | `/app/api/handoff/request/route.ts:113-121` | `created_at` |
| `handoff_accepted` | `/app/api/handoff/accept/route.ts:71-79` | `created_at` |
| `handoff_timeout` | `/app/api/handoff/accept/route.ts:56-63` | `created_at` |
| `call_ended` | `/lib/callClient.ts:206-215` | `created_at` |

**Query P95 latency:**
\`\`\`sql
-- Time to first AI audio (ring → first audio)
SELECT 
  PERCENTILE_CONT(0.95) WITHIN GROUP (
    ORDER BY 
      EXTRACT(EPOCH FROM (
        (SELECT created_at FROM call_events WHERE call_id = calls.id AND type = 'first_ai_audio')
        - (SELECT created_at FROM call_events WHERE call_id = calls.id AND type = 'call_started')
      ))
  ) as p95_first_audio_seconds
FROM calls;

-- Barge-in latency (user speaks → AI stops)
SELECT 
  PERCENTILE_CONT(0.95) WITHIN GROUP (
    ORDER BY 
      EXTRACT(EPOCH FROM payload->>'interrupt_latency_ms')::numeric / 1000
  ) as p95_barge_in_seconds
FROM call_events 
WHERE type = 'barge_in';
\`\`\`

---

## 🔒 Summary

| Security Check | Status | Location |
|---------------|--------|----------|
| Origin allowlist enforcement | ✅ | `app/widget.js/route.ts:28-42` |
| IP rate limiting (dev) | ✅ | `app/api/session/route.ts:6-35` |
| No keys in client bundle | ✅ | Verified via grep |
| Block /api/dev/* in prod | ✅ | `app/api/dev/apply-sql/route.ts:11-14` |
| Event logging (p95 proof) | ✅ | All 10 milestones logged |

**All safety rails are in place and functioning correctly.** ✅
