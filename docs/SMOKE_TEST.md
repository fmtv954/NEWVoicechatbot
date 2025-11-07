# Smoke Test Checklist — Phase M Final Verification

**Version:** 1.0  
**Date:** 2025-11-07  
**Purpose:** End-to-end validation of Voice AI Call Widget POC before production launch

---

## Pre-Test Setup

### Environment Variables Check
\`\`\`bash
# Verify all required keys are set
echo $OPENAI_API_KEY
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
echo $TWILIO_ACCOUNT_SID
echo $TWILIO_AUTH_TOKEN
echo $TWILIO_FROM_NUMBER
echo $TAVILY_API_KEY
echo $LIVEKIT_API_KEY
echo $LIVEKIT_API_SECRET
echo $LIVEKIT_URL
echo $JWT_SECRET
echo $NEXT_PUBLIC_APP_URL
\`\`\`

### Database Setup
\`\`\`bash
# Apply all migrations
curl -X POST "http://localhost:3000/api/dev/apply-sql?name=01_tables"
curl -X POST "http://localhost:3000/api/dev/apply-sql?name=02_indexes"
curl -X POST "http://localhost:3000/api/dev/apply-sql?name=03_rls"
curl -X POST "http://localhost:3000/api/dev/apply-sql?name=04_seed"
\`\`\`

### Create Test Campaign
\`\`\`bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "a0000000-0000-0000-0000-000000000001",
    "name": "Smoke Test Campaign",
    "allowed_origins": ["http://localhost:3000", "https://yourdomain.vercel.app"]
  }'

# Save the returned campaign_id for testing
\`\`\`

---

## Test Execution (One-Pass Flow)

### ✅ Step 1: Campaign Creation
**Action:** Create campaign with production host in `allowed_origins`

**Expected:**
- Returns `{ id, embed, qr_url }`
- Campaign appears in Supabase `campaigns` table

**Verify:**
\`\`\`sql
SELECT * FROM campaigns WHERE name = 'Smoke Test Campaign';
\`\`\`

---

### ✅ Step 2: Call Initiation
**Action:** 
- Open `/a/[campaign_id]` via QR or direct URL
- Click "Call" button

**Expected:**
- Ring.mp3 plays instantly (<50ms)
- "Calling..." status appears
- Timer shows "00:00"

**Events to Check:**
- `call_started` logged in `call_events` table

---

### ✅ Step 3: First AI Audio
**Action:** Wait for AI to speak first greeting

**Expected:**
- First AI audio arrives ≤1.0s from call start
- Ring stops immediately when AI speaks
- Timer starts counting
- Status changes to "Connected"

**Events to Check:**
- `first_ai_audio` logged with timestamp
- Calculate latency: `first_ai_audio.created_at - call_started.created_at`

**Pass Criteria:** Latency ≤1000ms

---

### ✅ Step 4: Interrupt (Barge-In) — 3 Times
**Action:** 
1. While AI is speaking, start talking
2. Observe AI stops speaking
3. Repeat 3 times during conversation

**Expected:**
- AI stops speaking ≤150ms after user starts
- No audio overlap or echo
- Conversation feels natural

**Events to Check:**
- `barge_in` logged 3 times in `call_events`

**Pass Criteria:** All 3 interrupts feel responsive

---

### ✅ Step 5: Lead Capture
**Action:** 
- Provide contact info when AI asks:
  - First name: "Jane"
  - Last name: "Doe"
  - Email: "jane@example.com"
  - Phone: "+15551234567"
  - Reason: "Product pricing question"
- AI reads back information
- Confirm with "Yes"

**Expected:**
- AI calls `saveLead` tool
- Lead row created in database with correct `campaign_id`
- AI confirms: "Great, I've got your info!"

**Events to Check:**
- `function_call_invoked` with `tool_name: "saveLead"`
- `tool_result_returned` with `ok: true`
- `lead_saved` with `lead_id`

**Verify:**
\`\`\`sql
SELECT * FROM leads WHERE email = 'jane@example.com';
-- Should show: campaign_id, agent_id, first_name, last_name, email, phone, reason
\`\`\`

---

### ✅ Step 6: Web Search (Unknown Question)
**Action:** Ask a question AI doesn't know:
- "What's the weather in Tokyo right now?"

**Expected:**
- AI says "Let me look that up for you!"
- Tavily API called once
- AI cites source: "According to [source], the weather in Tokyo is..."

**Events to Check:**
- `function_call_invoked` with `tool_name: "searchWeb"`
- `tool_called` with `query: "weather Tokyo"`
- `tool_result_returned` with search results

**Deduplication Test:**
- Ask the same question again
- AI should NOT call Tavily again (uses cached result)

---

### ✅ Step 7: Handoff Request (Success Path)
**Action:** Say "I'd like to speak to a human" or "Connect me to someone"

**Expected:**
- AI says "One sec while I connect you!"
- SMS sent to all on-call agent contacts
- SMS body includes:
  \`\`\`
  URGENT: Visitor needs help (Campaign: Smoke Test Campaign)
  Customer: Jane Doe  Phone: +15551234567  Email: jane@example.com
  Reason: [handoff reason]
  Join: https://[domain]/agent/accept?token=...
  \`\`\`

**Events to Check:**
- `function_call_invoked` with `tool_name: "requestHandoff"`
- `handoff_requested` with `ticket_id`
- `sms_sent` for each agent contact (with `provider_sid`)
- `tool_result_returned` with `ok: true`

---

### ✅ Step 8: Agent Accepts Handoff
**Action:** 
- Tap SMS link on mobile device
- Opens `/agent/accept?token=...`

**Expected:**
- Token verified successfully
- "Connecting to customer..." message
- LiveKit room connection established
- Agent hears customer audio
- Customer hears agent audio
- AI is muted/disconnected

**Events to Check:**
- `handoff_accepted` with `ticket_id`
- `livekit_joined` with `participant_type: "agent"`

**UI Verification:**
- Mute/Unmute button works
- End Call button visible
- Call duration timer visible

---

### ✅ Step 9: Handoff Timeout (90s)
**Action:** 
- Trigger another handoff: "Connect me again"
- Wait 90+ seconds WITHOUT tapping the SMS link

**Expected:**
- After ~90s, AI says: "I'm sorry, no one is available right now. Is there anything else I can help with?"
- Ticket marked as `timeout` in database

**Events to Check:**
- `handoff_requested` logged
- `sms_sent` logged
- After 90s: `handoff_timeout` logged

**Verify:**
\`\`\`sql
SELECT * FROM handoff_tickets WHERE status = 'timeout';
-- Should show the timed-out ticket
\`\`\`

---

### ✅ Step 10: Call End
**Action:** Click "End Call" button

**Expected:**
- Call disconnects cleanly
- Timer stops
- Final duration calculated
- "Call ended" message displayed

**Events to Check:**
- `call_ended` with `duration_seconds`

**Verify:**
\`\`\`sql
SELECT 
  ce.event_name, 
  ce.created_at,
  ce.payload
FROM call_events ce
WHERE ce.call_id = '[your_call_id]'
ORDER BY ce.created_at;
\`\`\`

**Should see complete timeline:**
1. call_started
2. first_ai_audio
3. barge_in (×3)
4. function_call_invoked (saveLead)
5. tool_result_returned
6. lead_saved
7. function_call_invoked (searchWeb)
8. tool_called
9. tool_result_returned
10. function_call_invoked (requestHandoff)
11. handoff_requested
12. sms_sent
13. tool_result_returned
14. handoff_accepted
15. livekit_joined
16. handoff_requested (second)
17. sms_sent
18. handoff_timeout
19. livekit_left
20. call_ended

---

## Security & Safety Verification

### ✅ Widget Origin Check
**Action:** 
- Embed widget on disallowed origin (e.g., `http://unauthorized-site.com`)

