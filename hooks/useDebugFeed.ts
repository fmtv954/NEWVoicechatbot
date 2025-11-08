"use client"

import { useState, useEffect } from "react"
import type CallClient from "@/lib/callClient"

interface DebugEvent {
  type: string
  ts: string
  meta?: any
}

interface TranscriptEntry {
  role: "ai" | "customer"
  text: string
  ts: string
}

export function useDebugFeed(callClient: CallClient | null) {
  const [events, setEvents] = useState<DebugEvent[]>([])
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])

  useEffect(() => {
    if (!callClient) return

    // Subscribe to call client events via onEvent callback
    // This is already handled by the CallClient constructor config
    // The events will be automatically passed through config.onEvent

    // Cleanup on unmount
    return () => {
      setEvents([])
      setTranscript([])
    }
  }, [callClient])

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const addEvent = (event: { type: string; timestamp: number; payload?: any }) => {
    const debugEvent: DebugEvent = {
      type: event.type,
      ts: formatTimestamp(event.timestamp),
      meta: event.payload,
    }
    setEvents((prev) => [...prev, debugEvent].slice(-15))
  }

  return { events, transcript, addEvent }
}
