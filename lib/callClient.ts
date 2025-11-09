/**
 * WebRTC Call Client for OpenAI Realtime API
 *
 * Handles getUserMedia, ring tone, session creation, and WebRTC connection
 */

type CallClientConfig = {
  agentId: string
  campaignId: string
  microphoneStream?: MediaStream
  onStateChange?: (state: 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended') => void
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
      this.config.onStateChange?.('ringing')
      this.emit('ringing')

      if (this.config.microphoneStream) {
        console.log('[v0] 🎤 Using pre-acquired microphone stream')
        this.localStream = this.config.microphoneStream

        // Check if AudioContext was attached during permission grant
        const preAudioContext = (this.localStream as any)._audioContext
        if (preAudioContext && preAudioContext.state === 'running') {
          this.audioContext = preAudioContext
          console.log('[v0] ✓ Using pre-created AudioContext from permission dialog')
        }
      } else {
        console.log('[v0] 🎤 Requesting microphone access...')
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
          console.log('[v0] AudioContext created, state:', this.audioContext.state)

          if (this.audioContext.state === 'suspended') {
            console.log('[v0] AudioContext suspended - attempting resume...')
            await this.audioContext.resume()
            console.log('[v0] AudioContext resumed, state:', this.audioContext.state)
          }
        } catch (err) {
          console.error('[v0] Failed to create AudioContext:', err)
        }
      }

      const [micTrack] = this.localStream.getAudioTracks()
      micTrack.enabled = true

      console.log('[v0] ✓ Microphone acquired:', {
        readyState: micTrack.readyState,
        muted: micTrack.muted,
        enabled: micTrack.enabled,
        label: micTrack.label,
        settings: micTrack.getSettings(),
      })

      if (micTrack.readyState !== 'live') {
        throw new Error('Microphone track is not live - check device permissions')
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

          console.log('[v0] ✓ Microphone analyzer connected to SAME stream being transmitted')
          console.log('[v0] ✓ Analyzer settings:', {
            fftSize: this.microphoneAnalyzer.fftSize,
            frequencyBinCount: this.microphoneAnalyzer.frequencyBinCount,
            minDecibels: this.microphoneAnalyzer.minDecibels,
            maxDecibels: this.microphoneAnalyzer.maxDecibels,
          })

          // Start monitoring immediately
          this.monitorMicrophoneLevels()
        } catch (err) {
          console.error('[v0] Failed to create microphone analyzer:', err)
        }
      }

      try {
        this.ringAudio = new Audio(
          'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/phone-ringing-382734-Dpm4XMvhZGxma3hoWloFLrI4kdq22a.mp3'
        )
        this.ringAudio.loop = true
        this.ringAudio.volume = 0.5 // Increased volume to 50%

        this.ringStartTime = Date.now()

        // Add load event listener
        this.ringAudio.addEventListener('canplaythrough', () => {
          console.log('[v0] Ring tone loaded and ready to play')
        })

        this.ringAudio.addEventListener('error', (err) => {
          console.error('[v0] Ring tone error:', err)
        })

        // Wait for audio to load before playing
        await this.ringAudio.play()
        console.log('[v0] Ring tone playing - should last 5-6 seconds')
      } catch (err) {
        console.warn('[v0] Failed to play ring tone:', err)
        // Continue without ring tone - not critical for functionality
      }

      // POST /api/session to get session credentials
      this.config.onStateChange?.('connecting')
      // Emit connecting event
      this.emit('connecting')
      const sessionResponse = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: this.config.agentId,
          campaign_id: this.config.campaignId,
        }),
      })

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json()
        throw new Error(errorData.error || 'Failed to create session')
      }

      const { callId, sessionClientSecret, rtcConfiguration } = await sessionResponse.json()

      // Validate session response
      if (
        !sessionClientSecret ||
        typeof sessionClientSecret !== 'string' ||
        sessionClientSecret.length === 0
      ) {
        console.error('[v0] Invalid session response - missing or empty sessionClientSecret')
        throw new Error('Invalid session credentials received from server')
      }

      this.callId = callId
      this.config.onCallStarted?.(callId)
      this.emit('call_started', { callId })

      console.log('[v0] ✓ Session created successfully')
      console.log('[v0] - Call ID:', callId)
      console.log('[v0] - Client Secret length:', sessionClientSecret.length)
      console.log('[v0] - Client Secret prefix:', sessionClientSecret.substring(0, 20) + '...')

      console.log('[v0] Session created, callId:', callId)
      console.log('[v0] Session client secret length:', sessionClientSecret?.length || 0)

      this.peerConnection = new RTCPeerConnection(rtcConfiguration)

      console.log('[v0] Adding sendrecv audio transceiver...')
      this.peerConnection.addTransceiver('audio', {
        direction: 'sendrecv',
      })

      console.log('[v0] Adding microphone track to peer connection...')
      const [track] = this.localStream.getAudioTracks()

      // Double-check track is enabled and live
      if (!track.enabled || track.readyState !== 'live') {
        console.error('[v0] ⚠️ Track not ready:', {
          enabled: track.enabled,
          readyState: track.readyState,
        })
        track.enabled = true
      }

      const sender = this.peerConnection.addTrack(track, this.localStream)
      console.log('[v0] ✓ Microphone track added, sender:', {
        track: sender.track?.id,
        kind: sender.track?.kind,
        enabled: sender.track?.enabled,
        muted: sender.track?.muted,
        readyState: sender.track?.readyState,
      })

      this.monitorOutboundAudioLevel(sender)

      // Create data channel for events
      this.dataChannel = this.peerConnection.createDataChannel('oai-events')
      this.dataChannel.addEventListener('open', () => {
        console.log('[v0] Data channel opened')
        this.emit('data_channel_open')

        // Data channel ready, waiting for ring to finish before greeting...
        console.log('[v0] Data channel ready, waiting for ring to complete before greeting...')
      })

      this.attachToolHandlers()

      // ===== ENHANCED HANDLER WITH RING DURATION CHECK =====
      // Listen for remote audio tracks
      this.peerConnection.addEventListener('track', (event) => {
        console.log('[v0] Received remote track:', event.track.kind)

        if (event.track.kind === 'audio') {
          if (!this.hasReceivedAudio) {
            const ringElapsed = Date.now() - this.ringStartTime
            const remainingRing = Math.max(0, this.minRingDuration - ringElapsed)

            console.log(`[v0] First remote audio received after ${ringElapsed}ms ring`)
            console.log(`[v0] Waiting ${remainingRing}ms for ring to complete...`)

            // Wait for remaining ring time before stopping
            setTimeout(() => {
              console.log('[v0] Ring duration met - stopping ring and starting timer')
              this.hasReceivedAudio = true

              // Stop ring tone
              if (this.ringAudio) {
                this.ringAudio.pause()
                this.ringAudio = null
              }

              if (
                !this.greetingSent &&
                this.dataChannel &&
                this.dataChannel.readyState === 'open'
              ) {
                console.log('[v0] 🎤 Ring complete - requesting AI greeting now...')
                this.sendRealtimeEvent({
                  type: 'response.create',
                })
                this.greetingSent = true
              }

              // Start timer
              this.startTimer()

              // Update state to connected
              this.config.onStateChange?.('connected')

              if (this.callId) {
                fetch('/api/calls/events', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    call_id: this.callId,
                    type: 'first_ai_audio',
                  }),
                }).catch((err) => console.error('[v0] Failed to log first_ai_audio event:', err))
              }
            }, remainingRing)
          }

          if (!this.remoteAudioElement) {
            this.remoteAudioElement = new Audio()
            this.remoteAudioElement.autoplay = true
            this.remoteAudioElement.volume = 1.0
            this.remoteAudioElement.srcObject = event.streams[0]

            // Add comprehensive event listeners for diagnostics
            this.remoteAudioElement.addEventListener('loadedmetadata', () => {
              console.log('[v0] ✓ Remote audio metadata loaded')
            })

            this.remoteAudioElement.addEventListener('canplay', () => {
              console.log('[v0] ✓ Remote audio can play')
            })

            this.remoteAudioElement.addEventListener('playing', () => {
              console.log('[v0] ✓ Remote audio is PLAYING')
            })

            this.remoteAudioElement.addEventListener('pause', () => {
              console.log('[v0] ⚠ Remote audio PAUSED')
            })

            this.remoteAudioElement.addEventListener('stalled', () => {
              console.warn('[v0] ⚠ Remote audio STALLED')
            })

            this.remoteAudioElement.addEventListener('error', (err) => {
              console.error('[v0] ✗ Remote audio ERROR:', err)
            })

            // Attach to DOM body (hidden) to ensure browser allows playback
            this.remoteAudioElement.style.display = 'none'
            document.body.appendChild(this.remoteAudioElement)

            console.log('[v0] Remote audio element created and connected to stream')

            this.remoteAudioElement
              .play()
              .then(() => {
                console.log('[v0] ✓ Remote audio play() succeeded')
                console.log('[v0] ✓ Audio element volume:', this.remoteAudioElement!.volume)

                // Check if actually playing
                if (this.remoteAudioElement!.paused) {
                  console.error('[v0] ✗ Audio element says paused=true even after play()')
                  this.config.onError?.('Audio playback blocked. Click anywhere to enable sound.')
                } else {
                  console.log('[v0] ✓ Audio element paused=false, should be audible')
                }
              })
              .catch((err) => {
                console.error('[v0] ✗ Remote audio play() FAILED:', err)
                if (err.name === 'NotAllowedError') {
                  this.config.onError?.(
                    "Audio blocked by browser. Click 'Enable Audio' to hear the AI."
                  )
                } else {
                  this.config.onError?.('Failed to play AI audio: ' + err.message)
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
                console.error('[v0] Failed to create audio analyzer:', err)
              }
            }
          }
        }
      })
      // ===== END ENHANCED HANDLER =====

      // Handle ICE candidates
      this.peerConnection.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
          console.log('[v0] ICE candidate:', event.candidate.candidate)
        }
      })

      // Create and set local SDP offer
      const offer = await this.peerConnection.createOffer()
      await this.peerConnection.setLocalDescription(offer)

      console.log('[v0] SDP offer created with microphone attached')

      console.log('[v0] Sending SDP offer via proxy...')
      const sdpResponse = await fetch('/api/webrtc/sdp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          offer: offer.sdp,
          sessionClientSecret,
        }),
      })

      if (!sdpResponse.ok) {
        const errorData = await sdpResponse.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[v0] SDP exchange failed:', sdpResponse.status, errorData)
        throw new Error(errorData.error || `Failed to exchange SDP: ${sdpResponse.status}`)
      }

      const answerSdp = await sdpResponse.text()

      console.log('[v0] SDP answer received, length:', answerSdp.length)

      await this.peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      })

      console.log('[v0] WebRTC connection established')
    } catch (error) {
      console.error('[v0] Error starting call:', error)
      this.config.onError?.(error instanceof Error ? error.message : 'Failed to start call')
      this.cleanup()
    }
  }

  /**
   * Interrupt: Stop local audio immediately and send interrupt event
   */
  interrupt(): void {
    console.log('[v0] Interrupting AI')
    this.emit('barge_in')

    if (this.callId) {
      fetch('/api/calls/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: this.callId,
          type: 'barge_in',
        }),
      }).catch((err) => console.error('[v0] Failed to log barge_in event:', err))
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
      type: 'input_audio_buffer.clear',
    })

    this.sendRealtimeEvent({
      type: 'response.cancel',
    })
  }

  /**
   * End: Close tracks, peer connection, and timer
   */
  end(): void {
    console.log('[v0] Ending call')

    if (this.callId && this.startTime > 0) {
      const durationSeconds = Math.floor((Date.now() - this.startTime) / 1000)
      this.emit('call_ended', { duration_seconds: durationSeconds })
      fetch('/api/calls/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: this.callId,
          type: 'call_ended',
          payload: { duration_seconds: durationSeconds },
        }),
      }).catch((err) => console.error('[v0] Failed to log call_ended event:', err))
    }

    this.config.onStateChange?.('ended')
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
    this.emit('first_ai_audio')
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000)
      this.config.onDurationUpdate?.(elapsed)
    }, 1000)
  }

  /**
   * Send an event to the OpenAI Realtime API via data channel
   */
  private sendRealtimeEvent(event: any): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(event))
    }
  }

  /**
   * Attach tool handlers to listen for function_call_arguments.done events
   */
  private attachToolHandlers(): void {
    if (!this.dataChannel) {
      console.error('[v0] Cannot attach tool handlers: data channel not available')
      return
    }

    this.dataChannel.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data)

        console.log('[v0] OpenAI Event:', message.type, message)

        if (this.handoffInProgress) {
          if (message.type === 'response.created') {
            const responseId =
              (message as any).response?.id || (message as any).response_id || (message as any).id

            console.log('[v0] 🛑 Canceling AI response because handoff is in progress')

            if (responseId) {
              this.sendRealtimeEvent({
                type: 'response.cancel',
                response_id: responseId,
              })
            } else {
              this.sendRealtimeEvent({ type: 'response.cancel' })
            }

            return
          }

          if (
            message.type === 'response.audio.delta' ||
            message.type === 'response.audio.done' ||
            message.type === 'response.output_item.added' ||
            message.type === 'response.output_item.done' ||
            message.type === 'response.done'
          ) {
            return
          }
        }

        if (message.type === 'output_audio_buffer.started') {
          this.pauseMicrophoneForTTS()
        }

        if (message.type === 'output_audio_buffer.stopped') {
          this.resumeMicrophoneAfterTTS()
        }

        if (message.type === 'response.audio.delta') {
          if (!this.aiIsSpeaking) {
            this.aiIsSpeaking = true
            console.log('[v0] 🎤 AI Started Speaking')
            if (!this.aiHasResponded) {
              this.aiHasResponded = true
              console.log('[v0] ✅ AI HAS RESPONDED (first time)!')
              if (this.config.onAIResponded) {
                this.config.onAIResponded(true)
              }
            }
            this.updateDiagnostics()
          }
        }

        if (message.type === 'response.audio.done' || message.type === 'response.done') {
          if (this.aiIsSpeaking) {
            this.aiIsSpeaking = false
            console.log('[v0] 🔇 AI Stopped Speaking')
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

        if (message.type === 'response.created') {
          this.aiIsProcessing = true
          console.log('[v0] 🤔 AI Processing Response...')
          this.updateProcessingState()
        }

        if (message.type === 'input_audio_buffer.speech_started') {
          this.isReceivingUserAudio = true
          console.log('[v0] 🎙️ AI DETECTED your speech!')
          this.updateDiagnostics()
        }

        if (message.type === 'input_audio_buffer.speech_stopped') {
          this.isReceivingUserAudio = false
          console.log('[v0] 🔇 User stopped speaking')
          this.updateDiagnostics()
        }

        if (message.type === 'response.output_item.added') {
          console.log('[v0] ✅ AI Responding...')
        }

        if (message.type === 'session.created' || message.type === 'session.updated') {
          console.log('[v0] 📋 Session Config:', {
            voice: message.session?.voice,
            model: message.session?.model,
            input_audio_format: message.session?.input_audio_format,
            output_audio_format: message.session?.output_audio_format,
            turn_detection: message.session?.turn_detection,
            modalities: message.session?.modalities,
          })

          if (this.config.onAudioFormat) {
            this.config.onAudioFormat({
              codec: message.session?.output_audio_format,
              sampleRate: 24000, // Default for OpenAI Realtime
              channels: 1,
            })
          }
        }

        if (message.type === 'conversation.item.input_audio_transcription.completed') {
          const transcript = message.transcript || ''
          console.log('[v0] 🎤 User said:', transcript)
          this.emit('transcript', { speaker: 'user', text: transcript })
        }

        if (message.type === 'response.output_item.done') {
          if (message.item?.type === 'message' && message.item?.content) {
            const content = message.item.content.find((c: any) => c.type === 'text')
            if (content && content.text) {
              console.log('[v0] 🤖 AI said:', content.text)
              this.emit('transcript', { speaker: 'ai', text: content.text })
            }
          }
        }

        // Listen for function_call_arguments.done event
        if (message.type === 'response.function_call_arguments.done') {
          const { call_id, name, arguments: argsString } = message

          console.log('[v0] Tool call received:', name, argsString)

          // Parse arguments
          let args: any
          try {
            args = JSON.parse(argsString)
          } catch (parseError) {
            console.error('[v0] Failed to parse tool arguments:', parseError)
            this.sendToolOutput(call_id, name, {
              error: 'Invalid JSON arguments',
            })
            return
          }

          // Execute the tool
          const result = await this.runTool(name, args)

          // Send result back to OpenAI
          this.sendToolOutput(call_id, name, result)
        }
      } catch (error) {
        console.error('[v0] Error handling data channel message:', error)
      }
    })
  }

  /**
   * Execute a tool by name and return the result
   */
  private async runTool(name: string, args: any): Promise<any> {
    console.log(`[v0] Running tool: ${name}`, args)
    this.emit('function_call_invoked', { name, args })

    try {
      let result: any

      switch (name) {
        case 'saveLead':
          result = await this.toolSaveLead(args)
          break

        case 'searchWeb':
          result = await this.toolSearchWeb(args)
          break

        case 'requestHandoff':
          result = await this.toolRequestHandoff(args)
          break

        default:
          console.error(`[v0] Unknown tool: ${name}`)
          result = { error: `Unknown tool: ${name}` }
      }

      this.emit('tool_result_returned', { name, ok: !result.error, result })

      return result
    } catch (error) {
      console.error(`[v0] Tool execution error for ${name}:`, error)

      this.emit('tool_result_returned', {
        name,
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return {
        error: error instanceof Error ? error.message : 'Tool execution failed',
      }
    }
  }

  /**
   * Tool: saveLead - Save lead information to database
   */
  private async toolSaveLead(args: any): Promise<any> {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      throw new Error(errorData.error || 'Failed to save lead')
    }

    const result = await response.json()

    this.emit('lead_saved', {
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

    // Deduplicate: only search once per unknown question
    const normalizedQuery = query.toLowerCase().trim()
    if (this.searchedQueries.has(normalizedQuery)) {
      console.log(`[v0] Skipping duplicate search for: ${query}`)
      return {
        results: [],
        message: 'Already searched for this query',
      }
    }

    // Mark as searched
    this.searchedQueries.add(normalizedQuery)

    // Log tool_called event
    if (this.callId) {
      fetch('/api/calls/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: this.callId,
          type: 'tool_called',
          payload: { tool: 'searchWeb', query },
        }),
      }).catch((err) => console.error('[v0] Failed to log tool_called event:', err))
    }

    const response = await fetch('/api/tools/searchWeb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, call_id: this.callId }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to search web')
    }

    const result = await response.json()
    return result
  }

  /**
   * Tool: requestHandoff - Request handoff to human agent
   */
  private async toolRequestHandoff(args: any): Promise<any> {
    console.log('[v0] 🚨 REQUEST HANDOFF TRIGGERED')
    console.log('[v0] - Agent ID:', this.config.agentId)
    console.log('[v0] - Campaign ID:', this.config.campaignId)
    console.log('[v0] - Call ID:', this.callId)
    console.log('[v0] - Reason:', args.reason)

    let response: Response
    try {
      response = await fetch('/api/handoff/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: this.config.agentId,
          campaign_id: this.config.campaignId,
          call_id: this.callId,
          reason: args.reason,
        }),
      })

      console.log('[v0] 📥 Handoff response status:', response.status)
      console.log('[v0] 📥 Response content-type:', response.headers.get('content-type'))

      if (!response.ok) {
        let errorData: any
        const contentType = response.headers.get('content-type')

        if (contentType && contentType.includes('application/json')) {
          errorData = await response.json()
        } else {
          const errorText = await response.text()
          console.error('[v0] ❌ Handoff request failed with plain text error:', errorText)
          throw new Error(errorText || 'Failed to request handoff')
        }

        console.error('[v0] ❌ Handoff request failed:', errorData)
        throw new Error(errorData.error || 'Failed to request handoff')
      }

      const result = await response.json()
      console.log('[v0] ✅ Handoff request successful:', result)

      this.emit('handoff_requested', {
        ticket_id: result.ticket_id,
        reason: args.reason,
        slackMessage: result.slackMessage,
      })

      this.enterHandoffMode()

      return { ok: true, ticket_id: result.ticket_id }
    } catch (error) {
      console.error('[v0] ❌ Handoff tool exception:', error)
      throw error
    }
  }

  /**
   * Send tool output back to OpenAI Realtime API
   */
  private sendToolOutput(callId: string, name: string, output: any): void {
    console.log(`[v0] Sending tool output for ${name}:`, output)

    this.sendRealtimeEvent({
      type: 'response.function_call_output',
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

      if (average > 5) {
        console.log(`[v0] ✓ Audio stream active, level: ${this.lastAudioLevel}`)
      } else {
        console.log(`[v0] ⚠ Audio stream silent, level: ${this.lastAudioLevel}`)
      }

      this.updateDiagnostics()

      // Check again in 2 seconds if still connected
      if (this.remoteAudioElement) {
        setTimeout(checkLevel, 2000)
      }
    }

    // Start monitoring after 1 second
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

      // Get frequency data
      this.microphoneAnalyzer.getByteFrequencyData(dataArray)
      const frequencyAverage = dataArray.reduce((a, b) => a + b, 0) / dataArray.length

      // Get time domain data for RMS calculation
      this.microphoneAnalyzer.getByteTimeDomainData(timeDomainArray)
      let sum = 0
      for (let i = 0; i < timeDomainArray.length; i++) {
        const normalized = (timeDomainArray[i] - 128) / 128
        sum += normalized * normalized
      }
      const rms = Math.sqrt(sum / timeDomainArray.length) * 100

      // Use the maximum of both measurements
      this.lastMicrophoneLevel = Math.max(Math.round(frequencyAverage), Math.round(rms))

      if (this.lastMicrophoneLevel > 10) {
        console.log(
          `[v0] 🎤 Microphone input level: ${this.lastMicrophoneLevel} (LOUD - freq:${Math.round(frequencyAverage)} rms:${Math.round(rms)})`
        )
      } else if (this.lastMicrophoneLevel > 3) {
        console.log(
          `[v0] 🎤 Microphone input level: ${this.lastMicrophoneLevel} (moderate - freq:${Math.round(frequencyAverage)} rms:${Math.round(rms)})`
        )
      } else {
        console.log(
          `[v0] 🎤 Microphone input level: ${this.lastMicrophoneLevel} (quiet/silent - freq:${Math.round(frequencyAverage)} rms:${Math.round(rms)})`
        )
      }

      if (this.config.onMicrophoneLevel) {
        this.config.onMicrophoneLevel(this.lastMicrophoneLevel)
      }

      // Check again in 100ms for responsive updates
      if (this.localStream) {
        setTimeout(checkLevel, 100)
      }
    }

    // Start monitoring immediately
    checkLevel()
  }

  async forceResumeAudio(): Promise<void> {
    console.log('[v0] Force resuming audio...')

    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
      console.log('[v0] AudioContext resumed, state:', this.audioContext.state)
    }

    if (this.remoteAudioElement) {
      // Ensure volume is at maximum
      this.remoteAudioElement.volume = 1.0

      if (this.remoteAudioElement.paused) {
        try {
          await this.remoteAudioElement.play()
          console.log('[v0] ✓ Remote audio manually resumed and playing')
        } catch (err) {
          console.error('[v0] Failed to manually resume audio:', err)
        }
      } else {
        console.log('[v0] ✓ Audio already playing')
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
          if (report.type === 'outbound-rtp' && report.kind === 'audio') {
            currentBytes = report.bytesSent || 0
            currentPackets = report.packetsSent || 0
            audioLevel = report.audioLevel || 0
            totalAudioEnergy = report.totalAudioEnergy || 0
          }
        })

        const bytesIncreased = currentBytes > lastBytes
        const packetsIncreased = currentPackets > lastPackets
        const energyIncreased = totalAudioEnergy > lastAudioEnergy

        if (bytesIncreased && packetsIncreased) {
          if (energyIncreased && audioLevel > 0) {
            console.log('[v0] ✓ AUDIO TRANSMITTING (with sound):', {
              bytes: currentBytes,
              packets: currentPackets,
              audioLevel: audioLevel.toFixed(4),
              energyDelta: (totalAudioEnergy - lastAudioEnergy).toFixed(6),
            })
          } else {
            console.log(
              '[v0] ⚠️ Bytes transmitting but NO AUDIO ENERGY - sending silence frames:',
              {
                bytes: currentBytes,
                packets: currentPackets,
                audioLevel: audioLevel.toFixed(4),
                totalAudioEnergy: totalAudioEnergy.toFixed(6),
              }
            )
          }
        } else if (lastBytes > 0) {
          console.log('[v0] ⚠️ Microphone NOT transmitting - bytes/packets not increasing')
        }

        lastBytes = currentBytes
        lastPackets = currentPackets
        lastAudioEnergy = totalAudioEnergy

        if (this.peerConnection) {
          setTimeout(checkStats, 500)
        }
      } catch (err) {
        console.error('[v0] Failed to get sender stats:', err)
      }
    }

    setTimeout(checkStats, 1000)
  }

  private pauseMicrophoneForTTS(): void {
    if (!this.localStream) return

    const track = this.localStream.getAudioTracks()[0]
    if (track && track.enabled) {
      track.enabled = false
      console.log('[v0] 🤫 Mic paused during TTS to avoid echo')
    }
  }

  private resumeMicrophoneAfterTTS(): void {
    if (!this.localStream) return

    const track = this.localStream.getAudioTracks()[0]
    if (track && !track.enabled && track.readyState === 'live') {
      track.enabled = true
      console.log('[v0] 🔊 Mic RESUMED after TTS - ready for user input!')

      // Ensure AudioContext is running
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('[v0] AudioContext also resumed')
        })
      }
    } else if (track && track.enabled) {
      console.log('[v0] ✓ Mic already enabled')
    }
  }

  private enterHandoffMode(): void {
    if (this.handoffInProgress) {
      return
    }

    console.log('[v0] 🤫 Entering handoff mode - silencing AI responses')

    this.handoffInProgress = true

    if (this.remoteAudioElement) {
      this.remoteAudioElement.muted = true
      this.remoteAudioElement.volume = 0
    }

    this.aiIsSpeaking = false
    this.aiIsProcessing = false
    this.updateDiagnostics()
    this.updateProcessingState()

    this.sendRealtimeEvent({ type: 'response.cancel' })

    this.sendRealtimeEvent({
      type: 'session.update',
      session: {
        instructions:
          "The conversation has been handed off to a human agent. Continue transcribing the caller's audio but do not speak or respond.",
      },
    })
  }
}

export default CallClient
