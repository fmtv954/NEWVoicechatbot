import { type NextRequest, NextResponse } from "next/server"
import { SUNNY_SYSTEM_PROMPT } from "@/lib/prompt"
import { tools } from "@/lib/tools"
import { startCall } from "@/lib/calls"

// Simple IP-based rate limiter for dev (in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetAt) {
    // New window
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false
  }

  record.count++
  return true
}

export async function POST(req: NextRequest) {
  // Get client IP for rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown"

  // Check rate limit
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
  }

  // Parse and validate request body
  let body: { agent_id?: string; campaign_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
  }

  const { agent_id, campaign_id } = body

  // Validate required fields
  if (!agent_id || typeof agent_id !== "string") {
    return NextResponse.json({ error: "Missing or invalid agent_id" }, { status: 400 })
  }

  if (!campaign_id || typeof campaign_id !== "string") {
    return NextResponse.json({ error: "Missing or invalid campaign_id" }, { status: 400 })
  }

  // Validate UUID format (basic check)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(agent_id) || !uuidRegex.test(campaign_id)) {
    return NextResponse.json({ error: "Invalid UUID format for agent_id or campaign_id" }, { status: 400 })
  }

  // Check for OpenAI API key
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    console.error("[v0] Missing OPENAI_API_KEY environment variable")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  try {
    const callId = await startCall({ agent_id, campaign_id })

    if (!callId) {
      console.error("[v0] Failed to start call tracking")
      return NextResponse.json({ error: "Failed to initialize call" }, { status: 500 })
    }

    // Create OpenAI Realtime session
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "sage",
        instructions: SUNNY_SYSTEM_PROMPT,
        tools: tools,
        input_audio_transcription: {
          model: "whisper-1",
        },
        turn_detection: null,
        modalities: ["text", "audio"],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] OpenAI API error:", response.status, errorText)
      return NextResponse.json({ error: "Failed to create session with OpenAI" }, { status: 500 })
    }

    const sessionData = await response.json()

    return NextResponse.json({
      callId,
      sessionClientSecret: sessionData.client_secret?.value || "",
      rtcConfiguration: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      },
    })
  } catch (error) {
    console.error("[v0] Error creating OpenAI session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
