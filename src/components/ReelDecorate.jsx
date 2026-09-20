import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Music, Type, Sparkles, Smile, Download } from "lucide-react"

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

export default function ReelDecorate({ clips, onBack, onNext, initialOverlays }) {
  const videoRef = useRef(null)
  const [clipIdx, setClipIdx] = useState(0)
  const [textOverlays, setTextOverlays] = useState(initialOverlays || [])
  const [activeTextId, setActiveTextId] = useState(null)
  const [textSheetOpen, setTextSheetOpen] = useState(false)
  const [textDraft, setTextDraft] = useState({ text: "", color: "#ffffff", size: 28 })
  const [dragging, setDragging] = useState(null)
  const [toast, setToast] = useState("")
  const [stickerOverlays, setStickerOverlays] = useState([])
  const [activeStickerId, setActiveStickerId] = useState(null)
  const [stickerSheetOpen, setStickerSheetOpen] = useState(false)
  const [filterId, setFilterId] = useState("none")
  const [filterCarouselOpen, setFilterCarouselOpen] = useState(false)

  const list = Array.isArray(clips) && clips.length > 0 ? clips : []
  const activeClip = list[clipIdx]

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(""), 1500)
  }

  // Load + play current clip
  useEffect(() => {
    const v = videoRef.current
    if (!v || !activeClip) return
    v.src = activeClip.url
    v.currentTime = activeClip.trimStart || 0
    v.play().catch(() => {})
  }, [activeClip?.id])

  // Loop through clips on end
  useEffect(() => {
    const v = videoRef.current
    if (!v || !activeClip) return
    const onTime = () => {
      const end = activeClip.trimEnd
      if (end && v.currentTime >= end) {
        const next = clipIdx + 1 < list.length ? clipIdx + 1 : 0
        setClipIdx(next)
      }
    }
    v.addEventListener("timeupdate", onTime)
    return () => v.removeEventListener("timeupdate", onTime)
  }, [activeClip, clipIdx, list])

  // Drag text overlays
  useEffect(() => {
    if (!dragging) return
    const move = (e) => {
      const rect = videoRef.current?.getBoundingClientRect()
      if (!rect) return
      const t = e.touches?.[0] || e
      const nx = Math.max(0, Math.min(1, (t.clientX - rect.left) / rect.width))
      const ny = Math.max(0, Math.min(1, (t.clientY - rect.top) / rect.height))
      if (dragging.startsWith("sticker-")) {
        const id = dragging.slice(8)
        setStickerOverlays((arr) => arr.map((x) => x.id === id ? { ...x, x: nx, y: ny } : x))
      } else {
        setTextOverlays((arr) => arr.map((x) => x.id === dragging ? { ...x, x: nx, y: ny } : x))
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
  }, [dragging])

  function saveAsDraft() {
    try {
      localStorage.setItem("reel_draft_v1", JSON.stringify({
        savedAt: Date.now(),
        clips: list.map((c) => ({ url: c.url, trimStart: c.trimStart, trimEnd: c.trimEnd })),
        textOverlays,
      }))
      showToast("Draft saved")
    } catch {
      showToast("Could not save draft")
    }
  }

  if (!activeClip) return null

  return (
    <div className="fixed inset-0 z-[230] bg-black flex flex-col select-none"
         style={{ width: "100vw", height: "100dvh" }}>

      {/* Back button top-left */}
      <button
        onClick={onBack}
        className="absolute top-4 left-4 z-30 w-10 h-10 rounded-full grid place-items-center bg-black/40 backdrop-blur-md text-white"
        aria-label="Back to edit"
      >
        <ChevronLeft size={22} />
      </button>

      {/* Right floating rail */}
      <div className="absolute right-4 top-20 z-30 flex flex-col items-end gap-4">
        {[
          { label: "Audio",    icon: <Music size={18} />,      onClick: () => showToast("Audio coming soon") },
          { label: "Text",     icon: <Type size={18} />,       onClick: () => { setActiveTextId(null); setTextDraft({ text: "", color: "#ffffff", size: 28 }); setTextSheetOpen(true) } },
          { label: "Effects",  icon: <Sparkles size={18} />,   onClick: () => setFilterCarouselOpen(true) },
          { label: "Stickers", icon: <Smile size={18} />,      onClick: () => setStickerSheetOpen(true) },
          { label: "Save",     icon: <Download size={18} />,   onClick: saveAsDraft },
        ].map((b) => (
          <button key={b.label} onClick={b.onClick} className="flex items-center gap-2.5">
            <span className="text-white text-[12px] font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
              {b.label}
            </span>
            <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md border border-white/15 grid place-items-center text-white">
              {b.icon}
            </span>
          </button>
        ))}
      </div>

      {/* Video preview */}
      <div className="flex-1 grid place-items-center overflow-hidden bg-black">
        <div style={{ position: "relative", display: "inline-block", maxHeight: "100dvh" }}>
          <video
            ref={videoRef}
            playsInline
            muted={false}
            className="max-h-full object-contain"
            style={{
              maxHeight: "100dvh",
              width: "auto",
              maxWidth: "100vw",
              display: "block",
              filter: (FILTERS.find((f) => f.id === filterId)?.css) || "none",
            }}
          />
          {stickerOverlays.map((st) => (
            <button
              key={st.id}
              onMouseDown={(e) => { e.preventDefault(); setActiveStickerId(st.id); setDragging("sticker-" + st.id) }}
              onTouchStart={(e) => { e.preventDefault(); setActiveStickerId(st.id); setDragging("sticker-" + st.id) }}
              onClick={(e) => e.stopPropagation()}
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
              }}
            >
              {st.emoji}
            </button>
          ))}
          {textOverlays.map((t) => (
            <button
              key={t.id}
              onMouseDown={(e) => { e.preventDefault(); setDragging(t.id) }}
              onTouchStart={(e) => { e.preventDefault(); setDragging(t.id) }}
              onClick={(e) => {
                e.stopPropagation()
                setActiveTextId(t.id)
                setTextDraft({ text: t.text, color: t.color, size: t.size })
                setTextSheetOpen(true)
              }}
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
                border: activeTextId === t.id ? "1px dashed rgba(255,255,255,0.7)" : "none",
                touchAction: "none",
              }}
            >
              {t.text || "Tap to type"}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between px-4 pb-6 pt-12"
           style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }}>
        <button
          onClick={onBack}
          className="h-11 px-5 rounded-full bg-white text-black font-bold text-[14px]"
        >
          Edit reel
        </button>
        <button
          onClick={() => onNext({ textOverlays, stickerOverlays, filterId })}
          className="h-11 px-5 rounded-full bg-[#0866FF] text-white font-bold text-[14px] inline-flex items-center gap-2"
        >
          Next <ChevronRight size={18} strokeWidth={2.6} />
        </button>
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
              {activeTextId ? "Edit text" : "Add text"}
            </h3>
            <input
              value={textDraft.text}
              onChange={(e) => setTextDraft((d) => ({ ...d, text: e.target.value.slice(0, 100) }))}
              placeholder="Type something…"
              autoFocus
              className="h-12 rounded-full bg-white/[0.06] border border-white/10 px-5 text-cream text-[15px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
            />
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {["#ffffff","#000000","#EC4899","#A855F7","#F59E0B","#22C55E","#3B82F6","#EF4444"].map((c) => (
                <button key={c} onClick={() => setTextDraft((d) => ({ ...d, color: c }))}
                        className="shrink-0 w-8 h-8 rounded-full border-2"
                        style={{ background: c, borderColor: textDraft.color === c ? "#fff" : "rgba(255,255,255,0.15)" }} />
              ))}
            </div>
            <div className="flex gap-2">
              {[18, 28, 40, 56].map((sz) => (
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
              {activeTextId && (
                <button onClick={() => { setTextOverlays((arr) => arr.filter((x) => x.id !== activeTextId)); setTextSheetOpen(false); setActiveTextId(null) }}
                        className="flex-1 h-11 rounded-full bg-red-500/15 border border-red-500/40 text-red-300 font-bold text-[13.5px]">
                  Delete
                </button>
              )}
              <button
                onClick={() => {
                  const clean = textDraft.text.trim()
                  if (!clean) return
                  if (activeTextId) {
                    setTextOverlays((arr) => arr.map((x) => x.id === activeTextId ? { ...x, ...textDraft, text: clean } : x))
                  } else {
                    const id = crypto.randomUUID()
                    setTextOverlays((arr) => [...arr, { id, ...textDraft, text: clean, x: 0.5, y: 0.5 }])
                  }
                  setTextSheetOpen(false); setActiveTextId(null)
                }}
                className="flex-1 h-11 rounded-full text-white font-bold text-[13.5px]"
                style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
              >
                {activeTextId ? "Update" : "Add"}
              </button>
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
                <button
                  key={e}
                  onClick={() => {
                    const id = crypto.randomUUID()
                    setStickerOverlays((arr) => [...arr, { id, emoji: e, x: 0.5, y: 0.5, size: 56 }])
                    setActiveStickerId(id)
                    setStickerSheetOpen(false)
                  }}
                  className="w-11 h-11 rounded-full grid place-items-center text-2xl"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  {e}
                </button>
              ))}
            </div>
            {activeStickerId && (
              <div className="flex items-center gap-2 mt-2">
                {[32, 48, 64, 88].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setStickerOverlays((arr) => arr.map((x) => x.id === activeStickerId ? { ...x, size: sz } : x))}
                    className="flex-1 h-9 rounded-full text-white text-[12px] font-bold border border-white/15 bg-white/[0.06]"
                  >
                    {sz}
                  </button>
                ))}
                <button
                  onClick={() => { setStickerOverlays((arr) => arr.filter((x) => x.id !== activeStickerId)); setActiveStickerId(null) }}
                  className="h-9 px-4 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[12px] font-bold"
                >
                  Delete
                </button>
              </div>
            )}
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
                  <span className="w-16 h-16 rounded-2xl border-2 overflow-hidden grid place-items-center text-white text-[11px] font-bold"
                        style={{ borderColor: filterId === f.id ? "#fff" : "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>
                    <span style={{ filter: f.css, width: "100%", height: "100%", display: "grid", placeItems: "center", background: "linear-gradient(135deg, #C084FC, #EC4899)" }}>
                      Aa
                    </span>
                  </span>
                  <span className="text-white text-[11px] font-semibold">{f.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded-full z-50 pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
