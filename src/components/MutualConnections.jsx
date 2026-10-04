import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Users } from "lucide-react"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

export default function MutualConnections({ userId, myId }) {
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [mutuals, setMutuals] = useState([])
  const [commonCommunities, setCommonCommunities] = useState([])
  const [commonInterests, setCommonInterests] = useState([])

  useEffect(() => {
    if (!userId || !myId || userId === myId) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      setLoading(true)

      // Mutual follows — people I follow AND they follow
      const [myFollowingRes, theirFollowingRes] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", myId).limit(500),
        supabase.from("follows").select("following_id").eq("follower_id", userId).limit(500),
      ])
      const mine = new Set((myFollowingRes.data || []).map((r) => r.following_id))
      const mutualIds = (theirFollowingRes.data || [])
        .map((r) => r.following_id)
        .filter((id) => mine.has(id) && id !== userId && id !== myId)

      // Shared communities
      const [myCommRes, theirCommRes] = await Promise.all([
        supabase.from("community_memberships").select("community_id").eq("user_id", myId).limit(200),
        supabase.from("community_memberships").select("community_id").eq("user_id", userId).limit(200),
      ])
      const myC = new Set((myCommRes.data || []).map((r) => r.community_id))
      const sharedCommIds = (theirCommRes.data || [])
        .map((r) => r.community_id)
        .filter((id) => myC.has(id))

      // Shared interests
      const [myIntRes, theirIntRes] = await Promise.all([
        supabase.from("profile_interests").select("interest_id").eq("profile_id", myId).limit(200),
        supabase.from("profile_interests").select("interest_id").eq("profile_id", userId).limit(200),
      ])
      const myI = new Set((myIntRes.data || []).map((r) => r.interest_id))
      const sharedIntIds = (theirIntRes.data || [])
        .map((r) => r.interest_id)
        .filter((id) => myI.has(id))

      // Enrich: profiles + photos for mutuals
      let profMap = new Map(), photoMap = new Map()
      if (mutualIds.length > 0) {
        const [profs, phs] = await Promise.all([
          supabase.from("profiles").select("id, display_name, username, is_verified").in("id", mutualIds.slice(0, 30)),
          supabase.from("profile_photos").select("user_id, storage_path, is_primary, display_order").in("user_id", mutualIds.slice(0, 30)).order("is_primary", { ascending: false }).order("display_order", { ascending: true }),
        ])
        ;(profs.data || []).forEach((p) => profMap.set(p.id, p))
        ;(phs.data || []).forEach((x) => { if (!photoMap.has(x.user_id)) photoMap.set(x.user_id, x.storage_path) })
      }

      let commMap = new Map()
      if (sharedCommIds.length > 0) {
        const { data: comms } = await supabase.from("communities").select("id, slug, name, emoji, cover_color").in("id", sharedCommIds)
        ;(comms || []).forEach((c) => commMap.set(c.id, c))
      }

      let intMap = new Map()
      if (sharedIntIds.length > 0) {
        const { data: ints } = await supabase.from("interests").select("id, name").in("id", sharedIntIds)
        ;(ints || []).forEach((i) => intMap.set(i.id, i))
      }

      if (cancelled) return
      setMutuals(mutualIds.slice(0, 12).map((id) => ({
        id,
        _profile: profMap.get(id),
        _photo: photoMap.get(id) ? publicPhotoUrl(photoMap.get(id)) : null,
      })))
      setCommonCommunities(sharedCommIds.map((id) => commMap.get(id)).filter(Boolean))
      setCommonInterests(sharedIntIds.map((id) => intMap.get(id)).filter(Boolean))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [userId, myId])

  if (loading) return null
  const hasAny = mutuals.length > 0 || commonCommunities.length > 0 || commonInterests.length > 0
  if (!hasAny) return null

  return (
    <div className="mt-3 flex flex-col gap-3">
      {mutuals.length > 0 && (
        <button
          onClick={() => { tap("light") }}
          className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.03] border border-white/8 text-left"
        >
          <div className="flex -space-x-2 shrink-0">
            {mutuals.slice(0, 3).map((m) => (
              <span key={m.id} className="w-7 h-7 rounded-full overflow-hidden bg-purple-600 border-2 border-[#0B0B14] grid place-items-center text-white text-[10px] font-black">
                {m._photo ? <img src={m._photo} alt="" className="w-full h-full object-cover" /> : (m._profile?.display_name || "?")[0].toUpperCase()}
              </span>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-cream text-[12.5px] font-semibold truncate">
              {mutuals.slice(0, 2).map((m) => m._profile?.display_name || m._profile?.username || "Someone").join(", ")}
              {mutuals.length > 2 ? ` + ${mutuals.length - 2} more` : ""}
            </p>
            <p className="text-muted text-[11px]">
              {mutuals.length} mutual connection{mutuals.length === 1 ? "" : "s"}
            </p>
          </div>
        </button>
      )}

      {commonCommunities.length > 0 && (
        <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/8">
          <p className="text-purple-400 text-[10px] font-black tracking-[0.16em] uppercase mb-2">Shared communities</p>
          <div className="flex flex-wrap gap-1.5">
            {commonCommunities.slice(0, 6).map((c) => (
              <button
                key={c.id}
                onClick={() => { tap("light"); nav('/communities/' + (c.slug || c.id)) }}
                className="h-7 px-2 rounded-full bg-purple-500/12 border border-purple-500/25 text-purple-100 text-[11px] font-semibold inline-flex items-center gap-1.5"
              >
                <span>{c.emoji || "🌐"}</span> {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {commonInterests.length > 0 && (
        <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/8">
          <p className="text-purple-400 text-[10px] font-black tracking-[0.16em] uppercase mb-2">Shared interests</p>
          <div className="flex flex-wrap gap-1.5">
            {commonInterests.slice(0, 8).map((i) => (
              <span
                key={i.id}
                className="h-7 px-2.5 rounded-full text-[11px] font-semibold border border-purple-500/30 text-purple-100"
                style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.20) 0%, rgba(236,72,153,0.10) 100%)" }}
              >
                {i.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
