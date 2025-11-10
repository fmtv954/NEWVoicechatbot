"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

export default function ValidationPage() {
  const [envStatus, setEnvStatus] = useState<any>(null)
  const [envLoading, setEnvLoading] = useState(false)

  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM agents LIMIT 5;")
  const [sqlResult, setSqlResult] = useState<any>(null)
  const [sqlLoading, setSqlLoading] = useState(false)

  const [sessionResult, setSessionResult] = useState<any>(null)
  const [sessionLoading, setSessionLoading] = useState(false)

  const testEnvStatus = async () => {
    setEnvLoading(true)
    try {
      const res = await fetch("/api/env/status")
      const data = await res.json()
      setEnvStatus(data)
      console.log("[v0] Environment status:", data)
    } catch (error) {
      setEnvStatus({ error: String(error) })
      console.error("[v0] Environment status error:", error)
    } finally {
      setEnvLoading(false)
    }
  }

  const testSqlExecution = async () => {
    setSqlLoading(true)
    try {
      const res = await fetch("/api/dev/apply-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: sqlQuery }),
      })
      const data = await res.json()
      setSqlResult(data)
      console.log("[v0] SQL execution result:", data)
    } catch (error) {
      setSqlResult({ error: String(error) })
      console.error("[v0] SQL execution error:", error)
    } finally {
      setSqlLoading(false)
    }
  }

  const testSession = async () => {
    setSessionLoading(true)
    try {
      const res = await fetch("/api/session")
      const data = await res.json()
      setSessionResult(data)
      console.log("[v0] Session result:", data)
    } catch (error) {
      setSessionResult({ error: String(error) })
      console.error("[v0] Session error:", error)
    } finally {
      setSessionLoading(false)
    }
  }

  return (
    <main className="min-h-screen p-8 bg-background">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Supabase Validation Dashboard</h1>
          <p className="text-muted-foreground">
            Test the environment variable handling, SQL execution, and session management
          </p>
        </div>

        {/* Environment Status Test */}
        <Card>
          <CardHeader>
            <CardTitle>1. Environment Variable Detection</CardTitle>
            <CardDescription>Tests /api/env/status to verify backward-compatible env var handling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={testEnvStatus} disabled={envLoading}>
              {envLoading ? "Testing..." : "Test Environment Status"}
            </Button>

            {envStatus && (
              <div className="space-y-2">
                <pre className="p-4 bg-muted rounded-lg overflow-auto text-sm">
                  {JSON.stringify(envStatus, null, 2)}
                </pre>
                {envStatus.supabase?.configured ? (
                  <Alert>
                    <AlertDescription className="text-green-600">
                      ✓ Supabase is properly configured
                      {envStatus.supabase.usingLegacyVar && (
                        <Badge variant="outline" className="ml-2">
                          Legacy SUPABASE_URL detected
                        </Badge>
                      )}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertDescription>✗ Configuration issue: {envStatus.supabase?.hint}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SQL Execution Test */}
        <Card>
          <CardHeader>
            <CardTitle>2. SQL Execution</CardTitle>
            <CardDescription>Tests /api/dev/apply-sql with a simple query using the admin client</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">SQL Query</label>
              <Textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                rows={4}
                className="font-mono text-sm"
              />
            </div>

            <Button onClick={testSqlExecution} disabled={sqlLoading}>
              {sqlLoading ? "Executing..." : "Execute SQL"}
            </Button>

            {sqlResult && (
              <div className="space-y-2">
                <pre className="p-4 bg-muted rounded-lg overflow-auto text-sm max-h-96">
                  {JSON.stringify(sqlResult, null, 2)}
                </pre>
                {sqlResult.success ? (
                  <Alert>
                    <AlertDescription className="text-green-600">
                      ✓ Query executed successfully ({sqlResult.rowCount} rows)
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertDescription>
                      ✗ Query failed: {sqlResult.error}
                      {sqlResult.hint && <div className="mt-2 text-xs">{sqlResult.hint}</div>}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session Test */}
        <Card>
          <CardHeader>
            <CardTitle>3. Session Management</CardTitle>
            <CardDescription>Tests /api/session to verify user session handling and error messages</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={testSession} disabled={sessionLoading}>
              {sessionLoading ? "Testing..." : "Test Session"}
            </Button>

            {sessionResult && (
              <div className="space-y-2">
                <pre className="p-4 bg-muted rounded-lg overflow-auto text-sm">
                  {JSON.stringify(sessionResult, null, 2)}
                </pre>
                {sessionResult.user ? (
                  <Alert>
                    <AlertDescription className="text-green-600">
                      ✓ Session active for user: {sessionResult.user.email}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertDescription>
                      No active session (expected if not logged in)
                      {sessionResult.hint && <div className="mt-2 text-xs">{sessionResult.hint}</div>}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Validation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Badge variant={envStatus?.supabase?.configured ? "default" : "outline"}>
                  {envStatus ? (envStatus.supabase?.configured ? "✓" : "✗") : "○"}
                </Badge>
                Environment variables detected correctly
              </li>
              <li className="flex items-center gap-2">
                <Badge variant={sqlResult?.success ? "default" : "outline"}>
                  {sqlResult ? (sqlResult.success ? "✓" : "✗") : "○"}
                </Badge>
                SQL execution working with admin client
              </li>
              <li className="flex items-center gap-2">
                <Badge variant={sessionResult && !sessionResult.error ? "default" : "outline"}>
                  {sessionResult ? (!sessionResult.error ? "✓" : "✗") : "○"}
                </Badge>
                Session API responding with structured errors
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
