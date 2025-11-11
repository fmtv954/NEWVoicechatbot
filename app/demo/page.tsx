import DemoCallCard from "./demo-call-card"

export default function DemoPage() {
  const demoAgentId = process.env.DEMO_AGENT_ID || "a0000000-0000-0000-0000-000000000001"
  const demoCampaignId = process.env.DEMO_CAMPAIGN_ID || "c0000000-0000-0000-0000-000000000001"

  return (
    <main className="min-h-screen bg-background p-6 sm:p-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Voice AI Demo</h1>
          <p className="text-muted-foreground text-base">
            Test the full-featured voice AI interface with live diagnostics, transcript capture, and handoff testing.
          </p>
        </header>

        <DemoCallCard campaignId={demoCampaignId} agentId={demoAgentId} />
      </div>
    </main>
  )
}