**Expected:**
- Widget does NOT render
- Console shows warning: `[Voice AI Widget] Origin not allowed. Current origin: http://unauthorized-site.com, Allowed origins: [...]`

---

### ✅ Secrets Check (Client Bundle)
**Action:**
\`\`\`bash
# Build production bundle
pnpm build

# Search for leaked secrets
grep -r "OPENAI_API_KEY" .next/
grep -r "SUPABASE_SERVICE_ROLE_KEY" .next/
grep -r "TWILIO_AUTH_TOKEN" .next/
grep -r "JWT_SECRET" .next/

# Should return 0 matches for all
\`\`\`

**Expected:** No secrets found in client bundle

---

### ✅ DEV Routes Blocked in Production
**Action:**
\`\`\`bash
# Set NODE_ENV=production
export NODE_ENV=production

# Try to access dev route
curl -X POST "https://yourdomain.vercel.app/api/dev/apply-sql?name=01_tables"
\`\`\`

**Expected:** Returns `403 Forbidden` with message "DEV routes are disabled in production"

---

### ✅ Rate Limiting
**Action:** Send 15 rapid requests to `/api/session`

**Expected:**
- First 10 requests succeed (200)
- Requests 11-15 fail with 429 (Too Many Requests)
- Wait 60 seconds → rate limit resets

---

## Performance Metrics

### Target SLAs (from Latency Budget)
| Metric | Target | Acceptable |
|--------|--------|------------|
| First AI audio | ≤800ms | ≤1000ms |
| Barge-in latency | ≤100ms | ≤150ms |
| Tool execution | ≤2000ms | ≤3000ms |
| LiveKit join | ≤2000ms | ≤3000ms |

### Calculate from Events
\`\`\`sql
-- First AI audio latency
SELECT 
  EXTRACT(EPOCH FROM (first_audio.created_at - started.created_at)) * 1000 AS latency_ms
FROM call_events started
JOIN call_events first_audio ON first_audio.call_id = started.call_id
WHERE started.event_name = 'call_started'
  AND first_audio.event_name = 'first_ai_audio';

-- Barge-in latencies
SELECT 
  call_id,
  created_at,
  payload->>'timestamp' AS barge_in_time
FROM call_events
WHERE event_name = 'barge_in';

-- Tool execution times
SELECT 
  invoked.call_id,
  invoked.payload->>'tool_name' AS tool_name,
  EXTRACT(EPOCH FROM (returned.created_at - invoked.created_at)) * 1000 AS execution_ms
FROM call_events invoked
JOIN call_events returned ON returned.call_id = invoked.call_id
WHERE invoked.event_name = 'function_call_invoked'
  AND returned.event_name = 'tool_result_returned'
  AND invoked.created_at < returned.created_at;
\`\`\`

---

## Acceptance Criteria

### ✅ Local Environment
- [ ] All 10 smoke test steps pass
- [ ] Complete event timeline logged in `call_events`
- [ ] No errors in browser console (except expected origin check warnings)
- [ ] No errors in Next.js server logs

### ✅ Production Environment
- [ ] All 10 smoke test steps pass on Vercel production URL
- [ ] Widget origin allowlist enforced
- [ ] DEV routes return 403
- [ ] No secrets in client bundle
- [ ] Privacy banner visible on call page
- [ ] SMS delivered to verified numbers (Twilio trial limitation documented)

### ✅ Performance
- [ ] First AI audio ≤1000ms (p95)
- [ ] Barge-in ≤150ms (all attempts)
- [ ] Tool execution ≤3000ms
- [ ] LiveKit join ≤3000ms

---

## Rollback Procedures

### If LiveKit Fails in Production
**Symptom:** Agents cannot connect to customers; `livekit_joined` events missing

**Action:**
1. Add a feature flag environment variable to disable handoff temporarily
2. Update the AI prompt to gracefully handle disabled handoff
3. Deploy immediately
4. AI continues to function; handoff gracefully disabled

**Note:** This is a manual rollback strategy - the feature flag is not currently implemented in the codebase.

### If SMS Enrichment Causes Multi-Segment Issues
**Symptom:** Agents report receiving multiple SMS fragments; billing concerns

**Action:**
1. Revert to short SMS template:
   \`\`\`typescript
   // In app/api/handoff/request/route.ts
   const smsBody = `Call handoff requested! Reason: ${reason}\nJoin: ${acceptUrl}`
   \`\`\`

2. Deploy
3. SMS becomes single-segment; costs reduced

### Full Rollback
**Action:**
1. Go to Vercel dashboard
2. Find previous stable deployment
3. Click "Promote to Production"
4. Verify rollback successful

**Database Rollback (if needed):**
- Refer to `user_read_only_context/project_sources/11_Runbook.txt`
- Use Supabase point-in-time recovery
- Target timestamp before breaking change

---

## Go/No-Go Checklist

Before launching to production, all items must be checked:

**Functionality:**
- [ ] Voice call connects successfully
- [ ] First AI audio ≤1.0s
- [ ] Interrupts work reliably
- [ ] Lead capture saves to database
- [ ] Web search executes once per question
- [ ] Handoff SMS sent and received
- [ ] Agent can join via LiveKit
- [ ] Handoff timeout works (90s)
- [ ] Call ends cleanly

**Security:**
- [ ] Origin allowlist enforced
- [ ] Rate limiting active
- [ ] No secrets in client bundle
- [ ] DEV routes blocked (403 in prod)
- [ ] Privacy banner visible

**Performance:**
- [ ] First audio ≤1000ms (p95)
- [ ] Barge-in ≤150ms
- [ ] Tool execution ≤3000ms

**Documentation:**
- [ ] README updated with setup steps
- [ ] Environment variables documented
- [ ] Twilio trial limitations noted
- [ ] Rollback procedures documented

**Monitoring:**
- [ ] Event logging working
- [ ] Supabase connection stable
- [ ] Error tracking configured

---

## Post-Launch Monitoring

**First 24 Hours:**
- Monitor `call_events` table for anomalies
- Check error logs in Vercel dashboard
- Track handoff acceptance rate
- Measure p95 latencies

**Queries to Run:**
\`\`\`sql
-- Call success rate
SELECT 
  COUNT(*) FILTER (WHERE event_name = 'call_started') AS total_calls,
  COUNT(*) FILTER (WHERE event_name = 'call_ended') AS completed_calls
FROM call_events
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Lead capture rate
SELECT 
  COUNT(*) FILTER (WHERE event_name = 'call_started') AS total_calls,
  COUNT(DISTINCT call_id) FILTER (WHERE event_name = 'lead_saved') AS calls_with_leads
FROM call_events
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Handoff acceptance rate
SELECT 
  COUNT(*) FILTER (WHERE event_name = 'handoff_requested') AS total_handoffs,
  COUNT(*) FILTER (WHERE event_name = 'handoff_accepted') AS accepted_handoffs,
  COUNT(*) FILTER (WHERE event_name = 'handoff_timeout') AS timed_out_handoffs
FROM call_events
WHERE created_at > NOW() - INTERVAL '24 hours';
\`\`\`

---

**End of Smoke Test Checklist**
