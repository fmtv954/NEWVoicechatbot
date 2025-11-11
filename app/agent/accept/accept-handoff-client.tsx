"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  User,
  Mail,
  Clock,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Room, RoomEvent, createLocalAudioTrack, type RemoteParticipant, type LocalParticipant } from "livekit-client"

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
    lead_status?: string
    lead_status_reason?: string
    reason?: string
    accepted_at?: string
  } | null>(null)

  const [roomStatus, setRoomStatus] = useState<RoomStatus>("idle")
  const [isMuted, setIsMuted] = useState(false)
  const [events, setEvents] = useState<MilestoneEvent[]>([])
  const [participants, setParticipants] = useState<Array<RemoteParticipant | LocalParticipant>>([])
  const [audioLevels, setAudioLevels] = useState<Map<string, number>>(new Map())
  const [isSpeaking, setIsSpeaking] = useState<Map<string, boolean>>(new Map())
  const roomRef = useRef<Room | null>(null)
  const callIdRef = useRef<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyzerMapRef = useRef<Map<string, AnalyserNode>>(new Map())

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
          lead_status: data.lead_status,
          lead_status_reason: data.lead_status_reason,
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

      if (audioContextRef.current) {
        audioContextRef.current.close()
      }

      disconnectFromRoom()
    }
  }, [token])

  useEffect(() => {
    if (roomStatus !== "connected" || !roomRef.current) return

    const room = roomRef.current
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    audioContextRef.current = audioContext

    const setupAudioAnalyzer = (participant: RemoteParticipant | LocalParticipant) => {
      const audioTrack = Array.from(participant.audioTrackPublications.values())[0]?.track

      if (!audioTrack) return

      const mediaStreamTrack = audioTrack.mediaStreamTrack
      if (!mediaStreamTrack) return

      const stream = new MediaStream([mediaStreamTrack])
      const source = audioContext.createMediaStreamSource(stream)
      const analyzer = audioContext.createAnalyser()
      analyzer.fftSize = 256
      analyzer.smoothingTimeConstant = 0.8

      source.connect(analyzer)
      analyzerMapRef.current.set(participant.identity, analyzer)

      console.log("[v0] Setup audio analyzer for:", participant.identity)
    }

    const updateParticipants = () => {
      const allParticipants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())]
      console.log("[v0] Participants updated, count:", allParticipants.length)
      console.log(
        "[v0] Participant identities:",
        allParticipants.map((p) => p.identity),
      )
      setParticipants(allParticipants)

      // Setup analyzers for new participants
      allParticipants.forEach(setupAudioAnalyzer)
    }

    // Listen for participant changes
    room.on(RoomEvent.ParticipantConnected, updateParticipants)
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      analyzerMapRef.current.delete(participant.identity)
      updateParticipants()
    })
    room.on(RoomEvent.TrackSubscribed, updateParticipants)
    room.on(RoomEvent.TrackPublished, updateParticipants)

    // Listen for speaking indicators
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const speakingMap = new Map<string, boolean>()
      speakers.forEach((speaker) => {
        speakingMap.set(speaker.identity, true)
      })
      console.log("[v0] Active speakers:", Array.from(speakingMap.keys()))
      setIsSpeaking(speakingMap)
    })

    updateParticipants()

    // Monitor audio levels
    const monitorInterval = setInterval(() => {
      const levels = new Map<string, number>()

      analyzerMapRef.current.forEach((analyzer, identity) => {
        const dataArray = new Uint8Array(analyzer.frequencyBinCount)
        analyzer.getByteFrequencyData(dataArray)

        // Calculate average volume (0-1 scale)
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length / 255
        levels.set(identity, average)
      })

      setAudioLevels(levels)
    }, 100) // Update 10 times per second

    return () => {
      clearInterval(monitorInterval)
      room.off(RoomEvent.ParticipantConnected, updateParticipants)
      room.off(RoomEvent.ParticipantDisconnected, updateParticipants)
      room.off(RoomEvent.TrackSubscribed, updateParticipants)
      room.off(RoomEvent.TrackPublished, updateParticipants)
    }
  }, [roomStatus])

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
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const getEventColor = (type: string) => {
    if (type === "livekit_joined") return "text-green-600"
    if (type === "livekit_left") return "text-red-600"
    return "text-slate-500"
  }

  const formatLeadStatus = (status?: string) => {
    if (!status) return ""
    return status
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  }

  const getParticipantLabel = (participant: RemoteParticipant | LocalParticipant) => {
    if (participant.identity.startsWith("customer-")) {
      return "Customer"
    } else if (participant.identity.startsWith("agent-")) {
      return "You (Agent)"
    }
    return participant.identity
  }

  const leadDetails = roomData?.lead
  const hasLeadDetails = Boolean(
    leadDetails && [leadDetails.first_name, leadDetails.last_name, leadDetails.email, leadDetails.phone].some(Boolean),
  )

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
                  <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-900">
                      <User className="w-4 h-4" />
                      Customer Information
                    </h3>
                    {roomData.lead_status && roomData.lead_status !== "found" && (
                      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <Badge variant="outline" className="mb-2 border-amber-300 bg-amber-100 text-amber-900">
                          {formatLeadStatus(roomData.lead_status)}
                        </Badge>
                        <div className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <p>
                            {roomData.lead_status_reason ||
                              "We were unable to automatically match this caller to an existing lead."}
                          </p>
                        </div>
                      </div>
                    )}

                    {hasLeadDetails ? (
                      <div className="space-y-2 text-sm">
                        {(roomData.lead?.first_name || roomData.lead?.last_name) && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-600" />
                            <span className="font-medium">
                              {[roomData.lead?.first_name, roomData.lead?.last_name].filter(Boolean).join(" ")}
                            </span>
                          </div>
                        )}
                        {roomData.lead?.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-blue-600" />
                            <span>{roomData.lead.email}</span>
                          </div>
                        )}
                        {roomData.lead?.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-blue-600" />
                            <span>{roomData.lead.phone}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-white/70 p-3 text-sm text-blue-900">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <p>
                          We don't have saved lead details for this caller. Please confirm their name and contact
                          information manually before proceeding.
                        </p>
                      </div>
                    )}
                  </div>

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

                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                          <Users className="h-4 w-4" />
                          <span>
                            {participants.length} participant{participants.length !== 1 ? "s" : ""} in room
                          </span>
                        </div>

                        <div className="w-full text-xs text-muted-foreground">
                          <p>Debug: Room connected = {roomStatus === "connected" ? "yes" : "no"}</p>
                          <p>Debug: Participants detected = {participants.length}</p>
                        </div>

                        {participants.length > 0 && (
                          <div className="w-full max-w-md space-y-3 mt-4">
                            {participants.map((participant) => {
                              const level = audioLevels.get(participant.identity) || 0
                              const speaking = isSpeaking.get(participant.identity) || false
                              const isLocal = participant.identity === roomRef.current?.localParticipant.identity

                              return (
                                <div
                                  key={participant.identity}
                                  className={`p-3 rounded-lg border transition-all ${
                                    speaking ? "border-green-500 bg-green-50" : "border-slate-200 bg-slate-50"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <User className={`h-4 w-4 ${speaking ? "text-green-600" : "text-slate-600"}`} />
                                      <span
                                        className={`text-sm font-medium ${speaking ? "text-green-900" : "text-slate-700"}`}
                                      >
                                        {getParticipantLabel(participant)}
                                      </span>
                                      {speaking && (
                                        <Badge variant="outline" className="text-xs border-green-600 text-green-700">
                                          Speaking
                                        </Badge>
                                      )}
                                    </div>
                                    {isLocal && isMuted && <MicOff className="h-4 w-4 text-red-500" />}
                                  </div>

                                  {/* Audio level bar */}
                                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-100 ${
                                        speaking ? "bg-green-500" : "bg-blue-500"
                                      }`}
                                      style={{ width: `${level * 100}%` }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

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
