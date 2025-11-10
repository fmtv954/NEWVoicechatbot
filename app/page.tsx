import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function HomePage() {
  return (
    <main className="min-h-screen p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold">Voice AI Chat POC</h1>
          <p className="text-xl text-muted-foreground">
            24/7 AI voice concierge for capturing leads and seamless human handoff
          </p>
          <Badge variant="outline">Development Environment</Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Demo</CardTitle>
              <CardDescription>Test the voice AI experience and see embed snippets</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/demo">Launch Demo</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Validation Dashboard</CardTitle>
              <CardDescription>Test environment variables, SQL execution, and session management</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary" className="w-full">
                <Link href="/validate">Run Tests</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campaign Links</CardTitle>
              <CardDescription>Access campaign call pages via /a/[campaignId]</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Campaign pages will be dynamically generated from your database
              </p>
              <Button asChild variant="outline" className="w-full bg-transparent">
                <Link href="/campaigns">View Campaigns</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leads</CardTitle>
              <CardDescription>View captured leads from voice AI conversations</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full bg-transparent">
                <Link href="/leads">View Leads</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agent Handoff</CardTitle>
              <CardDescription>Accept live call transfers from AI to human agent</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full bg-transparent">
                <Link href="/agent/accept">Agent Portal</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Database</span>
                <Badge>Supabase Connected</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tables</span>
                <Badge variant="outline">9 tables ready</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Environment</span>
                <Badge variant="secondary">Development</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>Built with Next.js, Supabase, LiveKit, OpenAI Realtime API</p>
        </div>
      </div>
    </main>
  )
}
