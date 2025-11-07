import { notFound } from "next/navigation"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import CallInterface from "./call-interface"

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>
}) {
  const { campaignId } = await params

  const { data: campaign, error } = await supabaseAdmin
    .from("campaigns")
    .select("id, name, agent_id")
    .eq("id", campaignId)
    .single()

  if (error || !campaign) {
    notFound()
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-md w-full space-y-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <CallInterface campaignId={campaignId} agentId={campaign.agent_id} />
        </div>
      </div>
    </main>
  )
}
