import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ImagePlus, Heart, Send, X, Users, Play, Camera, PenSquare, Video, Image as ImageIcon, MessageCircle, Share2 , MoreVertical } from "lucide-react"
import VerifiedBadge from "../components/VerifiedBadge"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BottomNav from "../components/BottomNav"
import NotificationBell from "../components/NotificationBell"
import AppHeader from "../components/AppHeader"
import StoriesRow from "../components/StoriesRow"
import PostCommentsSheet from "../components/PostCommentsSheet"
import PostActionsSheet from "../components/PostActionsSheet"
import PostComposer from "../components/PostComposer"
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
  const [myReactions, setMyReactions] = useState(new Set())
  const [reactionCounts, setReactionCounts] = useState(new Map())
  const [commentCounts, setCommentCounts] = useState(new Map())
  const [commentsFor, setCommentsFor] = useState(null)
  const [actionsFor, setActionsFor] = useState(null)
  const [suggested, setSuggested] = useState([])
  const [composerChooserOpen, setComposerChooserOpen] = useState(false)
  const [postComposerOpen, setPostComposerOpen] = useState(false)
  const [myPhotoUrl, setMyPhotoUrl] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef(null)

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true); setError("")

    // 1. My communities (may be empty)
    const { data: mine } = await supabase
      .from("community_memberships")
      .select("community_id")
      .eq("user_id", myId)
    const myCommIds = (mine || []).map((m) => m.community_id)

    // 2. Community meta
    if (myCommIds.length > 0) {
      const { data: commRows } = await supabase
        .from("communities")
        .select("id, name, emoji, cover_color")
        .in("id", myCommIds)
      setCommunities(new Map((commRows || []).map((c) => [c.id, c])))
    }

    // 3a. Community posts (only if user has communities)
    let communityPosts = []
    if (myCommIds.length > 0) {
      const { data: rows, error: pErr } = await supabase
        .from("community_posts")
        .select("id, community_id, author_id, content, image_path, created_at, pinned_until")
        .in("community_id", myCommIds)
        .order("created_at", { ascending: false })
        .limit(20)
      if (pErr) { setError(pErr.message); setLoading(false); return }
      communityPosts = (rows || []).map((r) => ({ ...r, _source: "community" }))
    }

    // 3b. Personal posts (from me + my matches)
    const { data: matchRows } = await supabase
      .from("matches")
      .select("user_one_id, user_two_id")
      .or("user_one_id.eq." + myId + ",user_two_id.eq." + myId)
    const matchIds = (matchRows || []).map((m) => m.user_one_id === myId ? m.user_two_id : m.user_one_id)
    const allowedUserIds = [myId, ...matchIds]

    const { data: personalRows } = await supabase
      .from("user_posts")
      .select("id, user_id, content, image_path, audience, created_at")
      .in("user_id", allowedUserIds)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20)
    const personalPosts = (personalRows || []).map((r) => ({
      ...r,
      author_id: r.user_id,
      _source: "personal",
    }))

    // 3c. Load my hidden post IDs and filter them out
    const { data: hideRows } = await supabase
      .from("post_hides")
      .select("post_id, post_type")
      .eq("user_id", myId)
    const hiddenKeys = new Set((hideRows || []).map((h) => h.post_type + ":" + h.post_id))

    // 3d. Merge + filter + sort + take first 12
    const list = [...communityPosts, ...personalPosts]
      .filter((r) => !hiddenKeys.has((r._source || "community") + ":" + r.id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 12)

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
    // Load my avatar for composer pill
    const { data: myProfilePhoto } = await supabase
      .from("profile_photos")
      .select("storage_path")
      .eq("user_id", myId)
      .order("is_primary", { ascending: false })
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle()
    setMyPhotoUrl(myProfilePhoto?.storage_path ? publicPhotoUrl(myProfilePhoto.storage_path) : null)

    setSuggested((sug || []).slice(0, 10).map((r) => ({
      id: r.id,
      display_name: r.display_name,
      username: r.username,
      photo_url: publicPhotoUrl(r.primary_photo),
    })))

    // Reactions + comment counts (per source)
    const communityIds = list.filter((r) => r._source === "community").map((r) => r.id)
    const personalIds = list.filter((r) => r._source === "personal").map((r) => r.id)

    const myLikedIds = new Set()
    const counts = new Map()
    const cc = new Map()

    if (communityIds.length > 0) {
      const { data: reactRows } = await supabase
        .from("community_post_reactions")
        .select("post_id, user_id")
        .in("post_id", communityIds)
      ;(reactRows || []).forEach((r) => {
        counts.set(r.post_id, (counts.get(r.post_id) || 0) + 1)
        if (r.user_id === myId) myLikedIds.add(r.post_id)
      })

      const { data: commentRows } = await supabase
        .from("community_post_comments")
        .select("post_id")
        .in("post_id", communityIds)
      ;(commentRows || []).forEach((c) => cc.set(c.post_id, (cc.get(c.post_id) || 0) + 1))
    }

    if (personalIds.length > 0) {
      const { data: reactRows } = await supabase
        .from("user_post_likes")
        .select("post_id, user_id")
        .in("post_id", personalIds)
      ;(reactRows || []).forEach((r) => {
        counts.set(r.post_id, (counts.get(r.post_id) || 0) + 1)
        if (r.user_id === myId) myLikedIds.add(r.post_id)
      })

      const { data: commentRows } = await supabase
        .from("user_post_comments")
        .select("post_id")
        .in("post_id", personalIds)
      ;(commentRows || []).forEach((c) => cc.set(c.post_id, (cc.get(c.post_id) || 0) + 1))
    }

    setMyReactions(myLikedIds)
    setReactionCounts(counts)
    setCommentCounts(cc)

    setLoading(false)
  }, [myId])

  // ---- Infinite scroll: fetch next page ----
  const loadMore = useCallback(async () => {
    if (!myId || loadingMore || !hasMore || !cursor) return
    setLoadingMore(true)

    const myCommIds = [...communities.keys()]

    // --- Community posts (older than cursor) ---
    let communityPosts = []
    if (myCommIds.length > 0) {
      const { data: rows } = await supabase
        .from("community_posts")
        .select("id, community_id, author_id, content, image_path, created_at, pinned_until")
        .in("community_id", myCommIds)
        .lt("created_at", cursor)
        .order("created_at", { ascending: false })
        .limit(20)
      communityPosts = (rows || []).map((r) => ({ ...r, _source: "community" }))
    }

    // --- Personal posts from me + matches ---
    const { data: matchRows } = await supabase
      .from("matches")
      .select("user_one_id, user_two_id")
      .or("user_one_id.eq." + myId + ",user_two_id.eq." + myId)
    const matchIds = (matchRows || []).map((m) => m.user_one_id === myId ? m.user_two_id : m.user_one_id)
    const allowedUserIds = [myId, ...matchIds]

    const { data: personalRows } = await supabase
      .from("user_posts")
      .select("id, user_id, content, image_path, audience, created_at")
      .in("user_id", allowedUserIds)
      .eq("is_active", true)
      .lt("created_at", cursor)
      .order("created_at", { ascending: false })
      .limit(20)
    const personalPosts = (personalRows || []).map((r) => ({
      ...r,
      author_id: r.user_id,
      _source: "personal",
    }))

    // --- Load hidden IDs, filter, merge, take newest 12 ---
    const { data: hideRows } = await supabase
      .from("post_hides")
      .select("post_id, post_type")
      .eq("user_id", myId)
    const hiddenKeys = new Set((hideRows || []).map((h) => h.post_type + ":" + h.post_id))

    const merged = [...communityPosts, ...personalPosts]
      .filter((r) => !hiddenKeys.has((r._source || "community") + ":" + r.id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 12)

    if (merged.length === 0) {
      setHasMore(false)
      setLoadingMore(false)
      return
    }

    // --- Profiles + photos for new authors ---
    const ids = [...new Set(merged.map((r) => r.author_id))]
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

    // --- Reactions + comment counts (per source) ---
    const communityIds = merged.filter((r) => r._source === "community").map((r) => r.id)
    const personalIds = merged.filter((r) => r._source === "personal").map((r) => r.id)

    if (communityIds.length > 0) {
      const { data: reactRows } = await supabase
        .from("community_post_reactions")
        .select("post_id, user_id")
        .in("post_id", communityIds)
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
        .in("post_id", communityIds)
      setCommentCounts((prev) => {
        const next = new Map(prev)
        ;(commentRows || []).forEach((c) => next.set(c.post_id, (next.get(c.post_id) || 0) + 1))
        return next
      })
    }

    if (personalIds.length > 0) {
      const { data: reactRows } = await supabase
        .from("user_post_likes")
        .select("post_id, user_id")
        .in("post_id", personalIds)
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
        .from("user_post_comments")
        .select("post_id")
        .in("post_id", personalIds)
      setCommentCounts((prev) => {
        const next = new Map(prev)
        ;(commentRows || []).forEach((c) => next.set(c.post_id, (next.get(c.post_id) || 0) + 1))
        return next
      })
    }

    setPosts((prev) => [...prev, ...merged])
    setCursor(merged[merged.length - 1].created_at)
    setHasMore(merged.length === 12)
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

  async function toggleLike(postId, source = "community") {
    if (!myId) return
    tap("light")
    const isLiked = myReactions.has(postId)
    const nextMine = new Set(myReactions)
    const nextCounts = new Map(reactionCounts)
    const table = source === "personal" ? "user_post_likes" : "community_post_reactions"

    if (isLiked) {
      nextMine.delete(postId)
      nextCounts.set(postId, Math.max(0, (nextCounts.get(postId) || 1) - 1))
      setMyReactions(nextMine); setReactionCounts(nextCounts)
      await supabase.from(table).delete().eq("post_id", postId).eq("user_id", myId)
    } else {
      nextMine.add(postId)
      nextCounts.set(postId, (nextCounts.get(postId) || 0) + 1)
      setMyReactions(nextMine); setReactionCounts(nextCounts)
      const row = source === "personal"
        ? { post_id: postId, user_id: myId }
        : { post_id: postId, user_id: myId, reaction: "❤️" }
      await supabase.from(table).insert(row)
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
      <AppHeader />

      <div className="flex-1 overflow-y-auto px-2 py-2 pb-24">
        {error && (
          <div className="mb-3 text-red-400 text-[12.5px] bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {!loading && (
          <>
            {/* Stories row */}
            <div className="mb-3 -mx-3">
              <StoriesRow />
            </div>

            {/* Composer pill */}
            <button
              onClick={() => { tap("light"); setComposerChooserOpen(true) }}
              className="w-full mb-3 flex items-center gap-2.5 active:scale-[0.99] transition-transform"
            >
              <span className="w-9 h-9 rounded-full overflow-hidden bg-elevated border border-white/10 shrink-0">
                {myPhotoUrl ? (
                  <img src={myPhotoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full grid place-items-center text-purple-300 font-black text-sm">Y</span>
                )}
              </span>
              <span className="flex-1 h-10 rounded-full bg-white/[0.04] border border-white/8 px-4 flex items-center text-muted text-[13.5px]">
                Share something real
              </span>
              <span className="w-9 h-9 rounded-full grid place-items-center bg-white/[0.04] border border-white/8 shrink-0">
                <ImageIcon size={15} className="text-purple-300" />
              </span>
              <span className="w-9 h-9 rounded-full grid place-items-center bg-white/[0.04] border border-white/8 shrink-0">
                <Video size={15} className="text-pink-300" />
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
              <article className="mb-2 rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
                {/* Source badge — community OR profile */}
                {p._source === "community" && comm && (
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
                {p._source === "personal" && (
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/[0.02]">
                    <span className="w-6 h-6 rounded-lg grid place-items-center text-[12px] bg-pink-500/20">
                      {p.audience === "matches" ? "💜" : p.audience === "private" ? "🔒" : "🌍"}
                    </span>
                    <span className="text-pink-300 text-[11.5px] font-bold tracking-wide">
                      {p.author_id === myId
                        ? "Your post · " + (p.audience === "matches" ? "Matches" : p.audience === "private" ? "Only me" : "Everyone")
                        : "Posted to their profile"}
                    </span>
                  </div>
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
                      {name} {prof?.is_verified && <VerifiedBadge size={14} className="ml-1" />}
                    </p>
                    <p className="text-subtle text-[11px]">
                      {new Date(p.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <button
                    onClick={() => { tap("light"); setActionsFor(p) }}
                    className="w-8 h-8 rounded-full grid place-items-center text-muted shrink-0"
                    aria-label="Post options"
                  >
                    <MoreVertical size={18} />
                  </button>
                </div>

                {/* Content */}
                {p.content && (
                  <p className="px-3 pb-3 text-cream text-[14px] leading-[1.5] whitespace-pre-wrap">{p.content}</p>
                )}

                {imageUrl && (
                  <img src={imageUrl} alt="" className="w-full" loading="lazy" />
                )}

                {/* Engagement summary */}
                {((reactionCounts.get(p.id) || 0) > 0 || (commentCounts.get(p.id) || 0) > 0) && (
                  <div className="flex items-center justify-between px-3 pt-2.5 pb-1 border-t border-white/5">
                    <span className="flex items-center gap-1.5 text-muted text-[12px]">
                      {myReactions.has(p.id) ? (
                        <>{(() => {
                          const total = reactionCounts.get(p.id) || 0
                          if (total === 1) return <>You liked this</>
                          if (total === 2) return <>You and <strong className="text-cream">1</strong> other</>
                          return <>You and <strong className="text-cream">{total - 1}</strong> others</>
                        })()}</>
                      ) : (
                        <><strong className="text-cream">{reactionCounts.get(p.id) || 0}</strong> {reactionCounts.get(p.id) === 1 ? "reaction" : "reactions"}</>
                      )}
                    </span>
                    {(commentCounts.get(p.id) || 0) > 0 && (
                      <span className="text-muted text-[12px]">
                        {commentCounts.get(p.id)} {commentCounts.get(p.id) === 1 ? "comment" : "comments"}
                      </span>
                    )}
                  </div>
                )}

                {/* Engagement bar */}
                <div className="flex items-center justify-between px-2 py-1.5 border-t border-white/5">
                  <button
                    onClick={() => toggleLike(p.id, p._source)}
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
                    onClick={() => { tap("light"); setCommentsFor({ id: p.id, source: p._source }) }}
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
                <div className="mb-2 rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
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
        {!loading && !hasMore && posts.length > 0 && (
          <p className="text-center text-subtle text-[12px] py-6">
            You're all caught up ✨
          </p>
        )}
        <div ref={sentinelRef} data-sentinel style={{ height: 1 }} />
      </div>

      {commentsFor && (
        <PostCommentsSheet
          postId={commentsFor.id}
          source={commentsFor.source}
          onClose={() => setCommentsFor(null)}
          onCountChange={(n) => {
            setCommentCounts((prev) => {
              const next = new Map(prev)
              next.set(commentsFor.id, n)
              return next
            })
          }}
        />
      )}

      {/* Composer chooser sheet */}
      {composerChooserOpen && (
        <div className="fixed inset-0 z-[210] flex items-end" onClick={() => setComposerChooserOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <h3 className="text-cream font-extrabold text-[16px] mb-1">Share something real</h3>
            <p className="text-muted text-[12.5px] mb-3">What would you like to create?</p>

            <button
              onClick={() => { tap("light"); setComposerChooserOpen(false); setPostComposerOpen(true) }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left active:scale-[0.99] transition-transform"
            >
              <span className="w-11 h-11 rounded-2xl grid place-items-center" style={{ background: "linear-gradient(135deg, #C084FC 0%, #EC4899 100%)" }}>
                <PenSquare size={20} color="#fff" />
              </span>
              <div className="flex-1">
                <p className="text-cream font-bold text-[14.5px]">Write a post</p>
                <p className="text-muted text-[12px]">Text + photo to your profile or matches</p>
              </div>
            </button>

            <button
              onClick={() => { tap("light"); setComposerChooserOpen(false); nav("/reels") }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left active:scale-[0.99] transition-transform"
            >
              <span className="w-11 h-11 rounded-2xl grid place-items-center" style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}>
                <Video size={20} color="#fff" />
              </span>
              <div className="flex-1">
                <p className="text-cream font-bold text-[14.5px]">Create a reel</p>
                <p className="text-muted text-[12px]">Record or upload a short video</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Full-screen post composer */}
      {postComposerOpen && (
        <PostComposer
          onClose={() => setPostComposerOpen(false)}
          onDone={() => { setPostComposerOpen(false); load() }}
        />
      )}

      {actionsFor && (
        <PostActionsSheet
          post={actionsFor}
          onClose={() => setActionsFor(null)}
          onDeleted={(id) => setPosts((arr) => arr.filter((x) => x.id !== id || x._source !== actionsFor._source))}
          onUpdated={(next) => setPosts((arr) => arr.map((x) => (x.id === next.id && x._source === actionsFor._source) ? { ...x, ...next } : x))}
        />
      )}

      <BottomNav />
    </div>
  )
}
