import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ImagePlus, Heart, Send, X, Users, Play, Camera, PenSquare, Video, Image as ImageIcon, MessageCircle, Share2 } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BottomNav from "../components/BottomNav"
import NotificationBell from "../components/NotificationBell"
import StoriesRow from "../components/StoriesRow"
import PostCommentsSheet from "../components/PostCommentsSheet"
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
  const [reelsRail, setReelsRail] = useState([])
  const [myReactions, setMyReactions] = useState(new Set())
  const [reactionCounts, setReactionCounts] = useState(new Map())
  const [commentCounts, setCommentCounts] = useState(new Map())
  const [commentsFor, setCommentsFor] = useState(null)
  const [suggested, setSuggested] = useState([])
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef(null)

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
      .limit(12)

    if (pErr) { setError(pErr.message); setLoading(false); return }

    const list = rows || []
    setPosts(list)
    setHasMore(list.length === 12)
    setCursor(list.length > 0 ? list[list.length - 1].created_at : null)

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

    // Recent public reels for home rail
    const { data: reelRows } = await supabase
      .from("reels")
      .select("id, video_url, thumbnail_url, caption, mirrored, created_at")
      .eq("is_active", true)
      .eq("audience", "public")
      .order("created_at", { ascending: false })
      .limit(8)
    setReelsRail(reelRows || [])

    // Suggested people
    const { data: sug } = await supabase.rpc("get_discover_profiles", {
      p_limit: 10,
      p_same_city: false,
      p_shared_interests: false,
      p_same_country: false,
      p_verified_only: false,
      p_online_only: false,
      p_community_id: null,
    })
    setSuggested((sug || []).slice(0, 10).map((r) => ({
      id: r.id,
      display_name: r.display_name,
      username: r.username,
      photo_url: publicPhotoUrl(r.primary_photo),
    })))

    // Reactions + comment counts
    const postIds = list.map((r) => r.id)
    if (postIds.length > 0) {
      const { data: reactRows } = await supabase
        .from("community_post_reactions")
        .select("post_id, user_id")
        .in("post_id", postIds)
      const mine = new Set()
      const counts = new Map()
      ;(reactRows || []).forEach((r) => {
        counts.set(r.post_id, (counts.get(r.post_id) || 0) + 1)
        if (r.user_id === myId) mine.add(r.post_id)
      })
      setMyReactions(mine)
      setReactionCounts(counts)

      const { data: commentRows } = await supabase
        .from("community_post_comments")
        .select("post_id")
        .in("post_id", postIds)
      const cc = new Map()
      ;(commentRows || []).forEach((c) => cc.set(c.post_id, (cc.get(c.post_id) || 0) + 1))
      setCommentCounts(cc)
    }

    setLoading(false)
  }, [myId])

  // ---- Infinite scroll: fetch next page ----
  const loadMore = useCallback(async () => {
    if (!myId || loadingMore || !hasMore || !cursor) return
    setLoadingMore(true)
    const myCommIds = [...communities.keys()]
    if (myCommIds.length === 0) { setLoadingMore(false); return }

    const { data: rows } = await supabase
      .from("community_posts")
      .select("id, community_id, author_id, content, image_path, created_at, pinned_until")
      .in("community_id", myCommIds)
      .lt("created_at", cursor)
      .order("created_at", { ascending: false })
      .limit(12)

    const newPosts = rows || []
    if (newPosts.length === 0) {
      setHasMore(false)
      setLoadingMore(false)
      return
    }

    const ids = [...new Set(newPosts.map((r) => r.author_id))]
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, username, is_verified")
        .in("id", ids)
      setProfiles((prev) => {
        const next = new Map(prev)
        ;(profs || []).forEach((p) => next.set(p.id, p))
        return next
      })
      const { data: ph } = await supabase
        .from("profile_photos")
        .select("user_id, storage_path, is_primary, display_order")
        .in("user_id", ids)
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
      setPhotos((prev) => {
        const next = new Map(prev)
        ;(ph || []).forEach((p) => { if (!next.has(p.user_id)) next.set(p.user_id, p.storage_path) })
        return next
      })
    }

    const postIds = newPosts.map((r) => r.id)
    if (postIds.length > 0) {
      const { data: reactRows } = await supabase
        .from("community_post_reactions")
        .select("post_id, user_id")
        .in("post_id", postIds)
      setMyReactions((prev) => {
        const next = new Set(prev)
        ;(reactRows || []).forEach((r) => { if (r.user_id === myId) next.add(r.post_id) })
        return next
      })
      setReactionCounts((prev) => {
        const next = new Map(prev)
        ;(reactRows || []).forEach((r) => next.set(r.post_id, (next.get(r.post_id) || 0) + 1))
        return next
      })
      const { data: commentRows } = await supabase
        .from("community_post_comments")
        .select("post_id")
        .in("post_id", postIds)
      setCommentCounts((prev) => {
        const next = new Map(prev)
        ;(commentRows || []).forEach((c) => next.set(c.post_id, (next.get(c.post_id) || 0) + 1))
        return next
      })
    }

    setPosts((prev) => [...prev, ...newPosts])
    setCursor(newPosts[newPosts.length - 1].created_at)
    setHasMore(newPosts.length === 12)
    setLoadingMore(false)
  }, [myId, loadingMore, hasMore, cursor, communities])

  // ---- Sentinel observer ----
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore()
    }, { rootMargin: "300px" })
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!myId) return
    const ch = supabase
      .channel("feed-realtime-" + myId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_posts" }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [myId, load])

  async function toggleLike(postId) {
    if (!myId) return
    tap("light")
    const isLiked = myReactions.has(postId)
    const nextMine = new Set(myReactions)
    const nextCounts = new Map(reactionCounts)
    if (isLiked) {
      nextMine.delete(postId)
      nextCounts.set(postId, Math.max(0, (nextCounts.get(postId) || 1) - 1))
      setMyReactions(nextMine); setReactionCounts(nextCounts)
      await supabase.from("community_post_reactions").delete().eq("post_id", postId).eq("user_id", myId)
    } else {
      nextMine.add(postId)
      nextCounts.set(postId, (nextCounts.get(postId) || 0) + 1)
      setMyReactions(nextMine); setReactionCounts(nextCounts)
      await supabase.from("community_post_reactions").insert({ post_id: postId, user_id: myId, reaction: "❤️" })
    }
  }

  async function sharePost(p) {
    tap("light")
    const url = window.location.origin + "/communities/" + p.community_id
    if (navigator.share) {
      try { await navigator.share({ title: "Nakubonye", url }) } catch {}
    } else {
      try { await navigator.clipboard.writeText(url); alert("Link copied!") } catch {}
    }
  }

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
          <NotificationBell />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 pb-24">
        {error && (
          <div className="mb-3 text-red-400 text-[12.5px] bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {!loading && (
          <>
            {/* Composer card */}
            <button
              onClick={() => { tap("light"); nav("/reels") }}
              className="w-full mb-3 flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/8 text-left active:scale-[0.99] transition-transform"
            >
              <span
                className="w-10 h-10 rounded-full grid place-items-center shrink-0"
                style={{ background: "linear-gradient(135deg, #C084FC 0%, #EC4899 100%)" }}
              >
                <PenSquare size={18} color="#fff" />
              </span>
              <span className="flex-1 text-muted text-[14px]">Share something real</span>
              <span className="flex items-center gap-1">
                <span className="w-8 h-8 rounded-full grid place-items-center bg-white/[0.06] border border-white/10">
                  <ImageIcon size={14} className="text-purple-300" />
                </span>
                <span className="w-8 h-8 rounded-full grid place-items-center bg-white/[0.06] border border-white/10">
                  <Video size={14} className="text-pink-300" />
                </span>
              </span>
            </button>

            {/* Reels rail */}
            {reelsRail.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase">
                    Reels
                  </p>
                  <button
                    onClick={() => { tap("light"); nav("/reels") }}
                    className="text-purple-300 text-[12px] font-bold"
                  >
                    See all →
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {reelsRail.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => { tap("light"); nav("/reels") }}
                      className="shrink-0 relative rounded-xl overflow-hidden bg-black"
                      style={{ width: 104, height: 156 }}
                    >
                      <video
                        src={r.video_url}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover"
                        style={{ transform: r.mirrored ? "scaleX(-1)" : "none" }}
                      />
                      <span className="absolute inset-0 grid place-items-center bg-black/20">
                        <span className="w-10 h-10 rounded-full grid place-items-center bg-black/45 backdrop-blur-md border border-white/20">
                          <Play size={16} fill="#fff" color="#fff" />
                        </span>
                      </span>
                      {r.caption && (
                        <span className="absolute left-1.5 right-1.5 bottom-1.5 text-white text-[10px] font-semibold line-clamp-2 leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] text-left">
                          {r.caption.slice(0, 40)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && (
          <>
            {/* Stories row */}
            <div className="mb-2 -mx-3">
              <div className="flex items-center justify-between mb-1 px-4">
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase">
                  Stories
                </p>
                <button
                  onClick={() => { tap("light"); nav("/stories") }}
                  className="text-purple-300 text-[12px] font-bold"
                >
                  See all →
                </button>
              </div>
              <StoriesRow />
            </div>

            {/* Composer card */}
            <button
              onClick={() => { tap("light"); nav("/reels") }}
              className="w-full mb-3 flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/8 text-left active:scale-[0.99] transition-transform"
            >
              <span
                className="w-10 h-10 rounded-full grid place-items-center shrink-0"
                style={{ background: "linear-gradient(135deg, #C084FC 0%, #EC4899 100%)" }}
              >
                <PenSquare size={18} color="#fff" />
              </span>
              <span className="flex-1 text-muted text-[14px]">Share something real</span>
              <span className="flex items-center gap-1">
                <span className="w-8 h-8 rounded-full grid place-items-center bg-white/[0.06] border border-white/10">
                  <ImageIcon size={14} className="text-purple-300" />
                </span>
                <span className="w-8 h-8 rounded-full grid place-items-center bg-white/[0.06] border border-white/10">
                  <Video size={14} className="text-pink-300" />
                </span>
              </span>
            </button>

          </>
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
          posts.map((p, idx) => {
            const prof = profiles.get(p.author_id)
            const comm = communities.get(p.community_id)
            const photoPath = photos.get(p.author_id)
            const name = prof?.display_name || prof?.username || "Someone"
            const imageUrl = p.image_path ? supabase.storage.from("community-media").getPublicUrl(p.image_path).data?.publicUrl : null
            return (
              <Fragment key={p.id}>
              <article className="mb-4 rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden">
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

                {/* Engagement bar */}
                <div className="flex items-center justify-between px-2 py-1.5 border-t border-white/5">
                  <button
                    onClick={() => toggleLike(p.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl flex-1 justify-center"
                  >
                    <Heart
                      size={18}
                      strokeWidth={2.2}
                      color={myReactions.has(p.id) ? "#EC4899" : "#888"}
                      fill={myReactions.has(p.id) ? "#EC4899" : "none"}
                    />
                    <span className="text-[12.5px] font-bold" style={{ color: myReactions.has(p.id) ? "#EC4899" : "#888" }}>
                      {reactionCounts.get(p.id) || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => { tap("light"); setCommentsFor(p.id) }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl flex-1 justify-center"
                  >
                    <MessageCircle size={18} strokeWidth={2.2} color="#888" />
                    <span className="text-muted text-[12.5px] font-bold">{commentCounts.get(p.id) || 0}</span>
                  </button>
                  <button
                    onClick={() => sharePost(p)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl flex-1 justify-center"
                  >
                    <Share2 size={18} strokeWidth={2.2} color="#888" />
                    <span className="text-muted text-[12.5px] font-bold">Share</span>
                  </button>
                </div>
              </article>

              {(idx + 1) % 4 === 0 && suggested.length > 0 && (
                <div className="mb-4 rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden">
                  <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase px-3 pt-3 mb-2">
                    People you may know
                  </p>
                  <div className="flex gap-3 overflow-x-auto px-3 pb-3" style={{ scrollbarWidth: "none" }}>
                    {suggested.slice(0, 6).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { tap("light"); nav("/profile/" + u.id) }}
                        className="shrink-0 flex flex-col items-center gap-1.5"
                        style={{ width: 92 }}
                      >
                        <span className="w-[72px] h-[72px] rounded-full overflow-hidden bg-elevated border-2 border-white/10">
                          {u.photo_url ? (
                            <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="w-full h-full grid place-items-center text-purple-400 font-black text-xl">
                              {(u.display_name || "?")[0]}
                            </span>
                          )}
                        </span>
                        <span className="text-cream text-[12px] font-semibold truncate w-full text-center">
                          {u.display_name || u.username}
                        </span>
                        <span className="text-purple-300 text-[11px] font-bold">View</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </Fragment>
            )
          })
        )}

        {/* Infinite scroll sentinel */}
        {loadingMore && (
          <div className="grid place-items-center py-6">
            <div className="w-7 h-7 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          </div>
        )}
        {!hasMore && posts.length > 0 && (
          <p className="text-center text-subtle text-[12px] py-6">
            You're all caught up ✨
          </p>
        )}
        <div ref={sentinelRef} data-sentinel style={{ height: 1 }} />
      </div>

      {commentsFor && (
        <PostCommentsSheet
          postId={commentsFor}
          onClose={() => setCommentsFor(null)}
          onCountChange={(n) => {
            setCommentCounts((prev) => {
              const next = new Map(prev)
              next.set(commentsFor, n)
              return next
            })
          }}
        />
      )}

      <BottomNav />
    </div>
  )
}
