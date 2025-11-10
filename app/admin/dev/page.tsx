import { redirect } from "next/navigation"
import { CreateCampaignForm } from "./create-campaign-form"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export default async function AdminDevPage() {
  const isProduction = process.env.NODE_ENV === "production"
  const isEnabled = process.env.ADMIN_DEV_ENABLED === "1"

  if (isProduction && !isEnabled) {
    redirect("/")
  }

  let defaultAgentId = "a0000000-0000-0000-0000-000000000001"

  try {
    const { data: agent, error } = await supabaseAdmin
      .from("agents")
      .select("id, name")
      .eq("id", "a0000000-0000-0000-0000-000000000001")
      .maybeSingle()

    if (!error && agent?.id) {
      defaultAgentId = agent.id
    }
  } catch (error) {
    console.error("[Admin Dev] Failed to fetch agent:", error)
    // Continue with default agent ID
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Campaign Creator (Dev Only)</h1>
          <p className="mt-2 text-muted-foreground">Create a new campaign and get the embed code and QR code.</p>
        </div>

        <CreateCampaignForm defaultAgentId={defaultAgentId} />
      </div>
    </div>
  )
}
