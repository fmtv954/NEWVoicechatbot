import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

export default function DemoPage() {
  return (
    <main className="min-h-screen p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/">← Back to Home</Link>
          </Button>
          <h1 className="text-4xl font-bold mb-2">Voice AI Demo</h1>
          <p className="text-muted-foreground">Test the voice AI concierge experience</p>
        </div>

        <Alert>
          <AlertDescription>
            This demo page is a placeholder. The full implementation will include:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Live voice AI interaction with microphone access</li>
              <li>QR code generation for campaign links</li>
              <li>Embed snippet preview and quick-start controls</li>
              <li>Real-time transcript display</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Quick Test</CardTitle>
            <CardDescription>Select a campaign to test the voice AI experience</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Campaign selection will be loaded from your Supabase database
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Embed Code</CardTitle>
            <CardDescription>Copy this snippet to embed the voice AI widget on your site</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-muted rounded-lg text-sm overflow-auto">
              {`<script src="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/widget.js"></script>
<div data-voice-ai-campaign="YOUR_CAMPAIGN_ID"></div>`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
