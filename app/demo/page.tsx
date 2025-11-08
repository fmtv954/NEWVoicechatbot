import { Suspense } from "react"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import DemoCallCard from "./demo-call-card"

async function getCampaign() {
  const { data: campaign, error } = await supabaseAdmin
    .from("campaigns")
    .select("id, agent_id, name")
    .eq("id", "c0000000-0000-0000-0000-000000000001")
    .single()

  if (error || !campaign) {
    throw new Error("Demo campaign not found. Run SQL seed scripts first.")
  }

  return campaign
}

export default async function DemoPage() {
  const campaign = await getCampaign()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Voice AI Demo</h1>
          <p className="text-slate-600">Test the AI agent with real-time debugging</p>
        </header>

        <Suspense fallback={<div className="text-center">Loading...</div>}>
          <DemoCallCard campaignId={campaign.id} agentId={campaign.agent_id} />
        </Suspense>
      </div>
    </div>
  )
}
