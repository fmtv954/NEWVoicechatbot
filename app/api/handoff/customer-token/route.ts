import { type NextRequest, NextResponse } from "next/server"

// We'll generate LiveKit JWT tokens manually using Web Crypto API

async function createLiveKitToken(
  apiKey: string,
  apiSecret: string,
  identity: string,
  roomName: string,
  ttlSeconds = 600,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  // LiveKit JWT structure
  const header = {
    alg: "HS256",
    typ: "JWT",
  }

  const payload = {
    exp: now + ttlSeconds, // Token expiration
    iss: apiKey, // API key is the issuer
    sub: identity, // Participant identity
    nbf: now, // Not valid before now
    video: {
      // LiveKit video grant
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    },
  }

  // Encode header and payload
  const base64UrlEncode = (obj: any) => {
    const json = JSON.stringify(obj)
    return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  }

  const encodedHeader = base64UrlEncode(header)
  const encodedPayload = base64UrlEncode(payload)
  const message = `${encodedHeader}.${encodedPayload}`

  // Sign with HMAC SHA-256
  const encoder = new TextEncoder()
  const keyData = encoder.encode(apiSecret)
  const messageData = encoder.encode(message)

  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData)

  // Convert signature to base64url
  const signatureArray = new Uint8Array(signature)
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  return `${message}.${signatureBase64}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ticket_id } = body

    console.log("[CustomerToken] 🎫 Customer token request for ticket:", ticket_id)

    if (!ticket_id) {
      return NextResponse.json({ error: "Missing ticket_id" }, { status: 400 })
    }

    // Validate LiveKit credentials
    const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY
    const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET
    const LIVEKIT_URL = process.env.LIVEKIT_URL

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      console.error("[CustomerToken] Missing LiveKit credentials")
      return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 })
    }

    // Room name is the ticket ID
    const roomName = `handoff-${ticket_id}`
    const customerIdentity = `customer-${ticket_id}`

    console.log("[CustomerToken] Creating token for:", { roomName, identity: customerIdentity })

    const token = await createLiveKitToken(
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      customerIdentity,
      roomName,
      600, // 10 minutes
    )

    console.log("[CustomerToken] ✅ Token created successfully")

    return NextResponse.json({
      token,
      room: roomName,
      url: LIVEKIT_URL,
    })
  } catch (error) {
    console.error("[CustomerToken] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create token" },
      { status: 500 },
    )
  }
}
