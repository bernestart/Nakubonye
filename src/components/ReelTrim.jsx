import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "../lib/supabase"
import { Pause, Play, Undo2, Redo2, Plus, ImagePlus, Crop, FlipHorizontal, Scissors, Type, X, Check, Music, Sparkles, Smile, Download, ChevronRight, Gauge, Mic, Image as ImageIcon } from "lucide-react"

const FILMSTRIP_PER_CLIP = 6

const STICKER_LIB = ["❤️","😂","😍","🥰","🔥","✨","💯","👏","🙌","😎","🤩","😘","💜","💕","🌸","🌈","☀️","⭐","🎉","🎈","🍀","🌹","🦋","🍕","☕","🎶","⚡","💫","🌙","👑"]

const FILTERS = [
  { id: "none",    name: "Original", css: "none" },
  { id: "warm",    name: "Warm",     css: "sepia(0.35) saturate(1.3) brightness(1.05)" },
  { id: "cool",    name: "Cool",     css: "hue-rotate(180deg) saturate(1.1) brightness(1.05)" },
  { id: "mono",    name: "Mono",     css: "grayscale(1) contrast(1.1)" },
  { id: "vivid",   name: "Vivid",    css: "saturate(1.8) contrast(1.1)" },
  { id: "fade",    name: "Fade",     css: "saturate(0.7) brightness(1.15) contrast(0.9)" },
  { id: "vintage", name: "Vintage",  css: "sepia(0.55) saturate(1.1) contrast(1.05)" },
  { id: "noir",    name: "Noir",     css: "grayscale(1) contrast(1.3) brightness(0.95)" },
]

const SPEEDS = [0.3, 0.5, 1, 1.5, 2, 3]

async function loadTracksFromDb() {
  const { data, error } = await supabase
    .from("tracks")
    .select("id, title, artist, audio_url, cover_url, duration_sec")
    .limit(50)
  if (error) { console.warn("tracks load error:", error.message); return [] }
  return data || []
}

