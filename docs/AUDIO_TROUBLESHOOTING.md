# Audio Troubleshooting Guide

This guide helps diagnose why you might not hear the AI or ring tone during calls.

## Quick Diagnosis Checklist

Use the **Audio Diagnostics** button on the `/demo` page to automatically test:

- ✓ Browser compatibility
- ✓ Microphone permissions
- ✓ Audio output support
- ✓ AudioContext state
- ✓ Ring tone file exists
- ✓ Autoplay policy
- ✓ WebRTC support

## Common Issues & Solutions

### 1. No Ring Tone (Not Critical)

**Symptoms:**
\`\`\`
[v0] Failed to play ring tone: Failed to load because no supported source was found.
\`\`\`

**Causes:**
- Ring.mp3 file missing from `/public`
- Browser autoplay policy blocking audio
- Audio codec not supported

**Solutions:**
- ✅ **Safe to ignore** - Ring tone is cosmetic, call still works
- Check if `/publichttps://hebbkx1anhila5yf.public.blob.vercel-storage.com/phone-ringing-382734-Dpm4XMvhZGxma3hoWloFLrI4kdq22a.mp3` exists
- Click anywhere on page before calling (enables autoplay)

---

### 2. No AI Voice (Critical)

**Symptoms:**
\`\`\`
[v0] Remote audio is now PLAYING - you should hear the AI
\`\`\`
But you hear nothing.

**Root Causes:**

#### A. Browser Autoplay Policy
Modern browsers block audio until user interacts with page.

**Solution:**
\`\`\`javascript
// User must click/tap BEFORE audio can play
// Our fix: Audio plays after "Start Call" button click
\`\`\`

**Test:**
1. Click "Start Call"
2. Wait 3-4 seconds without clicking anything else
3. You should hear AI greeting

#### B. AudioContext Suspended
Browser suspends audio contexts until user interaction.

**Console Check:**
\`\`\`javascript
const ctx = new AudioContext()
console.log(ctx.state) // "suspended" = blocked
\`\`\`

**Solution:**
\`\`\`javascript
// Resume on user gesture
document.addEventListener('click', async () => {
  const ctx = new AudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
})
\`\`\`

#### C. Audio Element Not Attached to DOM
Remote audio might not play if not in document.

**Our Fix (already implemented):**
\`\`\`javascript
this.remoteAudioElement.style.display = 'none'
document.body.appendChild(this.remoteAudioElement) // ← Critical!
\`\`\`

#### D. Volume Set to Zero
Audio might be muted by system or browser.

**Check:**
1. System volume > 0
2. Browser tab not muted (check tab icon)
3. Audio element volume = 1.0

---

### 3. Microphone Not Working

**Symptoms:**
\`\`\`
DOMException: Permission denied
\`\`\`

**Solutions:**
1. Click browser address bar lock icon
2. Allow microphone permissions
3. Refresh page and try again

---

### 4. WebRTC Connection Fails

**Symptoms:**
\`\`\`
Failed to exchange SDP with OpenAI
\`\`\`

**Causes:**
- Invalid OpenAI API key
- Network firewall blocking WebRTC
- STUN server unreachable

**Solutions:**
1. Verify `OPENAI_API_KEY` is set correctly
2. Check firewall allows UDP ports 3478, 19302
3. Test from different network (mobile hotspot)

---

## Debugging Console Logs

### Normal Call Flow

\`\`\`
[v0] Ring tone playing
[v0] Data channel opened
[v0] Received remote track: audio
[v0] First remote audio received - stopping ring and starting timer
[v0] Remote audio element created and connected to stream
[v0] Remote audio is now PLAYING - you should hear the AI
\`\`\`

### Problem Indicators

| Log Message | Issue | Severity |
|-------------|-------|----------|
| `Failed to play ring tone` | Ring.mp3 not loading | Low - cosmetic only |
| `Failed to play remote audio` | Autoplay blocked | **High** - no AI audio |
| `Permission denied` | Mic access denied | **High** - can't call |
| `Failed to create session` | API/auth error | **High** - no connection |
| `Remote audio playback error` | Audio codec issue | **High** - no AI audio |

---

## Testing Strategy

### Step 1: Run Audio Diagnostics
Click "Audio Diagnostics" button on `/demo` page and verify all checks pass.

### Step 2: Manual Test
1. **Before calling:** Click anywhere on page (enables audio)
2. Click "Start Call"
3. **Don't click anything** for 5 seconds
4. Wait for AI greeting: "Hey there! I'm Sunny..."

### Step 3: Check Console
Open DevTools (F12) and look for:
- ✅ `[v0] Remote audio is now PLAYING`
- ✅ No red error messages
- ❌ Any `Failed to play` errors

### Step 4: Test Interruption
1. While AI is speaking, say something
2. AI should stop immediately (<150ms)
3. Console should show: `[v0] Interrupting AI`

---

## Browser-Specific Issues

### Chrome/Edge (Recommended)
✅ Best support for WebRTC and OpenAI Realtime API

**Known Issues:**
- Autoplay blocked until user gesture
- **Fix:** Implemented - call button click enables audio

### Safari
⚠️ Stricter autoplay policies

**Known Issues:**
- AudioContext suspended by default
- May require double-click to enable audio

**Fix:**
\`\`\`javascript
// Resume AudioContext on first click
document.addEventListener('click', async () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  await ctx.resume()
}, { once: true })
\`\`\`

### Firefox
✅ Good WebRTC support

**Known Issues:**
- Different audio codec preferences
- May need `audio/opus` instead of `audio/pcm16`

---

## Advanced Debugging

### Enable Verbose Logging

Add to `lib/callClient.ts`:
\`\`\`javascript
this.peerConnection.addEventListener('track', (event) => {
  console.log('[v0] Track event:', {
    kind: event.track.kind,
    id: event.track.id,
    enabled: event.track.enabled,
    muted: event.track.muted,
    readyState: event.track.readyState
  })
})
\`\`\`

### Monitor Audio Stream
\`\`\`javascript
const stream = event.streams[0]
console.log('[v0] Audio tracks:', stream.getAudioTracks().map(t => ({
  label: t.label,
  enabled: t.enabled,
  muted: t.muted
})))
\`\`\`

### Check Remote Audio Element
\`\`\`javascript
console.log('[v0] Remote audio state:', {
  paused: this.remoteAudioElement.paused,
  volume: this.remoteAudioElement.volume,
  readyState: this.remoteAudioElement.readyState,
  networkState: this.remoteAudioElement.networkState
})
\`\`\`

---

## Environment Variables

Verify all required keys are set:

\`\`\`bash
# Required for calls
OPENAI_API_KEY=sk-...          # OpenAI Realtime API
SUPABASE_URL=https://...        # Database
SUPABASE_SERVICE_ROLE_KEY=...  # Server-side DB access

# Optional (for handoff)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
LIVEKIT_API_KEY=...
\`\`\`

Check on `/demo` page → Environment Check section.

---

## Still Not Working?

### Last Resort Checklist

1. ✅ Opened `/demo` in Chrome/Edge (not Safari)
2. ✅ Clicked "Run Diagnostics" - all pass
3. ✅ Clicked "Start Call" and waited 5 seconds
4. ✅ Console shows "Remote audio is now PLAYING"
5. ✅ System volume > 50%
6. ✅ Browser tab not muted
7. ❌ **Still no audio**

### Possible Issues

**A. OpenAI API Issue**
- Check OpenAI status: https://status.openai.com
- Verify API key has Realtime API access
- Try regenerating API key

**B. Network/Firewall**
- Test from different network (mobile hotspot)
- Check corporate firewall isn't blocking WebRTC
- Verify UDP ports 3478, 19302 open

**C. Hardware**
- Test with different headphones/speakers
- Check system audio settings
- Try different output device

**D. Browser Extension**
- Disable ad blockers (they sometimes block audio)
- Try incognito/private mode
- Clear browser cache and cookies

---

## Success Criteria

✅ **Working Call:**
1. Click "Start Call"
2. Hear ring tone (optional)
3. Ring stops within 1 second
4. Hear AI say: "Hey there! I'm Sunny, your friendly AI assistant..."
5. Timer starts counting
6. You can interrupt AI mid-sentence

If all 6 steps work, your setup is correct!

---

## Report Issues

If diagnostics pass but audio still doesn't work:

1. Copy console logs (F12 → Console → Right-click → Save As)
2. Note browser version: `chrome://version` or `about:support`
3. Include diagnostic results screenshot
4. Open GitHub issue with all info

---

## Quick Fixes Summary

| Problem | Quick Fix |
|---------|-----------|
| No ring tone | Ignore - cosmetic only |
| No AI voice | Click page before calling |
| Mic denied | Allow in browser settings |
| Autoplay blocked | Implemented - button click fixes |
| Muted tab | Click speaker icon in tab |
| Low volume | Check system + browser volume |
| Still nothing | Try Chrome in incognito mode |
