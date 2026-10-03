import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { photoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import AppHeader from "../components/AppHeader"

export default function PendingTags() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [busyId, setBusyId] = useState(null)

  async function load() {
    if (!myId) return
    setLoading(true)
    const { data } = await supabase
      .from("photo_tags")
      .select("id, created_at, tagger_id, photos(id, user_id, storage_path, bucket, created_at)")
      .eq("tagged_user_id", myId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    const taggerIds = [...new Set((data || []).map((t) => t.tagger_id))]
    let profMap = new Map()
    if (taggerIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", taggerIds)
      ;(profs || []).forEach((p) => profMap.set(p.id, p))
    }

    setItems(
      (data || []).map((t) => ({
        ...t,
        tagger: profMap.get(t.tagger_id) || null,
      }))
    )
    setLoading(false)
  }

  useEffect(() => { load() }, [myId])

  async function decide(id, next) {
    if (busyId) return
    setBusyId(id)
    const { error } = await supabase
      .from("photo_tags")
      .update({ status: next })
      .eq("id", id)
    if (!error) setItems((cur) => cur.filter((t) => t.id !== id))
    setBusyId(null)
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, margin: "0 auto", maxWidth: 480, display: "flex", flexDirection: "column", background: "#0B0B14", overflow: "hidden" }}>
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
          <h1 className="text-cream font-extrabold text-[16px]">Tag review</h1>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/8 p-3 h-20 shimmer" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center px-6">
            <p className="text-cream font-bold text-[15px] mb-1">No pending tags</p>
            <p className="text-muted text-[13px]">When someone tags you and tag review is on, requests show up here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-4">
            {items.map((t) => {
              const photo = t.photos
              const url = photo ? photoUrl(photo.bucket, photo.storage_path) : ""
              return (
                <div key={t.id} className="rounded-2xl bg-white/[0.03] border border-white/8 p-3 flex gap-3">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-black shrink-0">
                    {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <p className="text-cream text-[13.5px] leading-snug">
                      <span className="font-bold">{t.tagger?.display_name || t.tagger?.username || "Someone"}</span>
                      {" "}tagged you in a photo
                    </p>
                    <div className="flex gap-2">
                      <button
                        disabled={busyId === t.id}
                        onClick={() => { tap("light"); decide(t.id, "approved") }}
                        className="flex-1 h-9 rounded-full text-white font-bold text-[12.5px] disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
                      >
                        Approve
                      </button>
                      <button
                        disabled={busyId === t.id}
                        onClick={() => { tap("light"); decide(t.id, "rejected") }}
                        className="flex-1 h-9 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[12.5px] disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
