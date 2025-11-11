import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { AccessToken } from "livekit-server-sdk"

/**
 * POST /api/handoff/customer-token
 * Mint LiveKit token for customer to join handoff room
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ticket_id, call_id } = body

    if (!ticket_id || !call_id) {
      return NextResponse.json({ error: "Missing ticket_id or call_id" }, { status: 400 })
    }

    // Verify ticket exists and is accepted
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("handoff_tickets")
      .select("*")
      .eq("id", ticket_id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    if (ticket.status !== "accepted") {
      return NextResponse.json({ error: `Ticket not yet accepted (status: ${ticket.status})` }, { status: 400 })
    }

    // Check LiveKit credentials
    const livekitApiKey = process.env.LIVEKIT_API_KEY
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET
    const livekitUrl = process.env.LIVEKIT_URL

    if (!livekitApiKey || !livekitApiSecret || !livekitUrl) {
      console.error("[Customer Token] LiveKit credentials not configured")
      return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 })
    }

    // Create room name and participant identity
    const roomName = `handoff-${ticket_id}`
    const participantName = `customer-${call_id}`

    console.log("[Customer Token] Minting token:", { roomName, participantName })

    // Create LiveKit access token
    const accessToken = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: participantName,
    })

    accessToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    })

    const livekitToken = await accessToken.toJwt()

    console.log("[Customer Token] ✓ Token minted successfully")

    return NextResponse.json({
      ok: true,
      room_name: roomName,
      livekit_token: livekitToken,
      livekit_url: livekitUrl,
    })
  } catch (error) {
    console.error("[Customer Token] Failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
