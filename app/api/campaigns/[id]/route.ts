import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Fetch campaign with agent details
    const { data: campaign, error } = await supabaseAdmin
      .from("campaigns")
      .select("id, name, agent_id, allowed_origins")
      .eq("id", id)
      .single()

    if (error || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    return NextResponse.json(campaign)
  } catch (error) {
    console.error("Error in GET /api/campaigns/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
