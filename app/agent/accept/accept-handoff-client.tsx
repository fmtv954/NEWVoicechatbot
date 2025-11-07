"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Loader2, Mic, MicOff, Phone, PhoneOff } from "lucide-react"
import { Room, RoomEvent, createLocalAudioTrack } from "livekit-client"

type RoomStatus = "idle" | "connecting" | "connected" | "disconnected"

export default function AcceptHandoffClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [status, setStatus] = useState<"loading" | "accepted" | "error">("loading")
  const [error, setError] = useState<string>("")
  const [roomData, setRoomData] = useState<{
    room_name: string
    livekit_token: string
    livekit_url: string
    ticket_id: string
    call_id?: string
  } | null>(null)

  const [roomStatus, setRoomStatus] = useState<RoomStatus>("idle")
  const [isMuted, setIsMuted] = useState(false)
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

  return (
    <div className="container max-w-2xl mx-auto py-12 px-4">
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
            <div className="flex flex-col items-center justify-center py-12 gap-4">
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
                      End Call
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
