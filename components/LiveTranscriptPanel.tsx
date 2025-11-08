"use client"

import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, User, Bot, Database, Send } from "lucide-react"

interface TranscriptEntry {
  timestamp: number
  speaker: "user" | "ai"
  text: string
}

interface LeadData {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  reason?: string
}

interface HandoffData {
  sent: boolean
  reason?: string
  slackMessage?: string
  timestamp?: number
}

interface LiveTranscriptPanelProps {
  transcript: TranscriptEntry[]
  leadData: LeadData
  handoffData: HandoffData
}

export function LiveTranscriptPanel({ transcript, leadData, handoffData }: LiveTranscriptPanelProps) {
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-900">Testing Dashboard</h2>

      {/* Live Transcript */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" />
          Live Transcript
        </h3>
        <ScrollArea className="h-64 w-full rounded-md border border-slate-200 bg-slate-50 p-3">
          {transcript.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No conversation yet...</p>
          ) : (
            <div className="space-y-2">
              {transcript.map((entry, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 p-2 rounded ${
                    entry.speaker === "user" ? "bg-blue-50" : "bg-green-50"
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {entry.speaker === "user" ? (
                      <User className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Bot className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-slate-700">
                        {entry.speaker === "user" ? "User" : "AI"}
                      </span>
                      <span className="text-xs text-slate-500">{formatTimestamp(entry.timestamp)}</span>
                    </div>
                    <p className="text-sm text-slate-800 mt-0.5">{entry.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Captured Lead Data */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Database className="w-5 h-5 text-purple-600" />
          Captured Lead Data
        </h3>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded p-2">
              <label className="text-xs font-medium text-slate-600">First Name</label>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">
                {leadData.first_name || <span className="text-slate-400 italic">Not captured</span>}
              </p>
            </div>
            <div className="bg-slate-50 rounded p-2">
              <label className="text-xs font-medium text-slate-600">Last Name</label>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">
                {leadData.last_name || <span className="text-slate-400 italic">Not captured</span>}
              </p>
            </div>
            <div className="bg-slate-50 rounded p-2">
              <label className="text-xs font-medium text-slate-600">Email</label>
              <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">
                {leadData.email || <span className="text-slate-400 italic">Not captured</span>}
              </p>
            </div>
            <div className="bg-slate-50 rounded p-2">
              <label className="text-xs font-medium text-slate-600">Phone</label>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">
                {leadData.phone || <span className="text-slate-400 italic">Not captured</span>}
              </p>
            </div>
          </div>
          <div className="bg-slate-50 rounded p-2">
            <label className="text-xs font-medium text-slate-600">Reason for Contact</label>
            <p className="text-sm text-slate-900 mt-0.5">
              {leadData.reason || <span className="text-slate-400 italic">Not captured</span>}
            </p>
          </div>
        </div>
      </Card>

      {/* Handoff Status */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Send className="w-5 h-5 text-orange-600" />
          Handoff to Human Agent
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Status:</span>
            {handoffData.sent ? (
              <Badge className="bg-green-500">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Sent
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-600">
                <XCircle className="w-3 h-3 mr-1" />
                Not Sent
              </Badge>
            )}
          </div>

          {handoffData.reason && (
            <div className="bg-slate-50 rounded p-2">
              <label className="text-xs font-medium text-slate-600">Reason</label>
              <p className="text-sm text-slate-900 mt-0.5">{handoffData.reason}</p>
            </div>
          )}

          {handoffData.sent && handoffData.timestamp && (
            <div className="bg-slate-50 rounded p-2">
              <label className="text-xs font-medium text-slate-600">Sent At</label>
              <p className="text-sm text-slate-900 mt-0.5">{formatTimestamp(handoffData.timestamp)}</p>
            </div>
          )}

          {handoffData.slackMessage && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Slack Message Template</label>
              <ScrollArea className="h-48 w-full rounded-md border border-slate-200 bg-slate-900 p-3">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{handoffData.slackMessage}</pre>
              </ScrollArea>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
