import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { getAdminClient } from "@/lib/supabase/admin"

export default async function CampaignCallPage({
  params,
}: {
  params: Promise<{ campaignId: string }>
}) {
  const { campaignId } = await params

  let campaign = null
  let error = null

  try {
    const supabase = getAdminClient()
    const { data, error: fetchError } = await supabase
      .from("campaigns")
      .select("id, name, agent_id")
      .eq("id", campaignId)
      .single()

    if (fetchError) throw fetchError
    campaign = data
  } catch (e) {
    error = e instanceof Error ? e.message : "Campaign not found"
  }

  return (
    <main className="min-h-screen p-8 bg-background">
      <div className="max-w-2xl mx-auto space-y-8">
        {error ? (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Campaign Not Found</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">{error}</p>
              <Button asChild variant="outline">
                <Link href="/campaigns">View All Campaigns</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold">{campaign?.name}</h1>
              <p className="text-muted-foreground">Voice AI Call Interface</p>
            </div>

            <Alert>
              <AlertDescription>
                This is a placeholder for the voice AI call interface. The full implementation will include:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Microphone permission request</li>
                  <li>Live audio connection to OpenAI Realtime API</li>
                  <li>Real-time transcription display</li>
                  <li>Lead capture form with AI read-back</li>
                  <li>Human handoff button for live agent transfer</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>Campaign Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Campaign ID</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{campaign?.id}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agent ID</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{campaign?.agent_id}</code>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1 bg-transparent">
                <Link href="/campaigns">← Back to Campaigns</Link>
              </Button>
              <Button className="flex-1" disabled>
                Start Voice Call (Coming Soon)
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
