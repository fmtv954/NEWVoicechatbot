"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Loader2, Mic, MicOff, Phone, PhoneOff, User, Mail, Clock } from "lucide-react"
import { Room, RoomEvent, createLocalAudioTrack } from "livekit-client"

type RoomStatus = "idle" | "connecting" | "connected" | "disconnected"

interface MilestoneEvent {
  type: string
  timestamp: number
  payload?: any
}

export default function AcceptHandoffClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [status, setStatus] = useState<"loading" | "accepted" | "error" | "expired" | "already_accepted">("loading")
  const [error, setError] = useState<string>("")
  const [roomData, setRoomData] = useState<{
    room_name: string
    livekit_token: string
    livekit_url: string
    ticket_id: string
    call_id?: string
    lead?: {
      first_name?: string
      last_name?: string
      email?: string
      phone?: string
    }
    reason?: string
    accepted_at?: string
  } | null>(null)

  const [roomStatus, setRoomStatus] = useState<RoomStatus>("idle")
  const [isMuted, setIsMuted] = useState(false)
  const [events, setEvents] = useState<MilestoneEvent[]>([])
  const roomRef = useRef<Room | null>(null)
  const callIdRef = useRef<string | null>(null)

  useEffect(() => {
    async function acceptHandoff() {
      if (!token) {
        setStatus("error")
        setError("No token provided")
        return
      }

      try {
        const response = await fetch("/api/handoff/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })

        const data = await response.json()

        if (response.status === 410) {
          setStatus("expired")
          setError(data.error || "This handoff request has expired")
          return
        }

        if (response.status === 409) {
          setStatus("already_accepted")
          setRoomData({ ...data, accepted_at: data.accepted_at })
          setError(data.error || "This handoff has already been accepted")
          return
        }

        if (!response.ok) {
          setStatus("error")
          setError(data.error || "Failed to accept handoff")
          return
        }

        setStatus("accepted")
        setRoomData({
          room_name: data.room_name,
          livekit_token: data.livekit_token,
          livekit_url: data.livekit_url,
          ticket_id: data.ticket_id,
          call_id: data.call_id,
          lead: data.lead,
          reason: data.reason,
        })

        callIdRef.current = data.call_id || null

        await connectToRoom(data.livekit_url, data.livekit_token, data.call_id)
      } catch (err) {
        console.error("[Agent Accept] Error:", err)
        setStatus("error")
        setError("Network error - please try again")
      }
    }

    acceptHandoff()

    return () => {
      if (callIdRef.current && roomRef.current) {
        fetch("/api/calls/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            call_id: callIdRef.current,
            type: "livekit_left",
            payload: {
              participant_type: "agent",
            },
          }),
        }).catch((err) => console.error("[Agent Accept] Failed to log livekit_left:", err))
      }

      disconnectFromRoom()
    }
  }, [token])

  async function connectToRoom(livekitUrl: string, livekitToken: string, callId?: string) {
    try {
      setRoomStatus("connecting")

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      })

      roomRef.current = room

      // Listen for room events
      room.on(RoomEvent.Connected, async () => {
        console.log("[Agent Accept] Connected to LiveKit room")
        setRoomStatus("connected")

        const event: MilestoneEvent = {
          type: "livekit_joined",
          timestamp: Date.now(),
          payload: { participant_type: "agent" },
        }
        setEvents((prev) => [...prev, event].slice(-15))

        // Log livekit_joined event
        if (callId) {
          await fetch("/api/calls/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              call_id: callId,
              type: "livekit_joined",
              payload: {
                participant_type: "agent",
              },
            }),
          })
        }
      })

      room.on(RoomEvent.Disconnected, async () => {
        console.log("[Agent Accept] Disconnected from LiveKit room")
        setRoomStatus("disconnected")

        const event: MilestoneEvent = {
          type: "livekit_left",
          timestamp: Date.now(),
          payload: { participant_type: "agent" },
        }
        setEvents((prev) => [...prev, event].slice(-15))

        if (callIdRef.current) {
          await fetch("/api/calls/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              call_id: callIdRef.current,
              type: "livekit_left",
              payload: {
                participant_type: "agent",
              },
            }),
          })
        }
      })

      // Connect to the room
      await room.connect(livekitUrl, livekitToken)

      // Create and publish local audio track
      const audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      })

      await room.localParticipant.publishTrack(audioTrack)
      console.log("[Agent Accept] Published audio track")
    } catch (err) {
      console.error("[Agent Accept] Failed to connect to room:", err)
      setStatus("error")
      setError("Failed to connect to voice call")
      setRoomStatus("disconnected")
    }
  }

  function disconnectFromRoom() {
    if (roomRef.current) {
      roomRef.current.disconnect()
      roomRef.current = null
    }
  }

  function toggleMute() {
    if (roomRef.current) {
      const audioTrack = roomRef.current.localParticipant.audioTrackPublications.values().next().value?.track
      if (audioTrack) {
        if (isMuted) {
          audioTrack.unmute()
        } else {
          audioTrack.mute()
        }
        setIsMuted(!isMuted)
      }
    }
  }

  function endCall() {
    disconnectFromRoom()
    setRoomStatus("disconnected")
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
  }

  const getEventColor = (type: string) => {
    if (type === "livekit_joined") return "text-green-600"
    if (type === "livekit_left") return "text-red-600"
    return "text-slate-500"
  }

  return (
    <div className="container max-w-5xl mx-auto py-12 px-4">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Card */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-6 w-6" />
                Agent Handoff
              </CardTitle>
              <CardDescription>Accept incoming handoff from AI agent</CardDescription>
            </CardHeader>
            <CardContent>
              {status === "loading" && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">Accepting handoff...</p>
                </div>
              )}

              {status === "expired" && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Clock className="h-12 w-12 text-orange-500" />
                  <div className="text-center">
                    <p className="font-semibold text-orange-600">Request Expired</p>
                    <p className="text-sm text-muted-foreground mt-2">{error}</p>
                    <p className="text-xs text-muted-foreground mt-4">
                      This handoff link has expired. Please ask the customer to request a new handoff.
                    </p>
                  </div>
                </div>
              )}

              {status === "already_accepted" && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <CheckCircle2 className="h-12 w-12 text-blue-500" />
                  <div className="text-center">
                    <p className="font-semibold text-blue-600">Already Accepted</p>
                    <p className="text-sm text-muted-foreground mt-2">{error}</p>
                    {roomData?.accepted_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Accepted at: {new Date(roomData.accepted_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {status === "error" && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                  <div className="text-center">
                    <p className="font-semibold text-destructive">Failed to Accept</p>
                    <p className="text-sm text-muted-foreground mt-2">{error}</p>
                  </div>
                  <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">
                    Try Again
                  </Button>
                </div>
              )}

              {status === "accepted" && roomData && (
                <>
                  {roomData.lead && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Customer Information
                      </h3>
                      <div className="space-y-2 text-sm">
                        {(roomData.lead.first_name || roomData.lead.last_name) && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-600" />
                            <span className="font-medium">
                              {[roomData.lead.first_name, roomData.lead.last_name].filter(Boolean).join(" ")}
                            </span>
                          </div>
                        )}
                        {roomData.lead.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-blue-600" />
                            <span>{roomData.lead.email}</span>
                          </div>
                        )}
                        {roomData.lead.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-blue-600" />
                            <span>{roomData.lead.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {roomData.reason && (
                    <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-900">
                        <strong>Reason:</strong> {roomData.reason}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col items-center justify-center py-8 gap-4">
                    {roomStatus === "connecting" && (
                      <>
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Connecting to call...</p>
                      </>
                    )}

                    {roomStatus === "connected" && (
                      <>
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                        <div className="text-center">
                          <p className="font-semibold text-green-600">Connected!</p>
                          <p className="text-sm text-muted-foreground mt-2">You are now talking with the caller</p>
                        </div>

                        <div className="flex gap-3 mt-6">
                          <Button variant={isMuted ? "destructive" : "outline"} size="lg" onClick={toggleMute}>
                            {isMuted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                            {isMuted ? "Unmute" : "Mute"}
                          </Button>
                          <Button variant="destructive" size="lg" onClick={endCall}>
                            <PhoneOff className="mr-2 h-4 w-4" />
                            Leave
                          </Button>
                        </div>

                        <div className="mt-6 p-4 bg-muted rounded-lg w-full">
                          <p className="text-xs text-muted-foreground">Room: {roomData.room_name}</p>
                        </div>
                      </>
                    )}

                    {roomStatus === "disconnected" && (
                      <>
                        <PhoneOff className="h-12 w-12 text-muted-foreground" />
                        <div className="text-center">
                          <p className="font-semibold">Call Ended</p>
                          <p className="text-sm text-muted-foreground mt-2">The call has been disconnected</p>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-slate-900 rounded-2xl shadow-lg p-6 text-white sticky top-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-semibold">Event Log</h3>
              <span className="ml-auto text-xs text-slate-400">{events.length}/15</span>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
              {events.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-8">No events yet</p>
              ) : (
                events.map((event, index) => (
                  <div key={index} className="bg-slate-800 rounded-lg p-3 text-xs border border-slate-700">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={`font-mono font-semibold ${getEventColor(event.type)}`}>{event.type}</span>
                      <span className="text-slate-500">{formatTimestamp(event.timestamp)}</span>
                    </div>
                    {event.payload && (
                      <div className="text-slate-400 mt-1 font-mono text-[10px]">
                        {JSON.stringify(event.payload, null, 0)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

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
