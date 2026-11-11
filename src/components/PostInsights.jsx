import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { X, Eye, Heart, MessageCircle } from "lucide-react"

export default function PostInsights({ post, onClose }) {
  const [stats, setStats] = useState({ views: 0, likes: 0, comments: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [likes, comments, views] = await Promise.all([
        supabase.from("user_post_likes").select("id", { count: "exact", head: true }).eq("post_id", post.id),
        supabase.from("user_post_comments").select("id", { count: "exact", head: true }).eq("post_id", post.id).is("deleted_at", null),
        supabase.from("post_views").select("id", { count: "exact", head: true }).eq("post_id", String(post.id))
      ])
      setStats({
        likes: likes.count || 0,
        comments: comments.count || 0,
        views: views.count || 0
      })
      setLoading(false)
    })()
  }, [post.id])

  return (
    <div className="fixed inset-0 z-[450] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5" style={{ paddingBottom: "max(20px, var(--safe-bottom, 8px))" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-cream font-extrabold text-[17px]">Post Insights</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center bg-white/10 text-muted"><X size={16} /></button>
        </div>
        {loading ? <p className="text-center text-muted text-[13px]">Loading…</p> : (
          <div className="flex justify-between px-4">
            <div className="text-center">
              <Eye size={22} className="mx-auto mb-1 text-purple-400" />
              <p className="font-bold text-[18px]">{stats.views}</p>
              <p className="text-subtle text-[11px]">Views</p>
            </div>
            <div className="text-center">
              <Heart size={22} className="mx-auto mb-1 text-pink-400" />
              <p className="font-bold text-[18px]">{stats.likes}</p>
              <p className="text-subtle text-[11px]">Likes</p>
            </div>
            <div className="text-center">
              <MessageCircle size={22} className="mx-auto mb-1 text-blue-400" />
              <p className="font-bold text-[18px]">{stats.comments}</p>
              <p className="text-subtle text-[11px]">Comments</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
