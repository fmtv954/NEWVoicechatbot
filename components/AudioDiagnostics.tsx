"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, AlertTriangle, Volume2, VolumeX, RefreshCw } from "lucide-react"

interface DiagnosticResult {
  status: "pass" | "fail" | "warning" | "testing"
  message: string
}

interface DiagnosticsState {
  microphone: DiagnosticResult
  audioOutput: DiagnosticResult
  audioContext: DiagnosticResult
  ringTone: DiagnosticResult
  autoplay: DiagnosticResult
  webrtc: DiagnosticResult
  browser: DiagnosticResult
}

export function AudioDiagnostics() {
  const [isOpen, setIsOpen] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({
    microphone: { status: "testing", message: "Not tested" },
    audioOutput: { status: "testing", message: "Not tested" },
    audioContext: { status: "testing", message: "Not tested" },
    ringTone: { status: "testing", message: "Not tested" },
    autoplay: { status: "testing", message: "Not tested" },
    webrtc: { status: "testing", message: "Not tested" },
    browser: { status: "testing", message: "Not tested" },
  })

  const runDiagnostics = async () => {
    setIsRunning(true)

    // 1. Browser compatibility check
    const browserCheck = checkBrowserCompatibility()
    setDiagnostics((prev) => ({ ...prev, browser: browserCheck }))

    // 2. Microphone permission test
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setDiagnostics((prev) => ({
        ...prev,
        microphone: {
          status: "pass",
          message: `Microphone access granted (${stream.getAudioTracks()[0].label})`,
        },
      }))
      stream.getTracks().forEach((track) => track.stop())
    } catch (err: any) {
      setDiagnostics((prev) => ({
        ...prev,
        microphone: {
          status: "fail",
          message: `Microphone denied: ${err.message}`,
        },
      }))
    }

    // 3. Audio output test
    try {
      const audioTest = new Audio()
      if (audioTest.canPlayType("audio/mpeg")) {
        setDiagnostics((prev) => ({
          ...prev,
          audioOutput: {
            status: "pass",
            message: "Audio output supported",
          },
        }))
      } else {
        setDiagnostics((prev) => ({
          ...prev,
          audioOutput: {
            status: "warning",
            message: "MP3 not fully supported",
          },
        }))
      }
    } catch (err: any) {
      setDiagnostics((prev) => ({
        ...prev,
        audioOutput: {
          status: "fail",
          message: `Audio output error: ${err.message}`,
        },
      }))
    }

    // 4. AudioContext test
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      if (ctx.state === "suspended") {
        setDiagnostics((prev) => ({
          ...prev,
          audioContext: {
            status: "warning",
            message: "AudioContext suspended - user interaction needed",
          },
        }))
      } else {
        setDiagnostics((prev) => ({
          ...prev,
          audioContext: {
            status: "pass",
            message: `AudioContext ready (state: ${ctx.state})`,
          },
        }))
      }
      ctx.close()
    } catch (err: any) {
      setDiagnostics((prev) => ({
        ...prev,
        audioContext: {
          status: "fail",
          message: `AudioContext error: ${err.message}`,
        },
      }))
    }

    // 5. Ring tone file test
    try {
      const response = await fetch("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/phone-ringing-382734-Dpm4XMvhZGxma3hoWloFLrI4kdq22a.mp3", { method: "HEAD" })
      if (response.ok) {
        setDiagnostics((prev) => ({
          ...prev,
          ringTone: {
            status: "pass",
            message: "Ring tone file accessible",
          },
        }))
      } else {
        setDiagnostics((prev) => ({
          ...prev,
          ringTone: {
            status: "fail",
            message: `Ring tone not found (${response.status})`,
          },
        }))
      }
    } catch (err: any) {
      setDiagnostics((prev) => ({
        ...prev,
        ringTone: {
          status: "fail",
          message: `Ring tone fetch error: ${err.message}`,
        },
      }))
    }

    // 6. Autoplay test
    try {
      const testAudio = new Audio()
      testAudio.volume = 0
      testAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
      const playPromise = testAudio.play()

      if (playPromise !== undefined) {
        await playPromise
        setDiagnostics((prev) => ({
          ...prev,
          autoplay: {
            status: "pass",
            message: "Autoplay allowed",
          },
        }))
        testAudio.pause()
      }
    } catch (err: any) {
      setDiagnostics((prev) => ({
        ...prev,
        autoplay: {
          status: "warning",
          message: "Autoplay blocked - user interaction required",
        },
      }))
    }

    // 7. WebRTC test
    try {
      const supported =
        typeof RTCPeerConnection !== "undefined" &&
        typeof navigator.mediaDevices !== "undefined" &&
        typeof navigator.mediaDevices.getUserMedia === "function"

      if (supported) {
        setDiagnostics((prev) => ({
          ...prev,
          webrtc: {
            status: "pass",
            message: "WebRTC fully supported",
          },
        }))
      } else {
        setDiagnostics((prev) => ({
          ...prev,
          webrtc: {
            status: "fail",
            message: "WebRTC not supported",
          },
        }))
      }
    } catch (err: any) {
      setDiagnostics((prev) => ({
        ...prev,
        webrtc: {
          status: "fail",
          message: `WebRTC error: ${err.message}`,
        },
      }))
    }

    setIsRunning(false)
  }

  const checkBrowserCompatibility = (): DiagnosticResult => {
    const ua = navigator.userAgent
    let browser = "Unknown"
    let supported = true

    if (ua.includes("Chrome")) browser = "Chrome"
    else if (ua.includes("Safari")) browser = "Safari"
    else if (ua.includes("Firefox")) browser = "Firefox"
    else if (ua.includes("Edge")) browser = "Edge"
    else {
      supported = false
    }

    return {
      status: supported ? "pass" : "warning",
      message: `Browser: ${browser}${supported ? " (Supported)" : " (May have issues)"}`,
    }
  }

  const getStatusIcon = (status: DiagnosticResult["status"]) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />
      case "fail":
        return <XCircle className="w-5 h-5 text-red-600" />
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />
      default:
        return <div className="w-5 h-5 border-2 border-slate-300 rounded-full animate-pulse" />
    }
  }

  const allPassed = Object.values(diagnostics).every((d) => d.status === "pass")
  const anyFailed = Object.values(diagnostics).some((d) => d.status === "fail")

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-all"
        >
          {anyFailed ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          Audio Diagnostics
        </button>
      ) : (
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-96 max-h-[600px] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Audio Diagnostics
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {/* Status Summary */}
            {!isRunning && (
              <div
                className={`p-3 rounded-lg border ${
                  allPassed
                    ? "bg-green-50 border-green-200"
                    : anyFailed
                      ? "bg-red-50 border-red-200"
                      : "bg-yellow-50 border-yellow-200"
                }`}
              >
                <p className="text-sm font-medium">
                  {allPassed
                    ? "✓ All systems operational"
                    : anyFailed
                      ? "⚠ Issues detected"
                      : "⚠ Some warnings detected"}
                </p>
              </div>
            )}

            {/* Run Diagnostics Button */}
            <button
              onClick={runDiagnostics}
              disabled={isRunning}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRunning ? "animate-spin" : ""}`} />
              {isRunning ? "Running Tests..." : "Run Diagnostics"}
            </button>

            {/* Diagnostic Results */}
            <div className="space-y-3">
              {Object.entries(diagnostics).map(([key, result]) => (
                <div key={key} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="flex-shrink-0 mt-0.5">{getStatusIcon(result.status)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5 break-words">{result.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {(anyFailed || Object.values(diagnostics).some((d) => d.status === "warning")) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-900 mb-2">Recommendations:</p>
                <ul className="text-xs text-blue-800 space-y-1">
                  {diagnostics.microphone.status === "fail" && <li>• Allow microphone access in browser settings</li>}
                  {diagnostics.autoplay.status === "warning" && <li>• Click anywhere on the page to enable audio</li>}
                  {diagnostics.ringTone.status === "fail" && <li>• Ring tone file missing or unreachable</li>}
                  {diagnostics.audioContext.status === "warning" && <li>• Interact with page before starting call</li>}
                  {diagnostics.webrtc.status === "fail" && <li>• Try a different browser (Chrome/Edge recommended)</li>}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
