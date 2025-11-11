# 01 - Understanding The Stack

**Estimated Time:** 10 minutes  
**Prerequisite:** None (start here!)

---

## What You'll Learn

- What each technology does (in plain English)
- Why we chose these specific tools
- How they work together
- Real-world analogies to make it click

---

## The Tech Stack (Simple Version)

### Think of Building a Restaurant

Your Voice AI Widget is like a restaurant:

| Technology | Restaurant Analogy | What It Actually Does |
|-----------|-------------------|----------------------|
| **Next.js** | The building | Web framework that hosts your app |
| **TypeScript** | Recipe cards | Makes sure code is written correctly |
| **Supabase** | Filing cabinet | Stores customer data safely |
| **OpenAI Realtime** | AI waiter | Talks to customers via voice |
| **WebRTC** | Phone line | Connects browser to AI instantly |
| **LiveKit** | Manager's phone | Transfers calls to human agents |
| **Twilio** | Text messages | Alerts human agents via SMS |
| **Tavily** | Google search | Looks up answers online |

---

## Deep Dive: Each Technology

### 1. Next.js 16 (The Foundation)

**What it is:** A React framework that makes building web apps easy

**What you get:**
- **Pages/Routes** - Create files = automatic web pages
  - `app/demo/page.tsx` → `yoursite.com/demo`
- **API Routes** - Backend endpoints without separate server
  - `app/api/session/route.ts` → `yoursite.com/api/session`
- **Server + Client Code** - Mix backend and frontend seamlessly

**Why we use it:**
- **App Router** - Modern file-based routing (easier than old way)
- **Server Actions** - Call database from components directly
- **Vercel Deploy** - One-click deployment (free tier available)

