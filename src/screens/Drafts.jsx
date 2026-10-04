import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Trash2, Pencil } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import AppHeader from "../components/AppHeader"
import { listDrafts, deleteDraft } from "../lib/drafts"

const KIND_LABEL = { post: "Post", reel: "Reel", story: "Story" }

function draftPreviewText(kind, payload) {
  if (kind === "post")  return payload?.content?.trim() || "No text"
  if (kind === "reel")  return payload?.caption?.trim() || "Reel without caption"
  if (kind === "story") return payload?.caption?.trim() || payload?.textContent?.trim() || "Story"
  return "Draft"
}

export default function Drafts() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState([])

  async function load() {
    if (!myId) return
    setLoading(true)
    const data = await listDrafts(myId)
    setDrafts(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [myId])

  async function remove(id) {
    if (!confirm("Discard this draft?")) return
    tap("light")
    await deleteDraft(id)
    setDrafts((cur) => cur.filter((d) => d.id !== id))
  }

  function resume(d) {
    tap("light")
    const q = new URLSearchParams({ draft: d.id }).toString()
    if (d.kind === "post")  nav("/create?"  + q)
    if (d.kind === "reel")  nav("/reels?compose=" + d.id)
    if (d.kind === "story") nav("/stories?compose=" + d.id)
  }

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
          <h1 className="text-cream font-extrabold text-[16px]">Drafts</h1>
        </div>

        {loading ? (
          <div className="p-4 flex flex-col gap-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-white/[0.03] shimmer" />)}
          </div>
        ) : drafts.length === 0 ? (
          <div className="py-20 text-center px-6">
            <p className="text-[46px] mb-2">📝</p>
            <p className="text-cream font-bold text-[15px] mb-1">No drafts yet</p>
            <p className="text-muted text-[13px]">Start writing a post, reel, or story and it will save here automatically.</p>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-2">
            {drafts.map((d) => (
              <div key={d.id} className="rounded-2xl bg-white/[0.03] border border-white/8 p-3 flex gap-3">
                {d.preview_url && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-black shrink-0">
                    <img src={d.preview_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-purple-400 text-[10px] font-black tracking-wider uppercase">{KIND_LABEL[d.kind] || "Draft"}</span>
                    <span className="text-muted text-[10.5px]">
                      {new Date(d.updated_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-cream text-[13px] line-clamp-2 leading-snug">{draftPreviewText(d.kind, d.payload)}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => resume(d)}
                      className="h-8 px-3 rounded-full text-white text-[12px] font-bold inline-flex items-center gap-1.5"
                      style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
                    >
                      <Pencil size={12} /> Continue
                    </button>
                    <button
                      onClick={() => remove(d.id)}
                      className="h-8 px-3 rounded-full bg-white/[0.06] border border-white/10 text-red-300 text-[12px] font-bold inline-flex items-center gap-1.5"
                    >
                      <Trash2 size={12} /> Discard
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
