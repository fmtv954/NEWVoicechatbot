# Troubleshooting Guide

## Call connects but no audio from AI

Based on your debug logs, the WebRTC connection is working perfectly. If you can't hear the AI:

### Most Common Issues:

**1. Browser tab is muted**
- Look for a speaker icon with an X on the browser tab
- Right-click the tab → Unmute site

**2. Device volume too low**
- Check system volume
- Check browser volume (some browsers have per-site volume controls)

**3. Interrupted too early**
- Your logs show "Interrupting AI" was called twice
- This means you clicked "Interrupt" or spoke before the AI finished
- Wait 2-3 seconds after connection for AI to start greeting
- Don't click "Interrupt" unless the AI is actually speaking

**4. Browser autoplay restrictions**
- Some browsers block audio until user interaction
- Try clicking anywhere on the page first, then start the call

### Debug Steps:

**Check browser console (F12):**
\`\`\`
Look for: "[v0] Remote audio is now PLAYING - you should hear the AI"
\`\`\`
- If you see this, audio IS working - check device/tab volume
- If you don't see this, there's an audio playback issue

**Check for errors:**
\`\`\`
Look for: "[v0] Remote audio playback error:"
\`\`\`
- This indicates a browser audio issue

**Verify WebRTC is working:**
\`\`\`
Look for: "[v0] WebRTC connection established"
Look for: "[v0] First remote audio received"
\`\`\`
- Both should appear - if not, there's a connection issue

### Your Specific Issue:

Your logs show:
\`\`\`
✅ WebRTC connection established
✅ First remote audio received
✅ Data channel opened
⚠️  Interrupting AI (called twice)
\`\`\`

**Diagnosis:** You interrupted the AI before it could finish speaking. Try these steps:

1. Start call
2. Wait 3-4 seconds WITHOUT clicking anything
3. Listen for the AI greeting: "Hey there! I'm Sunny..."
4. Only click "Interrupt" if the AI is mid-sentence and you want to talk

### Still Not Working?

**Test if it's an audio output issue:**
1. Open another tab
2. Play a YouTube video
3. If you can hear YouTube but not the AI, it's likely browser autoplay restrictions

**Workaround:**
1. Close the call page
2. Go to chrome://settings/content/sound
3. Add your localhost URL to "Allowed to play sound"
4. Reload and try again

### Environment Variable Checklist:

Make sure these are set correctly:
\`\`\`bash
OPENAI_API_KEY=sk-proj-...  # Must be valid
NEXT_PUBLIC_APP_URL=http://localhost:3000
\`\`\`

If `OPENAI_API_KEY` is missing or invalid, the session will fail silently.
