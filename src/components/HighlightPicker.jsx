import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, Check } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"

export default function HighlightPicker({ onClose, onCreated }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [loading, setLoading] = useState(true)
  const [stories, setStories] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!myId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from("stories")
        .select("id, media_url, media_type, caption, created_at, expires_at")
        .eq("user_id", myId)
        .order("created_at", { ascending: false })
        .limit(200)
      if (cancelled) return
      setStories(data || [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [myId])

  function toggle(id) {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function create() {
    if (!myId || busy) return
    const t = title.trim()
    if (!t) { setError("Give your highlight a name"); return }
    if (selected.size === 0) { setError("Pick at least one story"); return }
    setBusy(true); setError("")
    tap("light")
    try {
      const orderedIds = stories.filter((s) => selected.has(s.id)).map((s) => s.id)
      const cover = orderedIds[0]
      const { data: h, error: herr } = await supabase
        .from("story_highlights")
        .insert({ user_id: myId, title: t, cover_story_id: cover })
        .select("id")
        .single()
      if (herr) throw herr

      const rows = orderedIds.map((sid, i) => ({
        highlight_id: h.id,
        story_id: sid,
        display_order: i,
      }))
      const { error: ierr } = await supabase.from("story_highlight_items").insert(rows)
      if (ierr) throw ierr

      onCreated?.()
      onClose?.()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 flex flex-col"
        style={{ maxHeight: "85dvh", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="p-4 shrink-0 border-b border-white/8">
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-cream font-extrabold text-[16px]">New highlight</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center text-muted" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 40))}
            placeholder="Highlight name"
            className="w-full h-11 rounded-full bg-white/[0.06] border border-white/10 px-4 text-cream text-[14px] placeholder:text-muted focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="grid grid-cols-3 gap-1">
              {[0,1,2,3,4,5].map((i) => <div key={i} className="aspect-[9/16] rounded-lg bg-white/[0.03] shimmer" />)}
            </div>
          ) : stories.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-cream font-bold text-[15px] mb-1">No stories yet</p>
              <p className="text-muted text-[13px]">Post a story first, then add it to a highlight.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {stories.map((s) => {
                const isSel = selected.has(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className="relative aspect-[9/16] rounded-lg overflow-hidden bg-black border-2 transition-colors"
                    style={{ borderColor: isSel ? "#C084FC" : "transparent" }}
                  >
                    {s.media_type === "video" ? (
                      <video src={s.media_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                    ) : (
                      <img src={s.media_url} alt="" className="w-full h-full object-cover" />
                    )}
                    {isSel && (
                      <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-purple-500 grid place-items-center">
                        <Check size={14} color="#fff" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="p-4 pt-2 shrink-0 flex flex-col gap-2">
          {error && <p className="text-red-300 text-[12.5px] text-center">{error}</p>}
          <button
            onClick={create}
            disabled={busy || !title.trim() || selected.size === 0}
            className="w-full h-12 rounded-full text-white font-bold text-[14.5px] disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            {busy ? "Creating…" : `Create highlight (${selected.size})`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
