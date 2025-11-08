/**
 * WebRTC Call Client for OpenAI Realtime API
 *
 * Handles getUserMedia, ring tone, session creation, and WebRTC connection
 */

type CallClientConfig = {
  agentId: string
  campaignId: string
  onStateChange?: (state: "idle" | "ringing" | "connecting" | "connected" | "ended") => void
  onDurationUpdate?: (seconds: number) => void
  onError?: (error: string) => void
  onCallStarted?: (callId: string) => void
  onEvent?: (event: { type: string; timestamp: number; payload?: any }) => void
}

class CallClient {
  private config: CallClientConfig
  private localStream: MediaStream | null = null
  private peerConnection: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private ringAudio: HTMLAudioElement | null = null
  private timerInterval: NodeJS.Timeout | null = null
  private startTime = 0
  private hasReceivedAudio = false
  private remoteAudioElement: HTMLAudioElement | null = null
  private callId: string | null = null
  private searchedQueries = new Set<string>()
  private audioContext: AudioContext | null = null
  private audioAnalyzer: AnalyserNode | null = null
  private ringStartTime = 0
  private minRingDuration = 5000 // 5 seconds minimum ring before stopping

  constructor(config: CallClientConfig) {
    this.config = config
  }

  /**
   * Emit a milestone event to subscribers
   */
  private emit(type: string, payload?: any): void {
    if (this.config.onEvent) {
      this.config.onEvent({
        type,
        timestamp: Date.now(),
        payload,
      })
    }
  }

