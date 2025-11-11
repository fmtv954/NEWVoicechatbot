import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabaseAdmin"

// Simple in-memory rate limiter for dev (IP-based)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const limit = rateLimitMap.get(ip)

  if (!limit || now > limit.resetAt) {
    // Reset or create new limit
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 }) // 60 seconds
    return true
  }

  if (limit.count >= 10) {
    // Rate limit exceeded
    return false
  }

  // Increment count
  limit.count++
  return true
}

/**
 * POST /api/session
 * Create an OpenAI Realtime session and log the call in database
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting in dev mode
    if (process.env.NODE_ENV !== "production") {
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
      if (!checkRateLimit(ip)) {
        return NextResponse.json({ error: "Rate limit exceeded. Try again in 60 seconds." }, { status: 429 })
      }
    }

    const { agent_id, campaign_id } = await req.json()

    if (!agent_id || !campaign_id) {
      return NextResponse.json({ error: "Missing required fields: agent_id, campaign_id" }, { status: 400 })
    }

    // Validate OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      console.error("[v0] OPENAI_API_KEY not configured")
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    // Create session with OpenAI Realtime API
    const sessionResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "verse",
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1",
        },
        tools: [
          {
            type: "function",
            name: "saveLead",
            description: "Save lead information when the caller provides their contact details",
            parameters: {
              type: "object",
              properties: {
                first_name: { type: "string", description: "First name" },
                last_name: { type: "string", description: "Last name" },
                email: { type: "string", description: "Email address" },
                phone: { type: "string", description: "Phone number" },
                reason: { type: "string", description: "Reason for calling" },
                transcript: { type: "string", description: "Full conversation transcript" },
              },
              required: ["first_name"],
            },
          },
          {
            type: "function",
            name: "searchWeb",
            description: "Search the web for information the caller is asking about",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query" },
              },
              required: ["query"],
            },
          },
          {
            type: "function",
            name: "requestHandoff",
            description: "Request handoff to a human agent when the caller asks to speak with someone",
            parameters: {
              type: "object",
              properties: {
                reason: { type: "string", description: "Reason for handoff request" },
              },
              required: ["reason"],
            },
          },
        ],
        instructions: `You are a friendly AI assistant for a Voice AI Call Widget demo.

Your personality:
- Warm, professional, and conversational
- Natural speech patterns with occasional "um" or "well" for authenticity
- Patient and empathetic listener

Core behaviors:
1. Greet the caller warmly and ask how you can help
2. Listen carefully using Voice Activity Detection (VAD) - never cut them off
3. Provide helpful, concise answers to questions
4. If asked about pricing or technical details you don't know, use searchWeb tool
5. If caller provides contact info, use saveLead tool to save it
6. If caller asks to speak with someone, use requestHandoff tool

Important rules:
- Never make up information - use searchWeb if unsure
- Keep responses brief (1-2 sentences) to feel more conversational
- Ask follow-up questions to understand their needs better
- Always confirm information before using saveLead tool`,
      }),
    })

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text()
      console.error("[v0] OpenAI session creation failed:", sessionResponse.status, errorText)
      return NextResponse.json({ error: "Failed to create OpenAI session" }, { status: sessionResponse.status })
    }

    const sessionData = await sessionResponse.json()
    const sessionClientSecret = sessionData.client_secret?.value

    if (!sessionClientSecret) {
      console.error("[v0] No client_secret in OpenAI response")
      return NextResponse.json({ error: "Invalid session response from OpenAI" }, { status: 500 })
    }

    // Log the call in database
    const supabase = getSupabaseAdmin()
    const { data: call, error: callError } = await supabase
      .from("calls")
      .insert({
        agent_id,
        campaign_id,
        status: "ringing",
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (callError) {
      console.error("[v0] Failed to create call record:", callError)
      return NextResponse.json({ error: "Failed to create call record" }, { status: 500 })
    }

    console.log("[v0] Session created successfully, callId:", call.id)

    return NextResponse.json({
      callId: call.id,
      sessionClientSecret,
      rtcConfiguration: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      },
    })
  } catch (error) {
    console.error("[v0] Error in /api/session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
