"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Mic, AlertCircle, CheckCircle2 } from "lucide-react"

interface MicPermissionDialogProps {
  open: boolean
  onPermissionGranted: (stream: MediaStream) => void
  onPermissionDenied: (error: string) => void
}

export function MicPermissionDialog({ open, onPermissionGranted, onPermissionDenied }: MicPermissionDialogProps) {
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestMicrophone = async () => {
    setRequesting(true)
    setError(null)

    try {
      console.log("[v0] Requesting microphone permission (synchronous with user gesture)...")

      // Request microphone synchronously in the same call stack as button click
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 24000 },
          channelCount: { ideal: 1 },
        },
      })

      console.log("[v0] ✓ Microphone permission granted!")

      // Create and resume AudioContext within the same user gesture (critical for mobile)
      try {
        const audioContext = new AudioContext({ sampleRate: 24000 })
        console.log("[v0] AudioContext created within user gesture, state:", audioContext.state)

        if (audioContext.state === "suspended") {
          await audioContext.resume()
          console.log("[v0] ✓ AudioContext resumed, state:", audioContext.state)
        }
        // Store context on stream for later retrieval
        ;(stream as any)._audioContext = audioContext
      } catch (audioErr) {
        console.error("[v0] Failed to initialize AudioContext:", audioErr)
      }

      onPermissionGranted(stream)
    } catch (err: any) {
      console.error("[v0] ✗ Microphone permission denied:", err)

      let errorMessage = "Microphone access denied"

      if (err.name === "NotAllowedError") {
        errorMessage = "Microphone permission denied. Please allow microphone access in your browser settings."
      } else if (err.name === "NotFoundError") {
        errorMessage = "No microphone found. Please connect a microphone and try again."
      } else if (err.name === "NotReadableError") {
        errorMessage = "Microphone is already in use by another application."
      } else {
        errorMessage = err.message || "Failed to access microphone"
      }

      setError(errorMessage)
      onPermissionDenied(errorMessage)
    } finally {
      setRequesting(false)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full">
            <Mic className="w-8 h-8 text-blue-600" />
          </div>
          <DialogTitle className="text-center text-xl">Microphone Access Required</DialogTitle>
          <DialogDescription className="text-center">
            To start your AI voice call, we need access to your microphone. Your audio is only used for this
            conversation and is not recorded.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-2 py-2">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span>Voice conversation with AI</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span>Real-time speech recognition</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span>Transcripts only - no audio saved</span>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={requestMicrophone}
            disabled={requesting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            {requesting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Requesting Access...
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 mr-2" />
                Allow Microphone Access
              </>
            )}
          </Button>
        </DialogFooter>

        <p className="text-xs text-center text-slate-500">
          If you previously denied access, you may need to change it in your browser or device settings.
        </p>
      </DialogContent>
    </Dialog>
  )
}
