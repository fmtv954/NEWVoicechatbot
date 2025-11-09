"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, XCircle, Loader2, Send } from "lucide-react"

export default function TestSlackPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message?: string
    error?: string
    timestamp?: string
  } | null>(null)

  const handleTest = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/test/slack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Failed to test Slack webhook",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6 sm:p-10">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Slack Webhook Test</h1>
          <p className="text-base text-muted-foreground">
            Test your Slack webhook configuration to ensure handoff notifications will work correctly.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Send Test Message</CardTitle>
            <CardDescription>Verify your Slack integration is working properly</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This will send a test message to your configured Slack channel. Make sure you have:
              </p>
              <ul className="ml-6 list-disc space-y-1 text-sm text-muted-foreground">
                <li>Created a Slack Incoming Webhook</li>
                <li>Set the SLACK_WEBHOOK_URL environment variable</li>
                <li>Invited the Slack app to your channel</li>
              </ul>
            </div>

            <Button onClick={handleTest} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Test Message...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Test Message
                </>
              )}
            </Button>

            {result && (
              <Alert variant={result.success ? "default" : "destructive"}>
                {result.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <AlertTitle>{result.success ? "Success!" : "Error"}</AlertTitle>
                <AlertDescription>
                  {result.success ? (
                    <div className="space-y-2">
                      <p>{result.message}</p>
                      <p className="text-xs text-muted-foreground">Check your Slack channel for the test message</p>
                      {result.timestamp && <p className="text-xs text-muted-foreground">Sent at: {result.timestamp}</p>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p>{result.error}</p>
                      <p className="text-xs">Make sure SLACK_WEBHOOK_URL is set in your environment variables</p>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