export default function ReelTrim({ src, initialFile, onCancel, onDone }) {
  const videoRef = useRef(null)
  const trackRef = useRef(null)
  const fileRef = useRef(null)
  const [clips, setClips] = useState([])
  const [activeClipIdx, setActiveClipIdx] = useState(0)
  const [durations, setDurations] = useState({}) // clipId -> duration
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [frames, setFrames] = useState({}) // clipId -> [dataURLs]
  const [history, setHistory] = useState([])
  const [future, setFuture] = useState([])
  const [dragging, setDragging] = useState(null)
  const [mirrored, setMirrored] = useState(false)
  const [aspectRatio, setAspectRatio] = useState("9:16")
  const [cropSheetOpen, setCropSheetOpen] = useState(false)
  const [textOverlays, setTextOverlays] = useState([])
  const [textSheetOpen, setTextSheetOpen] = useState(false)
  const [editingTextId, setEditingTextId] = useState(null)
  const [textDraft, setTextDraft] = useState({ text: "", color: "#ffffff", size: 24 })
  const [splitFlash, setSplitFlash] = useState(false)
  // --- merged from ReelDecorate ---
  const [stickerOverlays, setStickerOverlays] = useState([])
  const [activeStickerId, setActiveStickerId] = useState(null)
  const [stickerSheetOpen, setStickerSheetOpen] = useState(false)
  const [filterId, setFilterId] = useState("none")
  const [filterCarouselOpen, setFilterCarouselOpen] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [speedSheetOpen, setSpeedSheetOpen] = useState(false)
  const [audioTrack, setAudioTrack] = useState(null)
  const [audioSheetOpen, setAudioSheetOpen] = useState(false)
  const [audioList, setAudioList] = useState([])
  const [audioLoading, setAudioLoading] = useState(false)
  const [coverTime, setCoverTime] = useState(0)
  const [coverBlob, setCoverBlob] = useState(null)
  const audioRef = useRef(null)
  const [audioMuted, setAudioMuted] = useState(false)
  const [voiceoverBlob, setVoiceoverBlob] = useState(null)
  const [voiceoverUrl, setVoiceoverUrl] = useState(null)
  const [voiceoverRecording, setVoiceoverRecording] = useState(false)
  const [voiceoverPlaying, setVoiceoverPlaying] = useState(false)
  const voiceoverRecorderRef = useRef(null)
  const voiceoverStreamRef = useRef(null)
  const voiceoverChunksRef = useRef([])
  const voiceoverRef = useRef(null)

  const activeClip = clips[activeClipIdx]
  const activeDuration = activeClip ? (durations[activeClip.id] || 0) : 0
  const activeTrimStart = activeClip?.trimStart ?? 0
  const activeTrimEnd = activeClip?.trimEnd ?? activeDuration

  // ===== INITIALISE first clip from src =====
  useEffect(() => {
    if (!src) return
    const id = "clip-" + crypto.randomUUID().slice(0, 8)
    setClips([{
      id,
      url: src,
      file: initialFile || null,
      trimStart: 0,
      trimEnd: null,
    }])
    setActiveClipIdx(0)
  }, [src])

  // ===== LOAD DURATION for active clip =====
  useEffect(() => {
    const v = videoRef.current
    if (!v || !activeClip) return
    const onLoaded = () => {
      const d = v.duration || 0
      setDurations((prev) => ({ ...prev, [activeClip.id]: d }))
      if (activeClip.trimEnd == null) {
        setClips((arr) => arr.map((c) => c.id === activeClip.id ? { ...c, trimEnd: d } : c))
      }
      // Extract filmstrip for this clip
      if (!frames[activeClip.id]) {
        extractFilmstrip(activeClip)
      }
    }
    v.addEventListener("loadedmetadata", onLoaded)
    return () => v.removeEventListener("loadedmetadata", onLoaded)
  }, [activeClip?.id])

  // Audio sync: picked track follows video play/pause/seek
  useEffect(() => {
    const v = videoRef.current
    const a = audioRef.current
    if (!v || !a || !audioTrack?.audio_url) return

    const onPlay = () => {
      a.currentTime = v.currentTime
      a.play().catch(() => {})
    }
    const onPause = () => a.pause()
    const onSeek = () => { a.currentTime = v.currentTime }
    const onTime = () => {
      if (Math.abs(a.currentTime - v.currentTime) > 0.4) a.currentTime = v.currentTime
    }
    v.addEventListener("play", onPlay)
    v.addEventListener("pause", onPause)
    v.addEventListener("seeked", onSeek)
    v.addEventListener("timeupdate", onTime)
    return () => {
      v.removeEventListener("play", onPlay)
      v.removeEventListener("pause", onPause)
      v.removeEventListener("seeked", onSeek)
      v.removeEventListener("timeupdate", onTime)
      a.pause()
    }
  }, [audioTrack?.id, audioTrack?.audio_url])

  // Voiceover playback sync
  useEffect(() => {
    const v = videoRef.current
    const vo = voiceoverRef.current
    if (!v || !vo || !voiceoverUrl) return

    const onPlay = () => { vo.currentTime = Math.max(0, v.currentTime - (voiceoverStartRef.current || 0)); vo.play().catch(() => {}) }
    const onPause = () => vo.pause()
    const onTime = () => {
      const target = Math.max(0, v.currentTime - (voiceoverStartRef.current || 0))
      if (Math.abs(vo.currentTime - target) > 0.4) vo.currentTime = target
    }
    v.addEventListener("play", onPlay)
    v.addEventListener("pause", onPause)
    v.addEventListener("timeupdate", onTime)
    return () => {
      v.removeEventListener("play", onPlay)
      v.removeEventListener("pause", onPause)
      v.removeEventListener("timeupdate", onTime)
      vo.pause()
    }
  }, [voiceoverUrl])

  // Voiceover record helpers
  async function startVoiceover() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      voiceoverStreamRef.current = stream
      voiceoverChunksRef.current = []
      const rec = new MediaRecorder(stream)
      voiceoverRecorderRef.current = rec
      rec.ondataavailable = (e) => { if (e.data.size > 0) voiceoverChunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(voiceoverChunksRef.current, { type: "audio/webm" })
        if (voiceoverUrl) { try { URL.revokeObjectURL(voiceoverUrl) } catch {} }
        setVoiceoverBlob(blob)
        setVoiceoverUrl(URL.createObjectURL(blob))
        voiceoverStreamRef.current?.getTracks().forEach((t) => t.stop())
        voiceoverStartRef.current = 0
      }
      voiceoverStartRef.current = videoRef.current?.currentTime || 0
      rec.start()
      setVoiceoverRecording(true)
      const v = videoRef.current
      if (v) { v.muted = true; v.play().catch(() => {}) }
    } catch (e) {
      alert("Microphone permission denied")
    }
  }

  function stopVoiceover() {
    try { voiceoverRecorderRef.current?.stop() } catch {}
    setVoiceoverRecording(false)
    const v = videoRef.current
    if (v) { v.pause(); v.muted = false }
  }

  function clearVoiceover() {
    if (voiceoverUrl) { try { URL.revokeObjectURL(voiceoverUrl) } catch {} }
    setVoiceoverBlob(null)
    setVoiceoverUrl(null)
    voiceoverStartRef.current = 0
  }

  async function extractFilmstrip(clip) {
    const v = videoRef.current
    if (!v) return
    const capture = document.createElement("video")
    capture.src = clip.url
    capture.muted = true
    capture.crossOrigin = "anonymous"
    await new Promise((res) => { capture.onloadedmetadata = res; setTimeout(res, 2000) })
    const total = capture.duration || 0
    const results = []
    for (let i = 0; i < FILMSTRIP_PER_CLIP; i++) {
      const t = (total / (FILMSTRIP_PER_CLIP - 1)) * i
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
    setFrames((prev) => ({ ...prev, [clip.id]: results }))
  }

  // ===== PLAYBACK: follow clip's time =====
  useEffect(() => {
    const v = videoRef.current
    if (!v || !activeClip) return
    const onTime = () => {
      setCurrent(v.currentTime)
      if (v.currentTime >= activeTrimEnd) {
        // Advance to next clip or loop
        if (activeClipIdx < clips.length - 1) {
          const nextIdx = activeClipIdx + 1
          setActiveClipIdx(nextIdx)
          const nextClip = clips[nextIdx]
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.src = nextClip.url
              videoRef.current.currentTime = nextClip.trimStart || 0
              videoRef.current.play().catch(() => {})
            }
          }, 30)
        } else {
          // Loop to first
          setActiveClipIdx(0)
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.src = clips[0].url
              videoRef.current.currentTime = clips[0].trimStart || 0
              videoRef.current.play().catch(() => {})
            }
          }, 30)
        }
      }
    }
    v.addEventListener("timeupdate", onTime)
    return () => v.removeEventListener("timeupdate", onTime)
  }, [activeClip, activeTrimEnd, activeClipIdx, clips])

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      if (v.currentTime < activeTrimStart || v.currentTime >= activeTrimEnd) v.currentTime = activeTrimStart
      v.play().catch(() => {})
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  // ===== UNDO / REDO =====
  function snapshot() {
    setHistory((h) => [...h.slice(-30), {
      clips: clips.map((c) => ({ ...c })),
      textOverlays: textOverlays.map((t) => ({ ...t })),
    }])
    setFuture([])
  }
  function undo() {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setFuture((f) => [...f, { clips: clips.map((c) => ({ ...c })), textOverlays: textOverlays.map((t) => ({ ...t })) }])
    setHistory((h) => h.slice(0, -1))
    setClips(prev.clips)
    setTextOverlays(prev.textOverlays)
  }
  function redo() {
    if (future.length === 0) return
    const next = future[future.length - 1]
    setHistory((h) => [...h, { clips: clips.map((c) => ({ ...c })), textOverlays: textOverlays.map((t) => ({ ...t })) }])
    setFuture((f) => f.slice(0, -1))
    setClips(next.clips)
    setTextOverlays(next.textOverlays)
  }

  // ===== HANDLE DRAG on timeline =====
  function onHandleDown(which, e) {
    e.preventDefault(); e.stopPropagation()
    if (!activeClip) return
    setDragging(which)
    snapshot()
  }

  useEffect(() => {
    if (!dragging) return
    const move = (e) => {
      const track = trackRef.current
      if (!track || !activeClip) return
      const rect = track.getBoundingClientRect()
      const t = e.touches?.[0] || e
      const pct = Math.max(0, Math.min(1, (t.clientX - rect.left) / rect.width))
      const time = pct * activeDuration
      if (dragging === "start") {
        const maxStart = activeTrimEnd - 0.5
        setClips((arr) => arr.map((c) => c.id === activeClip.id ? { ...c, trimStart: Math.min(time, maxStart) } : c))
      } else if (dragging === "end") {
        const minEnd = activeTrimStart + 0.5
        setClips((arr) => arr.map((c) => c.id === activeClip.id ? { ...c, trimEnd: Math.max(time, minEnd) } : c))
      } else if (dragging === "playhead") {
        if (videoRef.current) videoRef.current.currentTime = time
        setCurrent(time)
      } else if (dragging.startsWith("text-")) {
        const id = dragging.slice(5)
        const videoRect = videoRef.current?.getBoundingClientRect()
        if (!videoRect) return
        const nx = Math.max(0, Math.min(1, (t.clientX - videoRect.left) / videoRect.width))
        const ny = Math.max(0, Math.min(1, (t.clientY - videoRect.top) / videoRect.height))
        setTextOverlays((arr) => arr.map((x) => (x.id === id ? { ...x, x: nx, y: ny } : x)))
      } else if (dragging.startsWith("sticker-")) {
        const id = dragging.slice(8)
        const videoRect = videoRef.current?.getBoundingClientRect()
        if (!videoRect) return
        const nx = Math.max(0, Math.min(1, (t.clientX - videoRect.left) / videoRect.width))
        const ny = Math.max(0, Math.min(1, (t.clientY - videoRect.top) / videoRect.height))
        setStickerOverlays((arr) => arr.map((x) => (x.id === id ? { ...x, x: nx, y: ny } : x)))
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
  }, [dragging, activeClip, activeDuration, activeTrimStart, activeTrimEnd])

  // ===== TOOLS =====

  // Split current clip at playhead
  function splitClip() {
    if (!activeClip) return
    const splitAt = videoRef.current?.currentTime || 0
    if (splitAt <= activeTrimStart + 0.3 || splitAt >= activeTrimEnd - 0.3) return
    snapshot()
    const newId = "clip-" + crypto.randomUUID().slice(0, 8)
    const before = { ...activeClip, trimEnd: splitAt }
    const after = { ...activeClip, id: newId, trimStart: splitAt, trimEnd: activeTrimEnd, file: activeClip.file }
    setClips((arr) => {
      const idx = arr.findIndex((c) => c.id === activeClip.id)
      const next = [...arr]
      next.splice(idx, 1, before, after)
      return next
    })
    setDurations((prev) => ({ ...prev, [newId]: activeDuration }))
    // Move frames too
    setFrames((prev) => ({ ...prev, [newId]: prev[activeClip.id] || [] }))
    setSplitFlash(true)
    setTimeout(() => setSplitFlash(false), 500)
  }

  // Replace active clip's file
  function onReplaceFile(e) {
    const f = e.target.files?.[0]
    if (!f || !f.type.startsWith("video/")) return
    snapshot()
    const url = URL.createObjectURL(f)
    setClips((arr) => arr.map((c) => c.id === activeClip.id ? { ...c, url, file: f, trimStart: 0, trimEnd: null } : c))
    setDurations((prev) => ({ ...prev, [activeClip.id]: 0 }))
    setFrames((prev) => ({ ...prev, [activeClip.id]: null }))
    if (videoRef.current) videoRef.current.src = url
    e.target.value = ""
  }

  // Add a new clip at the end
  function onAddFile(e) {
    const f = e.target.files?.[0]
    if (!f || !f.type.startsWith("video/")) return
    snapshot()
    const id = "clip-" + crypto.randomUUID().slice(0, 8)
    const url = URL.createObjectURL(f)
    setClips((arr) => [...arr, { id, url, file: f, trimStart: 0, trimEnd: null }])
    e.target.value = ""
  }

  // Delete active clip
  function deleteClip() {
    if (clips.length <= 1) return
    snapshot()
    setClips((arr) => arr.filter((c) => c.id !== activeClip.id))
    setActiveClipIdx((i) => Math.max(0, Math.min(i, clips.length - 2)))
  }

  // ===== RENDER HELPERS =====
  const startPct = activeDuration > 0 ? (activeTrimStart / activeDuration) * 100 : 0
  const endPct = activeDuration > 0 ? (activeTrimEnd / activeDuration) * 100 : 100
  const playheadPct = activeDuration > 0 ? (current / activeDuration) * 100 : 0
  const fmt = (s) => (s || 0).toFixed(1)

  function handleDone() {
    onDone({
      clips: clips.map((c) => ({
        id: c.id,
        url: c.url,
        file: c.file || null,
        trimStart: c.trimStart || 0,
        trimEnd: c.trimEnd || durations[c.id] || 0,
      })),
      mirrored,
      aspectRatio,
      textOverlays,
      stickerOverlays,
      filterId,
      speed,
      audioTrack,
      coverTime,
      coverBlob,
    })
  }

  return (
    <div className="fixed inset-0 z-[230] bg-black flex flex-col select-none"
         style={{ width: "100vw", height: "100dvh", touchAction: "none" }}>
      <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => {
        if (splitFlash || dragging) return
        // Route to replace or add based on which tool was tapped
        const mode = fileRef.current?.dataset.mode
        if (mode === "replace") onReplaceFile(e)
        else onAddFile(e)
      }} />

      {/* Header */}
      <header className="flex items-center justify-between px-3 py-3 z-20">
        <button onClick={onCancel} className="h-10 px-4 rounded-xl bg-white/10 text-white font-semibold text-[14px]">Cancel</button>
        <button onClick={handleDone} className="h-10 px-4 rounded-xl text-white font-bold text-[14px]"
                style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}>Done</button>
      </header>

      {/* Clip selector strip (if multiple) */}
      {clips.length > 1 && (
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {clips.map((c, i) => (
            <button
              key={c.id}
              onClick={() => {
                setActiveClipIdx(i)
                if (videoRef.current) {
                  videoRef.current.src = c.url
                  videoRef.current.currentTime = c.trimStart || 0
                }
              }}
              className="shrink-0 relative"
              style={{
                width: 56, height: 56, borderRadius: 12,
                border: i === activeClipIdx ? "2px solid #EC4899" : "2px solid transparent",
                overflow: "hidden",
                background: "#222",
              }}
            >
              {frames[c.id]?.[0] ? (
                <img src={frames[c.id][0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white/40 text-[10px]">…</span>
              )}
              <span className="absolute top-0.5 left-0.5 text-[9px] font-bold text-white bg-black/60 rounded px-1">
                {i + 1}
              </span>
            </button>
          ))}
          <button
            onClick={() => { fileRef.current.dataset.mode = "add"; fileRef.current.click() }}
            className="shrink-0 grid place-items-center"
            style={{ width: 56, height: 56, borderRadius: 12, border: "1px dashed rgba(255,255,255,0.4)" }}
            aria-label="Add clip"
          >
            <Plus size={20} color="#fff" />
          </button>
        </div>
      )}

      {/* Hidden audio elements */}
      <audio ref={audioRef} src={audioTrack?.audio_url || ""} preload="auto" muted={audioMuted} style={{ display: "none" }} />
      <audio ref={voiceoverRef} src={voiceoverUrl || ""} preload="auto" style={{ display: "none" }} />

      {/* Video preview */}
      <div className="flex-1 grid place-items-center overflow-hidden bg-black px-4">
        <div style={{ position: "relative", display: "inline-block", maxHeight: "55dvh" }}>
          {activeClip && (
            <video
              ref={videoRef}
              src={activeClip.url}
              playsInline
              className="max-h-full object-contain"
              style={{
                maxHeight: "55dvh",
                transform: mirrored ? "scaleX(-1)" : "none",
                aspectRatio: aspectRatio.replace(":", "/"),
                width: "auto",
                maxWidth: "100%",
                display: "block",
                filter: (FILTERS.find((f) => f.id === filterId)?.css) || "none",
              }}
              onLoadedMetadata={(e) => { try { e.target.playbackRate = speed } catch {} }}
            />
          )}
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
          {stickerOverlays.map((st) => (
            <button
              key={st.id}
              onMouseDown={(e) => { e.preventDefault(); setDragging("sticker-" + st.id) }}
              onTouchStart={(e) => { e.preventDefault(); setDragging("sticker-" + st.id) }}
              onClick={(e) => { e.stopPropagation(); setActiveStickerId(st.id); setStickerSheetOpen(true) }}
              style={{
                position: "absolute",
                left: st.x * 100 + "%",
                top: st.y * 100 + "%",
                transform: "translate(-50%, -50%)",
                fontSize: st.size,
                zIndex: 6,
                padding: 4,
                border: activeStickerId === st.id ? "1px dashed rgba(255,255,255,0.7)" : "none",
                touchAction: "none",
                background: "transparent",
              }}
            >
              {st.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Play + undo/redo */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-center gap-5 mb-2">
          <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="text-white">
            {playing ? <Pause size={26} fill="#fff" /> : <Play size={26} fill="#fff" />}
          </button>
          <button onClick={undo} disabled={history.length === 0} className="text-white disabled:opacity-30" aria-label="Undo"><Undo2 size={24} /></button>
          <button onClick={redo} disabled={future.length === 0} className="text-white disabled:opacity-30" aria-label="Redo"><Redo2 size={24} /></button>
        </div>
        <div className="text-center text-white/80 text-[13px] font-semibold mb-3">
          {fmt(current)} / {fmt(activeDuration)}s
          {clips.length > 1 && <span className="ml-2 text-white/40">· clip {activeClipIdx + 1}/{clips.length}</span>}
        </div>
      </div>

      {/* Yellow timeline */}
      <div className="px-4 pb-2">
        <div ref={trackRef} className="relative w-full rounded-xl"
             style={{ height: 52, background: "#FFC107", border: "3px solid #FFC107" }}>
          <div className="absolute inset-0 flex">
            {frames[activeClip?.id]?.length ? (
              frames[activeClip.id].map((f, i) => (
                <div key={i} className="flex-1 h-full overflow-hidden" style={{ opacity: 0.9 }}>
                  {f && <img src={f} alt="" className="w-full h-full object-cover" />}
                </div>
              ))
            ) : (
              <div className="w-full h-full grid place-items-center text-black/40 text-[11px] font-bold">Loading preview…</div>
            )}
          </div>

          <div className="absolute inset-y-0 left-0 bg-black/65 pointer-events-none" style={{ width: startPct + "%" }} />
          <div className="absolute inset-y-0 right-0 bg-black/65 pointer-events-none" style={{ width: (100 - endPct) + "%" }} />

          <div className="absolute inset-y-0 z-30 pointer-events-none"
               style={{ left: playheadPct + "%", width: 2, background: "#fff", boxShadow: "0 0 6px rgba(255,255,255,0.8)" }} />

          <button
            onMouseDown={(e) => onHandleDown("start", e)}
            onTouchStart={(e) => onHandleDown("start", e)}
            className="absolute inset-y-0 z-40 grid place-items-center cursor-ew-resize"
            style={{ left: startPct + "%", transform: "translateX(-50%)", width: 32, touchAction: "none", zIndex: 50 }}
            aria-label="Trim start"
          >
            <span className="w-1.5 h-8 rounded-full bg-[#0B0B14]" />
          </button>
          <button
            onMouseDown={(e) => onHandleDown("end", e)}
            onTouchStart={(e) => onHandleDown("end", e)}
            className="absolute inset-y-0 z-40 grid place-items-center cursor-ew-resize"
            style={{ left: endPct + "%", transform: "translateX(-50%)", width: 32, touchAction: "none", zIndex: 50 }}
            aria-label="Trim end"
          >
            <span className="w-1.5 h-8 rounded-full bg-[#0B0B14]" />
          </button>
        </div>

        <div className="relative w-full h-6 mt-1 cursor-pointer"
             onClick={(e) => {
               const rect = e.currentTarget.getBoundingClientRect()
               const pct = (e.clientX - rect.left) / rect.width
               const t = pct * activeDuration
               if (videoRef.current) videoRef.current.currentTime = t
               setCurrent(t)
             }} />
      </div>

      {/* Right-side floating rail — merged from ReelDecorate */}
      <div className="absolute right-3 top-20 z-30 flex flex-col items-end gap-3">
        {[
          { label: "Text",     icon: <Type size={17} />,     onClick: () => { setEditingTextId(null); setTextDraft({ text: "", color: "#ffffff", size: 24 }); setTextSheetOpen(true) } },
          { label: "Effects",  icon: <Sparkles size={17} />, onClick: () => setFilterCarouselOpen(true) },
          { label: "Stickers", icon: <Smile size={17} />,    onClick: () => setStickerSheetOpen(true) },
          { label: "Audio",    icon: <Music size={17} />,    onClick: () => setAudioSheetOpen(true), active: !!audioTrack },
          { label: "Speed",    icon: <Gauge size={17} />,    onClick: () => setSpeedSheetOpen(true), active: speed !== 1 },
        ].map((b) => (
          <button key={b.label} onClick={b.onClick} className="flex items-center gap-2">
            <span className="text-white text-[11px] font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
                  style={{ color: b.active ? "#EC4899" : "#fff" }}>
              {b.label}
            </span>
            <span className="w-9 h-9 rounded-full grid place-items-center text-white"
                  style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: b.active ? "1.5px solid #EC4899" : "1px solid rgba(255,255,255,0.18)" }}>
              {b.icon}
            </span>
          </button>
        ))}
        <button
          onClick={() => { if (voiceoverRecording) stopVoiceover(); else startVoiceover() }}
          className="flex items-center gap-2">
          <span className="text-white text-[11px] font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
                style={{ color: voiceoverRecording ? "#EF4444" : voiceoverUrl ? "#EC4899" : "#fff" }}>
            {voiceoverRecording ? "Stop" : voiceoverUrl ? "Voice ✓" : "Voice"}
          </span>
          <span className="w-9 h-9 rounded-full grid place-items-center text-white"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: voiceoverRecording ? "1.5px solid #EF4444" : voiceoverUrl ? "1.5px solid #EC4899" : "1px solid rgba(255,255,255,0.18)" }}>
            <Mic size={17} />
          </span>
        </button>
        <button
          onClick={() => {
            const v = videoRef.current
            if (!v) return
            setCoverTime(v.currentTime || 0)
            try {
              const c = document.createElement("canvas")
              c.width = v.videoWidth || 720
              c.height = v.videoHeight || 1280
              c.getContext("2d").drawImage(v, 0, 0, c.width, c.height)
              c.toBlob((blob) => {
                if (blob) setCoverBlob(blob)
              }, "image/jpeg", 0.85)
            } catch {}
          }}
          className="flex items-center gap-2">
          <span className="text-white text-[11px] font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">Cover</span>
          <span className="w-9 h-9 rounded-full grid place-items-center text-white"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.18)" }}>
            <ImageIcon size={17} />
          </span>
        </button>
      </div>

      {/* Audio / Text */}
      <div className="px-4 flex flex-col gap-2 mt-1">
        <button className="w-full h-10 rounded-xl border border-white/25 border-dashed text-white/85 font-medium text-[13.5px] inline-flex items-center justify-center gap-2">
          <Plus size={16} /> Audio
        </button>
        <button
          onClick={() => { setEditingTextId(null); setTextDraft({ text: "", color: "#ffffff", size: 24 }); setTextSheetOpen(true) }}
          className="w-full h-10 rounded-xl border border-white/25 border-dashed text-white/85 font-medium text-[13.5px] inline-flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Text
        </button>
      </div>

      {/* Bottom tools */}
      <div className="flex items-center justify-around px-2 py-3 mb-2" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <button
          onClick={() => { fileRef.current.dataset.mode = "add"; fileRef.current.click() }}
          className="flex flex-col items-center gap-1 text-white"
        >
          <Plus size={22} />
          <span className="text-[11px] font-medium">Add</span>
        </button>
        <button
          onClick={() => { fileRef.current.dataset.mode = "replace"; fileRef.current.click() }}
          className="flex flex-col items-center gap-1 text-white"
        >
          <ImagePlus size={22} />
          <span className="text-[11px] font-medium">Replace</span>
        </button>
        <button
          onClick={() => setCropSheetOpen(true)}
          className="flex flex-col items-center gap-1 text-white"
          style={{ color: aspectRatio !== "9:16" ? "#EC4899" : "#fff" }}
        >
          <Crop size={22} />
          <span className="text-[11px] font-medium">Crop</span>
        </button>
        <button
          onClick={() => setMirrored((m) => !m)}
          className="flex flex-col items-center gap-1"
          style={{ color: mirrored ? "#EC4899" : "#fff" }}
        >
          <FlipHorizontal size={22} />
          <span className="text-[11px] font-medium">Mirror</span>
        </button>
        <button
          onClick={splitClip}
          disabled={clips.length === 0}
          className="flex flex-col items-center gap-1 text-white disabled:opacity-40"
        >
          <Scissors size={22} />
          <span className="text-[11px] font-medium">Split</span>
        </button>
      </div>

      {/* Delete clip (only when >1) */}
      {clips.length > 1 && (
        <div className="absolute top-4 right-3 z-20">
          <button
            onClick={deleteClip}
            className="w-9 h-9 rounded-full grid place-items-center bg-red-500/20 border border-red-500/40"
            aria-label="Delete clip"
          >
            <X size={16} color="#fca5a5" />
          </button>
        </div>
      )}

      {/* Text sheet */}
      {textSheetOpen && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setTextSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-3"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto" />
            <h3 className="text-cream font-extrabold text-[16px]">{editingTextId ? "Edit text" : "Add text"}</h3>
            <input
              value={textDraft.text}
              onChange={(e) => setTextDraft((d) => ({ ...d, text: e.target.value.slice(0, 100) }))}
              placeholder="Type something…"
              autoFocus
              className="h-12 rounded-full bg-white/[0.06] border border-white/10 px-5 text-cream text-[15px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
            />
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {["#ffffff", "#000000", "#EC4899", "#A855F7", "#F59E0B", "#22C55E", "#3B82F6", "#EF4444"].map((c) => (
                <button key={c} onClick={() => setTextDraft((d) => ({ ...d, color: c }))}
                        className="shrink-0 w-8 h-8 rounded-full border-2"
                        style={{ background: c, borderColor: textDraft.color === c ? "#fff" : "rgba(255,255,255,0.15)" }} />
              ))}
            </div>
            <div className="flex gap-2">
              {[16, 24, 36, 52].map((sz) => (
                <button key={sz} onClick={() => setTextDraft((d) => ({ ...d, size: sz }))}
                        className="flex-1 h-9 rounded-full text-white text-[12px] font-bold border"
                        style={{
                          borderColor: textDraft.size === sz ? "#fff" : "rgba(255,255,255,0.15)",
                          background: textDraft.size === sz ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)",
                        }}>
                  {sz}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              {editingTextId && (
                <button onClick={() => { setTextOverlays((arr) => arr.filter((x) => x.id !== editingTextId)); setTextSheetOpen(false); setEditingTextId(null) }}
                        className="flex-1 h-11 rounded-full bg-red-500/15 border border-red-500/40 text-red-300 font-bold text-[13.5px]">
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
                  setTextSheetOpen(false); setEditingTextId(null)
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

      {/* Crop sheet */}
      {cropSheetOpen && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setCropSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div onClick={(e) => e.stopPropagation()}
               className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5"
               style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <h3 className="text-cream font-extrabold text-[16px] mb-4">Crop aspect ratio</h3>
            <div className="grid grid-cols-4 gap-3">
              {[{ id: "9:16", w: 9, h: 16 }, { id: "1:1", w: 1, h: 1 }, { id: "4:5", w: 4, h: 5 }, { id: "16:9", w: 16, h: 9 }].map((r) => (
                <button key={r.id} onClick={() => { setAspectRatio(r.id); setCropSheetOpen(false) }} className="flex flex-col items-center gap-2">
                  <span className="grid place-items-center rounded-xl border-2"
                        style={{ width: 56, height: 56, borderColor: aspectRatio === r.id ? "#EC4899" : "rgba(255,255,255,0.2)", background: aspectRatio === r.id ? "rgba(236,72,153,0.15)" : "rgba(255,255,255,0.03)" }}>
                    <span style={{ width: r.w >= r.h ? 26 : 26 * (r.w / r.h), height: r.h >= r.w ? 26 : 26 * (r.h / r.w), border: "1.5px solid #fff", borderRadius: 3, opacity: 0.85 }} />
                  </span>
                  <span className="text-[12px] font-semibold" style={{ color: aspectRatio === r.id ? "#EC4899" : "#888" }}>{r.id}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Speed sheet */}
      {speedSheetOpen && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setSpeedSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div onClick={(e) => e.stopPropagation()}
               className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5"
               style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <h3 className="text-cream font-extrabold text-[16px] mb-4">Playback speed</h3>
            <div className="grid grid-cols-3 gap-2">
              {SPEEDS.map((sp) => (
                <button key={sp} onClick={() => { setSpeed(sp); if (videoRef.current) videoRef.current.playbackRate = sp; setSpeedSheetOpen(false) }}
                        className="h-12 rounded-xl font-bold text-[13.5px]"
                        style={{
                          background: speed === sp ? "linear-gradient(135deg, rgba(236,72,153,0.22) 0%, rgba(168,85,247,0.22) 100%)" : "rgba(255,255,255,0.04)",
                          border: speed === sp ? "1px solid rgba(236,72,153,0.6)" : "1px solid rgba(255,255,255,0.08)",
                          color: speed === sp ? "#fff" : "#888",
                        }}>
                  {sp}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sticker picker */}
      {stickerSheetOpen && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setStickerSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div onClick={(e) => e.stopPropagation()}
               className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-3"
               style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto" />
            <h3 className="text-cream font-extrabold text-[16px]">Add sticker</h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {STICKER_LIB.map((e) => (
                <button key={e} onClick={() => {
                  const id = crypto.randomUUID()
                  setStickerOverlays((arr) => [...arr, { id, emoji: e, x: 0.5, y: 0.5, size: 56 }])
                  setActiveStickerId(id)
                }} className="w-11 h-11 rounded-full grid place-items-center text-2xl" style={{ background: "rgba(255,255,255,0.06)" }}>
                  {e}
                </button>
              ))}
            </div>
            {activeStickerId && (
              <div className="flex items-center gap-2 mt-2">
                {[32, 48, 64, 88].map((sz) => (
                  <button key={sz} onClick={() => setStickerOverlays((arr) => arr.map((x) => x.id === activeStickerId ? { ...x, size: sz } : x))}
                          className="flex-1 h-9 rounded-full text-white text-[12px] font-bold border border-white/15 bg-white/[0.06]">
                    {sz}
                  </button>
                ))}
                <button onClick={() => { setStickerOverlays((arr) => arr.filter((x) => x.id !== activeStickerId)); setActiveStickerId(null) }}
                        className="h-9 px-4 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[12px] font-bold">
                  Delete
                </button>
              </div>
            )}
            <button onClick={() => setStickerSheetOpen(false)}
                    className="w-full h-11 rounded-full text-white font-bold text-[13.5px] mt-2"
                    style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Filter carousel */}
      {filterCarouselOpen && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setFilterCarouselOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div onClick={(e) => e.stopPropagation()}
               className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5"
               style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <h3 className="text-cream font-extrabold text-[16px] mb-4">Effects</h3>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {FILTERS.map((f) => (
                <button key={f.id} onClick={() => { setFilterId(f.id); setFilterCarouselOpen(false) }} className="shrink-0 flex flex-col items-center gap-1.5">
                  <span className="w-16 h-16 rounded-2xl border-2 overflow-hidden grid place-items-center"
                        style={{ borderColor: filterId === f.id ? "#fff" : "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>
                    <span style={{ filter: f.css, width: "100%", height: "100%", display: "grid", placeItems: "center", background: "linear-gradient(135deg, #C084FC, #EC4899)", color: "#fff", fontWeight: 900 }}>Aa</span>
                  </span>
                  <span className="text-white text-[11px] font-semibold">{f.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Audio picker */}
      {audioSheetOpen && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setAudioSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div onClick={(e) => e.stopPropagation()}
               className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 flex flex-col"
               style={{ maxHeight: "80dvh", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
            <div className="pt-3 pb-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto" />
            </div>
            <div className="px-5 pb-3 flex items-center justify-between shrink-0">
              <h3 className="text-cream font-extrabold text-[16px]">Add audio</h3>
              {audioTrack && (
                <button onClick={() => { setAudioTrack(null); setAudioSheetOpen(false) }}
                        className="text-[12.5px] text-red-300 font-semibold">Remove</button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-4">
              {audioLoading && <p className="text-muted text-[13px] text-center py-6">Loading…</p>}
              {!audioLoading && audioList.length === 0 && (
                <p className="text-muted text-[13px] text-center py-6">No tracks yet. Add some to the tracks table.</p>
              )}
              {!audioLoading && audioList.length > 0 && (
                <p className="text-green-400 text-[11px] text-center pb-2">{audioList.length} tracks loaded</p>
              )}
              {audioList.map((tr) => (
                <button key={tr.id}
                        onClick={() => { setAudioTrack(tr); setAudioSheetOpen(false) }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/8 mb-2 text-left">
                  <span className="w-11 h-11 rounded-lg shrink-0 grid place-items-center overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    {tr.cover_url ? <img src={tr.cover_url} alt="" className="w-full h-full object-cover" /> : <Music size={18} className="text-purple-400" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-bold text-[13.5px] truncate">{tr.title}</p>
                    <p className="text-muted text-[11.5px] truncate">{tr.artist}</p>
                  </div>
                  {audioTrack?.id === tr.id && <Check size={18} className="text-purple-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Split flash */}
      {splitFlash && (
        <div className="absolute inset-0 z-[250] grid place-items-center pointer-events-none">
          <div className="bg-black/70 rounded-2xl px-6 py-3 text-white font-bold text-[14px] inline-flex items-center gap-2">
            <Check size={16} /> Split
          </div>
        </div>
      )}
    </div>
  )
}
