"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useState } from "react"
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react"

export default function DemoPage() {
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [transcript, setTranscript] = useState<string[]>([])
  const [status, setStatus] = useState<"idle" | "ringing" | "connected" | "ended">("idle")

  const handleStartCall = () => {
    setStatus("ringing")
    setTranscript(["📞 Calling AI agent..."])

    // Simulate connection
    setTimeout(() => {
      setStatus("connected")
      setIsConnected(true)
      setTranscript((prev) => [...prev, "🤖 AI: Hi! I'm Sunny, your AI assistant. How can I help you today?"])
    }, 1500)
  }

  const handleEndCall = () => {
    setStatus("ended")
    setIsConnected(false)
    setTranscript((prev) => [...prev, "📞 Call ended"])

    setTimeout(() => {
      setStatus("idle")
      setTranscript([])
    }, 2000)
  }

  const handleToggleMute = () => {
    setIsMuted(!isMuted)
    setTranscript((prev) => [...prev, isMuted ? "🔊 Unmuted" : "🔇 Muted"])
  }

  return (
    <main className="min-h-screen p-8 bg-background">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/">← Back to Home</Link>
          </Button>
          <h1 className="text-4xl font-bold mb-2">Voice AI Demo</h1>
          <p className="text-muted-foreground">Test the voice AI concierge experience</p>
        </div>

        <Alert>
          <AlertDescription>
            This is a demo interface showing the voice AI phone experience. The full implementation requires:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>LiveKit WebRTC connection</li>
              <li>OpenAI Realtime API integration</li>
              <li>Microphone permissions and audio capture</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Phone Interface */}
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <CardHeader>
              <CardTitle>Voice AI Phone</CardTitle>
              <CardDescription>Click to start talking with the AI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status Badge */}
              <div className="flex justify-center">
                {status === "idle" && <Badge variant="outline">Ready to Call</Badge>}
                {status === "ringing" && (
                  <Badge variant="secondary" className="animate-pulse">
                    Ringing...
                  </Badge>
                )}
                {status === "connected" && <Badge className="bg-green-500">Connected</Badge>}
                {status === "ended" && <Badge variant="destructive">Call Ended</Badge>}
              </div>

              {/* Phone Visual */}
              <div className="flex justify-center py-8">
                <div
                  className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isConnected
                      ? "bg-green-500 shadow-lg shadow-green-500/50 animate-pulse"
                      : "bg-primary/10 hover:bg-primary/20"
                  }`}
                >
                  <Phone className="w-16 h-16 text-primary" />
                  {isConnected && (
                    <div className="absolute inset-0 rounded-full border-4 border-green-400 animate-ping opacity-75" />
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex gap-4 justify-center">
                {!isConnected && status !== "ringing" && (
                  <Button size="lg" onClick={handleStartCall} className="gap-2">
                    <Phone className="w-5 h-5" />
                    Start Call
                  </Button>
                )}

                {(isConnected || status === "ringing") && (
                  <>
                    <Button variant="outline" size="lg" onClick={handleToggleMute} className="gap-2 bg-transparent">
                      {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      {isMuted ? "Unmute" : "Mute"}
                    </Button>
                    <Button variant="destructive" size="lg" onClick={handleEndCall} className="gap-2">
                      <PhoneOff className="w-5 h-5" />
                      End Call
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transcript */}
          <Card>
            <CardHeader>
              <CardTitle>Live Transcript</CardTitle>
              <CardDescription>Real-time conversation transcript</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 h-96 overflow-auto bg-muted/30 rounded-lg p-4">
                {transcript.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Transcript will appear here during the call
                  </p>
                ) : (
                  transcript.map((line, index) => (
                    <p key={index} className="text-sm leading-relaxed">
                      {line}
                    </p>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Embed Code */}
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
