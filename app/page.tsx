import Link from "next/link"
import { Phone, Search, Users, Shield, Zap, Database } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="border-b bg-gradient-to-b from-background to-muted/20">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Voice AI Call Widget POC</h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Browser-based voice agent with lead capture, web search, and human handoff capabilities. Privacy-first:
              transcripts only, no audio recording.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                href="/demo"
                className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
              >
                Try Demo Call
              </Link>
              <Link
                href="/admin"
                className="rounded-lg border border-input bg-background px-6 py-3 text-sm font-semibold hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Admin Tools
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Features</h2>
          <p className="mt-4 text-lg text-muted-foreground">Everything you need for intelligent voice interactions</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Natural Conversation</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Voice conversation using OpenAI Realtime API with barge-in support and Voice Activity Detection
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Lead Capture</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Automatic lead capture with read-back confirmation stored securely in Supabase
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Web Search</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>Real-time web search fallback via Tavily API for up-to-date information</CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Human Handoff</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Seamless handoff to human agents via Twilio SMS and LiveKit browser-to-browser connection
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Privacy First</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Transcripts only - no audio recording. Full compliance with privacy regulations
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Full Event Logging</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>Complete event logging and metrics for monitoring and debugging</CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tech Stack Section */}
      <div className="border-t bg-muted/20">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Tech Stack</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-center">
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">Frontend</h3>
              <p className="text-sm text-muted-foreground">Next.js 14, TypeScript, Tailwind</p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">Voice</h3>
              <p className="text-sm text-muted-foreground">OpenAI Realtime API (WebRTC)</p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">Handoff</h3>
              <p className="text-sm text-muted-foreground">LiveKit + Twilio SMS</p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">Database</h3>
              <p className="text-sm text-muted-foreground">Supabase (Postgres + RLS)</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="border-t">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to get started?</h2>
            <p className="mt-4 text-lg text-muted-foreground">Try the demo call to experience the voice AI in action</p>
            <div className="mt-10">
              <Link
                href="/demo"
                className="rounded-lg bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors inline-block"
              >
                Launch Demo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
