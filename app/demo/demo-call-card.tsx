"use client"

import { useState, useRef } from "react"
import { Phone, PhoneOff, AlertCircle, CheckCircle2, Volume2, Mic, MicOff, Radio, UserPlus } from "lucide-react"
import CallClient from "@/lib/callClient"
import { DebugPanel } from "@/components/DebugPanel"
import { AudioDiagnostics } from "@/components/AudioDiagnostics"
import { MicPermissionDialog } from "@/components/MicPermissionDialog"
import { LiveTranscriptPanel } from "@/components/LiveTranscriptPanel"

interface DemoCallCardProps {
  campaignId: string
  agentId: string
}

interface MilestoneEvent {
  type: string
  timestamp: number
  payload?: any
}

interface AIStatus {
  isSpeaking: boolean
  isReceivingAudio: boolean
  audioLevel: number
}

interface AudioFormat {
  codec?: string
  sampleRate?: number
  channels?: number
}

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

export default function DemoCallCard({ campaignId, agentId }: DemoCallCardProps) {
  const [callState, setCallState] = useState<"idle" | "ringing" | "connecting" | "connected" | "ended">("idle")
  const [callDuration, setCallDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isRinging, setIsRinging] = useState(false)
  const [events, setEvents] = useState<MilestoneEvent[]>([])
  const [showUnmuteButton, setShowUnmuteButton] = useState(false)
  const [aiStatus, setAIStatus] = useState<AIStatus>({ isSpeaking: false, isReceivingAudio: false, audioLevel: 0 })
  const [audioFormat, setAudioFormat] = useState<AudioFormat>({})
  const [microphoneLevel, setMicrophoneLevel] = useState(0)
  const [aiIsProcessing, setAIIsProcessing] = useState(false)
  const [showMicDialog, setShowMicDialog] = useState(false)
  const [micStream, setMicStream] = useState<MediaStream | null>(null)
  const callClientRef = useRef<CallClient | null>(null)
  const [aiHasResponded, setAIHasResponded] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [leadData, setLeadData] = useState<LeadData>({})
  const [handoffData, setHandoffData] = useState<HandoffData>({ sent: false })

  const isCallActive = callState === "ringing" || callState === "connecting" || callState === "connected"

  const handleStartCall = async () => {
    setError(null)
    setTranscript([])
    setLeadData({})
    setHandoffData({ sent: false })
    setShowMicDialog(true)
  }

  const handleMicrophoneGranted = async (stream: MediaStream) => {
    setMicStream(stream)
    setShowMicDialog(false)
    await startCallWithMicrophone(stream)
  }

  const handleMicrophoneDenied = (errorMessage: string) => {
    setShowMicDialog(false)
    setError(errorMessage)
  }

  const startCallWithMicrophone = async (stream: MediaStream) => {
    setError(null)
    setIsRinging(true)
    setEvents([])
    setShowUnmuteButton(false)
    setAIStatus({ isSpeaking: false, isReceivingAudio: false, audioLevel: 0 })
    setAudioFormat({})
    setMicrophoneLevel(0)
    setAIIsProcessing(false)
    setAIHasResponded(false)

    const client = new CallClient({
      agentId,
      campaignId,
      microphoneStream: stream,
      onStateChange: (state) => {
        setCallState(state)
        if (state === "connected") {
          setIsRinging(false)
          setTimeout(() => setShowUnmuteButton(true), 2000)
        }
      },
      onDurationUpdate: (seconds) => {
        setCallDuration(seconds)
      },
      onError: (err) => {
        setError(err)
        setCallState("idle")
        setIsRinging(false)
        if (err.includes("blocked") || err.includes("Audio")) {
          setShowUnmuteButton(true)
        }
      },
      onEvent: (event) => {
        setEvents((prev) => [...prev, event].slice(-15))

        if (event.type === "transcript") {
          setTranscript((prev) => [
            ...prev,
            {
              timestamp: event.timestamp,
              speaker: event.payload.speaker,
              text: event.payload.text,
            },
          ])
        }

        if (event.type === "lead_saved") {
          setLeadData(event.payload.leadData || {})
        }

        if (event.type === "handoff_requested") {
          setHandoffData({
            sent: true,
            reason: event.payload.reason,
            slackMessage: event.payload.slackMessage,
            timestamp: event.timestamp,
          })
        }
      },
      onAIStatus: (status) => {
        setAIStatus(status)
      },
      onAudioFormat: (format) => {
        setAudioFormat(format)
      },
      onMicrophoneLevel: (level) => {
        setMicrophoneLevel(level)
      },
      onAIProcessing: (isProcessing) => {
        setAIIsProcessing(isProcessing)
      },
      onAIResponded: (hasResponded) => {
        setAIHasResponded(hasResponded)
      },
    })

    callClientRef.current = client
    await client.start()
  }

  const handleEndCall = () => {
    if (callClientRef.current) {
      callClientRef.current.end()
      callClientRef.current = null
    }
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop())
      setMicStream(null)
    }
    setCallState("idle")
    setCallDuration(0)
    setIsRinging(false)
    setShowUnmuteButton(false)
    setAIStatus({ isSpeaking: false, isReceivingAudio: false, audioLevel: 0 })
    setAudioFormat({})
    setMicrophoneLevel(0)
    setAIIsProcessing(false)
    setAIHasResponded(false)
  }

  const handleForceResumeAudio = async () => {
    if (callClientRef.current) {
      await callClientRef.current.forceResumeAudio()
      console.log("[v0] Force resume audio triggered from UI")
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case "call_started":
      case "first_ai_audio":
        return "text-green-600"
      case "barge_in":
        return "text-orange-600"
      case "function_call_invoked":
      case "tool_result_returned":
        return "text-blue-600"
      case "lead_saved":
        return "text-purple-600"
      case "handoff_requested":
        return "text-red-600"
      case "call_ended":
        return "text-slate-600"
      default:
        return "text-slate-500"
    }
  }

  const getAudioLevelColor = (level: number) => {
    if (level === 0) return "bg-slate-300"
    if (level < 10) return "bg-yellow-400"
    if (level < 30) return "bg-green-400"
    return "bg-green-600"
  }

  const getAudioLevelWidth = (level: number) => {
    return Math.min(100, (level / 50) * 100)
  }

  const debugEvents = events.map((e) => ({
    type: e.type,
    ts: formatTimestamp(e.timestamp),
    meta: e.payload,
  }))

  return (
    <>
      <MicPermissionDialog
        open={showMicDialog}
        onPermissionGranted={handleMicrophoneGranted}
        onPermissionDenied={handleMicrophoneDenied}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Call Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-8">
          {/* Privacy Banner */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <p className="text-sm text-blue-700">Transcripts only; no audio recorded.</p>
          </div>

          {/* Handoff status banner */}
          {handoffData.sent && (
            <div className="mb-6 bg-orange-50 border border-orange-300 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <UserPlus className="w-6 h-6 text-orange-600 animate-pulse" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-orange-900">Handoff In Progress</h3>
                  <p className="text-xs text-orange-700 mt-1">
                    Transferring to human agent. Hold music should be playing...
                  </p>
                  {handoffData.reason && <p className="text-xs text-orange-600 mt-1">Reason: {handoffData.reason}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Caller ID */}
          <div className="text-center space-y-4 mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
              {handoffData.sent ? (
                <UserPlus className="w-12 h-12 text-white animate-pulse" />
              ) : (
                <Phone className="w-12 h-12 text-white" />
              )}
            </div>
            <h2 className="text-3xl font-semibold text-slate-900">
              {handoffData.sent ? "Transferring..." : "AI Helper"}
            </h2>

            {/* Ring indicator */}
            {isRinging && (
              <div className="flex items-center justify-center gap-2 text-blue-600 animate-pulse">
                <div className="w-2 h-2 bg-blue-600 rounded-full" />
                <span className="text-sm font-medium">Ringing... (wait 5-6 seconds)</span>
              </div>
            )}

            {callState === "connecting" && <p className="text-sm text-slate-500">Connecting...</p>}
            {callState === "connected" && !handoffData.sent && (
              <div className="space-y-1">
                <p className="text-sm text-green-600 font-medium">Connected</p>
                <p className="text-xs text-slate-500">
                  AI will greet you automatically - just listen and respond naturally
                </p>
              </div>
            )}
          </div>

          {callState === "connected" && (
            <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Live Diagnostics</h3>

              {handoffData.sent && (
                <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded p-2">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-orange-600 animate-pulse" />
                    <span className="text-sm font-medium text-orange-900">Handoff Active</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded bg-orange-100 text-orange-700">
                    TRANSFERRING
                  </span>
                </div>
              )}

              {/* Microphone Input Level */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Mic className={`w-4 h-4 ${microphoneLevel > 10 ? "text-blue-600" : "text-slate-400"}`} />
                    <span className="text-sm font-medium text-slate-700">Your Microphone Input</span>
                  </div>
                  <span className="text-xs font-mono text-slate-600">{microphoneLevel}</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      microphoneLevel === 0 ? "bg-red-300" : microphoneLevel < 10 ? "bg-yellow-400" : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(100, (microphoneLevel / 50) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {microphoneLevel === 0 && "🔴 Not detecting sound - speak louder or check mic"}
                  {microphoneLevel > 0 && microphoneLevel < 10 && "🟡 Very quiet - speak louder"}
                  {microphoneLevel >= 10 && microphoneLevel < 30 && "🟢 Good level"}
                  {microphoneLevel >= 30 && "🟢 Strong signal"}
                </p>
              </div>

              {/* AI Heard User Audio indicator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {aiStatus.isReceivingAudio ? (
                    <Mic className="w-4 h-4 text-green-600 animate-pulse" />
                  ) : (
                    <MicOff className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-sm font-medium text-slate-700">AI Heard Your Audio</span>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    aiStatus.isReceivingAudio ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {aiStatus.isReceivingAudio ? "YES" : "NO"}
                </span>
              </div>

              {/* AI Processing indicator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded-full ${aiIsProcessing ? "bg-purple-600 animate-pulse" : "bg-slate-300"}`}
                  />
                  <span className="text-sm font-medium text-slate-700">AI Processing</span>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    aiIsProcessing ? "bg-purple-100 text-purple-700" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {aiIsProcessing ? "YES" : "NO"}
                </span>
              </div>

              {/* AI Speaking Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio
                    className={`w-4 h-4 ${aiHasResponded ? "text-green-600" : "text-slate-400"} ${aiStatus.isSpeaking ? "animate-pulse" : ""}`}
                  />
                  <span className="text-sm font-medium text-slate-700">AI Responded</span>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    aiHasResponded ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {aiHasResponded ? "YES" : "NO"}
                </span>
              </div>

              {/* Audio Stream Level (AI Output) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">AI Audio Output Level</span>
                  <span className="text-xs font-mono text-slate-600">{aiStatus.audioLevel}</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${getAudioLevelColor(aiStatus.audioLevel)}`}
                    style={{ width: `${getAudioLevelWidth(aiStatus.audioLevel)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {aiStatus.audioLevel === 0 && "⚠️ Silent - No audio data from AI"}
                  {aiStatus.audioLevel > 0 && aiStatus.audioLevel < 10 && "🟡 Very quiet"}
                  {aiStatus.audioLevel >= 10 && aiStatus.audioLevel < 30 && "🟢 Good level"}
                  {aiStatus.audioLevel >= 30 && "🟢 Strong signal"}
                </p>
              </div>

              {/* Audio Format */}
              {audioFormat.codec && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Format:</span>
                    <span className="font-mono text-slate-800">
                      {audioFormat.codec} • {audioFormat.sampleRate}Hz • {audioFormat.channels}ch
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timer */}
          <div className="text-center mb-6">
            <div className="text-5xl font-mono font-bold text-slate-700 tracking-wider">
              {formatDuration(callDuration)}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Call/End buttons */}
          <div className="space-y-3">
            {!isCallActive ? (
              <button
                onClick={handleStartCall}
                disabled={callState === "ended"}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95"
              >
                <Phone className="w-6 h-6" />
                Start Call
              </button>
            ) : (
              <>
                {showUnmuteButton && (
                  <button
                    onClick={handleForceResumeAudio}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95"
                  >
                    <Volume2 className="w-5 h-5" />
                    Enable Audio (Click if you can't hear AI)
                  </button>
                )}
                <button
                  onClick={handleEndCall}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95"
                >
                  <PhoneOff className="w-6 h-6" />
                  End
                </button>
              </>
            )}
          </div>

          {/* Tester Checklist */}
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Test Scenarios
            </h3>
            <ul className="space-y-2 text-sm text-amber-800">
              <li className="flex items-start gap-2">
                <span className="text-amber-600">1.</span>
                <span>
                  Wait for AI greeting, then say <strong>"spell my name"</strong> - tests natural conversation
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600">2.</span>
                <span>
                  Ask <strong>"what's the pricing?"</strong> - triggers web search with Tavily
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600">3.</span>
                <span>
                  Say <strong>"I need to speak with someone"</strong> - initiates handoff to human agent
                </span>
              </li>
            </ul>
            <div className="mt-3 pt-3 border-t border-amber-200">
              <p className="text-xs text-amber-700">
                <strong>Tip:</strong> The AI uses Voice Activity Detection (VAD) - just speak naturally and it will
                respond. You can talk over the AI anytime (barge-in).
              </p>
            </div>
          </div>
        </div>

        {/* Debug Panel - Docked Right */}
        <div className="lg:col-span-1">
          <DebugPanel events={debugEvents} />
        </div>
      </div>

      <AudioDiagnostics />

      {callState !== "idle" && (
        <div className="mt-6">
          <LiveTranscriptPanel transcript={transcript} leadData={leadData} handoffData={handoffData} />
        </div>
      )}
    </>
  )
}
