import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft} from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import ProfilePostCard from "../components/ProfilePostCard"
import { tap } from "../lib/haptic"

export default function HashtagPage() {
  const { tag } = useParams()
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tag) return
    ;(async () => {
      setLoading(true)
      const { data } = await supabase.from("user_posts").select("id, user_id, content, image_path, image_paths, audience, created_at, location_text, feeling_text").eq("is_active", true).ilike("content", `%#${tag}%`).order("created_at", { ascending: false }).limit(50)
      const authorIds = [...new Set((data || []).map(p => p.user_id))]
      const { data: profs } = await supabase.from("profiles").select("id, display_name, username, is_verified").in("id", authorIds)
      const profMap = new Map((profs || []).map(p => [p.id, p]))
      setPosts((data || []).map(p => ({ ...p, _source: "personal", author_id: p.user_id, _prof: profMap.get(p.user_id) })))
      setLoading(false)
    })()
  }, [tag])

  return (
    <div className="min-h-dvh bg-[#0B0B14] text-cream flex flex-col">
      <header className="sticky top-0 z-30 bg-[#0B0B14]/80 backdrop-blur-md border-b border-white/8 shrink-0">
        <div className="max-w-[480px] mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted"><ArrowLeft size={20} strokeWidth={2.3} /></button>
          <h1 className="text-cream font-bold text-[17px] flex items-center gap-1.5"><span className="text-purple-400"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg></span> {tag}</h1>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto max-w-[480px] mx-auto w-full pb-10">
        {loading ? <div className="p-4"><div className="h-32 rounded-xl bg-white/[0.03] shimmer" /></div> : posts.length === 0 ? <div className="py-20 text-center px-6"><p className="text-cream font-bold text-[15px] mb-1">No posts yet</p><p className="text-muted text-[13px]">Be the first to post with #{tag}.</p></div> : posts.map(p => <ProfilePostCard key={p.id} post={p} authorProfile={p._prof} authorPhoto={null} isMe={p.author_id === myId} onOpenMenu={() => {}} reactionCount={0} liked={false} commentCount={0} shareCount={0} onToggleLike={() => {}} onOpenReposts={() => {}} />)}
      </div>
    </div>
  )
}
