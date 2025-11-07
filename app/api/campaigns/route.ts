import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agent_id, name, allowed_origins } = body

    // Validate required fields
    if (!agent_id || !name) {
      return NextResponse.json({ error: "Missing required fields: agent_id, name" }, { status: 400 })
    }

    // Validate allowed_origins is an array
    if (allowed_origins && !Array.isArray(allowed_origins)) {
      return NextResponse.json({ error: "allowed_origins must be an array" }, { status: 400 })
    }

    // Verify agent exists
    const { data: agent, error: agentError } = await supabaseAdmin
      .from("agents")
      .select("id")
      .eq("id", agent_id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    // Create campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .insert({
        agent_id,
        name,
        allowed_origins: allowed_origins || [],
      })
      .select()
      .single()

    if (campaignError) {
      console.error("Error creating campaign:", campaignError)
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
    }

    // Build response
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const embed = `<script src="${appUrl}/widget.js" data-campaign="${campaign.id}" async></script>`
    const qr_url = `${appUrl}/api/campaigns/${campaign.id}/qr`

    return NextResponse.json({
      id: campaign.id,
      embed,
      qr_url,
    })
  } catch (error) {
    console.error("Error in POST /api/campaigns:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
