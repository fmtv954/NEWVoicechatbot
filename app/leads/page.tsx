import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { getAdminClient } from "@/lib/supabase/admin"

export default async function LeadsPage() {
  let leads = []
  let error = null

  try {
    const supabase = getAdminClient()
    const { data, error: fetchError } = await supabase
      .from("leads")
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        phone,
        reason,
        created_at,
        campaign_id,
        campaigns(name)
      `,
      )
      .order("created_at", { ascending: false })
      .limit(50)

    if (fetchError) throw fetchError
    leads = data || []
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load leads"
    console.error("[Leads Page] Error:", e)
  }

  return (
    <main className="min-h-screen p-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/">← Back to Home</Link>
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Leads</h1>
              <p className="text-muted-foreground">Captured leads from voice AI conversations</p>
            </div>
            {!error && <Badge variant="outline">{leads.length} leads</Badge>}
          </div>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error Loading Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{error}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Make sure NEXT_PUBLIC_SUPABASE_URL environment variable is set
              </p>
            </CardContent>
          </Card>
        )}

        {!error && leads.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No leads captured yet. Test the voice AI on the demo page to generate leads.
              </p>
              <div className="flex justify-center mt-4">
                <Button asChild>
                  <Link href="/demo">Go to Demo</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!error && leads.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Leads</CardTitle>
              <CardDescription>Latest 50 leads captured by your voice AI agents</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead: any) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        {lead.first_name} {lead.last_name}
                      </TableCell>
                      <TableCell>{lead.email || "-"}</TableCell>
                      <TableCell>{lead.phone || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">{lead.reason || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{lead.campaigns?.name || "Unknown"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(lead.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
