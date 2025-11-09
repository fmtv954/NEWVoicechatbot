"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Save, RotateCcw, Copy, CheckCircle2, AlertCircle } from "lucide-react"

export function PromptEditor() {
  const [prompt, setPrompt] = useState("")
  const [originalPrompt, setOriginalPrompt] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Load current prompt
  useEffect(() => {
    async function loadPrompt() {
      try {
        const res = await fetch("/api/admin/prompt")
        if (!res.ok) throw new Error("Failed to load prompt")
        const data = await res.json()
        setPrompt(data.prompt)
        setOriginalPrompt(data.prompt)
      } catch (error) {
        setMessage({ type: "error", text: "Failed to load prompt. Check console for details." })
      } finally {
        setLoading(false)
      }
    }
    loadPrompt()
  }, [])

  // Save prompt
  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })
      if (!res.ok) throw new Error("Failed to save prompt")
      setOriginalPrompt(prompt)
      setMessage({ type: "success", text: "Prompt saved successfully! Changes will apply to new calls." })
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save prompt. Check console for details." })
    } finally {
      setSaving(false)
    }
  }

  // Reset to original
  function handleReset() {
    setPrompt(originalPrompt)
    setMessage(null)
  }

  // Copy to clipboard
  async function handleCopy() {
    await navigator.clipboard.writeText(prompt)
    setMessage({ type: "success", text: "Prompt copied to clipboard!" })
    setTimeout(() => setMessage(null), 2000)
  }

  // Character and token estimates
  const charCount = prompt.length
  const tokenEstimate = Math.ceil(charCount / 4) // Rough estimate: 1 token ≈ 4 characters

  const hasChanges = prompt !== originalPrompt

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Prompt</CardTitle>
        <CardDescription>
          Define the AI agent's personality, instructions, and behavior. Supports Markdown formatting.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Message Alert */}
        {message && (
          <Alert variant={message.type === "error" ? "destructive" : "default"}>
            {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* Textarea */}
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your system prompt here..."
          className="min-h-[500px] font-mono text-sm"
        />

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex gap-4">
            <span>{charCount.toLocaleString()} characters</span>
            <span>~{tokenEstimate.toLocaleString()} tokens</span>
          </div>
          {hasChanges && <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Prompt
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
