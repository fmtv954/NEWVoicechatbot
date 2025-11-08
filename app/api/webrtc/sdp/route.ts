import { type NextRequest, NextResponse } from "next/server"

/**
 * Proxy for OpenAI Realtime SDP exchange
 * Avoids CORS issues by doing the exchange server-side
 */
export async function POST(req: NextRequest) {
  try {
    const { offer, sessionClientSecret } = await req.json()

    if (!offer || !sessionClientSecret) {
      return NextResponse.json({ error: "Missing offer or sessionClientSecret" }, { status: 400 })
    }

    // Forward SDP offer to OpenAI
    const response = await fetch("https://api.openai.com/v1/realtime", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionClientSecret}`,
        "Content-Type": "application/sdp",
      },
      body: offer,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] OpenAI SDP exchange failed:", response.status, errorText)
      return NextResponse.json({ error: "Failed to exchange SDP with OpenAI" }, { status: response.status })
    }

    const answerSdp = await response.text()

    return new NextResponse(answerSdp, {
      headers: {
        "Content-Type": "application/sdp",
      },
    })
  } catch (error) {
    console.error("[v0] Error in SDP proxy:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
