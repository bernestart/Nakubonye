import { useCallback, useEffect, useRef, useState } from "react"
import { Pause, Play, Undo2, Redo2, Plus, ImagePlus, Crop, FlipHorizontal, Scissors, Type, Music } from "lucide-react"

const FILMSTRIP_FRAMES = 8

export default function ReelTrim({ src, onCancel, onDone }) {
  const videoRef = useRef(null)
  const trackRef = useRef(null)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [frames, setFrames] = useState([])
  const [history, setHistory] = useState([])
  const [future, setFuture] = useState([])
  const [dragging, setDragging] = useState(null) // "start" | "end" | "playhead"

  const effectiveEnd = trimEnd ?? duration

  // Load metadata + extract filmstrip frames
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onLoaded = async () => {
      const d = v.duration || 0
      setDuration(d)
      setTrimEnd(d)

      // Extract filmstrip frames
      const capture = v.cloneNode(true)
      capture.muted = true
      capture.src = v.src
      capture.crossOrigin = "anonymous"
      const results = []
      for (let i = 0; i < FILMSTRIP_FRAMES; i++) {
        const t = (d / (FILMSTRIP_FRAMES - 1)) * i
        const frame = await new Promise((resolve) => {
          const onSeek = () => {
            try {
              const c = document.createElement("canvas")
              const w = 60
              const h = Math.round(w * (capture.videoHeight / capture.videoWidth) || w * 1.6)
              c.width = w; c.height = h
              c.getContext("2d").drawImage(capture, 0, 0, w, h)
              capture.removeEventListener("seeked", onSeek)
              resolve(c.toDataURL("image/jpeg", 0.6))
            } catch { resolve(null) }
          }
          capture.addEventListener("seeked", onSeek)
          try { capture.currentTime = t } catch { resolve(null) }
        })
        results.push(frame)
      }
      setFrames(results)
    }
    v.addEventListener("loadedmetadata", onLoaded)
    return () => v.removeEventListener("loadedmetadata", onLoaded)
  }, [src])

  // Playhead follows video current time
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => {
      setCurrent(v.currentTime)
      if (trimEnd != null && v.currentTime >= trimEnd) {
        v.pause()
        v.currentTime = trimStart
        setPlaying(false)
      }
    }
    v.addEventListener("timeupdate", onTime)
    return () => v.removeEventListener("timeupdate", onTime)
  }, [trimStart, trimEnd])

  // Auto-pause at end
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (trimStart != null && v.currentTime < trimStart) v.currentTime = trimStart
  }, [trimStart])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      if (v.currentTime < trimStart || v.currentTime >= effectiveEnd) v.currentTime = trimStart
      v.play().catch(() => {})
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  // Drag handles on the yellow timeline
  const onHandleDown = (which, e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(which)
    // Snapshot for undo
    setHistory((h) => [...h, { trimStart, trimEnd }])
    setFuture([])
  }

  useEffect(() => {
    if (!dragging) return
    const move = (e) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const t = e.touches?.[0] || e
      const pct = Math.max(0, Math.min(1, (t.clientX - rect.left) / rect.width))
      const time = pct * duration
      if (dragging === "start") {
        const maxStart = (trimEnd ?? duration) - 0.5
        setTrimStart(Math.min(time, maxStart))
      } else if (dragging === "end") {
        const minEnd = trimStart + 0.5
        setTrimEnd(Math.max(time, minEnd))
      } else if (dragging === "playhead") {
        if (videoRef.current) videoRef.current.currentTime = time
        setCurrent(time)
      }
    }
    const up = () => setDragging(null)
    window.addEventListener("mousemove", move)
    window.addEventListener("touchmove", move, { passive: false })
    window.addEventListener("mouseup", up)
    window.addEventListener("touchend", up)
    return () => {
      window.removeEventListener("mousemove", move)
      window.removeEventListener("touchmove", move)
      window.removeEventListener("mouseup", up)
      window.removeEventListener("touchend", up)
    }
  }, [dragging, duration, trimStart, trimEnd])

  const undo = () => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setFuture((f) => [...f, { trimStart, trimEnd }])
    setHistory((h) => h.slice(0, -1))
    setTrimStart(prev.trimStart)
    setTrimEnd(prev.trimEnd)
  }
  const redo = () => {
    if (future.length === 0) return
    const next = future[future.length - 1]
    setHistory((h) => [...h, { trimStart, trimEnd }])
    setFuture((f) => f.slice(0, -1))
    setTrimStart(next.trimStart)
    setTrimEnd(next.trimEnd)
  }

  const playheadPct = duration > 0 ? (current / duration) * 100 : 0
  const startPct = duration > 0 ? (trimStart / duration) * 100 : 0
  const endPct = duration > 0 ? ((trimEnd ?? duration) / duration) * 100 : 100

  const fmt = (s) => (s || 0).toFixed(1)

  return (
    <div className="fixed inset-0 z-[230] bg-black flex flex-col select-none"
         style={{ width: "100vw", height: "100dvh" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-3 z-20">
        <button
          onClick={onCancel}
          className="h-10 px-4 rounded-xl bg-white/10 text-white font-semibold text-[14px]"
        >
          Cancel
        </button>
        <button
          onClick={() => onDone({ trimStart, trimEnd: trimEnd ?? duration })}
          className="h-10 px-4 rounded-xl text-white font-bold text-[14px]"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
        >
          Done
        </button>
      </header>

      {/* Video preview */}
      <div className="flex-1 grid place-items-center overflow-hidden bg-black px-4">
        <video
          ref={videoRef}
          src={src}
          muted={false}
          playsInline
          className="max-w-full max-h-full object-contain"
          style={{ maxHeight: "55dvh" }}
        />
      </div>

      {/* Controls row: play + undo/redo + time */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-center gap-5 mb-2">
          <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="text-white">
            {playing ? <Pause size={26} fill="#fff" /> : <Play size={26} fill="#fff" />}
          </button>
          <button onClick={undo} disabled={history.length === 0} className="text-white disabled:opacity-30" aria-label="Undo">
            <Undo2 size={24} />
          </button>
          <button onClick={redo} disabled={future.length === 0} className="text-white disabled:opacity-30" aria-label="Redo">
            <Redo2 size={24} />
          </button>
        </div>
        <div className="text-center text-white/80 text-[13px] font-semibold mb-3">
          {fmt(current)} / {fmt(duration)}s
        </div>
      </div>

      {/* Yellow timeline with filmstrip + handles */}
      <div className="px-4 pb-2">
        <div
          ref={trackRef}
          className="relative w-full rounded-xl overflow-hidden"
          style={{ height: 52, background: "#FFC107", border: "3px solid #FFC107" }}
        >
          {/* Filmstrip */}
          <div className="absolute inset-0 flex">
            {frames.length > 0 ? (
              frames.map((f, i) => (
                <div key={i} className="flex-1 h-full overflow-hidden" style={{ opacity: 0.9 }}>
                  {f && <img src={f} alt="" className="w-full h-full object-cover" />}
                </div>
              ))
            ) : (
              <div className="w-full h-full grid place-items-center text-black/40 text-[11px] font-bold">
                Loading preview…
              </div>
            )}
          </div>

          {/* Dim the trimmed-out regions */}
          <div className="absolute inset-y-0 left-0 bg-black/65 pointer-events-none" style={{ width: startPct + "%" }} />
          <div className="absolute inset-y-0 right-0 bg-black/65 pointer-events-none" style={{ width: (100 - endPct) + "%" }} />

          {/* Playhead line */}
          <div
            className="absolute inset-y-0 z-30 pointer-events-none"
            style={{ left: playheadPct + "%", width: 2, background: "#fff", boxShadow: "0 0 6px rgba(255,255,255,0.8)" }}
          />

          {/* Start handle */}
          <button
            onMouseDown={(e) => onHandleDown("start", e)}
            onTouchStart={(e) => onHandleDown("start", e)}
            className="absolute inset-y-0 z-40 grid place-items-center cursor-ew-resize"
            style={{ left: startPct + "%", transform: "translateX(-50%)", width: 22, touchAction: "none" }}
            aria-label="Trim start"
          >
            <span className="w-1.5 h-8 rounded-full bg-[#0B0B14]" />
          </button>

          {/* End handle */}
          <button
            onMouseDown={(e) => onHandleDown("end", e)}
            onTouchStart={(e) => onHandleDown("end", e)}
            className="absolute inset-y-0 z-40 grid place-items-center cursor-ew-resize"
            style={{ left: endPct + "%", transform: "translateX(-50%)", width: 22, touchAction: "none" }}
            aria-label="Trim end"
          >
            <span className="w-1.5 h-8 rounded-full bg-[#0B0B14]" />
          </button>
        </div>

        {/* Playhead scrub bar (thin) — tap/drag to move playhead */}
        <div
          className="relative w-full h-6 mt-1 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const pct = (e.clientX - rect.left) / rect.width
            const t = pct * duration
            if (videoRef.current) videoRef.current.currentTime = t
            setCurrent(t)
          }}
        />
      </div>

      {/* Audio / Text quick buttons */}
      <div className="px-4 flex flex-col gap-2 mt-1">
        <button className="w-full h-10 rounded-xl border border-white/25 border-dashed text-white/85 font-medium text-[13.5px] inline-flex items-center justify-center gap-2">
          <Plus size={16} /> Audio
        </button>
        <button className="w-full h-10 rounded-xl border border-white/25 border-dashed text-white/85 font-medium text-[13.5px] inline-flex items-center justify-center gap-2">
          <Plus size={16} /> Text
        </button>
      </div>

      {/* Bottom tool row */}
      <div className="flex items-center justify-around px-2 py-3 mb-2" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        {[
          { icon: <Plus size={22} />, label: "Add" },
          { icon: <ImagePlus size={22} />, label: "Replace" },
          { icon: <Crop size={22} />, label: "Crop" },
          { icon: <FlipHorizontal size={22} />, label: "Mirror" },
          { icon: <Scissors size={22} />, label: "Split" },
        ].map((b) => (
          <button key={b.label} className="flex flex-col items-center gap-1 text-white">
            {b.icon}
            <span className="text-[11px] font-medium">{b.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
