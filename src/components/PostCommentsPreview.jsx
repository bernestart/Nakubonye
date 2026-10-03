import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { X, MessageCircle } from "lucide-react"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import VerifiedBadge from "./VerifiedBadge"

function relTime(iso) {
  if (!iso) return ""
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return "now"
  if (diff < 3600) return Math.floor(diff / 60) + "m"
  if (diff < 86400) return Math.floor(diff / 3600) + "h"
  if (diff < 604800) return Math.floor(diff / 86400) + "d"
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" })
}

export default function PostCommentsPreview({ postId, source, count, onClose, onOpenSheet }) {
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const backdropArmedRef = useRef(false)
  useEffect(() => {
    backdropArmedRef.current = false
    const t = setTimeout(() => { backdropArmedRef.current = true }, 350)
    return () => clearTimeout(t)
  }, [])
  const [comments, setComments] = useState([])
  const [profiles, setProfiles] = useState(new Map())
  const [photos, setPhotos] = useState(new Map())

  useEffect(() => {
    if (!postId) return
    ;(async () => {
      setLoading(true)
      setComments([])
      setProfiles(new Map())
      setPhotos(new Map())
      const table = source === "personal" ? "user_post_comments" : "community_post_comments"
      const { data: rows } = await supabase
        .from(table)
        .select("id, user_id, content, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: false })
        .limit(50)
      const list = rows || []
      setComments(list)

      const ids = [...new Set(list.map((c) => c.user_id))]
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, username, is_verified")
          .in("id", ids)
        setProfiles(new Map((profs || []).map((p) => [p.id, p])))

        const { data: ph } = await supabase
          .from("profile_photos")
          .select("user_id, storage_path, is_primary, display_order")
          .in("user_id", ids)
          .order("is_primary", { ascending: false })
          .order("display_order", { ascending: true })
        const pm = new Map()
        ;(ph || []).forEach((p) => { if (!pm.has(p.user_id)) pm.set(p.user_id, p.storage_path) })
        setPhotos(pm)
      }
      setLoading(false)
    })()
  }, [postId, source])

  return (
    <div className="fixed inset-0 z-[500] flex items-end" onClick={() => { if (backdropArmedRef.current) onClose?.() }}>
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
              <span className="w-8 h-8 rounded-full grid place-items-center bg-sky-500/15 border border-sky-500/30">
                <MessageCircle size={14} className="text-sky-400" />
              </span>
              <p className="text-cream font-extrabold text-[16px]">
                {count} {count === 1 ? "comment" : "comments"}
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
              {[0,1,2].map((i) => <div key={i} className="h-16 rounded-2xl bg-white/[0.03] shimmer" />)}
            </div>
          ) : comments.length === 0 ? (
            <p className="text-muted text-[13px] text-center py-8">No comments yet</p>
          ) : (
            <div className="flex flex-col gap-1">
              {comments.map((c) => {
                const p = profiles.get(c.user_id)
                const photoPath = photos.get(c.user_id)
                const name = p?.display_name || p?.username || "Someone"
                return (
                  <div key={c.id} className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/6">
                    <button
                      onClick={() => { tap("light"); onClose?.(); nav("/profile/" + c.user_id) }}
                      className="w-10 h-10 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0"
                    >
                      {photoPath ? (
                        <img src={publicPhotoUrl(photoPath)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        name[0].toUpperCase()
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-cream font-semibold text-[13px] truncate flex items-center gap-1.5">
                        {name}
                        {p?.is_verified && <VerifiedBadge size={12} />}
                      </p>
                      <p className="text-cream/85 text-[13.5px] leading-snug whitespace-pre-wrap break-words mt-0.5">
                        {c.content}
                      </p>
                      <p className="text-subtle text-[11px] mt-1">{relTime(c.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {onOpenSheet && (
          <div className="shrink-0 px-4 pb-2 pt-3 border-t border-white/8">
            <button
              onClick={() => { tap("light"); onClose?.(); onOpenSheet() }}
              className="w-full h-11 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[13.5px] active:opacity-80"
            >
              Add a comment
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
