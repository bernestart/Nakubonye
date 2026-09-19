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
  const [mirrored, setMirrored] = useState(false)
  const [aspectRatio, setAspectRatio] = useState("9:16")
  const [cropSheetOpen, setCropSheetOpen] = useState(false)
  const [textOverlays, setTextOverlays] = useState([])
  const [textSheetOpen, setTextSheetOpen] = useState(false)
  const [editingTextId, setEditingTextId] = useState(null)
  const [textDraft, setTextDraft] = useState({ text: "", color: "#ffffff", size: 24 })

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
      } else if (dragging.startsWith("text-")) {
        const id = dragging.slice(5)
        const videoRect = videoRef.current?.getBoundingClientRect()
        if (!videoRect) return
        const t = e.touches?.[0] || e
        const nx = Math.max(0, Math.min(1, (t.clientX - videoRect.left) / videoRect.width))
        const ny = Math.max(0, Math.min(1, (t.clientY - videoRect.top) / videoRect.height))
        setTextOverlays((arr) => arr.map((x) => (x.id === id ? { ...x, x: nx, y: ny } : x)))
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
          onClick={() => onDone({ trimStart, trimEnd: trimEnd ?? duration, mirrored, aspectRatio, textOverlays })}
          className="h-10 px-4 rounded-xl text-white font-bold text-[14px]"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
        >
          Done
        </button>
      </header>

      {/* Video preview */}
      <div className="flex-1 grid place-items-center overflow-hidden bg-black px-4">
        <div style={{ position: "relative", display: "inline-block", maxHeight: "55dvh" }}>
          <video
            ref={videoRef}
            src={src}
            muted={false}
            playsInline
            className="max-h-full object-contain"
            style={{
              maxHeight: "55dvh",
              transform: mirrored ? "scaleX(-1)" : "none",
              aspectRatio: aspectRatio.replace(":", "/"),
              width: "auto",
              maxWidth: "100%",
              display: "block",
            }}
          />
          {textOverlays.map((t) => (
            <button
              key={t.id}
              onMouseDown={(e) => { e.preventDefault(); setDragging("text-" + t.id) }}
              onTouchStart={(e) => { e.preventDefault(); setDragging("text-" + t.id) }}
              onClick={() => { setEditingTextId(t.id); setTextDraft({ text: t.text, color: t.color, size: t.size }); setTextSheetOpen(true) }}
              style={{
                position: "absolute",
                left: t.x * 100 + "%",
                top: t.y * 100 + "%",
                transform: "translate(-50%, -50%)",
                color: t.color,
                fontWeight: 900,
                fontSize: t.size,
                textShadow: "0 2px 12px rgba(0,0,0,0.85)",
                WebkitTextStroke: "0.5px rgba(0,0,0,0.5)",
                whiteSpace: "nowrap",
                zIndex: 5,
                padding: 4,
                border: editingTextId === t.id ? "1px dashed rgba(255,255,255,0.7)" : "none",
                touchAction: "none",
              }}
            >
              {t.text || "Tap to type"}
            </button>
          ))}
        </div>
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
        <button
          onClick={() => {
            setEditingTextId(null)
            setTextDraft({ text: "", color: "#ffffff", size: 24 })
            setTextSheetOpen(true)
          }}
          className="w-full h-10 rounded-xl border border-white/25 border-dashed text-white/85 font-medium text-[13.5px] inline-flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Text
        </button>
      </div>

      {/* Bottom tool row */}
      <div className="flex items-center justify-around px-2 py-3 mb-2" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        {[
          { icon: <Plus size={22} />, label: "Add", onClick: null },
          { icon: <ImagePlus size={22} />, label: "Replace", onClick: null },
          { icon: <Crop size={22} />, label: "Crop", onClick: () => setCropSheetOpen(true), active: aspectRatio !== "9:16" },
          { icon: <FlipHorizontal size={22} />, label: "Mirror", onClick: () => setMirrored((m) => !m), active: mirrored },
          { icon: <Scissors size={22} />, label: "Split", onClick: null },
        ].map((b) => (
          <button
            key={b.label}
            onClick={b.onClick || undefined}
            disabled={!b.onClick}
            className="flex flex-col items-center gap-1 text-white disabled:opacity-40"
            style={{ color: b.active ? "#EC4899" : "#fff" }}
          >
            {b.icon}
            <span className="text-[11px] font-medium">{b.label}</span>
          </button>
        ))}
      </div>

      {/* Text overlay sheet */}
      {textSheetOpen && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setTextSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-3"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto" />
            <h3 className="text-cream font-extrabold text-[16px]">
              {editingTextId ? "Edit text" : "Add text"}
            </h3>
            <input
              value={textDraft.text}
              onChange={(e) => setTextDraft((d) => ({ ...d, text: e.target.value.slice(0, 100) }))}
              placeholder="Type something…"
              autoFocus
              className="h-12 rounded-full bg-white/[0.06] border border-white/10 px-5 text-cream text-[15px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
            />
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {["#ffffff", "#000000", "#EC4899", "#A855F7", "#F59E0B", "#22C55E", "#3B82F6", "#EF4444"].map((c) => (
                <button
                  key={c}
                  onClick={() => setTextDraft((d) => ({ ...d, color: c }))}
                  className="shrink-0 w-8 h-8 rounded-full border-2"
                  style={{ background: c, borderColor: textDraft.color === c ? "#fff" : "rgba(255,255,255,0.15)" }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {[16, 24, 36, 52].map((sz) => (
                <button
                  key={sz}
                  onClick={() => setTextDraft((d) => ({ ...d, size: sz }))}
                  className="flex-1 h-9 rounded-full text-white text-[12px] font-bold border"
                  style={{
                    borderColor: textDraft.size === sz ? "#fff" : "rgba(255,255,255,0.15)",
                    background: textDraft.size === sz ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)",
                  }}
                >
                  {sz}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              {editingTextId && (
                <button
                  onClick={() => {
                    setTextOverlays((arr) => arr.filter((x) => x.id !== editingTextId))
                    setTextSheetOpen(false)
                    setEditingTextId(null)
                  }}
                  className="flex-1 h-11 rounded-full bg-red-500/15 border border-red-500/40 text-red-300 font-bold text-[13.5px]"
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => {
                  const clean = textDraft.text.trim()
                  if (!clean) return
                  if (editingTextId) {
                    setTextOverlays((arr) => arr.map((x) => x.id === editingTextId ? { ...x, ...textDraft, text: clean } : x))
                  } else {
                    const id = crypto.randomUUID()
                    setTextOverlays((arr) => [...arr, { id, ...textDraft, text: clean, x: 0.5, y: 0.5 }])
                  }
                  setTextSheetOpen(false)
                  setEditingTextId(null)
                }}
                className="flex-1 h-11 rounded-full text-white font-bold text-[13.5px]"
                style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
              >
                {editingTextId ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crop ratio sheet */}
      {cropSheetOpen && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setCropSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <h3 className="text-cream font-extrabold text-[16px] mb-4">Crop aspect ratio</h3>
            <div className="grid grid-cols-4 gap-3">
              {[
                { id: "9:16", label: "9:16", w: 9, h: 16 },
                { id: "1:1",  label: "1:1",  w: 1, h: 1 },
                { id: "4:5",  label: "4:5",  w: 4, h: 5 },
                { id: "16:9", label: "16:9", w: 16, h: 9 },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setAspectRatio(r.id); setCropSheetOpen(false) }}
                  className="flex flex-col items-center gap-2"
                >
                  <span
                    className="grid place-items-center rounded-xl border-2"
                    style={{
                      width: 56,
                      height: 56,
                      borderColor: aspectRatio === r.id ? "#EC4899" : "rgba(255,255,255,0.2)",
                      background: aspectRatio === r.id ? "rgba(236,72,153,0.15)" : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <span
                      style={{
                        width: r.w >= r.h ? 26 : 26 * (r.w / r.h),
                        height: r.h >= r.w ? 26 : 26 * (r.h / r.w),
                        border: "1.5px solid #fff",
                        borderRadius: 3,
                        opacity: 0.85,
                      }}
                    />
                  </span>
                  <span
                    className="text-[12px] font-semibold"
                    style={{ color: aspectRatio === r.id ? "#EC4899" : "#888" }}
                  >
                    {r.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
