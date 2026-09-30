import { useEffect, useRef, useState } from "react"
import { Play, Pause } from "lucide-react"

export default function AudioBubble({ src, mine }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const [seededBars, setSeededBars] = useState(null)

  useEffect(() => {
    const key = (src || "").slice(-24)
    let hash = 0
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
    const bars = []
    for (let i = 0; i < 42; i++) {
      hash = (hash * 1103515245 + 12345) | 0
      const v = Math.abs(hash) % 100
      bars.push(0.25 + (v / 100) * 0.75)
    }
    setSeededBars(bars)
  }, [src])

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play(); setPlaying(true) }
  }

  function seekTo(fraction) {
    const a = audioRef.current
    if (!a || !a.duration) return
    a.currentTime = Math.max(0, Math.min(1, fraction)) * a.duration
    setProgress(fraction)
    setCurrent(a.currentTime)
  }

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => {
      if (a.duration) {
        setProgress(a.currentTime / a.duration)
        setCurrent(a.currentTime)
      }
    }
    const onLoaded = () => setDuration(a.duration || 0)
    const onEnd = () => { setPlaying(false); setProgress(0); setCurrent(0) }
    a.addEventListener("timeupdate", onTime)
    a.addEventListener("loadedmetadata", onLoaded)
    a.addEventListener("ended", onEnd)
    return () => {
      a.removeEventListener("timeupdate", onTime)
      a.removeEventListener("loadedmetadata", onLoaded)
      a.removeEventListener("ended", onEnd)
    }
  }, [])

  const fmtTime = (sec) => {
    if (!sec || !isFinite(sec)) return "0:00"
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return m + ":" + String(s).padStart(2, "0")
  }

  const fg = mine ? "#ffffff" : "#A78BFA"
  const bg = mine ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.12)"

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[200px]">
      <button
        onClick={toggle}
        className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${mine ? "bg-white/20 text-white" : "bg-purple-600 text-white"}`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <Pause size={15} strokeWidth={2.6} fill="currentColor" />
        ) : (
          <Play size={15} strokeWidth={2.6} fill="currentColor" />
        )}
      </button>

      <div
        className="flex-1 flex items-center gap-[2px] cursor-pointer select-none"
        style={{ height: 30 }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const frac = (e.clientX - rect.left) / rect.width
          seekTo(frac)
        }}
      >
        {(seededBars || []).map((h, i) => {
          const barFrac = i / Math.max(1, seededBars.length - 1)
          const filled = barFrac <= progress
          return (
            <span
              key={i}
              style={{
                flex: 1,
                height: Math.max(4, h * 26),
                background: filled ? fg : bg,
                borderRadius: 2,
                transition: "background 80ms linear",
              }}
            />
          )
        })}
      </div>

      <span
        className={`text-[10.5px] font-semibold tabular-nums shrink-0 ${mine ? "text-white/80" : "text-muted"}`}
        style={{ minWidth: 34, textAlign: "right" }}
      >
        {fmtTime(playing || current > 0 ? current : duration)}
      </span>

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  )
}
