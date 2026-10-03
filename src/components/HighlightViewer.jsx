import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { supabase } from "../lib/supabase"

export default function HighlightViewer({ highlight, onClose }) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (!highlight?.id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data: rows } = await supabase
        .from("story_highlight_items")
        .select("story_id, display_order")
        .eq("highlight_id", highlight.id)
        .order("display_order", { ascending: true })
      const ids = (rows || []).map((r) => r.story_id)
      if (ids.length === 0) { setItems([]); setLoading(false); return }
      const { data: stories } = await supabase
        .from("stories")
        .select("id, media_url, media_type, caption, created_at")
        .in("id", ids)
      if (cancelled) return
      // Preserve display_order
      const map = new Map((stories || []).map((s) => [s.id, s]))
      const ordered = ids.map((id) => map.get(id)).filter(Boolean)
      setItems(ordered)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [highlight?.id])

  if (!highlight) return null

  const current = items[idx]

  return createPortal(
    <div className="fixed inset-0 z-[300] bg-black select-none" onClick={onClose}>
      <div className="absolute top-6 left-3 right-3 flex items-center gap-2 z-20" onClick={(e) => e.stopPropagation()}>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-[14px] truncate">{highlight.title}</p>
          <p className="text-white/60 text-[11px]">{items.length} {items.length === 1 ? "story" : "stories"}</p>
        </div>
        <button onClick={onClose} className="w-9 h-9 grid place-items-center text-white" aria-label="Close">
          <X size={22} />
        </button>
      </div>

      {/* Progress bars */}
      {items.length > 0 && (
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-20">
          {items.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-200" style={{ width: i < idx ? "100%" : i === idx ? "100%" : "0%" }} />
            </div>
          ))}
        </div>
      )}

      <div className="absolute inset-0 grid place-items-center" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        ) : !current ? (
          <p className="text-white/70 text-[14px]">No stories in this highlight</p>
        ) : current.media_type === "video" ? (
          <video
            src={current.media_url}
            autoPlay
            playsInline
            controls
            onEnded={() => setIdx((i) => Math.min(i + 1, items.length - 1))}
            className="w-full h-full object-contain"
          />
        ) : (
          <img src={current.media_url} alt="" className="w-full h-full object-contain" />
        )}
      </div>

      {/* Left/right tap zones */}
      {items.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.max(0, i - 1)) }}
            className="absolute left-0 top-16 bottom-16 w-1/3"
            aria-label="Previous"
          />
          <button
            onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.min(items.length - 1, i + 1)) }}
            className="absolute right-0 top-16 bottom-16 w-1/3"
            aria-label="Next"
          />
        </>
      )}

      {current?.caption && (
        <div className="absolute bottom-8 left-4 right-4 z-20 pointer-events-none" onClick={(e) => e.stopPropagation()}>
          <p className="text-white text-[14px] bg-black/50 backdrop-blur-md rounded-2xl px-4 py-3">{current.caption}</p>
        </div>
      )}
    </div>,
    document.body
  )
}
