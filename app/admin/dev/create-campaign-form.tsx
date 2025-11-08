"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

interface CreateCampaignFormProps {
  defaultAgentId: string
}

export function CreateCampaignForm({ defaultAgentId }: CreateCampaignFormProps) {
  const [name, setName] = useState("")
  const [allowedOrigins, setAllowedOrigins] = useState("http://localhost:3000\nhttps://*.vercel.app")
  const [agentId, setAgentId] = useState(defaultAgentId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{
    id: string
    embed: string
    qr_url: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setResult(null)

    try {
      // Parse origins from textarea (one per line)
      const originsArray = allowedOrigins
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          name,
          allowed_origins: originsArray,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create campaign")
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Campaign</CardTitle>
          <CardDescription>Fill in the details to generate a new campaign</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Holiday Sale 2024"
                required
              />
            </div>

            <div>
              <Label htmlFor="origins">Allowed Origins (one per line)</Label>
              <Textarea
                id="origins"
                value={allowedOrigins}
                onChange={(e) => setAllowedOrigins(e.target.value)}
                placeholder="http://localhost:3000"
                rows={4}
                className="font-mono text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The widget enforces origin checking. Add your host here to test embedding.
              </p>
            </div>

            <div>
              <Label htmlFor="agentId">Agent ID</Label>
              <Input
                id="agentId"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder={defaultAgentId}
                required
              />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Creating..." : "Create Campaign"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Embed Code</CardTitle>
              <CardDescription>Copy and paste this into your website</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
                <code>{result.embed}</code>
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>QR Code</CardTitle>
              <CardDescription>Download or link to this URL</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <a
                  href={result.qr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-primary hover:underline"
                >
                  {result.qr_url}
                </a>
                <img
                  src={result.qr_url || "/placeholder.svg"}
                  alt="Campaign QR Code"
                  className="mx-auto h-64 w-64 rounded-md border"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Call Page</CardTitle>
              <CardDescription>Open this page to test the call interface</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/a/${result.id}`} className="text-primary hover:underline">
                Open call page →
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
