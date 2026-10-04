import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Heart, MessageCircle, Share2 } from "lucide-react"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import VerifiedBadge from "./VerifiedBadge"

// Renders the nested card of an original post inside a reshare.
export default function ResharedPost({ snapshot }) {
  const nav = useNavigate()
  const [author, setAuthor] = useState(null)
  const [authorPhoto, setAuthorPhoto] = useState("")
  const [community, setCommunity] = useState(null)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)

  useEffect(() => {
    if (!snapshot?.author_id) return
    let cancelled = false
    ;(async () => {
      const [profRes, photoRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, username, is_verified").eq("id", snapshot.author_id).maybeSingle(),
        supabase.from("profile_photos").select("storage_path").eq("user_id", snapshot.author_id).order("is_primary", { ascending: false }).limit(1).maybeSingle(),
      ])
      if (cancelled) return
      setAuthor(profRes.data || null)
      setAuthorPhoto(photoRes.data?.storage_path ? publicPhotoUrl(photoRes.data.storage_path) : "")

      if (snapshot.community_id) {
        const { data: c } = await supabase.from("communities").select("id, name, emoji, cover_color").eq("id", snapshot.community_id).maybeSingle()
        if (!cancelled) setCommunity(c || null)
      }
    })()
    return () => { cancelled = true }
  }, [snapshot?.author_id, snapshot?.community_id])

  if (!snapshot) return null
  const name = author?.display_name || author?.username || "Someone"
  const image = snapshot.image_path
    ? supabase.storage.from("community-media").getPublicUrl(snapshot.image_path).data?.publicUrl
    : null

  return (
    <button
      onClick={() => { tap("light"); if (snapshot.type && snapshot.id) nav("/post/" + snapshot.type + "/" + snapshot.id) }}
      className="w-full text-left rounded-xl border border-white/12 bg-black/[0.15] overflow-hidden active:opacity-95"
    >
      {community && (
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          <span className="w-5 h-5 rounded-md grid place-items-center text-[11px]" style={{ background: community.cover_color || "rgba(168,85,247,0.25)" }}>
            {community.emoji || "•"}
          </span>
          <span className="text-purple-300 text-[10.5px] font-bold tracking-wide truncate">{community.name}</span>
        </div>
      )}

      <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1.5">
        <span className="w-8 h-8 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0">
          {authorPhoto ? (
            <img src={authorPhoto} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full grid place-items-center text-purple-400 font-black text-[11px]">
              {(name || "?")[0].toUpperCase()}
            </span>
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-cream font-bold text-[12.5px] truncate flex items-center gap-1">
            {name}
            {author?.is_verified && <VerifiedBadge size={12} />}
          </p>
          {snapshot.original_created_at && (
            <p className="text-subtle text-[10.5px]">
              {new Date(snapshot.original_created_at).toLocaleString([], { month: "short", day: "numeric" })}
            </p>
          )}
        </div>
      </div>

      {snapshot.content && (
        <p className="px-3 pb-2 text-cream text-[13px] leading-snug whitespace-pre-wrap line-clamp-4">
          {snapshot.content}
        </p>
      )}

      {image && (
        <img src={image} alt="" className="w-full max-h-[280px] object-cover" />
      )}
    </button>
  )
}
