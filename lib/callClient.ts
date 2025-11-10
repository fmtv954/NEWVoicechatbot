/**
 * WebRTC Call Client for OpenAI Realtime API
 *
 * Handles getUserMedia, ring tone, session creation, and WebRTC connection
 */

type CallClientConfig = {
  agentId: string
  campaignId: string
  microphoneStream?: MediaStream
  onStateChange?: (state: "idle" | "ringing" | "connecting" | "connected" | "ended") => void
  onDurationUpdate?: (seconds: number) => void
  onError?: (error: string) => void
  onCallStarted?: (callId: string) => void
  onEvent?: (event: { type: string; timestamp: number; payload?: any }) => void
  onAIStatus?: (status: {
    isSpeaking: boolean
    isReceivingAudio: boolean
    audioLevel: number
  }) => void
  onAudioFormat?: (format: { codec?: string; sampleRate?: number; channels?: number }) => void
  onMicrophoneLevel?: (level: number) => void
  onAIProcessing?: (isProcessing: boolean) => void
  onAIResponded?: (hasResponded: boolean) => void
  onTranscript?: (transcript: { speaker: string; text: string }) => void
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
  private aiIsSpeaking = false
  private isReceivingUserAudio = false
  private lastAudioLevel = 0
  private diagnosticInterval: NodeJS.Timeout | null = null
  private greetingSent = false
  private aiIsProcessing = false
  private microphoneAnalyzer: AnalyserNode | null = null
  private lastMicrophoneLevel = 0
  private aiHasResponded = false
  private handoffInProgress = false
  private pendingHandoffSilenceAck = false
  private handoffSilenceAckTimeout: NodeJS.Timeout | null = null

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

      if (this.config.microphoneStream) {
        this.localStream = this.config.microphoneStream

        const preAudioContext = (this.localStream as any)._audioContext
        if (preAudioContext && preAudioContext.state === "running") {
          this.audioContext = preAudioContext
        }
      } else {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: { ideal: 24000 },
            channelCount: { ideal: 1 },
          },
        })
      }

      // Create AudioContext if not already created
      if (!this.audioContext) {
        try {
          this.audioContext = new AudioContext({ sampleRate: 24000 })

          if (this.audioContext.state === "suspended") {
            await this.audioContext.resume()
          }
        } catch (err) {
          console.error("[v0] Failed to create AudioContext:", err)
        }
      }

      const [micTrack] = this.localStream.getAudioTracks()
      micTrack.enabled = true

      if (micTrack.readyState !== "live") {
        throw new Error("Microphone track is not live - check device permissions")
      }

      if (this.audioContext && this.localStream) {
        try {
          const micSource = this.audioContext.createMediaStreamSource(this.localStream)
          this.microphoneAnalyzer = this.audioContext.createAnalyser()
          this.microphoneAnalyzer.fftSize = 256
          this.microphoneAnalyzer.smoothingTimeConstant = 0.3
          this.microphoneAnalyzer.minDecibels = -90
          this.microphoneAnalyzer.maxDecibels = -10
          micSource.connect(this.microphoneAnalyzer)

          this.monitorMicrophoneLevels()
        } catch (err) {
          console.error("[v0] Failed to create microphone analyzer:", err)
        }
      }

      try {
        this.ringAudio = new Audio(
          "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/phone-ringing-382734-Dpm4XMvhZGxma3hoWloFLrI4kdq22a.mp3",
        )
        this.ringAudio.loop = true
        this.ringAudio.volume = 0.5

        this.ringStartTime = Date.now()

        await this.ringAudio.play()
      } catch (err) {
        console.warn("[v0] Failed to play ring tone:", err)
      }

      this.config.onStateChange?.("connecting")
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

      if (!sessionClientSecret || typeof sessionClientSecret !== "string" || sessionClientSecret.length === 0) {
        console.error("[v0] Invalid session response - missing or empty sessionClientSecret")
        throw new Error("Invalid session credentials received from server")
      }

      this.callId = callId
      this.config.onCallStarted?.(callId)
      this.emit("call_started", { callId })

      this.peerConnection = new RTCPeerConnection(rtcConfiguration)

      this.peerConnection.addTransceiver("audio", {
        direction: "sendrecv",
      })

      const [track] = this.localStream.getAudioTracks()

      if (!track.enabled || track.readyState !== "live") {
        console.error("[v0] Track not ready:", {
          enabled: track.enabled,
          readyState: track.readyState,
        })
        track.enabled = true
      }

      const sender = this.peerConnection.addTrack(track, this.localStream)

      this.monitorOutboundAudioLevel(sender)

      this.dataChannel = this.peerConnection.createDataChannel("oai-events")
      this.dataChannel.addEventListener("open", () => {
        this.emit("data_channel_open")
      })

      this.attachToolHandlers()

      this.peerConnection.addEventListener("track", (event) => {
        if (event.track.kind === "audio") {
          if (!this.hasReceivedAudio) {
            const ringElapsed = Date.now() - this.ringStartTime
            const remainingRing = Math.max(0, this.minRingDuration - ringElapsed)

            setTimeout(() => {
              this.hasReceivedAudio = true

              if (this.ringAudio) {
                this.ringAudio.pause()
                this.ringAudio = null
              }

              if (!this.greetingSent && this.dataChannel && this.dataChannel.readyState === "open") {
                this.sendRealtimeEvent({
                  type: "response.create",
                })
                this.greetingSent = true
              }

              this.startTimer()
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

            this.remoteAudioElement.style.display = "none"
            document.body.appendChild(this.remoteAudioElement)

            this.remoteAudioElement
              .play()
              .then(() => {
                if (this.remoteAudioElement!.paused) {
                  console.error("[v0] Audio element paused after play()")
                  this.config.onError?.("Audio playback blocked. Click anywhere to enable sound.")
                }
              })
              .catch((err) => {
                console.error("[v0] Remote audio play() failed:", err)
                if (err.name === "NotAllowedError") {
                  this.config.onError?.("Audio blocked by browser. Click 'Enable Audio' to hear the AI.")
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

                this.monitorAudioLevels()
              } catch (err) {
                console.error("[v0] Failed to create audio analyzer:", err)
              }
            }
          }
        }
      })

      this.peerConnection.addEventListener("icecandidate", () => {})

      const offer = await this.peerConnection.createOffer()
      await this.peerConnection.setLocalDescription(offer)

      const sdpResponse = await fetch("/api/webrtc/sdp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          offer: offer.sdp,
          sessionClientSecret,
        }),
      })

      if (!sdpResponse.ok) {
        const errorData = await sdpResponse.json().catch(() => ({ error: "Unknown error" }))
        console.error("[v0] SDP exchange failed:", sdpResponse.status, errorData)
        throw new Error(errorData.error || `Failed to exchange SDP: ${sdpResponse.status}`)
      }

      const answerSdp = await sdpResponse.text()

      await this.peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      })
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

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = false
        setTimeout(() => {
          track.enabled = true
        }, 50)
      })
    }

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
    if (this.diagnosticInterval) {
      clearInterval(this.diagnosticInterval)
      this.diagnosticInterval = null
    }

    this.handoffInProgress = false
    this.pendingHandoffSilenceAck = false

    if (this.handoffSilenceAckTimeout) {
      clearTimeout(this.handoffSilenceAckTimeout)
      this.handoffSilenceAckTimeout = null
    }

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
    this.microphoneAnalyzer = null

    // Reset state
    this.hasReceivedAudio = false
    this.startTime = 0
    this.searchedQueries.clear()
    this.aiIsSpeaking = false
    this.isReceivingUserAudio = false
    this.lastAudioLevel = 0
    this.greetingSent = false
    this.aiIsProcessing = false
    this.lastMicrophoneLevel = 0
    this.aiHasResponded = false
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

  private watchForHandoffSilenceAck(): void {
    if (this.handoffSilenceAckTimeout) {
      clearTimeout(this.handoffSilenceAckTimeout)
    }

    this.pendingHandoffSilenceAck = true
    this.handoffSilenceAckTimeout = setTimeout(() => {
      this.handleHandoffSilenceFailure("timeout")
    }, 3000)
  }

  private acknowledgeHandoffSilence(): void {
    if (!this.pendingHandoffSilenceAck) {
      return
    }

    console.log("[v0] 🤫 OpenAI acknowledged silence directive")

    this.pendingHandoffSilenceAck = false

    if (this.handoffSilenceAckTimeout) {
      clearTimeout(this.handoffSilenceAckTimeout)
      this.handoffSilenceAckTimeout = null
    }
  }

  private handleHandoffSilenceFailure(reason: "timeout" | "remote_error", details?: string): void {
    if (!this.pendingHandoffSilenceAck) {
      return
    }

    this.pendingHandoffSilenceAck = false

    if (this.handoffSilenceAckTimeout) {
      clearTimeout(this.handoffSilenceAckTimeout)
      this.handoffSilenceAckTimeout = null
    }

    const message =
      reason === "timeout"
        ? "[v0] ⚠️ Timed out waiting for OpenAI to acknowledge silence directive"
        : `[v0] ⚠️ OpenAI rejected silence directive: ${details ?? "unknown error"}`

    console.warn(message)
    this.emit("handoff_silence_fallback", { reason, details })
    this.sendRealtimeEvent({ type: "response.cancel" })
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

        if (message.type === "session.updated") {
          this.acknowledgeHandoffSilence()
        }

        if (message.type === "error" && this.pendingHandoffSilenceAck) {
          const errorDetails =
            typeof (message as any)?.error?.message === "string" ? (message as any).error.message : undefined

          this.handleHandoffSilenceFailure("remote_error", errorDetails)
          return
        }

        if (this.handoffInProgress) {
          if (message.type === "response.created") {
            const responseId = (message as any).response?.id || (message as any).response_id || (message as any).id

            if (responseId) {
              this.sendRealtimeEvent({
                type: "response.cancel",
                response_id: responseId,
              })
            } else {
              this.sendRealtimeEvent({ type: "response.cancel" })
            }

            return
          }

          if (
            message.type === "response.audio.delta" ||
            message.type === "response.audio.done" ||
            message.type === "response.output_item.added" ||
            message.type === "response.output_item.done" ||
            message.type === "response.done"
          ) {
            return
          }
        }

        if (message.type === "output_audio_buffer.started") {
          this.pauseMicrophoneForTTS()
        }

        if (message.type === "output_audio_buffer.stopped") {
          this.resumeMicrophoneAfterTTS()
        }

        if (message.type === "response.audio.delta") {
          if (!this.aiIsSpeaking) {
            this.aiIsSpeaking = true
            if (!this.aiHasResponded) {
              this.aiHasResponded = true
              if (this.config.onAIResponded) {
                this.config.onAIResponded(true)
              }
            }
            this.updateDiagnostics()
          }
        }

        if (message.type === "response.audio.done" || message.type === "response.done") {
          if (this.aiIsSpeaking) {
            this.aiIsSpeaking = false
            this.updateDiagnostics()
          }
          if (this.aiIsProcessing) {
            this.aiIsProcessing = false
            this.updateProcessingState()
          }
          setTimeout(() => {
            this.resumeMicrophoneAfterTTS()
          }, 250)
        }

        if (message.type === "response.created") {
          this.aiIsProcessing = true
          this.updateProcessingState()
        }

        if (message.type === "input_audio_buffer.speech_started") {
          this.isReceivingUserAudio = true
          this.updateDiagnostics()
        }

        if (message.type === "input_audio_buffer.speech_stopped") {
          this.isReceivingUserAudio = false
          this.updateDiagnostics()
        }

        if (message.type === "session.created" || message.type === "session.updated") {
          if (this.config.onAudioFormat) {
            this.config.onAudioFormat({
              codec: message.session?.output_audio_format,
              sampleRate: 24000,
              channels: 1,
            })
          }
        }

        if (message.type === "conversation.item.input_audio_transcription.completed") {
          const transcript = message.transcript || ""
          this.emit("transcript", { speaker: "user", text: transcript })
        }

        if (message.type === "response.output_item.done") {
          if (message.item?.type === "message" && message.item?.content) {
            const content = message.item.content.find((c: any) => c.type === "text")
            if (content && content.text) {
              this.emit("transcript", { speaker: "ai", text: content.text })
            }
          }
        }

        if (message.type === "response.function_call_arguments.done") {
          const { call_id, name, arguments: argsString } = message

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

          const result = await this.runTool(name, args)
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
        call_id: this.callId,
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

    this.emit("lead_saved", {
      lead_id: result.lead_id,
      leadData: {
        first_name: args.first_name,
        last_name: args.last_name,
        email: args.email,
        phone: args.phone,
        reason: args.reason,
      },
    })

    return { ok: true, lead_id: result.lead_id }
  }

  /**
   * Tool: searchWeb - Search the web via Tavily (with deduplication)
   */
  private async toolSearchWeb(args: any): Promise<any> {
    const { query } = args

    const normalizedQuery = query.toLowerCase().trim()
    if (this.searchedQueries.has(normalizedQuery)) {
      return {
        results: [],
        message: "Already searched for this query",
      }
    }

    this.searchedQueries.add(normalizedQuery)

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
    console.log("[v0] REQUEST HANDOFF TRIGGERED")

    let response: Response
    try {
      response = await fetch("/api/handoff/request", {
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
        let errorData: any
        const contentType = response.headers.get("content-type")

        if (contentType && contentType.includes("application/json")) {
          errorData = await response.json()
        } else {
          const errorText = await response.text()
          console.error("[v0] Handoff request failed:", errorText)
          throw new Error(errorText || "Failed to request handoff")
        }

        console.error("[v0] Handoff request failed:", errorData)
        throw new Error(errorData.error || "Failed to request handoff")
      }

      const result = await response.json()

      this.emit("handoff_requested", {
        ticket_id: result.ticket_id,
        reason: args.reason,
        slackMessage: result.slackMessage,
      })

      this.enterHandoffMode()

      return { ok: true, ticket_id: result.ticket_id }
    } catch (error) {
      console.error("[v0] Handoff tool exception:", error)
      throw error
    }
  }

  /**
   * Send tool output back to OpenAI Realtime API
   */
  private sendToolOutput(callId: string, name: string, output: any): void {
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
      this.lastAudioLevel = Math.round(average)

      this.updateDiagnostics()

      if (this.remoteAudioElement) {
        setTimeout(checkLevel, 2000)
      }
    }

    setTimeout(checkLevel, 1000)
  }

  private updateDiagnostics(): void {
    if (this.config.onAIStatus) {
      this.config.onAIStatus({
        isSpeaking: this.aiIsSpeaking,
        isReceivingAudio: this.isReceivingUserAudio,
        audioLevel: this.lastAudioLevel,
      })
    }
  }

  private updateProcessingState(): void {
    if (this.config.onAIProcessing) {
      this.config.onAIProcessing(this.aiIsProcessing)
    }
  }

  private monitorMicrophoneLevels(): void {
    if (!this.microphoneAnalyzer) return

    const bufferLength = this.microphoneAnalyzer.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    const timeDomainArray = new Uint8Array(this.microphoneAnalyzer.fftSize)

    const checkLevel = () => {
      if (!this.microphoneAnalyzer || !this.localStream) return

      this.microphoneAnalyzer.getByteFrequencyData(dataArray)
      const frequencyAverage = dataArray.reduce((a, b) => a + b, 0) / dataArray.length

      this.microphoneAnalyzer.getByteTimeDomainData(timeDomainArray)
      let sum = 0
      for (let i = 0; i < timeDomainArray.length; i++) {
        const normalized = (timeDomainArray[i] - 128) / 128
        sum += normalized * normalized
      }
      const rms = Math.sqrt(sum / timeDomainArray.length) * 100

      this.lastMicrophoneLevel = Math.max(Math.round(frequencyAverage), Math.round(rms))

      if (this.config.onMicrophoneLevel) {
        this.config.onMicrophoneLevel(this.lastMicrophoneLevel)
      }

      if (this.localStream) {
        setTimeout(checkLevel, 100)
      }
    }

    checkLevel()
  }

  async forceResumeAudio(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume()
    }

    if (this.remoteAudioElement) {
      this.remoteAudioElement.volume = 1.0

      if (this.remoteAudioElement.paused) {
        try {
          await this.remoteAudioElement.play()
        } catch (err) {
          console.error("[v0] Failed to manually resume audio:", err)
        }
      }
    }
  }

  private monitorOutboundAudioLevel(sender: RTCRtpSender): void {
    let lastBytes = 0
    let lastPackets = 0
    let lastAudioEnergy = 0

    const checkStats = async () => {
      if (!sender || !this.peerConnection) return

      try {
        const stats = await sender.getStats()
        let currentBytes = 0
        let currentPackets = 0
        let audioLevel = 0
        let totalAudioEnergy = 0

        stats.forEach((report) => {
          if (report.type === "outbound-rtp" && report.kind === "audio") {
            currentBytes = report.bytesSent || 0
            currentPackets = report.packetsSent || 0
            audioLevel = report.audioLevel || 0
            totalAudioEnergy = report.totalAudioEnergy || 0
          }
        })

        lastBytes = currentBytes
        lastPackets = currentPackets
        lastAudioEnergy = totalAudioEnergy

        if (this.peerConnection) {
          setTimeout(checkStats, 500)
        }
      } catch (err) {
        console.error("[v0] Failed to get sender stats:", err)
      }
    }

    setTimeout(checkStats, 1000)
  }

  private pauseMicrophoneForTTS(): void {
    if (!this.localStream) return

    const track = this.localStream.getAudioTracks()[0]
    if (track && track.enabled) {
      track.enabled = false
    }
  }

  private resumeMicrophoneAfterTTS(): void {
    if (!this.localStream) return

    const track = this.localStream.getAudioTracks()[0]
    if (track && !track.enabled && track.readyState === "live") {
      track.enabled = true

      if (this.audioContext && this.audioContext.state === "suspended") {
        this.audioContext.resume()
      }
    }
  }

  private enterHandoffMode(): void {
    if (this.handoffInProgress) {
      return
    }

    console.log("[v0] Entering handoff mode")

    this.handoffInProgress = true

    if (this.remoteAudioElement) {
      this.remoteAudioElement.muted = true
      this.remoteAudioElement.volume = 0
    }

    this.aiIsSpeaking = false
    this.aiIsProcessing = false
    this.updateDiagnostics()
    this.updateProcessingState()

    this.sendRealtimeEvent({ type: "response.cancel" })

    this.watchForHandoffSilenceAck()

    this.sendRealtimeEvent({
      type: "session.update",
      session: {
        instructions:
          "The conversation has been handed off to a human agent. Continue transcribing the caller's audio but do not speak or respond.",
      },
    })
  }
}

export default CallClient
