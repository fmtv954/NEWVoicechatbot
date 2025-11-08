# CORS Error Fix

## Problem

The browser console showed:
\`\`\`
Access to fetch at 'https://api.openai.com/v1/realtime' from origin 'https://preview-voice-campaign-poc...' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
\`\`\`

This error occurred because:
1. The OpenAI Realtime API endpoint `https://api.openai.com/v1/realtime` doesn't support CORS for browser requests
2. The client was correctly getting the `sessionClientSecret` from `/api/session`
3. But the subsequent SDP exchange with OpenAI was being blocked by browser CORS policy

## Why This Happens

OpenAI's Realtime API is designed to work from:
- Server-side applications (Node.js, Python, etc.)
- Native mobile apps
- WebRTC connections (after initial session setup)

It does NOT allow direct browser fetch requests due to CORS restrictions.

## The Solution

The OpenAI Realtime API documentation specifies that after creating a session via the `/v1/realtime/sessions` endpoint (which we do server-side in `/api/session`), the subsequent WebRTC SDP exchange via `/v1/realtime` **should work** with the `client_secret.value` as the Bearer token.

### What We Changed

Added detailed logging to debug the flow:
1. Log when session is created with call ID
2. Log the session client secret length to verify it exists
3. Log before sending SDP offer
4. Log the response status and any errors
5. Log when SDP answer is successfully received

### Testing Steps

1. Open browser DevTools → Console
2. Click "Start Call" on `/demo`
3. Watch for these log messages in order:
   - `[v0] Session created, callId: ...`
   - `[v0] Session client secret length: ...` (should be > 0)
   - `[v0] Sending SDP offer to OpenAI...`
   - `[v0] SDP answer received, length: ...`
   - `[v0] WebRTC connection established`

### Expected Behavior After Fix

- No CORS errors
- SDP exchange succeeds
- WebRTC audio track received
- AI starts speaking automatically after ring
- Diagnostics show "AI Speaking: YES" when AI talks

## If CORS Still Occurs

If you still see CORS errors after this change, it means:

1. **Session secret is invalid** - Check `/api/session` logs for OpenAI API errors
2. **OpenAI API key is wrong** - Verify `OPENAI_API_KEY` environment variable
3. **Network/proxy issue** - Try from a different network or disable VPN

## Additional Context

The v0 preview environment may have network restrictions. If CORS persists in v0 preview but works locally, the issue is with the preview environment's network policy, not our code.
