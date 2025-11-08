"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Activity, Copy, ChevronDown, ChevronUp, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"

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

interface DebugPanelProps {
  events: DebugEvent[]
  transcript?: TranscriptEntry[]
  maxEvents?: number
}

export function DebugPanel({ events, transcript, maxEvents = 15 }: DebugPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  const eventsEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (!isCollapsed && eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [events.length, isCollapsed])

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent) => {
    if (!panelRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  // Handle dragging
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragOffset])

  // Copy events to clipboard
  const handleCopyEvents = () => {
    const eventsText = events
      .map((event) => {
        const meta = event.meta ? ` ${JSON.stringify(event.meta)}` : ""
        return `[${event.ts}] ${event.type}${meta}`
      })
      .join("\n")

    navigator.clipboard.writeText(eventsText).then(() => {
      console.log("[DebugPanel] Events copied to clipboard")
    })
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case "call_started":
      case "first_ai_audio":
      case "livekit_joined":
        return "text-green-600"
      case "barge_in":
        return "text-orange-600"
      case "function_call_invoked":
      case "tool_result_returned":
        return "text-blue-600"
      case "lead_saved":
        return "text-purple-600"
      case "handoff_requested":
      case "slack_notification_sent": // Replaced sms_sent with slack_notification_sent
        return "text-red-600"
      case "handoff_accepted":
        return "text-teal-600"
      case "call_ended":
      case "livekit_left":
        return "text-slate-600"
      default:
        return "text-slate-500"
    }
  }

  const displayedEvents = events.slice(-maxEvents)

  return (
    <div
      ref={panelRef}
      className="fixed bg-slate-900 rounded-2xl shadow-2xl text-white z-50 w-96"
      style={{
        right: position.x === 0 ? "1rem" : "auto",
        top: position.y === 0 ? "4rem" : position.y,
        left: position.x === 0 ? "auto" : position.x,
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      {/* Header with drag handle */}
      <div
        className="flex items-center gap-2 p-4 border-b border-slate-700 cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
      >
        <GripVertical className="w-4 h-4 text-slate-500" />
        <Activity className="w-5 h-5 text-green-400" />
        <h3 className="text-lg font-semibold flex-1">Debug Panel</h3>
        <span className="text-xs text-slate-400">
          {displayedEvents.length}/{maxEvents}
        </span>
        <Button variant="ghost" size="sm" onClick={handleCopyEvents} className="text-slate-400 hover:text-white">
          <Copy className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-slate-400 hover:text-white"
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </Button>
      </div>

      {/* Events panel */}
      {!isCollapsed && (
        <div className="p-4">
          {/* Events list */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
            {displayedEvents.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-8">
                No events yet. Start a call to see activity.
              </p>
            ) : (
              displayedEvents.map((event, index) => (
                <div key={index} className="bg-slate-800 rounded-lg p-3 text-xs border border-slate-700">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={`font-mono font-semibold ${getEventColor(event.type)}`}>{event.type}</span>
                    <span className="text-slate-500 text-[10px]">{event.ts}</span>
                  </div>
                  {event.meta && (
                    <div className="text-slate-400 mt-1 font-mono text-[10px] overflow-x-auto">
                      {JSON.stringify(event.meta, null, 0)}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={eventsEndRef} />
          </div>

          {/* Transcript section */}
          {transcript && transcript.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <h4 className="text-sm font-semibold mb-2 text-slate-300">Recent Transcript</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {transcript.slice(-6).map((entry, index) => (
                  <div key={index} className="text-xs">
                    <span className={`font-semibold ${entry.role === "ai" ? "text-blue-400" : "text-green-400"}`}>
                      {entry.role === "ai" ? "AI" : "Customer"}:
                    </span>
                    <span className="text-slate-300 ml-2">{entry.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgb(30 41 59);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgb(71 85 105);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgb(100 116 139);
        }
      `}</style>
    </div>
  )
}
