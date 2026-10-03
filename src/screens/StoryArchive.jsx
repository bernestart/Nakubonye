import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import AppHeader from "../components/AppHeader"
import HighlightPicker from "../components/HighlightPicker"

function groupByDate(items) {
  const map = new Map()
  items.forEach((s) => {
    const d = new Date(s.created_at)
    const key = d.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" })
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(s)
  })
  return [...map.entries()]
}

export default function StoryArchive() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [stories, setStories] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function load() {
    if (!myId) return
    setLoading(true)
    const { data } = await supabase
      .from("stories")
      .select("id, media_url, media_type, caption, created_at, expires_at")
      .eq("user_id", myId)
      .order("created_at", { ascending: false })
      .limit(300)
    setStories(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [myId])

  async function deleteStory(id) {
    tap("light")
    try {
      try {
        const url = stories.find((s) => s.id === id)?.media_url || ""
        const marker = "/object/public/chat-media/"
        const idx = url.indexOf(marker)
        if (idx !== -1) {
          await supabase.storage.from("chat-media").remove([url.slice(idx + marker.length)])
        }
      } catch (e) { console.warn("storage delete failed", e) }
      const { error } = await supabase.from("stories").delete().eq("id", id).eq("user_id", myId)
      if (error) throw error
      setStories((cur) => cur.filter((s) => s.id !== id))
    } catch (e) {
      alert("Failed: " + (e.message || e))
    } finally {
      setConfirmDelete(null)
    }
  }

  const grouped = groupByDate(stories)

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, display: "flex", flexDirection: "column", background: "#0B0B14", overflow: "hidden" }}>
      <BrandGlow />
      <AppHeader />

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          <button
            onClick={() => { tap("light"); nav(-1) }}
            className="w-9 h-9 rounded-full grid place-items-center bg-white/[0.06] border border-white/10"
            aria-label="Back"
          >
            <ArrowLeft size={18} className="text-cream" />
          </button>
          <h1 className="text-cream font-extrabold text-[16px] flex-1">Story archive</h1>
          <button
            onClick={() => { tap("light"); setPickerOpen(true) }}
            className="h-9 px-3 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[12.5px] inline-flex items-center gap-1.5"
          >
            <Plus size={14} /> Highlight
          </button>
        </div>

        {loading ? (
          <div className="p-3 grid grid-cols-3 gap-1">
            {[0,1,2,3,4,5].map((i) => <div key={i} className="aspect-[9/16] rounded-lg bg-white/[0.03] shimmer" />)}
          </div>
        ) : stories.length === 0 ? (
          <div className="py-20 text-center px-6">
            <p className="text-cream font-bold text-[15px] mb-1">No archived stories</p>
            <p className="text-muted text-[13px]">Your past stories will appear here after they expire.</p>
          </div>
        ) : (
          grouped.map(([day, list]) => (
            <div key={day} className="mb-4">
              <p className="px-4 py-2 text-cream font-bold text-[13px]">{day}</p>
              <div className="grid grid-cols-3 gap-1 px-1">
                {list.map((s) => (
                  <div key={s.id} className="relative aspect-[9/16] rounded-lg overflow-hidden bg-black">
                    {s.media_type === "video" ? (
                      <video src={s.media_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                    ) : (
                      <img src={s.media_url} alt="" className="w-full h-full object-cover" />
                    )}
                    <button
                      onClick={() => { tap("light"); setConfirmDelete(s) }}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full grid place-items-center bg-black/60 backdrop-blur-md"
                      aria-label="Delete story"
                    >
                      <Trash2 size={13} color="#F87171" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {pickerOpen && (
        <HighlightPicker
          onClose={() => setPickerOpen(false)}
          onCreated={() => {}}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setConfirmDelete(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
            <p className="text-cream font-bold text-[15px] mb-1">Delete story?</p>
            <p className="text-muted text-[13px] mb-4">This can't be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 h-11 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[13.5px]"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteStory(confirmDelete.id)}
                className="flex-1 h-11 rounded-full bg-red-500/20 border border-red-500/40 text-red-200 font-bold text-[13.5px]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
