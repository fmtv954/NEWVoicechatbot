import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { getAdminClient } from "@/lib/supabase/admin"

export default async function CampaignsPage() {
  let campaigns = []
  let error = null

  try {
    const supabase = getAdminClient()
    const { data, error: fetchError } = await supabase
      .from("campaigns")
      .select("id, name, created_at, agent_id")
      .order("created_at", { ascending: false })

    if (fetchError) throw fetchError
    campaigns = data || []
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load campaigns"
  }

  return (
    <main className="min-h-screen p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/">← Back to Home</Link>
          </Button>
          <h1 className="text-4xl font-bold mb-2">Campaigns</h1>
          <p className="text-muted-foreground">Active voice AI campaigns</p>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error Loading Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {!error && campaigns.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No campaigns found. Create one via API.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {campaigns.map((campaign: any) => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{campaign.name}</CardTitle>
                    <CardDescription>Campaign ID: {campaign.id}</CardDescription>
                  </div>
                  <Badge>Active</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button asChild size="sm">
                    <Link href={`/a/${campaign.id}`}>Open Call Page</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/api/campaigns/${campaign.id}/qr`} target="_blank">
                      View QR Code
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
