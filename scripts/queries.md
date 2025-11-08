# SQL Queries for Performance & Reliability Checks

Quick reference for measuring latency metrics and verifying call event completeness after test runs.

---

## Latency Metrics (p95 Calculation)

### First AI Audio Latency

Measures time from call start to first remote audio received. Target: ≤1000ms

\`\`\`sql
-- Individual call latencies
SELECT 
  started.call_id,
  EXTRACT(EPOCH FROM (first_audio.created_at - started.created_at)) * 1000 AS first_audio_ms
FROM call_events started
JOIN call_events first_audio ON first_audio.call_id = started.call_id
WHERE started.event_name = 'call_started'
  AND first_audio.event_name = 'first_ai_audio'
ORDER BY first_audio_ms DESC;

-- p95 calculation
WITH latencies AS (
  SELECT 
    EXTRACT(EPOCH FROM (first_audio.created_at - started.created_at)) * 1000 AS latency_ms
  FROM call_events started
  JOIN call_events first_audio ON first_audio.call_id = started.call_id
  WHERE started.event_name = 'call_started'
    AND first_audio.event_name = 'first_ai_audio'
)
SELECT 
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_first_audio_ms,
  AVG(latency_ms) AS avg_first_audio_ms,
  MIN(latency_ms) AS min_first_audio_ms,
  MAX(latency_ms) AS max_first_audio_ms
FROM latencies;
\`\`\`

**Expected:** p95 ≤1000ms

---

### Barge-In Latency

Measures interrupt responsiveness. Target: ≤150ms

\`\`\`sql
-- Individual barge-in events
SELECT 
  call_id,
  created_at,
  payload->>'timestamp' AS barge_in_time
FROM call_events
WHERE event_name = 'barge_in'
ORDER BY created_at DESC;

-- Count per call
SELECT 
  call_id,
  COUNT(*) AS barge_in_count
FROM call_events
WHERE event_name = 'barge_in'
GROUP BY call_id
ORDER BY barge_in_count DESC;
\`\`\`

**Expected:** All barge-in events occur within 150ms of user speech (measure via console timestamps)

---

### Tool Execution Times

Measures time from tool invocation to result returned. Target: ≤3000ms

\`\`\`sql
WITH tool_times AS (
  SELECT 
    invoked.call_id,
    invoked.payload->>'tool_name' AS tool_name,
    EXTRACT(EPOCH FROM (returned.created_at - invoked.created_at)) * 1000 AS execution_ms,
    returned.payload->>'ok' AS success
  FROM call_events invoked
  JOIN call_events returned 
    ON returned.call_id = invoked.call_id
  WHERE invoked.event_name = 'function_call_invoked'
    AND returned.event_name = 'tool_result_returned'
    AND invoked.created_at < returned.created_at
)
SELECT 
  tool_name,
  COUNT(*) AS invocations,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_ms) AS p95_ms,
  AVG(execution_ms) AS avg_ms,
  MIN(execution_ms) AS min_ms,
  MAX(execution_ms) AS max_ms,
  COUNT(*) FILTER (WHERE success = 'true') AS successful,
  COUNT(*) FILTER (WHERE success = 'false') AS failed
FROM tool_times
GROUP BY tool_name;
\`\`\`

**Expected:** 
- `saveLead`: p95 ≤500ms
- `searchWeb`: p95 ≤3000ms
- `requestHandoff`: p95 ≤2000ms

---

## Call Event Completeness

### Last 10 Calls with Event Counts

Shows which events fired for each call to verify completeness.

\`\`\`sql
WITH call_summary AS (
  SELECT 
    c.id AS call_id,
    c.created_at,
    cmp.name AS campaign_name,
    COUNT(*) FILTER (WHERE ce.event_name = 'call_started') AS started,
    COUNT(*) FILTER (WHERE ce.event_name = 'first_ai_audio') AS first_audio,
    COUNT(*) FILTER (WHERE ce.event_name = 'barge_in') AS barge_ins,
    COUNT(*) FILTER (WHERE ce.event_name = 'function_call_invoked') AS function_calls,
    COUNT(*) FILTER (WHERE ce.event_name = 'tool_result_returned') AS tool_results,
    COUNT(*) FILTER (WHERE ce.event_name = 'lead_saved') AS leads,
    COUNT(*) FILTER (WHERE ce.event_name = 'handoff_requested') AS handoff_requests,
    COUNT(*) FILTER (WHERE ce.event_name = 'handoff_accepted') AS handoff_accepts,
    COUNT(*) FILTER (WHERE ce.event_name = 'handoff_timeout') AS handoff_timeouts,
    COUNT(*) FILTER (WHERE ce.event_name = 'call_ended') AS ended
  FROM calls c
  LEFT JOIN call_events ce ON ce.call_id = c.id
  LEFT JOIN campaigns cmp ON cmp.id = c.campaign_id
  GROUP BY c.id, c.created_at, cmp.name
  ORDER BY c.created_at DESC
  LIMIT 10
)
SELECT * FROM call_summary;
\`\`\`

**Healthy Call Should Have:**
- `started = 1`
- `first_audio = 1`
- `barge_ins ≥ 0` (depends on user interaction)
- `function_calls = tool_results` (every invocation gets a result)
- `ended = 1`

---

### Full Event Timeline for a Call

Replace `[call_id]` with actual UUID to see complete event sequence.

\`\`\`sql
SELECT 
  event_name,
  created_at,
  payload
FROM call_events
WHERE call_id = '[call_id]'
ORDER BY created_at;
\`\`\`

**Expected Sequence (Successful Call):**
1. `call_started`
2. `first_ai_audio`
3. `barge_in` (0 or more)
4. `function_call_invoked` (for each tool)
5. `tool_result_returned` (matching each invocation)
6. `lead_saved` (if lead captured)
7. `handoff_requested` (if requested)
8. `sms_sent` (if handoff requested)
9. `handoff_accepted` OR `handoff_timeout`
10. `livekit_joined` (if accepted)
11. `livekit_left` (if accepted)
12. `call_ended`

---

### Success Rate Metrics

Overall system health indicators.

\`\`\`sql
-- Call completion rate
SELECT 
  COUNT(*) FILTER (WHERE event_name = 'call_started') AS total_calls,
  COUNT(*) FILTER (WHERE event_name = 'call_ended') AS completed_calls,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event_name = 'call_ended') / 
    NULLIF(COUNT(*) FILTER (WHERE event_name = 'call_started'), 0), 
    2
  ) AS completion_rate_pct
FROM call_events
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Lead capture rate
SELECT 
  COUNT(DISTINCT call_id) FILTER (WHERE event_name = 'call_started') AS total_calls,
  COUNT(DISTINCT call_id) FILTER (WHERE event_name = 'lead_saved') AS calls_with_leads,
  ROUND(
    100.0 * COUNT(DISTINCT call_id) FILTER (WHERE event_name = 'lead_saved') / 
    NULLIF(COUNT(DISTINCT call_id) FILTER (WHERE event_name = 'call_started'), 0), 
    2
  ) AS lead_capture_rate_pct
FROM call_events
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Handoff acceptance rate
SELECT 
  COUNT(*) FILTER (WHERE event_name = 'handoff_requested') AS total_handoffs,
  COUNT(*) FILTER (WHERE event_name = 'handoff_accepted') AS accepted,
  COUNT(*) FILTER (WHERE event_name = 'handoff_timeout') AS timed_out,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event_name = 'handoff_accepted') / 
    NULLIF(COUNT(*) FILTER (WHERE event_name = 'handoff_requested'), 0), 
    2
  ) AS acceptance_rate_pct
FROM call_events
WHERE created_at > NOW() - INTERVAL '24 hours';
\`\`\`

---

## How to Use

### After a Test Pass:

1. **Run latency queries** in Supabase SQL Editor
2. **Copy p95 results** (first_audio_ms, tool execution times)
3. **Paste into README** under "Performance Metrics" or smoke test results
4. **Run completeness check** to verify all events logged correctly

### Example Results Format:

\`\`\`
Performance Metrics (Last 10 Calls):
- First AI Audio: p95 = 847ms, avg = 623ms ✓
- Barge-In: 3 events, all <150ms ✓
- Tool Execution:
  - saveLead: p95 = 312ms ✓
  - searchWeb: p95 = 2841ms ✓
  - requestHandoff: p95 = 1654ms ✓
- Call Completion: 10/10 (100%) ✓
- Lead Capture: 8/10 (80%) ✓
- Handoff Acceptance: 2/3 (66.7%)
\`\`\`

---

## Troubleshooting

**No events showing?**
- Check that `call_id` is correctly logged in all event functions
- Verify `/api/calls/events` endpoint is being called
- Check Supabase RLS policies allow inserts

**Latency seems high?**
- Check network conditions (localhost vs deployed)
- Verify OpenAI API region matches your location
- Review browser console for connection delays

**Missing events?**
- Check browser console for errors during tool execution
- Verify all tool handlers call `pushEvent()` correctly
- Review callClient.ts event emission points
