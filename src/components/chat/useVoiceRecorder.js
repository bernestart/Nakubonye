import { useCallback, useRef, useState } from "react"

/**
 * Shared voice-note recorder.
 * Usage:
 *   const { recording, seconds, start, stop } = useVoiceRecorder()
 *   start() — begins recording
 *   stop(true) → Promise<{ blob, seconds } | null>  — stops and returns blob
 *   stop(false) — cancels
 */
export function useVoiceRecorder({ maxSeconds = 300 } = {}) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const secondsRef = useRef(0)
  const resolveRef = useRef(null)

  const start = useCallback(async () => {
    if (recording) return false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm"
      const mr = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      secondsRef.current = 0
      setSeconds(0)

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        clearInterval(timerRef.current)
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        chunksRef.current = []
        if (resolveRef.current) {
          resolveRef.current({ blob, seconds: secondsRef.current })
          resolveRef.current = null
        }
      }

      mr.start()
      recorderRef.current = mr
      setRecording(true)

      timerRef.current = setInterval(() => {
        secondsRef.current += 1
        setSeconds(secondsRef.current)
        if (secondsRef.current >= maxSeconds) {
          try { recorderRef.current?.stop() } catch {}
          setRecording(false)
        }
      }, 1000)

      return true
    } catch (e) {
      return false
    }
  }, [recording, maxSeconds])

  const stop = useCallback((send) => {
    const mr = recorderRef.current
    if (!mr) return Promise.resolve(null)
    setRecording(false)
    return new Promise((resolve) => {
      if (!send) {
        // Discard — swallow the result
        resolveRef.current = () => resolve(null)
      } else {
        resolveRef.current = resolve
      }
      try { mr.stop() } catch { resolve(null) }
      recorderRef.current = null
    })
  }, [])

  return { recording, seconds, start, stop }
}
