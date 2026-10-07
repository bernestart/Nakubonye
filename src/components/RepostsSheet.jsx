import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { X, Repeat2 } from "lucide-react"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import VerifiedBadge from "./VerifiedBadge"

export default function RepostsSheet({ postId, postType, onClose }) {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [loading, setLoading] = useState(true)
  const [people, setPeople] = useState([])

  useEffect(() => {
    if (!postId || !postType) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      // Resharers are user_posts rows that reference this post
      const [repostRes, muteRes] = await Promise.all([
        supabase
          .from("user_posts")
          .select("id, user_id, created_at")
          .eq("reshared_from_type", postType)
          .eq("reshared_from_id", postId)
          .order("created_at", { ascending: false })
          .limit(200),
        myId
          ? supabase.from("user_mutes").select("muted_id").eq("muter_id", myId)
          : Promise.resolve({ data: [] }),
      ])

      const muteSet = new Set((muteRes.data || []).map((m) => m.muted_id))
      const rows = (repostRes.data || []).filter((r) => !muteSet.has(r.user_id))

      const ids = [...new Set((rows || []).map((r) => r.user_id))]
      let profMap = new Map(), photoMap = new Map()
      if (ids.length > 0) {
        const [profs, phs] = await Promise.all([
          supabase.from("profiles").select("id, display_name, username, is_verified").in("id", ids),
          supabase.from("profile_photos").select("user_id, storage_path, is_primary, display_order").in("user_id", ids).order("is_primary", { ascending: false }).order("display_order", { ascending: true }),
        ])
        ;(profs.data || []).forEach((p) => profMap.set(p.id, p))
        ;(phs.data || []).forEach((x) => { if (!photoMap.has(x.user_id)) photoMap.set(x.user_id, x.storage_path) })
      }
      if (cancelled) return
      setPeople(ids.map((uid) => ({
        id: uid,
        _profile: profMap.get(uid),
        _photo: photoMap.get(uid) ? publicPhotoUrl(photoMap.get(uid)) : null,
      })))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [postId, postType])

  return (
    <div className="fixed inset-0 z-[400] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] flex flex-col"
        style={{ maxHeight: "75dvh", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="shrink-0 pt-3 pb-2 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Repeat2 size={16} className="text-cream" />
            <span className="text-cream font-bold text-[15px]">
              {people.length} {people.length === 1 ? "share" : "shares"}
            </span>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 flex flex-col gap-2">
              {[0,1,2].map((i) => <div key={i} className="h-14 border-b border-white/6 bg-white/[0.02] shimmer" />)}
            </div>
          ) : people.length === 0 ? (
            <p className="text-muted text-[13px] text-center py-10">Nobody has reshared this yet.</p>
          ) : (
            people.map((u) => (
              <button
                key={u.id}
                onClick={() => { tap("light"); onClose?.(); nav("/profile/" + u.id) }}
                className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03]"
              >
                <span className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0">
                  {u._photo ? (
                    <img src={u._photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (u._profile?.display_name || u._profile?.username || "?")[0].toUpperCase()
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-cream font-semibold text-[14px] truncate flex items-center gap-1">
                    {u._profile?.display_name || u._profile?.username || "Someone"}
                    {u._profile?.is_verified && <VerifiedBadge size={12} />}
                  </p>
                  {u._profile?.username && (
                    <p className="text-muted text-[12px] truncate">@{u._profile.username}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
