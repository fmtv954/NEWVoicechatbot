import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

export default function AgentAcceptPage() {
  return (
    <main className="min-h-screen p-8 bg-background">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/">← Back to Home</Link>
          </Button>
          <h1 className="text-4xl font-bold mb-2">Agent Handoff Portal</h1>
          <p className="text-muted-foreground">Accept live call transfers from AI to human agent</p>
        </div>

        <Alert>
          <AlertDescription>
            This page handles agent handoff acceptance. Agents receive an SMS link with a single-use JWT token that
            brings them here to join the LiveKit call.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ol className="list-decimal list-inside space-y-2">
              <li>Customer requests to speak with a human during AI conversation</li>
              <li>System creates a handoff ticket and sends SMS to all on-call agents</li>
              <li>First agent to click the SMS link arrives here with a token</li>
              <li>Token is validated and agent joins the LiveKit room with the customer</li>
              <li>AI mutes itself; human agent takes over the conversation</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You need a valid handoff token from an SMS link to access this page. The token is single-use and expires
              after 10 minutes.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
