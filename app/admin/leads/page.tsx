import { TrendingUp, Users, Calendar, Trophy } from "lucide-react"

import { LeadTable } from "./lead-table"
import { fetchAdminLeads } from "./queries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

export default async function AdminLeadsPage() {
  const { leads, error } = await fetchAdminLeads()

  // Calculate stats
  const totalLeads = leads.length
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const leadsToday = leads.filter((l) => new Date(l.createdAt) >= todayStart).length
  const leadsThisWeek = leads.filter((l) => new Date(l.createdAt) >= weekStart).length
  const leadsThisMonth = leads.filter((l) => new Date(l.createdAt) >= monthStart).length

  // Calculate daily average for this month
  const daysInMonth = now.getDate()
  const dailyAverage = daysInMonth > 0 ? (leadsThisMonth / daysInMonth).toFixed(1) : "0.0"

  // Find top campaign
  const campaignCounts = new Map<string, number>()
  leads.forEach((lead) => {
    if (lead.campaignName) {
      campaignCounts.set(lead.campaignName, (campaignCounts.get(lead.campaignName) || 0) + 1)
    }
  })
  const topCampaign = Array.from(campaignCounts.entries()).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="min-h-screen bg-background p-6 sm:p-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Lead Management</h1>
          <p className="text-base text-muted-foreground">
            Monitor captured leads, review transcripts, and export contact details for follow-up.
          </p>
        </header>

        {/* Stats Cards */}
        {!error && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalLeads}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leadsToday}</div>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leadsThisMonth}</div>
                <p className="text-xs text-muted-foreground">{dailyAverage}/day average</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Top Campaign</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{topCampaign ? topCampaign[1] : 0}</div>
                <p className="text-xs text-muted-foreground truncate">{topCampaign ? topCampaign[0] : "No data"}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {error ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-6">
              <div>
                <p className="font-medium text-destructive">{error}</p>
                <p className="mt-1 text-sm text-muted-foreground">Check your Supabase configuration and try again.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <LeadTable initialLeads={leads} />
        )}
      </div>
    </div>
  )
}
