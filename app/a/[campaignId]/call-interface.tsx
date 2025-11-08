"use client"

import { useState, useRef } from "react"
import { Phone, PhoneOff, Volume2, AlertCircle } from "lucide-react"
import CallClient from "@/lib/callClient"

interface CallInterfaceProps {
  campaignId: string
  agentId: string
}

export default function CallInterface({ campaignId, agentId }: CallInterfaceProps) {
  const [callState, setCallState] = useState<"idle" | "ringing" | "connecting" | "connected" | "ended">("idle")
  const [callDuration, setCallDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [hasReceivedAudio, setHasReceivedAudio] = useState(false)
  const callClientRef = useRef<CallClient | null>(null)

  const isCallActive = callState === "ringing" || callState === "connecting" || callState === "connected"

  const handleStartCall = async () => {
    setError(null)
    setHasReceivedAudio(false)

    const client = new CallClient({
      agentId,
      campaignId,
      onStateChange: (state) => {
        setCallState(state)
        if (state === "connected") {
          setHasReceivedAudio(true)
        }
      },
      onDurationUpdate: (seconds) => {
        setCallDuration(seconds)
      },
      onError: (err) => {
        setError(err)
        setCallState("idle")
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
    setCallState("idle")
    setCallDuration(0)
    setHasReceivedAudio(false)
  }

  const handleInterrupt = () => {
    if (callClientRef.current) {
      callClientRef.current.interrupt()
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getStateLabel = () => {
    switch (callState) {
      case "ringing":
        return "Ringing..."
      case "connecting":
        return "Connecting..."
      case "connected":
        return "Connected"
      default:
        return "Ready to connect"
    }
  }

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Banner */}
      <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
        <p className="text-sm text-blue-700">Transcripts only; no audio recorded.</p>
      </div>

      {callState === "connected" && hasReceivedAudio && (
        <div className="w-full bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-3">
          <Volume2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-700 space-y-1">
            <p className="font-semibold">Audio connected! If you can't hear the AI:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Check your device volume is turned up</li>
              <li>Check browser tab is not muted (look for speaker icon on tab)</li>
              <li>Wait 2-3 seconds for AI to start speaking</li>
              <li>Try clicking "Interrupt" then wait again</li>
              <li>Check browser console (F12) for audio errors</li>
            </ul>
          </div>
        </div>
      )}

      {/* Caller ID */}
      <div className="text-center space-y-2">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
          <Phone className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">AI Helper</h2>
        <p className="text-sm text-slate-500">{getStateLabel()}</p>
      </div>

      {/* Timer */}
      <div className="text-center">
        <div className="text-4xl font-mono font-bold text-slate-700 tracking-wider">{formatDuration(callDuration)}</div>
      </div>

      {/* Error message */}
      {error && (
        <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Call/End buttons */}
      <div className="w-full space-y-3">
        {!isCallActive ? (
          <button
            onClick={handleStartCall}
            disabled={callState === "ended"}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95"
          >
            <Phone className="w-5 h-5" />
            Call
          </button>
        ) : (
          <>
            {callState === "connected" && (
              <p className="text-xs text-center text-slate-500 italic">
                Click "Interrupt" if the AI is speaking and you want to talk
              </p>
            )}
            <button
              onClick={handleInterrupt}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95"
            >
              Interrupt
            </button>
            <button
              onClick={handleEndCall}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95"
            >
              <PhoneOff className="w-5 h-5" />
              End
            </button>
          </>
        )}
      </div>

      {/* Status indicator */}
      {isCallActive && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Call in progress</span>
        </div>
      )}
    </div>
  )
}
