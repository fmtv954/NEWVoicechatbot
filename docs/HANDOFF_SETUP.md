# Slack + LiveKit Handoff Setup

Follow this checklist to verify the human handoff pipeline before running a full end-to-end call.

## 1. Environment Variables

Set the following values in `.env.local` (or deployment secrets) and restart the Next.js server:

| Variable | Description |
| --- | --- |
| `SLACK_WEBHOOK_URL` | Incoming webhook URL that will receive the handoff card. |
| `NEXT_PUBLIC_APP_URL` | Base URL agents will open from the Slack card (e.g. `http://localhost:3000`). |
| `LIVEKIT_API_KEY` | LiveKit API key used to mint agent tokens. |
| `LIVEKIT_API_SECRET` | LiveKit API secret used alongside the key. |
| `LIVEKIT_URL` | Websocket URL for your LiveKit instance (e.g. `wss://<project>.livekit.cloud`). |
| `JWT_SECRET` | Secret used to mint handoff acceptance tokens. |

Optional helpers:

- `HANDOFF_BASE_URL`, `HANDOFF_AGENT_ID`, `HANDOFF_CAMPAIGN_ID`, `HANDOFF_REASON`, `HANDOFF_CALL_ID` can be set to streamline the test script (see below).

## 2. Restart and Verify Environment

\`\`\`bash
pnpm dev
open http://localhost:3000/api/env/status
\`\`\`

Ensure the page reports `present: true` for each key above.

## 3. Trigger a Manual Handoff

Use the helper script to exercise `/api/handoff/request` without running a full call:

\`\`\`bash
pnpm tsx scripts/test-handoff-request.ts \
  --agent-id=a0000000-0000-0000-0000-000000000001 \
  --campaign-id=c0000000-0000-0000-0000-000000000001 \
  --reason="Manual QA handoff"
\`\`\`

The script prints the HTTP status, headers, and response body. You should see `200 OK`, the ticket ID, and `notification_sent: true`.

## 4. Confirm Slack Delivery

- Open the Slack channel attached to the webhook.
- Verify a new card with the “✅ Accept Call” button appears.
- Click the button to launch `/agent/accept?token=...`.

## 5. Verify LiveKit Join

After clicking the Slack card link:

1. Accept the handoff on `/agent/accept`.
2. Confirm the page shows “Connected!”.
3. Check Supabase `call_events` for `handoff_accepted` and `livekit_joined`.

At this point the environment is ready for a full end-to-end call test. Refer back to `docs/SMOKE_TEST.md` for the remaining QA steps.
