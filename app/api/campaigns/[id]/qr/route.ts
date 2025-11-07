import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import QRCode from "qrcode"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Fetch campaign to get name for UTM parameter
    const { data: campaign, error } = await supabaseAdmin.from("campaigns").select("name").eq("id", id).single()

    if (error || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Build URL with UTM parameters
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const targetUrl = `${appUrl}/a/${id}?utm_source=qr&utm_campaign=${encodeURIComponent(campaign.name)}`

    // Generate QR code as buffer
    const qrBuffer = await QRCode.toBuffer(targetUrl, {
      type: "png",
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
    })

    // Return PNG image
    return new NextResponse(qrBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (error) {
    console.error("Error generating QR code:", error)
    return NextResponse.json({ error: "Failed to generate QR code" }, { status: 500 })
  }
}
