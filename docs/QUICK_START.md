# Quick Start - Test in 5 Minutes

## Prerequisites (Free Tier OK!)

You need **3 API keys** to test the voice AI:

### 1. OpenAI Realtime API ($0.06/min)
- Sign up: https://platform.openai.com/signup
- Add $5 credit (minimum)
- Get API key: https://platform.openai.com/api-keys
- **Cost for testing:** ~$0.30 for 5 minutes of conversation

### 2. Supabase (FREE tier)
- Sign up: https://supabase.com/dashboard
- Create new project (takes ~2 minutes)
- Get keys from Settings → API
- **Cost:** $0 (free tier includes everything you need)

### 3. Tavily Search (FREE tier)
- Sign up: https://app.tavily.com/sign-up
- Get API key from dashboard
- **Cost:** $0 (1,000 free searches/month)

---

## Optional (for full handoff testing)

### 4. Twilio SMS ($0.0075/SMS)
- Sign up: https://www.twilio.com/try-twilio
- Get $15 free credit
- Get: Account SID, Auth Token, Phone Number
- **Cost for testing:** ~$0.08 for 10 test SMS

### 4b. Slack Incoming Webhook (FREE)
- Go to https://api.slack.com/messaging/webhooks
- Create/select an app and add the Incoming Webhooks feature
- Copy the generated webhook URL → `SLACK_WEBHOOK_URL`
- Choose the channel that should receive handoff alerts

### 5. LiveKit (FREE tier)
- Sign up: https://cloud.livekit.io/
- Create project
- Get: API Key, API Secret, URL
- **Cost:** $0 (free tier: 10,000 minutes/month)

---

## Setup Steps

### Step 1: Clone and Install
\`\`\`bash
git clone <your-repo>
cd voice-ai-widget
pnpm install
\`\`\`

### Step 2: Add Environment Variables
Copy `.env.example` to `.env.local` and add:

\`\`\`bash
# Required for voice AI
OPENAI_API_KEY=sk-proj-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
TAVILY_API_KEY=tvly-...

# Required for JWT tokens
JWT_SECRET=your-random-32-char-string

# Optional for handoff
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_FROM_NUMBER=+15551234567
LIVEKIT_API_KEY=APIxxx
LIVEKIT_API_SECRET=xxx
LIVEKIT_URL=wss://xxx.livekit.cloud

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
\`\`\`

### Step 3: Set Up Database
\`\`\`bash
# Start dev server
pnpm dev

# In another terminal, run migrations
curl -X POST "http://localhost:3000/api/dev/apply-sql?name=01_tables"
curl -X POST "http://localhost:3000/api/dev/apply-sql?name=02_indexes"
curl -X POST "http://localhost:3000/api/dev/apply-sql?name=03_rls"
curl -X POST "http://localhost:3000/api/dev/apply-sql?name=04_seed"
\`\`\`

### Step 4: Test the Call!
Open: http://localhost:3000/demo

This redirects to the demo campaign page where you can:
1. Click "Call" button
2. Allow microphone access
3. Wait ~1 second for AI to answer
4. Say "Hi, I'm interested in your product"
5. Test the conversation flow

---

## Cost Breakdown

### Minimum for Basic Testing (Voice Only)
- **OpenAI:** $5 credit = ~80 minutes of conversation
- **Supabase:** FREE
- **Tavily:** FREE
- **Total:** $5

### Full System with Handoff
- **OpenAI:** $5 credit
- **Twilio:** FREE ($15 trial credit)
- **LiveKit:** FREE (free tier)
- **Total:** $5

### Your $17 Budget
With $17, you can:
- Add $5 to OpenAI = 80+ minutes of voice AI testing
- Keep $12 for other services if needed
- **This is more than enough for full POC testing!**

---

## What Works Without Any UI

You can test everything via:

### 1. Voice Call Test
- Visit: `http://localhost:3000/demo`
- Click "Call" and talk!

### 2. Widget Test (on any HTML page)
Create `test.html`:
\`\`\`html
<!DOCTYPE html>
<html>
<body>
  <h1>Test Page</h1>
  <script 
    src="http://localhost:3000/widget.js" 
    data-campaign="c0000000-0000-0000-0000-000000000001" 
    async>
  </script>
</body>
</html>
\`\`\`
Open in browser - widget appears!

### 3. QR Code Test
Visit: `http://localhost:3000/api/campaigns/c0000000-0000-0000-0000-000000000001/qr`
Scan with phone → Opens call page!

### 4. Create New Campaign (curl)
\`\`\`bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "a0000000-0000-0000-0000-000000000001",
    "name": "My Test Campaign",
    "allowed_origins": ["*"]
  }'
\`\`\`
Returns new campaign ID and embed code!

---

## Testing Without Full Dashboard

You don't need a fancy UI to test! Use these methods:

### Check if call worked
\`\`\`sql
-- Run in Supabase SQL Editor
select * from calls order by created_at desc limit 5;
select * from call_events order by created_at desc limit 20;
\`\`\`

### Check if lead was captured
\`\`\`sql
select * from leads order by created_at desc limit 5;
\`\`\`

### Test handoff SMS
\`\`\`bash
curl -X POST http://localhost:3000/api/handoff/request \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "a0000000-0000-0000-0000-000000000001",
    "campaign_id": "c0000000-0000-0000-0000-000000000001",
    "reason": "Test handoff"
  }'
\`\`\`
Check your phone for SMS!

---

## Cost to Complete Full Dashboard

Based on `docs/PROJECT_STATUS.md`, here's the timeline and cost:

### Development Cost Estimate

**Option 1: DIY (Your Time)**
- 9 weeks @ 10-15 hours/week = 90-135 hours
- Following the implementation plan in PROJECT_STATUS.md
- **Cost:** $0 in money, your time investment

**Option 2: Hire Developer ($50-100/hr)**
- 90-135 hours × $75/hr average = **$6,750-10,125**

**Option 3: AI-Assisted Development (v0 + your guidance)**
- 40-60 hours of your time directing AI
- **Cost:** $0-200 (depending on AI tool subscriptions)

### API Costs During Development
- OpenAI: $10-20 for testing
- Supabase: FREE (stays on free tier)
- Twilio: FREE ($15 trial credit covers it)
- LiveKit: FREE (free tier sufficient)
- **Total API costs:** ~$10-20

### Production Monthly Costs (after launch)
- Supabase: $25/month (Pro plan)
- OpenAI: $0.06/minute × usage
- Twilio: $0.0075/SMS × handoffs
- LiveKit: FREE up to 10k minutes/month
- Vercel: FREE (hobby) or $20/month (Pro)
- **Estimate for 100 calls/month:** ~$50-75/month

---

## Recommended Path for Your Budget

With $17 available:

1. **Now: Add $5 to OpenAI** → Test everything voice-related
2. **Week 1-2:** Test all features with curl + SQL queries
3. **Week 3-4:** Build minimal admin UI for campaigns (if needed)
4. **Later:** Add full dashboard when budget allows

You can fully test and validate the POC with just $5, then decide if the full dashboard is worth the investment!