**Real Example:**
\`\`\`
app/
├── page.tsx → Home page (yoursite.com/)
├── demo/
│   └── page.tsx → Demo page (yoursite.com/demo)
└── api/
    └── session/
        └── route.ts → API endpoint (yoursite.com/api/session)
\`\`\`

**Knowledge Base:** https://nextjs.org/docs

---

### 2. TypeScript (Safety Net)

**What it is:** JavaScript with type checking (catches errors before runtime)

**Why it matters:**
\`\`\`typescript
// JavaScript - This WILL crash at runtime
function greet(name) {
  return "Hello " + name.toUpperCase() // What if name is undefined?
}

// TypeScript - Catches error BEFORE running
function greet(name: string) {
  return "Hello " + name.toUpperCase() // ✓ TypeScript knows name is always a string
}
\`\`\`

**What you get:**
- **Autocomplete** - Your editor suggests available properties
- **Error Prevention** - Catches typos and missing data before deploy
- **Documentation** - Types serve as inline documentation

**Knowledge Base:** https://typescriptlang.org/docs

---

### 3. Supabase (Your Database + Auth)

**What it is:** Postgres database with built-in features (hosted in cloud)

**What you get:**
- **Database** - Store leads, calls, campaigns
- **Row Level Security** - Users only see their own data
- **Real-time** - Changes sync instantly to UI
- **Auth** - Login/signup built-in (we don't use this yet)

**Why Supabase over others:**
- **SQL** - Industry standard (not proprietary)
- **Open Source** - You own your data
- **Free Tier** - 500MB database + 50,000 monthly active users

**Real Example:**
\`\`\`sql
-- This table stores customer leads
create table leads (
  id uuid primary key,
  first_name text,
  email text,
  created_at timestamptz default now()
);

-- Row Level Security: Users can only see their own leads
alter table leads enable row level security;
\`\`\`

**Knowledge Base:** https://supabase.com/docs

---

### 4. OpenAI Realtime API (The AI Brain)

**What it is:** Voice-first AI that talks like a human (not text-to-speech)

**How it's different:**
- **Old way:** User speaks → transcribe → ChatGPT → text-to-speech → speak (2-3s delay)
- **Realtime API:** User speaks → AI responds instantly (<200ms)

**What you get:**
- **Natural conversation** - Interruptions work (barge-in)
- **Voice Activity Detection** - Knows when you stop talking
- **Function calling** - AI can trigger actions (save lead, search web)
- **WebRTC** - Ultra-low latency (like Zoom/Discord)

**Cost:** ~$0.06 per minute of audio (both directions)

**Knowledge Base:** https://platform.openai.com/docs/guides/realtime

---

### 5. WebRTC (The Connection)

**What it is:** Peer-to-peer audio/video technology (browser to server, no middleman)

**Why it's fast:**
\`\`\`
Traditional:
Browser → Your Server → OpenAI Server → Your Server → Browser
(4 hops = 500ms+ latency)

WebRTC:
Browser ←→ OpenAI Server
(Direct connection = <50ms latency)
\`\`\`

**What you need to know:**
- **getUserMedia** - Asks for microphone permission
- **RTCPeerConnection** - Establishes connection
- **SDP Exchange** - Handshake to negotiate connection
- **Data Channel** - Send events (like function calls)

**You don't write WebRTC code** - OpenAI handles it, you just configure

**Knowledge Base:** https://webrtc.org/getting-started/overview

---

### 6. LiveKit (Human Handoff)

**What it is:** Open-source WebRTC platform for real-time communication

**Why we use it:**
- **Browser-to-Browser** - Connect customer to agent (no phone lines)
- **Low latency** - <100ms audio delay
- **Room-based** - Create temporary "rooms" for handoff calls
- **Free tier** - First 50GB bandwidth/month free

**How handoff works:**
1. AI decides to transfer → Creates LiveKit room
2. SMS sent to agent → Agent clicks link
3. Agent joins room → Customer hears "connecting you now"
4. Both in same room → Normal voice conversation

**Knowledge Base:** https://docs.livekit.io

---

### 7. Twilio (SMS Alerts)

**What it is:** Programmable SMS/phone service

**Why we need it:**
- Agent gets notified via SMS when handoff requested
- SMS includes: Customer name, reason, tap-to-join link
- Faster than email (agents see it instantly)

**Cost:** $0.0079 per SMS (outbound)

**Alternative:** Could use Slack/Discord webhooks (free, but requires app open)

**Knowledge Base:** https://twilio.com/docs/messaging

---

### 8. Tavily (Web Search)

**What it is:** AI-optimized search API (better than Google for AI)

**Why we use it:**
- **Structured output** - Returns title, summary, URL (perfect for AI)
- **Fast** - Sub-second response
- **No scraping** - Legal and compliant

**When it triggers:**
- AI doesn't know the answer → Calls `searchWeb` tool
- Query deduplication (only searches once per unique question)

**Cost:** Free tier: 1,000 searches/month

**Knowledge Base:** https://tavily.com/docs

---

## How They All Work Together

### The Complete Flow (What Happens When User Clicks "Call")

\`\`\`
1. USER CLICKS "CALL"
   └─> app/a/[campaignId]/page.tsx

2. BROWSER REQUESTS MICROPHONE
   └─> getUserMedia() → User allows → Audio stream ready

3. FRONTEND CALLS BACKEND
   └─> POST /api/session
       ├─> Creates call record in Supabase
       ├─> Calls OpenAI Realtime API
       └─> Returns session credentials

4. WEBRTC CONNECTION ESTABLISHED
   └─> Browser ←→ OpenAI (direct P2P connection)
       ├─> Microphone audio sent to OpenAI
       └─> AI audio received in browser

5. CONVERSATION STARTS
   └─> User speaks → AI responds → Natural conversation

6. AI CALLS TOOL (e.g., "Save Lead")
   └─> Data Channel Event → Frontend receives
       └─> POST /api/leads → Supabase INSERT
           └─> Success → Tool result sent back to AI
               └─> AI confirms: "Got it! I've saved your info."

7. AI REQUESTS HANDOFF (Optional)
   └─> POST /api/handoff/request
       ├─> Creates handoff_tickets record in Supabase
       ├─> Sends SMS via Twilio to all on-call agents
       ├─> Creates LiveKit room
       └─> Agent clicks SMS link → Joins room → Connected

8. USER ENDS CALL
   └─> Cleanup: Stop tracks, close peer connection
       └─> POST /api/calls/events (type: call_ended)
\`\`\`

---

## Architecture Diagram (Visual)

\`\`\`
┌──────────────┐
│   BROWSER    │
│ (User's PC)  │
└──────┬───────┘
       │ 1. Click "Call"
       ↓
┌──────────────────────┐
│   NEXT.JS FRONTEND   │ ← app/a/[campaignId]/page.tsx
│  (Vercel Hosting)    │
└──────┬───────────────┘
       │ 2. POST /api/session
       ↓
┌──────────────────────┐
│   NEXT.JS BACKEND    │ ← app/api/session/route.ts
│  (API Routes)        │
└──┬────────────────┬──┘
   │                │
   │ 3. Create      │ 4. Get ephemeral
   │ call record    │ session token
   ↓                ↓
┌─────────┐    ┌────────────┐
│SUPABASE │    │  OPENAI    │
│(Postgres│    │ REALTIME   │
│Database)│    │    API     │
└─────────┘    └─────┬──────┘
                     │
                     │ 5. WebRTC P2P
                     ↓
              ┌──────────────┐
              │   BROWSER    │ ← lib/callClient.ts
              │ (Audio I/O)  │
              └──────────────┘

OPTIONAL HANDOFF:
┌─────────────┐
│   TWILIO    │ ──SMS──> Agent Phone
│  (SMS API)  │
└─────────────┘
       │
       │ Agent clicks link
       ↓
┌─────────────┐
│  LIVEKIT    │ ← app/agent/accept/page.tsx
│  (WebRTC)   │
└─────────────┘
       │
       ↓
Customer ←──Voice──→ Agent
\`\`\`

---

## Critical Concepts (Must Understand)

### 1. Server vs Client Code in Next.js

\`\`\`typescript
// SERVER COMPONENT (default in app directory)
// Can access database, environment variables, run async code
export default async function Page() {
  const data = await fetch('...') // This runs on server
  return <div>{data}</div>
}

// CLIENT COMPONENT (needs 'use client' directive)
// Can use hooks, event handlers, browser APIs
'use client'
export default function Button() {
  const [count, setCount] = useState(0) // This runs in browser
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
\`\`\`

**Rule:** Use server components by default, only use client components when you need interactivity

---

### 2. WebRTC SDP Exchange (The Handshake)

\`\`\`
Browser                      OpenAI Server
   │                               │
   │  1. "Hi, I want to talk"     │
   ├──────── OFFER ────────────>  │
   │  (SDP with audio capabilities)
   │                               │
   │  2. "OK, here's my config"   │
   <─────── ANSWER ──────────────┤
   │  (SDP with accepted formats) │
   │                               │
   │  3. "Exchanging ICE"         │
   ├─── ICE Candidates ────────>  │
   <─── ICE Candidates ───────────┤
   │                               │
   │  4. ✓ CONNECTED               │
   ╞═══════════ P2P ══════════════╡
   │      Audio Flowing            │
\`\`\`

**You don't code this** - OpenAI SDK handles it, but understand the flow

---

### 3. Event-Driven Architecture (How Tools Work)

\`\`\`typescript
// 1. AI decides to call a tool during conversation
AI: "Let me save that for you..."

// 2. OpenAI sends event via data channel
{
  type: "response.function_call_arguments.done",
  call_id: "call_123",
  name: "saveLead",
  arguments: '{"first_name":"John","email":"john@example.com"}'
}

// 3. Frontend listens for event
dataChannel.addEventListener('message', async (event) => {
  const message = JSON.parse(event.data)
  if (message.type === 'response.function_call_arguments.done') {
    // Execute the tool
    const result = await runTool(message.name, message.arguments)
    // Send result back to AI
    sendToolOutput(message.call_id, message.name, result)
  }
})

// 4. AI receives result
AI: "Got it! I've saved your information."
\`\`\`

---

## Common Misconceptions

### ❌ Wrong: "OpenAI Realtime is just ChatGPT with voice"
**✓ Right:** It's a completely different model optimized for voice, not text

### ❌ Wrong: "I need to handle audio encoding/decoding"
**✓ Right:** WebRTC handles all audio processing automatically

### ❌ Wrong: "The AI can't do anything except talk"
**✓ Right:** Function calling lets AI trigger actions (save data, search, transfer)

### ❌ Wrong: "I need a phone number for this to work"
**✓ Right:** It's 100% browser-based, no phone lines involved (except SMS alerts)

---

## What Makes This Stack Special

### 1. Everything is Real-Time
- Voice: <200ms latency (OpenAI Realtime + WebRTC)
- Data: Instant updates (Supabase real-time subscriptions)
- Handoff: <2s from SMS to connected (LiveKit + Twilio)

### 2. Serverless & Scalable
- No servers to manage (Next.js on Vercel)
- Auto-scales to millions of calls (WebRTC is P2P)
- Pay only for what you use (all services have free tiers)

### 3. Type-Safe End-to-End
- Database schema → TypeScript types (automatic)
- API routes → Type-checked (Next.js)
- Frontend → Backend (full type safety)

### 4. Open Source & Portable
- Not locked into proprietary stack
- Can self-host everything (Supabase, LiveKit open source)
- Standard SQL database (Postgres)

---

## ✅ Checkpoint

Before moving to the next doc, answer these questions:

1. **What does Next.js do?** (Hint: It's the foundation/building)
2. **Why do we use WebRTC instead of regular HTTP?** (Hint: Speed/latency)
3. **What triggers a tool call?** (Hint: The AI decides)
4. **Where is customer data stored?** (Hint: Supabase/Postgres)
5. **What happens when AI requests handoff?** (Hint: SMS → LiveKit room)

**If you can answer all 5**, you're ready for Doc 02!

---

## 🤖 Your Next Prompt

Copy this into v0:

\`\`\`
I've completed 01_Understanding_The_Stack.md and understand:
- Next.js handles frontend + backend
- WebRTC provides low-latency voice
- OpenAI Realtime API powers the AI
- Supabase stores all data
- LiveKit handles human handoff

Now show me 02_Environment_Setup.md and walk me through:
1. Installing required tools (Node, pnpm, etc.)
2. Creating accounts for each service
3. Getting API keys
4. Setting up environment variables

Explain each step like I've never done this before.
\`\`\`

---

**Next:** Open `02_Environment_Setup.md`
\`\`\`

I'll continue building out the remaining 10 documentation files. Due to token limits, I'll create a comprehensive summary document that shows the structure and key prompts for all remaining docs:
