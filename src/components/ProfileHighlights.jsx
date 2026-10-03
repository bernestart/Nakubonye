import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { supabase } from "../lib/supabase"
import { tap } from "../lib/haptic"
import HighlightViewer from "./HighlightViewer"
import HighlightPicker from "./HighlightPicker"

export default function ProfileHighlights({ userId, isOwn = false, onAddNew }) {
  const [loading, setLoading] = useState(true)
  const [highlights, setHighlights] = useState([])
  const [openHighlight, setOpenHighlight] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data: hl } = await supabase
        .from("story_highlights")
        .select("id, title, cover_story_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
      if (cancelled) return
      const list = hl || []

      // Fetch cover story media for each
      const coverIds = list.map((h) => h.cover_story_id).filter(Boolean)
      let storyMap = new Map()
      if (coverIds.length > 0) {
        const { data: stories } = await supabase
          .from("stories")
          .select("id, media_url, media_type")
          .in("id", coverIds)
        ;(stories || []).forEach((s) => storyMap.set(s.id, s))
      }
      if (cancelled) return
      setHighlights(list.map((h) => ({ ...h, _cover: storyMap.get(h.cover_story_id) })))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [userId, reloadKey])

  if (loading) return null
  if (highlights.length === 0 && !isOwn) return null

  return (
    <>
      <div className="px-4 pt-3 pb-1">
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          {isOwn && (
            <button
              onClick={() => { tap("light"); setPickerOpen(true) }}
              className="shrink-0 flex flex-col items-center gap-1 w-[68px]"
            >
              <span className="w-14 h-14 rounded-full border-2 border-dashed border-white/20 grid place-items-center bg-white/[0.03]">
                <Plus size={20} className="text-muted" />
              </span>
              <span className="text-muted text-[11px] font-semibold truncate w-full text-center">New</span>
            </button>
          )}
          {highlights.map((h) => (
            <button
              key={h.id}
              onClick={() => { tap("light"); setOpenHighlight(h) }}
              className="shrink-0 flex flex-col items-center gap-1 w-[68px]"
            >
              <span className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/20 bg-elevated">
                {h._cover?.media_url ? (
                  h._cover.media_type === "video" ? (
                    <video src={h._cover.media_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                  ) : (
                    <img src={h._cover.media_url} alt="" className="w-full h-full object-cover" />
                  )
                ) : (
                  <span className="w-full h-full grid place-items-center text-white font-black text-[18px] bg-purple-600">
                    {h.title[0]?.toUpperCase() || "H"}
                  </span>
                )}
              </span>
              <span className="text-cream text-[11px] font-semibold truncate w-full text-center">{h.title}</span>
            </button>
          ))}
        </div>
      </div>

      {pickerOpen && (
        <HighlightPicker
          onClose={() => setPickerOpen(false)}
          onCreated={() => setReloadKey((k) => k + 1)}
        />
      )}

      {openHighlight && (
        <HighlightViewer
          highlight={openHighlight}
          onClose={() => setOpenHighlight(null)}
        />
      )}
    </>
  )
}
