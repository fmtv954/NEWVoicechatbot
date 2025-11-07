import { type NextRequest, NextResponse } from "next/server"
import { pushEvent, type CallEventType } from "@/lib/calls"

/**
 * POST /api/calls/events
 * Client-side endpoint to log call events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { call_id, type, payload } = body

    if (!call_id || !type) {
      return NextResponse.json({ error: "Missing call_id or type" }, { status: 400 })
    }

    const success = await pushEvent({
      call_id,
      type: type as CallEventType,
      payload,
    })

    if (!success) {
      return NextResponse.json({ error: "Failed to log event" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[Call Events] Error:", error)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