  /**
   * Start the call: getUserMedia, play ring, create session, establish WebRTC
   */
  async start(): Promise<void> {
    try {
      this.config.onStateChange?.("ringing")
      this.emit("ringing")

      // Get user microphone with echo cancellation, noise suppression, and auto gain control
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      try {
        this.audioContext = new AudioContext()
        console.log("[v0] AudioContext created, state:", this.audioContext.state)

        if (this.audioContext.state === "suspended") {
          console.warn("[v0] AudioContext is suspended - may need user interaction")
          // Try to resume AudioContext
          await this.audioContext.resume()
          console.log("[v0] AudioContext resumed, state:", this.audioContext.state)
        }
      } catch (err) {
        console.error("[v0] Failed to create AudioContext:", err)
      }

      try {
        this.ringAudio = new Audio("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/phone-ringing-382734-Dpm4XMvhZGxma3hoWloFLrI4kdq22a.mp3")
        this.ringAudio.loop = true
        this.ringAudio.volume = 0.5 // Increased volume to 50%

        this.ringStartTime = Date.now()

        // Add load event listener
        this.ringAudio.addEventListener("canplaythrough", () => {
          console.log("[v0] Ring tone loaded and ready to play")
        })

        this.ringAudio.addEventListener("error", (err) => {
          console.error("[v0] Ring tone error:", err)
        })

        // Wait for audio to load before playing
        await this.ringAudio.play()
        console.log("[v0] Ring tone playing - should last 5-6 seconds")
      } catch (err) {
        console.warn("[v0] Failed to play ring tone:", err)
        // Continue without ring tone - not critical for functionality
      }

      // POST /api/session to get session credentials
      this.config.onStateChange?.("connecting")
      // Emit connecting event
      this.emit("connecting")
      const sessionResponse = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: this.config.agentId,
          campaign_id: this.config.campaignId,
        }),
      })

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json()
        throw new Error(errorData.error || "Failed to create session")
      }

      const { callId, sessionClientSecret, rtcConfiguration } = await sessionResponse.json()
      this.callId = callId
      this.config.onCallStarted?.(callId)
      this.emit("call_started", { callId })

      // Create RTCPeerConnection
      this.peerConnection = new RTCPeerConnection(rtcConfiguration)

      // Add local audio track to peer connection
      this.localStream.getAudioTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!)
      })

      // Create data channel for events
      this.dataChannel = this.peerConnection.createDataChannel("oai-events")
      this.dataChannel.addEventListener("open", () => {
        console.log("[v0] Data channel opened")
        this.emit("data_channel_open")
        // Send session update with ephemeral key
        this.sendRealtimeEvent({
          type: "session.update",
          session: {
            modalities: ["audio", "text"],
            instructions: "", // Instructions already set on server
            voice: "sage",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: {
              model: "whisper-1",
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          },
        })
      })

      this.attachToolHandlers()

      // ===== ENHANCED HANDLER WITH RING DURATION CHECK =====
      // Listen for remote audio tracks
      this.peerConnection.addEventListener("track", (event) => {
        console.log("[v0] Received remote track:", event.track.kind)

        if (event.track.kind === "audio") {
          if (!this.hasReceivedAudio) {
            const ringElapsed = Date.now() - this.ringStartTime
            const remainingRing = Math.max(0, this.minRingDuration - ringElapsed)

            console.log(`[v0] First remote audio received after ${ringElapsed}ms ring`)

            // Wait for remaining ring time before stopping
            setTimeout(() => {
              console.log("[v0] Ring duration met - stopping ring and starting timer")
              this.hasReceivedAudio = true

              // Stop ring tone
              if (this.ringAudio) {
                this.ringAudio.pause()
                this.ringAudio = null
              }

              // Start timer
              this.startTimer()

              // Update state to connected
              this.config.onStateChange?.("connected")

              if (this.callId) {
                fetch("/api/calls/events", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    call_id: this.callId,
                    type: "first_ai_audio",
                  }),
                }).catch((err) => console.error("[v0] Failed to log first_ai_audio event:", err))
              }
            }, remainingRing)
          }

          if (!this.remoteAudioElement) {
            this.remoteAudioElement = new Audio()
            this.remoteAudioElement.autoplay = true
            this.remoteAudioElement.volume = 1.0
            this.remoteAudioElement.srcObject = event.streams[0]

            // Add comprehensive event listeners for diagnostics
            this.remoteAudioElement.addEventListener("loadedmetadata", () => {
              console.log("[v0] ✓ Remote audio metadata loaded")
            })

            this.remoteAudioElement.addEventListener("canplay", () => {
              console.log("[v0] ✓ Remote audio can play")
            })

            this.remoteAudioElement.addEventListener("playing", () => {
              console.log("[v0] ✓ Remote audio is PLAYING")
            })

            this.remoteAudioElement.addEventListener("pause", () => {
              console.log("[v0] ⚠ Remote audio PAUSED")
            })

            this.remoteAudioElement.addEventListener("stalled", () => {
              console.warn("[v0] ⚠ Remote audio STALLED")
            })

            this.remoteAudioElement.addEventListener("error", (err) => {
              console.error("[v0] ✗ Remote audio ERROR:", err)
            })

            // Attach to DOM body (hidden) to ensure browser allows playback
            this.remoteAudioElement.style.display = "none"
            document.body.appendChild(this.remoteAudioElement)

            console.log("[v0] Remote audio element created and connected to stream")

            this.remoteAudioElement
              .play()
              .then(() => {
                console.log("[v0] ✓ Remote audio play() succeeded")

                // Check if actually playing
                if (this.remoteAudioElement!.paused) {
                  console.error("[v0] ✗ Audio element says paused=true even after play()")
                  this.config.onError?.("Audio playback blocked. Click anywhere to enable sound.")
                } else {
                  console.log("[v0] ✓ Audio element paused=false, should be audible")
                }
              })
              .catch((err) => {
                console.error("[v0] ✗ Remote audio play() FAILED:", err)
                if (err.name === "NotAllowedError") {
                  this.config.onError?.("Audio blocked by browser. Click 'Unmute' to enable sound.")
                } else {
                  this.config.onError?.("Failed to play AI audio: " + err.message)
                }
              })

            if (this.audioContext && event.streams[0]) {
              try {
                const source = this.audioContext.createMediaStreamSource(event.streams[0])
                this.audioAnalyzer = this.audioContext.createAnalyser()
                this.audioAnalyzer.fftSize = 256
                source.connect(this.audioAnalyzer)

                // Monitor audio levels
                this.monitorAudioLevels()
              } catch (err) {
                console.error("[v0] Failed to create audio analyzer:", err)
              }
            }
          }
        }
      })
      // ===== END ENHANCED HANDLER =====

      // Handle ICE candidates
      this.peerConnection.addEventListener("icecandidate", (event) => {
        if (event.candidate) {
          console.log("[v0] ICE candidate:", event.candidate.candidate)
        }
      })

      // Create and set local SDP offer
      const offer = await this.peerConnection.createOffer()
      await this.peerConnection.setLocalDescription(offer)

      // Send offer to OpenAI Realtime API
      const sdpResponse = await fetch("https://api.openai.com/v1/realtime", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionClientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      })

      if (!sdpResponse.ok) {
        throw new Error("Failed to exchange SDP with OpenAI")
      }

      const answerSdp = await sdpResponse.text()
      await this.peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      })

      console.log("[v0] WebRTC connection established")
    } catch (error) {
      console.error("[v0] Error starting call:", error)
      this.config.onError?.(error instanceof Error ? error.message : "Failed to start call")
      this.cleanup()
    }
  }

  /**
   * Interrupt: Stop local audio immediately and send interrupt event
   */
  interrupt(): void {
    console.log("[v0] Interrupting AI")
    this.emit("barge_in")

    if (this.callId) {
      fetch("/api/calls/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: this.callId,
          type: "barge_in",
        }),
      }).catch((err) => console.error("[v0] Failed to log barge_in event:", err))
    }

    // Stop local audio immediately by disabling the track temporarily
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = false
        // Re-enable after a brief moment
        setTimeout(() => {
          track.enabled = true
        }, 50)
      })
    }

    // Send interrupt event via data channel
    this.sendRealtimeEvent({
      type: "input_audio_buffer.clear",
    })

    this.sendRealtimeEvent({
      type: "response.cancel",
    })
  }

  /**
   * End: Close tracks, peer connection, and timer
   */
  end(): void {
    console.log("[v0] Ending call")

    if (this.callId && this.startTime > 0) {
      const durationSeconds = Math.floor((Date.now() - this.startTime) / 1000)
      this.emit("call_ended", { duration_seconds: durationSeconds })
      fetch("/api/calls/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: this.callId,
          type: "call_ended",
          payload: { duration_seconds: durationSeconds },
        }),
      }).catch((err) => console.error("[v0] Failed to log call_ended event:", err))
    }

    this.config.onStateChange?.("ended")
    this.cleanup()
  }

  /**
   * Clean up all resources
   */
  private cleanup(): void {
    // Stop ring tone if still playing
    if (this.ringAudio) {
      this.ringAudio.pause()
      this.ringAudio = null
    }

    // Stop timer
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }

    // Stop local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    // Close data channel
    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    // Stop remote audio
    if (this.remoteAudioElement) {
      this.remoteAudioElement.pause()
      this.remoteAudioElement.srcObject = null
      // Remove from DOM
      if (this.remoteAudioElement.parentNode) {
        this.remoteAudioElement.parentNode.removeChild(this.remoteAudioElement)
      }
      this.remoteAudioElement = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.audioAnalyzer = null

    // Reset state
    this.hasReceivedAudio = false
    this.startTime = 0
    this.searchedQueries.clear()
  }

  /**
   * Start the call duration timer
   */
  private startTimer(): void {
    this.startTime = Date.now()
    this.emit("first_ai_audio")
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000)
      this.config.onDurationUpdate?.(elapsed)
    }, 1000)
  }

  /**
   * Send an event to the OpenAI Realtime API via data channel
   */
  private sendRealtimeEvent(event: any): void {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      this.dataChannel.send(JSON.stringify(event))
    }
  }

  /**
   * Attach tool handlers to listen for function_call_arguments.done events
   */
  private attachToolHandlers(): void {
    if (!this.dataChannel) {
      console.error("[v0] Cannot attach tool handlers: data channel not available")
      return
    }

    this.dataChannel.addEventListener("message", async (event) => {
      try {
        const message = JSON.parse(event.data)

        // Listen for function_call_arguments.done event
        if (message.type === "response.function_call_arguments.done") {
          const { call_id, name, arguments: argsString } = message

          console.log("[v0] Tool call received:", name, argsString)

          // Parse arguments
          let args: any
          try {
            args = JSON.parse(argsString)
          } catch (parseError) {
            console.error("[v0] Failed to parse tool arguments:", parseError)
            this.sendToolOutput(call_id, name, {
              error: "Invalid JSON arguments",
            })
            return
          }

          // Execute the tool
          const result = await this.runTool(name, args)

          // Send result back to OpenAI
          this.sendToolOutput(call_id, name, result)
        }
      } catch (error) {
        console.error("[v0] Error handling data channel message:", error)
      }
    })
  }

  /**
   * Execute a tool by name and return the result
   */
  private async runTool(name: string, args: any): Promise<any> {
    console.log(`[v0] Running tool: ${name}`, args)
    this.emit("function_call_invoked", { name, args })

    try {
      let result: any

      switch (name) {
        case "saveLead":
          result = await this.toolSaveLead(args)
          break

        case "searchWeb":
          result = await this.toolSearchWeb(args)
          break

        case "requestHandoff":
          result = await this.toolRequestHandoff(args)
          break

        default:
          console.error(`[v0] Unknown tool: ${name}`)
          result = { error: `Unknown tool: ${name}` }
      }

      this.emit("tool_result_returned", { name, ok: !result.error, result })

      return result
    } catch (error) {
      console.error(`[v0] Tool execution error for ${name}:`, error)

      this.emit("tool_result_returned", {
        name,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })

      return {
        error: error instanceof Error ? error.message : "Tool execution failed",
      }
    }
  }

  /**
   * Tool: saveLead - Save lead information to database
   */
  private async toolSaveLead(args: any): Promise<any> {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: this.config.agentId,
        campaign_id: this.config.campaignId,
        first_name: args.first_name,
        last_name: args.last_name,
        email: args.email,
        phone: args.phone,
        reason: args.reason,
        transcript: args.transcript,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to save lead")
    }

    const result = await response.json()
    this.emit("lead_saved", { lead_id: result.lead_id })
    return { ok: true, lead_id: result.lead_id }
  }

  /**
   * Tool: searchWeb - Search the web via Tavily (with deduplication)
   */
  private async toolSearchWeb(args: any): Promise<any> {
    const { query } = args

    // Deduplicate: only search once per unknown question
    const normalizedQuery = query.toLowerCase().trim()
    if (this.searchedQueries.has(normalizedQuery)) {
      console.log(`[v0] Skipping duplicate search for: ${query}`)
      return {
        results: [],
        message: "Already searched for this query",
      }
    }

    // Mark as searched
    this.searchedQueries.add(normalizedQuery)

    // Log tool_called event
    if (this.callId) {
      fetch("/api/calls/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: this.callId,
          type: "tool_called",
          payload: { tool: "searchWeb", query },
        }),
      }).catch((err) => console.error("[v0] Failed to log tool_called event:", err))
    }

    const response = await fetch("/api/tools/searchWeb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, call_id: this.callId }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to search web")
    }

    const result = await response.json()
    return result
  }

  /**
   * Tool: requestHandoff - Request handoff to human agent
   */
  private async toolRequestHandoff(args: any): Promise<any> {
    const response = await fetch("/api/handoff/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: this.config.agentId,
        campaign_id: this.config.campaignId,
        call_id: this.callId,
        reason: args.reason,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to request handoff")
    }

    const result = await response.json()
    this.emit("handoff_requested", { ticket_id: result.ticket_id })
    return { ok: true, ticket_id: result.ticket_id }
  }

  /**
   * Send tool output back to OpenAI Realtime API
   */
  private sendToolOutput(callId: string, name: string, output: any): void {
    console.log(`[v0] Sending tool output for ${name}:`, output)

    this.sendRealtimeEvent({
      type: "response.function_call_output",
      call_id: callId,
      name,
      output: JSON.stringify(output),
    })
  }

  private monitorAudioLevels(): void {
    if (!this.audioAnalyzer) return

    const dataArray = new Uint8Array(this.audioAnalyzer.frequencyBinCount)

    const checkLevel = () => {
      if (!this.audioAnalyzer || !this.remoteAudioElement) return

      this.audioAnalyzer.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length

      if (average > 5) {
        console.log(`[v0] ✓ Audio stream active, level: ${Math.round(average)}`)
      } else {
        console.log(`[v0] ⚠ Audio stream silent, level: ${Math.round(average)}`)
      }

      // Check again in 2 seconds if still connected
      if (this.remoteAudioElement) {
        setTimeout(checkLevel, 2000)
      }
    }

    // Start monitoring after 1 second
    setTimeout(checkLevel, 1000)
  }

  async forceResumeAudio(): Promise<void> {
    console.log("[v0] Force resuming audio...")

    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume()
      console.log("[v0] AudioContext resumed, state:", this.audioContext.state)
    }

    if (this.remoteAudioElement && this.remoteAudioElement.paused) {
      try {
        await this.remoteAudioElement.play()
        console.log("[v0] Remote audio manually resumed")
      } catch (err) {
        console.error("[v0] Failed to manually resume audio:", err)
      }
    }
  }
}

export default CallClient
