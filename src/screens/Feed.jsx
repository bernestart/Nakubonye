import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ImagePlus, Heart, Send, X, Users } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BottomNav from "../components/BottomNav"
import NotificationBell from "../components/NotificationBell"
import BrandGlow from "../components/BrandGlow"

export default function Feed() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [posts, setPosts] = useState([])
  const [communities, setCommunities] = useState(new Map())
  const [profiles, setProfiles] = useState(new Map())
  const [photos, setPhotos] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true); setError("")

    // 1. My communities
    const { data: mine } = await supabase
      .from("community_memberships")
      .select("community_id")
      .eq("user_id", myId)
    const myCommIds = (mine || []).map((m) => m.community_id)

    if (myCommIds.length === 0) {
      setPosts([]); setLoading(false); return
    }

    // 2. Community meta
    const { data: commRows } = await supabase
      .from("communities")
      .select("id, name, emoji, cover_color")
      .in("id", myCommIds)
    const commMap = new Map((commRows || []).map((c) => [c.id, c]))
    setCommunities(commMap)

    // 3. Posts from all my communities
    const { data: rows, error: pErr } = await supabase
      .from("community_posts")
      .select("id, community_id, author_id, content, image_path, created_at, pinned_until")
      .in("community_id", myCommIds)
      .order("created_at", { ascending: false })
      .limit(60)

    if (pErr) { setError(pErr.message); setLoading(false); return }

    const list = rows || []
    setPosts(list)

    // 4. Profiles + photos for post authors
    const ids = [...new Set(list.map((r) => r.author_id))]
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
  }, [myId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!myId) return
    const ch = supabase
      .channel("feed-realtime-" + myId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_posts" }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [myId, load])

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      margin: "0 auto", maxWidth: 480,
      display: "flex", flexDirection: "column",
      background: "#0B0B14", overflow: "hidden",
    }}>
      <BrandGlow />
      <header style={{ height: 48, flexShrink: 0 }} className="px-4 flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-xl grid place-items-center"
          style={{
            background: "linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)",
            boxShadow: "0 6px 18px rgba(168,85,247,0.45)",
          }}
        >
          <span className="text-white font-black text-[17px] leading-none">N</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { tap("light"); nav("/stories") }}
            className="h-9 px-3 rounded-full text-cream font-bold text-[13px] bg-white/[0.06] border border-white/12"
          >
            Stories
          </button>
          <NotificationBell />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 pb-24">
        {error && (
          <div className="mb-3 text-red-400 text-[12.5px] bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">Loading feed…</div>
        ) : posts.length === 0 ? (
          <div className="grid place-items-center h-full text-center px-6">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 grid place-items-center mx-auto mb-4">
                <Users size={22} className="text-purple-300" />
              </div>
              <p className="text-cream font-semibold text-[15px] mb-1.5">Your feed is empty</p>
              <p className="text-muted text-[13px] leading-relaxed mb-4">
                Join a community to see what people are sharing.
              </p>
              <button
                onClick={() => nav("/communities")}
                className="h-11 px-5 rounded-full text-white font-bold text-[13.5px]"
                style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
              >
                Explore communities
              </button>
            </div>
          </div>
        ) : (
          posts.map((p) => {
            const prof = profiles.get(p.author_id)
            const comm = communities.get(p.community_id)
            const photoPath = photos.get(p.author_id)
            const name = prof?.display_name || prof?.username || "Someone"
            const imageUrl = p.image_path ? supabase.storage.from("community-media").getPublicUrl(p.image_path).data?.publicUrl : null
            return (
              <article key={p.id} className="mb-4 rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden">
                {/* Community badge */}
                {comm && (
                  <button
                    onClick={() => { tap("light"); nav("/communities/" + comm.id) }}
                    className="w-full flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/[0.02] text-left"
                  >
                    <span
                      className="w-6 h-6 rounded-lg grid place-items-center text-[12px]"
                      style={{ background: comm.cover_color || "rgba(168,85,247,0.25)" }}
                    >
                      {comm.emoji || "•"}
                    </span>
                    <span className="text-purple-300 text-[11.5px] font-bold tracking-wide truncate">{comm.name}</span>
                  </button>
                )}

                {/* Author header */}
                <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
                  <button
                    onClick={() => { tap("light"); nav("/profile/" + p.author_id) }}
                    className="w-9 h-9 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0"
                  >
                    {photoPath ? (
                      <img src={publicPhotoUrl(photoPath)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-purple-400 font-black text-sm">{name[0]}</div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-bold text-[13.5px] truncate">
                      {name} {prof?.is_verified && <span className="text-purple-400">✓</span>}
                    </p>
                    <p className="text-subtle text-[11px]">
                      {new Date(p.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                {/* Content */}
                {p.content && (
                  <p className="px-3 pb-3 text-cream text-[14px] leading-[1.5] whitespace-pre-wrap">{p.content}</p>
                )}

                {imageUrl && (
                  <img src={imageUrl} alt="" className="w-full" loading="lazy" />
                )}

                {/* Footer actions */}
                <div className="flex items-center gap-3 px-3 py-2.5 border-t border-white/5">
                  <button
                    onClick={() => { tap("light"); nav("/communities/" + p.community_id) }}
                    className="flex items-center gap-1.5 text-muted text-[12px] font-semibold"
                  >
                    <Heart size={14} /> View in community
                  </button>
                </div>
              </article>
            )
          })
        )}
      </div>

      <BottomNav />
    </div>
  )
}
