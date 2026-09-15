import { useEffect, useRef } from 'react'

// Ring modes:
//   'incoming' → two-tone ring (someone is calling you)
//   'outgoing' → single-tone ring-back (you are calling them)
//   'none'     → silent
//
// Uses Web Audio API — no external audio files needed.

export function useRingtone(mode) {
  const ctxRef = useRef(null)
  const timeoutRef = useRef(null)
  const stopRef = useRef(false)

  useEffect(() => {
    stopRef.current = false
    clearTimeout(timeoutRef.current)

    if (mode === 'none') return

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      ctxRef.current = ctx

      const playPattern = () => {
        if (stopRef.current || ctx.state === 'closed') return
        const now = ctx.currentTime

        if (mode === 'incoming') {
          const g = ctx.createGain()
          g.gain.value = 0
          g.connect(ctx.destination)

          const o = ctx.createOscillator()
          o.frequency.value = 880
          o.type = 'sine'
          o.connect(g)

          g.gain.setValueAtTime(0.001, now)
          g.gain.linearRampToValueAtTime(0.16, now + 0.03)
          g.gain.setValueAtTime(0.16, now + 0.32)
          g.gain.linearRampToValueAtTime(0.001, now + 0.38)
          g.gain.setValueAtTime(0.001, now + 0.5)
          g.gain.linearRampToValueAtTime(0.16, now + 0.53)
          g.gain.setValueAtTime(0.16, now + 0.82)
          g.gain.linearRampToValueAtTime(0.001, now + 0.88)

          o.start(now)
          o.stop(now + 0.95)

          timeoutRef.current = setTimeout(playPattern, 2400)
        } else if (mode === 'outgoing') {
          const g = ctx.createGain()
          g.gain.value = 0
          g.connect(ctx.destination)

          const o = ctx.createOscillator()
          o.frequency.value = 440
          o.type = 'sine'
          o.connect(g)

          g.gain.setValueAtTime(0.001, now)
          g.gain.linearRampToValueAtTime(0.1, now + 0.05)
          g.gain.setValueAtTime(0.1, now + 0.9)
          g.gain.linearRampToValueAtTime(0.001, now + 1.0)

          o.start(now)
          o.stop(now + 1.05)

          timeoutRef.current = setTimeout(playPattern, 3200)
        }
      }

      ctx.resume().catch(() => {})
      playPattern()
    } catch (err) {
      console.warn('Ringtone unavailable:', err)
    }

    return () => {
      stopRef.current = true
      clearTimeout(timeoutRef.current)
      if (ctxRef.current) {
        try { ctxRef.current.close() } catch {}
        ctxRef.current = null
      }
    }
  }, [mode])
}
