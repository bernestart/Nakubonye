import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { X, Heart } from "lucide-react"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import VerifiedBadge from "./VerifiedBadge"

export default function PostLikesModal({ postId, source, count, onClose }) {
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [likers, setLikers] = useState([])

  useEffect(() => {
    if (!postId) return
    ;(async () => {
      setLoading(true)
      const table = source === "personal" ? "user_post_likes" : "community_post_reactions"
      const { data: rows } = await supabase
        .from(table)
        .select("user_id")
        .eq("post_id", postId)
        .order("created_at", { ascending: false })
        .limit(200)

      const ids = [...new Set((rows || []).map((r) => r.user_id))].filter(Boolean)
      if (ids.length === 0) { setLikers([]); setLoading(false); return }

      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, username, is_verified")
        .in("id", ids)
      const pMap = new Map((profs || []).map((p) => [p.id, p]))

      const { data: ph } = await supabase
        .from("profile_photos")
        .select("user_id, storage_path, is_primary, display_order")
        .in("user_id", ids)
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
      const phMap = new Map()
      ;(ph || []).forEach((p) => { if (!phMap.has(p.user_id)) phMap.set(p.user_id, p.storage_path) })

      setLikers((rows || []).map((r) => ({
        id: r.user_id,
        display_name: pMap.get(r.user_id)?.display_name,
        username: pMap.get(r.user_id)?.username,
        is_verified: pMap.get(r.user_id)?.is_verified,
        photo_url: phMap.get(r.user_id) ? publicPhotoUrl(phMap.get(r.user_id)) : null,
      })))
      setLoading(false)
    })()
  }, [postId, source])

  return (
    <div className="fixed inset-0 z-[500] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 flex flex-col"
        style={{ maxHeight: "75dvh", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="p-4 shrink-0 border-b border-white/8">
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full grid place-items-center bg-pink-500/15 border border-pink-500/30">
                <Heart size={14} fill="#EC4899" color="#EC4899" />
              </span>
              <p className="text-cream font-extrabold text-[16px]">
                {count} {count === 1 ? "like" : "likes"}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center text-muted" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex flex-col gap-2">
              {[0,1,2,3].map((i) => (
                <div key={i} className="h-14 rounded-2xl bg-white/[0.03] shimmer" />
              ))}
            </div>
          ) : likers.length === 0 ? (
            <p className="text-muted text-[13px] text-center py-8">No likes yet</p>
          ) : (
            <div className="flex flex-col gap-1">
              {likers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { tap("light"); onClose?.(); nav("/profile/" + u.id) }}
                  className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/[0.04] active:opacity-80 text-left"
                >
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0">
                    {u.photo_url ? (
                      <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (u.display_name || u.username || "?")[0].toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-semibold text-[14px] truncate flex items-center gap-1.5">
                      {u.display_name || u.username || "Someone"}
                      {u.is_verified && <VerifiedBadge size={12} />}
                    </p>
                    {u.username && <p className="text-muted text-[11.5px] truncate">@{u.username}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
