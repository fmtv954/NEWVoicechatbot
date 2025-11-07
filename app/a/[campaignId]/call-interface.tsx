"use client"

import { useState, useRef } from "react"
import { Phone, PhoneOff } from "lucide-react"
import CallClient from "@/lib/callClient"

interface CallInterfaceProps {
  campaignId: string
  agentId: string
}

export default function CallInterface({ campaignId, agentId }: CallInterfaceProps) {
  const [callState, setCallState] = useState<"idle" | "ringing" | "connecting" | "connected" | "ended">("idle")
  const [callDuration, setCallDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const callClientRef = useRef<CallClient | null>(null)

  const isCallActive = callState === "ringing" || callState === "connecting" || callState === "connected"

  const handleStartCall = async () => {
    setError(null)

    const client = new CallClient({
      agentId,
      campaignId,
      onStateChange: (state) => {
        setCallState(state)
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
        <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3">
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
