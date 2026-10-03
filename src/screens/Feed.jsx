import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ImagePlus, Heart, Send, X, Users, Play, Camera, PenSquare, Video, Image as ImageIcon, MessageCircle, Share2 , MoreVertical , Volume2 , VolumeX } from "lucide-react"
import VerifiedBadge from "../components/VerifiedBadge"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import { mixFeed } from "../lib/mixFeed"

// ─── Ranking signals ──────────────────────────────────────
// Fetch my interaction history with post authors (last 90 days)
// + my reel vs post affinity, so mixFeed can personalize ranking.
async function fetchRankingSignals(myId) {
  if (!myId) return { interactions: new Map(), reelAffinity: 1 }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // 1. My recent likes + comments on posts (need post_id, will resolve authors later)
  const [postLikes, postComments, reelsLiked] = await Promise.all([
    supabase.from("user_post_likes").select("post_id, created_at").eq("user_id", myId).gt("created_at", ninetyDaysAgo).limit(500),
    supabase.from("user_post_comments").select("post_id, created_at").eq("user_id", myId).gt("created_at", ninetyDaysAgo).limit(500),
    supabase.from("reel_likes").select("reel_id, created_at").eq("user_id", myId).gt("created_at", ninetyDaysAgo).limit(500),
  ])

  const postIds = [...new Set([
    ...(postLikes.data || []).map((r) => r.post_id),
    ...(postComments.data || []).map((r) => r.post_id),
  ])].filter(Boolean)

  // 2. Resolve post authors
  const authorCounts = new Map()
  if (postIds.length > 0) {
    const { data: personal } = await supabase
      .from("user_posts")
      .select("id, user_id")
      .in("id", postIds)
    const { data: community } = await supabase
      .from("community_posts")
      .select("id, author_id")
      .in("id", postIds)

    const idToAuthor = new Map()
    ;(personal || []).forEach((r) => idToAuthor.set(r.id, r.user_id))
    ;(community || []).forEach((r) => idToAuthor.set(r.id, r.author_id))

    // Increment per-author counts
    const addAuthor = (pid) => {
      const a = idToAuthor.get(pid)
      if (!a) return
      authorCounts.set(a, (authorCounts.get(a) || 0) + 1)
    }
    ;(postLikes.data || []).forEach((r) => addAuthor(r.post_id))
    ;(postComments.data || []).forEach((r) => addAuthor(r.post_id))
  }

  // 3. Content affinity — reel ratio
  const reelN = (reelsLiked.data || []).length
  const postN = (postLikes.data || []).length + (postComments.data || []).length
  const total = reelN + postN
  // affinity is a number between 0.7 (strongly post-preferring) and 1.4 (strongly reel-preferring)
  const reelAffinity = total < 5 ? 1 : Math.max(0.7, Math.min(1.4, 1 + (reelN - postN) / (total * 1.5)))

  return {
    interactions: authorCounts,
    reelAffinity,
  }
}
import BottomNav from "../components/BottomNav"
import NotificationBell from "../components/NotificationBell"
import AppHeader from "../components/AppHeader"
import StoriesRow from "../components/StoriesRow"
import SuggestedPeople from "../components/SuggestedPeople"
import PostImages from "../components/PostImages"
import ExpandableText from "../components/ExpandableText"
import PostLikesModal from "../components/PostLikesModal"
import PostCommentsPreview from "../components/PostCommentsPreview"
import MatchModal from "../components/MatchModal"
import PostCommentsSheet from "../components/PostCommentsSheet"
import PostActionsSheet from "../components/PostActionsSheet"
import FollowButton from "../components/FollowButton"
import PostComposer from "../components/PostComposer"
import BrandGlow from "../components/BrandGlow"

export default function Feed() {
  const nav = useNavigate()
  const { session, profile } = useAuth()
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
  const [matchModal, setMatchModal] = useState(null)
  const [likesModalFor, setLikesModalFor] = useState(null)
  const [commentsModalFor, setCommentsModalFor] = useState(null)
  const [feedMuted, setFeedMuted] = useState(true)
  const [composerChooserOpen, setComposerChooserOpen] = useState(false)
  const [postComposerOpen, setPostComposerOpen] = useState(false)
  const [pendingPosts, setPendingPosts] = useState([])
  function addPendingPost(item) { setPendingPosts((c) => [...c, item]) }
  function resolvePendingPost(tempId, realPost) {
    setPendingPosts((c) => c.filter((x) => x._tempId !== tempId))
    if (realPost) setPosts((c) => [realPost, ...c])
  }
  function failPendingPost(tempId, error) {
    setPendingPosts((c) => c.map((x) => x._tempId === tempId ? { ...x, _status: 'failed', _error: error } : x))
  }
  const [myPhotoUrl, setMyPhotoUrl] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const scrollRef = useRef(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)
  const sentinelRef = useRef(null)
  const loadingMoreRef = useRef(false)
  const seenReelIds = useRef(new Set())

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
        .select("id, community_id, author_id, content, image_path, image_paths, created_at, pinned_until")
        .in("community_id", myCommIds)
        .order("created_at", { ascending: false })
        .limit(20)
      if (pErr) { setError(pErr.message); setLoading(false); return }
      communityPosts = (rows || []).map((r) => ({ ...r, _source: "community" }))
    }

    // 3b. Personal posts (from me + matches + people I follow)
    const [matchRes, followRes] = await Promise.all([
      supabase.from("matches").select("user_one_id, user_two_id").or("user_one_id.eq." + myId + ",user_two_id.eq." + myId),
      supabase.from("follows").select("following_id").eq("follower_id", myId),
    ])
    const matchIds = (matchRes.data || []).map((m) => m.user_one_id === myId ? m.user_two_id : m.user_one_id)
    const followIds = (followRes.data || []).map((f) => f.following_id)
    const allowedUserIds = [...new Set([myId, ...matchIds, ...followIds])]

    const { data: personalRows } = await supabase
      .from("user_posts")
      .select("id, user_id, content, image_path, image_paths, audience, created_at")
      .in("user_id", allowedUserIds)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20)
    const personalPosts = (personalRows || []).map((r) => ({
      ...r,
      author_id: r.user_id,
      _source: "personal",
    }))

    // 3c. Reels (public only, from anyone)
    const { data: reelRows } = await supabase
      .from("reels")
      .select("id, user_id, video_url, thumbnail_url, caption, mirrored, cover_frame_time, created_at")
      .eq("is_active", true)
      .eq("audience", "public")
      .order("created_at", { ascending: false })
      .limit(4)
    const reelItems = (reelRows || []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      author_id: r.user_id,
      content: r.caption,
      video_url: r.video_url,
      thumbnail_url: r.thumbnail_url,
      mirrored: r.mirrored,
      cover_frame_time: r.cover_frame_time,
      created_at: r.created_at,
      _source: "reel",
    }))


    // Listings (public, active)
    const { data: lmListingsLoad } = await supabase
      .from("listings")
      .select("id, seller_id, title, description, price, currency, category, location, image_paths, created_at")
      .eq("status", "active")
      
      .order("created_at", { ascending: false })
      .limit(10)
    const listingItems = (lmListingsLoad || []).map((r) => ({
      id: r.id,
      user_id: r.seller_id,
      author_id: r.seller_id,
      title: r.title,
      content: r.description,
      price: r.price,
      currency: r.currency,
      location: r.location,
      image_paths: r.image_paths,
      created_at: r.created_at,
      _source: "listing",
    }))

    // Services (active)
    const { data: svcRows_lmListingsLoad } = await supabase
      .from("services")
      .select("id, provider_id, title, description, price, currency, category, duration_minutes, location, image_paths, created_at")
      .eq("status", "active")
      
      .order("created_at", { ascending: false })
      .limit(10)
    const serviceItems = (svcRows_lmListingsLoad || []).map((r) => ({
      id: r.id,
      user_id: r.provider_id,
      author_id: r.provider_id,
      title: r.title,
      content: r.description,
      price: r.price,
      currency: r.currency,
      duration_minutes: r.duration_minutes,
      location: r.location,
      image_paths: r.image_paths,
      created_at: r.created_at,
      _source: "service",
    }))

    // 3d. Load my hidden post IDs and filter them out
    const { data: hideRows } = await supabase
      .from("post_hides")
      .select("post_id, post_type")
      .eq("user_id", myId)
    const hiddenKeys = new Set((hideRows || []).map((h) => h.post_type + ":" + h.post_id))

    // Snoozed users — filter their posts from feed
    const { data: snoozeRows } = await supabase
      .from("post_snoozes")
      .select("snoozed_user_id")
      .eq("user_id", myId)
      .gt("until_at", new Date().toISOString())
    const snoozedIds = new Set((snoozeRows || []).map((s) => s.snoozed_user_id))

    // 3e. Sort posts and reels separately
    const postsSorted = [...communityPosts, ...personalPosts, ...listingItems, ...serviceItems]
      .filter((r) => !hiddenKeys.has((r._source || "community") + ":" + r.id))
      .filter((r) => !snoozedIds.has(r.author_id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const reelsSorted = reelItems
      .filter((r) => !hiddenKeys.has("reel:" + r.id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    // 3e-bis. Fetch engagement counts for ranking
    const commIdsRank = postsSorted.filter((r) => r._source === "community").map((r) => r.id)
    const personalIdsRank = postsSorted.filter((r) => r._source === "personal").map((r) => r.id)
    const likeMap = new Map()
    const cmtMap = new Map()
    if (commIdsRank.length > 0) {
      const [a, b] = await Promise.all([
        supabase.from("community_post_reactions").select("post_id").in("post_id", commIdsRank),
        supabase.from("community_post_comments").select("post_id").in("post_id", commIdsRank),
      ])
      ;(a.data || []).forEach((r) => likeMap.set(r.post_id, (likeMap.get(r.post_id) || 0) + 1))
      ;(b.data || []).forEach((c) => cmtMap.set(c.post_id, (cmtMap.get(c.post_id) || 0) + 1))
    }
    if (personalIdsRank.length > 0) {
      const [a, b] = await Promise.all([
        supabase.from("user_post_likes").select("post_id").in("post_id", personalIdsRank),
        supabase.from("user_post_comments").select("post_id").in("post_id", personalIdsRank),
      ])
      ;(a.data || []).forEach((r) => likeMap.set(r.post_id, (likeMap.get(r.post_id) || 0) + 1))
      ;(b.data || []).forEach((c) => cmtMap.set(c.post_id, (cmtMap.get(c.post_id) || 0) + 1))
    }
    const enrichedPosts = postsSorted.map((p) => ({
      ...p,
      _likeCount: likeMap.get(p.id) || 0,
      _commentCount: cmtMap.get(p.id) || 0,
    }))
    const enrichedReels = reelsSorted.map((r) => ({
      ...r,
      _likeCount: 0,
      _commentCount: 0,
    }))

    // 3f. Mix — ranked
    seenReelIds.current = new Set()
    const rankingSignals = await fetchRankingSignals(myId)
    const scoreContextLoad = {
      myId,
      matchIds: new Set(matchIds),
      followIds: new Set(followIds),
      interactions: rankingSignals.interactions,
      reelAffinity: rankingSignals.reelAffinity,
    }
    const list = mixFeed({
      posts: enrichedPosts,
      reels: enrichedReels,
      pageSize: 20,
      reelEvery: 10,
      seenReelIds: seenReelIds.current,
      scoreContext: scoreContextLoad,
    })

    setPosts(list)
    // hasMore stays true as long as we got something —
    // loadMore() will set it false when there's truly nothing left
    setHasMore(list.length > 0)
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
        const k = "community:" + r.post_id
        counts.set(k, (counts.get(k) || 0) + 1)
        if (r.user_id === myId) myLikedIds.add(k)
      })

      const { data: commentRows } = await supabase
        .from("community_post_comments")
        .select("post_id")
        .in("post_id", communityIds)
      ;(commentRows || []).forEach((c) => {
        const k = "community:" + c.post_id
        cc.set(k, (cc.get(k) || 0) + 1)
      })
    }

    if (personalIds.length > 0) {
      const { data: reactRows } = await supabase
        .from("user_post_likes")
        .select("post_id, user_id")
        .in("post_id", personalIds)
      ;(reactRows || []).forEach((r) => {
        const k = "personal:" + r.post_id
        counts.set(k, (counts.get(k) || 0) + 1)
        if (r.user_id === myId) myLikedIds.add(k)
      })

      const { data: commentRows } = await supabase
        .from("user_post_comments")
        .select("post_id")
        .in("post_id", personalIds)
      ;(commentRows || []).forEach((c) => {
        const k = "personal:" + c.post_id
        cc.set(k, (cc.get(k) || 0) + 1)
      })
    }

    // Reel likes — separate table, composite key
    const reelIds = list.filter((r) => r._source === "reel").map((r) => r.id)
    if (reelIds.length > 0) {
      const { data: reactRows } = await supabase
        .from("reel_likes")
        .select("reel_id, user_id")
        .in("reel_id", reelIds)
      ;(reactRows || []).forEach((r) => {
        const k = "reel:" + r.reel_id
        counts.set(k, (counts.get(k) || 0) + 1)
        if (r.user_id === myId) myLikedIds.add(k)
      })
    }

    setMyReactions(myLikedIds)
    setReactionCounts(counts)
    setCommentCounts(cc)

    setLoading(false)
  }, [myId])

  // ---- Infinite scroll: fetch next page ----
  const loadMore = useCallback(async () => {
    if (!myId || loadingMoreRef.current || !hasMore || !cursor) return
    loadingMoreRef.current = true
    setLoadingMore(true)

    const myCommIds = [...communities.keys()]

    // --- Community posts (older than cursor) ---
    let communityPosts = []
    if (myCommIds.length > 0) {
      const { data: rows } = await supabase
        .from("community_posts")
        .select("id, community_id, author_id, content, image_path, image_paths, created_at, pinned_until")
        .in("community_id", myCommIds)
        .lt("created_at", cursor)
        .order("created_at", { ascending: false })
        .limit(20)
      communityPosts = (rows || []).map((r) => ({ ...r, _source: "community" }))
    }

    // --- Personal posts from me + matches + follows ---
    const [matchRes, followRes] = await Promise.all([
      supabase.from("matches").select("user_one_id, user_two_id").or("user_one_id.eq." + myId + ",user_two_id.eq." + myId),
      supabase.from("follows").select("following_id").eq("follower_id", myId),
    ])
    const matchIds = (matchRes.data || []).map((m) => m.user_one_id === myId ? m.user_two_id : m.user_one_id)
    const followIds = (followRes.data || []).map((f) => f.following_id)
    const allowedUserIds = [...new Set([myId, ...matchIds, ...followIds])]

    const { data: personalRows } = await supabase
      .from("user_posts")
      .select("id, user_id, content, image_path, image_paths, audience, created_at")
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

    // --- Reels older than cursor ---
    const { data: reelRows } = await supabase
      .from("reels")
      .select("id, user_id, video_url, thumbnail_url, caption, mirrored, cover_frame_time, created_at")
      .eq("is_active", true)
      .eq("audience", "public")
      .lt("created_at", cursor)
      .order("created_at", { ascending: false })
      .limit(4)
    const reelItems = (reelRows || []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      author_id: r.user_id,
      content: r.caption,
      video_url: r.video_url,
      thumbnail_url: r.thumbnail_url,
      mirrored: r.mirrored,
      cover_frame_time: r.cover_frame_time,
      created_at: r.created_at,
      _source: "reel",
    }))


    // Listings (public, active)
    const { data: lmListingsMore } = await supabase
      .from("listings")
      .select("id, seller_id, title, description, price, currency, category, location, image_paths, created_at")
      .eq("status", "active")
      .lt("created_at", cursor)
      .order("created_at", { ascending: false })
      .limit(6)
    const listingItems = (lmListingsMore || []).map((r) => ({
      id: r.id,
      user_id: r.seller_id,
      author_id: r.seller_id,
      title: r.title,
      content: r.description,
      price: r.price,
      currency: r.currency,
      location: r.location,
      image_paths: r.image_paths,
      created_at: r.created_at,
      _source: "listing",
    }))

    // Services (active)
    const { data: svcRows_lmListingsMore } = await supabase
      .from("services")
      .select("id, provider_id, title, description, price, currency, category, duration_minutes, location, image_paths, created_at")
      .eq("status", "active")
      .lt("created_at", cursor)
      .order("created_at", { ascending: false })
      .limit(6)
    const serviceItems = (svcRows_lmListingsMore || []).map((r) => ({
      id: r.id,
      user_id: r.provider_id,
      author_id: r.provider_id,
      title: r.title,
      content: r.description,
      price: r.price,
      currency: r.currency,
      duration_minutes: r.duration_minutes,
      location: r.location,
      image_paths: r.image_paths,
      created_at: r.created_at,
      _source: "service",
    }))

    // --- Load hidden IDs, filter, merge, take newest 12 ---
    const { data: hideRows } = await supabase
      .from("post_hides")
      .select("post_id, post_type")
      .eq("user_id", myId)
    const hiddenKeys = new Set((hideRows || []).map((h) => h.post_type + ":" + h.post_id))

    const postsSorted = [...communityPosts, ...personalPosts, ...listingItems, ...serviceItems]
      .filter((r) => !hiddenKeys.has((r._source || "community") + ":" + r.id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const reelsSorted = reelItems
      .filter((r) => !hiddenKeys.has("reel:" + r.id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    // Engagement for ranking
    const commIdsRank = postsSorted.filter((r) => r._source === "community").map((r) => r.id)
    const personalIdsRank = postsSorted.filter((r) => r._source === "personal").map((r) => r.id)
    const likeMap = new Map()
    const cmtMap = new Map()
    if (commIdsRank.length > 0) {
      const [a, b] = await Promise.all([
        supabase.from("community_post_reactions").select("post_id").in("post_id", commIdsRank),
        supabase.from("community_post_comments").select("post_id").in("post_id", commIdsRank),
      ])
      ;(a.data || []).forEach((r) => likeMap.set(r.post_id, (likeMap.get(r.post_id) || 0) + 1))
      ;(b.data || []).forEach((c) => cmtMap.set(c.post_id, (cmtMap.get(c.post_id) || 0) + 1))
    }
    if (personalIdsRank.length > 0) {
      const [a, b] = await Promise.all([
        supabase.from("user_post_likes").select("post_id").in("post_id", personalIdsRank),
        supabase.from("user_post_comments").select("post_id").in("post_id", personalIdsRank),
      ])
      ;(a.data || []).forEach((r) => likeMap.set(r.post_id, (likeMap.get(r.post_id) || 0) + 1))
      ;(b.data || []).forEach((c) => cmtMap.set(c.post_id, (cmtMap.get(c.post_id) || 0) + 1))
    }
    const enrichedPosts = postsSorted.map((p) => ({
      ...p,
      _likeCount: likeMap.get(p.id) || 0,
      _commentCount: cmtMap.get(p.id) || 0,
    }))
    const enrichedReels = reelsSorted.map((r) => ({ ...r, _likeCount: 0, _commentCount: 0 }))

    const rankingSignalsLM = await fetchRankingSignals(myId)
    const scoreContextLM = {
      myId,
      matchIds: new Set(matchIds),
      followIds: new Set(followIds),
      interactions: rankingSignalsLM.interactions,
      reelAffinity: rankingSignalsLM.reelAffinity,
    }
    const merged = mixFeed({
      posts: enrichedPosts,
      reels: enrichedReels,
      pageSize: 20,
      reelEvery: 10,
      seenReelIds: seenReelIds.current,
      scoreContext: scoreContextLM,
    })

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
      const freshReactions = new Map()
      const freshMyReactions = new Set()
      ;(reactRows || []).forEach((r) => {
        const k = "community:" + r.post_id
        freshReactions.set(k, (freshReactions.get(k) || 0) + 1)
        if (r.user_id === myId) freshMyReactions.add(k)
      })
      setMyReactions((prev) => new Set([...prev, ...freshMyReactions]))
      setReactionCounts((prev) => {
        const next = new Map(prev)
        freshReactions.forEach((c, k) => next.set(k, c))
        return next
      })

      const { data: commentRows } = await supabase
        .from("community_post_comments")
        .select("post_id")
        .in("post_id", communityIds)
      const freshComments = new Map()
      ;(commentRows || []).forEach((c) => {
        const k = "community:" + c.post_id
        freshComments.set(k, (freshComments.get(k) || 0) + 1)
      })
      setCommentCounts((prev) => {
        const next = new Map(prev)
        freshComments.forEach((c, k) => next.set(k, c))
        return next
      })
    }

    if (personalIds.length > 0) {
      const { data: reactRows } = await supabase
        .from("user_post_likes")
        .select("post_id, user_id")
        .in("post_id", personalIds)
      const freshReactions = new Map()
      const freshMyReactions = new Set()
      ;(reactRows || []).forEach((r) => {
        const k = "personal:" + r.post_id
        freshReactions.set(k, (freshReactions.get(k) || 0) + 1)
        if (r.user_id === myId) freshMyReactions.add(k)
      })
      setMyReactions((prev) => new Set([...prev, ...freshMyReactions]))
      setReactionCounts((prev) => {
        const next = new Map(prev)
        freshReactions.forEach((c, k) => next.set(k, c))
        return next
      })

      const { data: commentRows } = await supabase
        .from("user_post_comments")
        .select("post_id")
        .in("post_id", personalIds)
      const freshComments = new Map()
      ;(commentRows || []).forEach((c) => {
        const k = "personal:" + c.post_id
        freshComments.set(k, (freshComments.get(k) || 0) + 1)
      })
      setCommentCounts((prev) => {
        const next = new Map(prev)
        freshComments.forEach((c, k) => next.set(k, c))
        return next
      })
    }

    // Reel likes for this page
    const newReelIds = merged.filter((r) => r._source === "reel").map((r) => r.id)
    if (newReelIds.length > 0) {
      const { data: reactRows } = await supabase
        .from("reel_likes")
        .select("reel_id, user_id")
        .in("reel_id", newReelIds)
      const freshReactions = new Map()
      const freshMyReactions = new Set()
      ;(reactRows || []).forEach((r) => {
        const k = "reel:" + r.reel_id
        freshReactions.set(k, (freshReactions.get(k) || 0) + 1)
        if (r.user_id === myId) freshMyReactions.add(k)
      })
      setMyReactions((prev) => new Set([...prev, ...freshMyReactions]))
      setReactionCounts((prev) => {
        const next = new Map(prev)
        freshReactions.forEach((c, k) => next.set(k, c))
        return next
      })
    }

    // Dedup by _source + id before appending — prevents duplicates at page boundaries
    setPosts((prev) => {
      const existing = new Set(prev.map((x) => `${x._source}:${x.id}`))
      const incoming = merged.filter((x) => !existing.has(`${x._source}:${x.id}`))
      return [...prev, ...incoming]
    })

    // Strict cursor: the oldest item across BOTH sources (posts + reels), not just merged[last]
    const allFetched = [...postsSorted, ...reelsSorted]
    if (allFetched.length > 0) {
      const oldest = allFetched.reduce((min, r) => (r.created_at < min ? r.created_at : min), allFetched[0].created_at)
      setCursor(oldest)
    } else {
      setHasMore(false)
    }

    setHasMore(allFetched.length > 0)
    setLoadingMore(false)
    loadingMoreRef.current = false
  }, [myId, hasMore, cursor, communities])

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

  // Reel autoplay — play when 60% visible, pause when scrolled away
  useEffect(() => {
    const videos = document.querySelectorAll("[data-reel-video]")
    if (videos.length === 0) return

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = entry.target
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const p = v.play()
            if (p?.catch) p.catch(() => {})
          } else {
            try { v.pause() } catch {}
          }
        })
      },
      { threshold: [0, 0.6, 1] }
    )

    videos.forEach((v) => obs.observe(v))
    return () => obs.disconnect()
  }, [posts])

  // Sync mute state to all feed videos when toggled
  useEffect(() => {
    const videos = document.querySelectorAll("[data-reel-video]")
    videos.forEach((v) => { v.muted = feedMuted })
  }, [feedMuted, posts])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!myId) return
    const ch = supabase
      .channel("feed-realtime-" + myId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_posts" }, () => {
        if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current)
        realtimeDebounceRef.current = setTimeout(() => load(), 800)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [myId, load])

  async function toggleLike(postId, source = "community") {
    if (!myId) return
    tap("light")
    const key = source + ":" + postId
    const isLiked = myReactions.has(key)
    const nextMine = new Set(myReactions)
    const nextCounts = new Map(reactionCounts)

    const table = source === "personal" ? "user_post_likes"
                : source === "reel"     ? "reel_likes"
                : "community_post_reactions"
    const idCol = source === "reel" ? "reel_id" : "post_id"

    if (isLiked) {
      nextMine.delete(key)
      nextCounts.set(key, Math.max(0, (nextCounts.get(key) || 1) - 1))
      setMyReactions(nextMine); setReactionCounts(nextCounts)
      await supabase.from(table).delete().eq(idCol, postId).eq("user_id", myId)
    } else {
      nextMine.add(key)
      nextCounts.set(key, (nextCounts.get(key) || 0) + 1)
      setMyReactions(nextMine); setReactionCounts(nextCounts)
      const row = source === "personal"
        ? { post_id: postId, user_id: myId }
        : source === "reel"
          ? { reel_id: postId, user_id: myId }
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

  const PULL_THRESHOLD = 80

  function handleTouchStart(e) {
    const el = scrollRef.current
    if (!el || el.scrollTop > 0) return
    pullStartY.current = e.touches[0].clientY
    isPulling.current = true
  }

  function handleTouchMove(e) {
    if (!isPulling.current) return
    const dy = e.touches[0].clientY - pullStartY.current
    if (dy > 0) {
      // Dampen the pull distance
      setPullDistance(Math.min(dy * 0.5, 120))
    }
  }

  async function handleTouchEnd() {
    if (!isPulling.current) return
    isPulling.current = false
    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true)
      setPullDistance(60)
      try {
        await load()
      } catch {}
      setRefreshing(false)
    }
    setPullDistance(0)
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

      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto px-2 py-2 pb-24"
        style={{
          transform: `translateY(${Math.max(0, pullDistance - 20)}px)`,
          transition: pullDistance === 0 ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
        }}
      >
        {/* Pull-to-refresh indicator */}
        {(pullDistance > 0 || refreshing) && (
          <div
            className="flex items-center justify-center overflow-hidden"
            style={{
              height: Math.max(0, pullDistance - 20),
              transition: pullDistance === 0 ? "height 200ms" : "none",
            }}
          >
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent"
                style={{
                  animation: refreshing ? "spin 0.8s linear infinite" : "none",
                  transform: refreshing ? "none" : `rotate(${(pullDistance / PULL_THRESHOLD) * 360}deg)`,
                }}
              />
              <span className="text-purple-300 text-[10.5px] font-bold">
                {refreshing ? "Refreshing…" : pullDistance >= PULL_THRESHOLD ? "Release to refresh" : "Pull down"}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 text-red-400 text-[12.5px] bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {!loading && (
          <>
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

            {/* Stories row */}
            <div className="mb-3 -mx-3">
              <StoriesRow />
            </div>

          </>
        )}

        {loading ? (
          <div className="flex flex-col gap-2 pt-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-white/[0.03] border border-white/8 p-3">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-full shimmer" />
                  <div className="flex-1">
                    <div className="h-3 w-1/3 shimmer-sm mb-1.5" />
                    <div className="h-2.5 w-1/4 shimmer-sm" />
                  </div>
                </div>
                <div className="h-48 shimmer" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <EmptyFeed
            nav={nav}
            suggested={suggested}
            myId={myId}
          />
        ) : (
          <>
            {pendingPosts.map((pp) => (
              <article key={pp._tempId} className="mb-2 rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
                <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-bold text-[13.5px] truncate">{pp.displayName || "You"}</p>
                    <p className="text-subtle text-[11px]">{pp._status === "failed" ? "Upload failed" : "Uploading…"}</p>
                  </div>
                  {pp._status === "failed" ? (
                    <span className="px-2 h-7 rounded-full bg-red-500/20 border border-red-500/50 text-red-300 text-[11px] font-bold grid place-items-center">Failed</span>
                  ) : (
                    <span className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                  )}
                </div>
                {pp.content && <ExpandableText text={pp.content} className="px-3 pb-3 text-cream text-[14px] leading-[1.5] whitespace-pre-wrap" />}
                {pp.imagePreview && <img src={pp.imagePreview} alt="" className="w-full max-h-[60vh] object-cover" />}
                {pp._status === "failed" && (
                  <div className="px-3 py-2.5 border-t border-red-500/20 bg-red-500/5">
                    <p className="text-red-300 text-[12px] mb-2 truncate">{pp._error || "Upload failed"}</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPendingPosts((c) => c.filter((x) => x._tempId !== pp._tempId))} className="h-8 px-3 rounded-full bg-white/[0.06] border border-white/12 text-muted font-bold text-[11.5px]">Discard</button>
                      <button onClick={() => pp._retry?.()} className="h-8 px-3 rounded-full text-white font-bold text-[11.5px]" style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}>Retry</button>
                    </div>
                  </div>
                )}
              </article>
            ))}

            {posts.map((p, idx) => {
            // REELS render as video cards
            if (p._source === "reel") {
              const rProf = profiles.get(p.author_id)
              const rPhoto = photos.get(p.author_id)
              const rName = rProf?.display_name || rProf?.username || "Someone"
              return (
                <Fragment key={"reel-" + p.id}>
                  <article className="mb-2 rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
                    {/* Author header */}
                    <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
                      <button
                        onClick={() => { tap("light"); nav("/profile/" + p.author_id) }}
                        className="w-9 h-9 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0"
                      >
                        {rPhoto ? (
                          <img src={publicPhotoUrl(rPhoto)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-purple-400 font-black text-sm">{rName[0]}</div>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-cream font-bold text-[13.5px] truncate flex items-center gap-1">
                          {rName}
                          {rProf?.is_verified && <VerifiedBadge size={13} />}
                        </p>
                        <p className="text-subtle text-[11px]">
                          {new Date(p.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span
                        className="shrink-0 px-2 h-6 rounded-full flex items-center gap-1 text-[10.5px] font-black tracking-wider"
                        style={{ background: "rgba(236,72,153,0.2)", border: "1px solid rgba(236,72,153,0.5)", color: "#F9A8D4" }}
                      >
                        ▶ REEL
                      </span>
                    </div>

                    {/* Caption */}
                    {p.content && (
                      <ExpandableText text={p.content} className="px-3 pb-3 text-cream text-[14px] leading-[1.5] whitespace-pre-wrap" />
                    )}

                    {/* Video / thumbnail — tap opens Reels player */}
                    <div className="relative">
                      <button
                        onClick={() => { tap("light"); nav("/reels") }}
                        className="relative w-full block bg-black"
                        style={{ aspectRatio: "9 / 16", maxHeight: "72vh" }}
                      >
                        {p.video_url ? (
                          <>
                            <div
                              className="absolute inset-0"
                              style={{
                                background: "linear-gradient(160deg, #2A1B4A 0%, #4C1D95 40%, #831843 100%)",
                              }}
                            />
                            <video
                              data-reel-video="true"
                              src={p.video_url}
                              poster={p.thumbnail_url || undefined}
                              muted={feedMuted}
                              loop
                              playsInline
                              preload="metadata"
                              className="absolute inset-0 w-full h-full object-cover"
                              style={{ transform: p.mirrored ? "scaleX(-1)" : "none" }}
                            />
                          </>
                        ) : p.thumbnail_url ? (
                          <img
                            src={p.thumbnail_url}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{ transform: p.mirrored ? "scaleX(-1)" : "none" }}
                          />
                        ) : (
                          <div
                            className="absolute inset-0 grid place-items-center p-6 text-center"
                            style={{ background: "linear-gradient(160deg, #2A1B4A 0%, #4C1D95 40%, #831843 100%)" }}
                          >
                            <p className="text-white/85 text-[15px] font-semibold leading-tight line-clamp-4" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}>
                              {p.content || "Watch this reel"}
                            </p>
                          </div>
                        )}
                      </button>

                      {/* Sound toggle — only when there's a video */}
                      {p.video_url && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); tap("light"); setFeedMuted((m) => !m) }}
                          className="absolute top-2.5 right-2.5 z-10 w-9 h-9 rounded-full grid place-items-center"
                          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}
                          aria-label={feedMuted ? "Unmute" : "Mute"}
                        >
                          {feedMuted
                            ? <VolumeX size={16} className="text-white" />
                            : <Volume2 size={16} className="text-white" />}
                        </button>
                      )}

                      {/* Caption overlay — bottom gradient with the reel caption */}
                      {p.content && (
                        <div
                          className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 pt-10 pointer-events-none"
                          style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.72))" }}
                        >
                          <p className="text-white text-[12.5px] font-medium leading-snug line-clamp-2"
                             style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
                            {p.content}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <button
                      onClick={() => { tap("light"); nav("/reels") }}
                      className="w-full flex items-center justify-between px-3 py-2.5 border-t border-white/5"
                    >
                      <span className="text-purple-300 text-[12.5px] font-bold">Watch reel →</span>
                      <span className="text-muted text-[11.5px]">Tap to open</span>
                    </button>
                  </article>

                  {((idx + 1) % 4 === 0 || (idx === posts.length - 1 && posts.length < 4)) && suggested.length > 0 && (
                    <SuggestedPeople people={suggested} onMatch={setMatchModal} />
                  )}
                </Fragment>
              )
            }

            // LISTING render
            if (p._source === "listing") {
              const img = p.image_paths?.[0]
                ? supabase.storage.from("listing-media").getPublicUrl(p.image_paths[0]).data?.publicUrl
                : null
              return (
                <Fragment key={"listing-" + p.id}>
                  <article className="mb-2 rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/[0.02]">
                      <span className="w-6 h-6 rounded-lg grid place-items-center text-[12px]" style={{ background: "rgba(236,72,153,0.2)" }}>🛒</span>
                      <span className="text-pink-300 text-[11.5px] font-bold tracking-wide">Marketplace</span>
                    </div>
                    <button onClick={() => { tap("light"); nav("/marketplace/" + p.id) }} className="w-full text-left active:opacity-90">
                      {img && <img src={img} alt="" className="w-full max-h-[420px] object-cover" />}
                      <div className="p-3">
                        <p className="text-cream font-bold text-[14.5px] mb-1">{p.title}</p>
                        <p className="text-cream font-black text-[15px]">
                          {p.price ? `${p.price.toLocaleString()} ${p.currency || "BIF"}` : "Free"}
                        </p>
                        {p.location && <p className="text-subtle text-[11.5px] mt-1">📍 {p.location}</p>}
                      </div>
                    </button>
                  </article>
                </Fragment>
              )
            }

            // SERVICE render
            if (p._source === "service") {
              const img = p.image_paths?.[0]
                ? supabase.storage.from("service-media").getPublicUrl(p.image_paths[0]).data?.publicUrl
                : null
              return (
                <Fragment key={"service-" + p.id}>
                  <article className="mb-2 rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/[0.02]">
                      <span className="w-6 h-6 rounded-lg grid place-items-center text-[12px]" style={{ background: "rgba(168,85,247,0.2)" }}>🔧</span>
                      <span className="text-purple-300 text-[11.5px] font-bold tracking-wide">Service</span>
                    </div>
                    <button onClick={() => { tap("light"); nav("/services/" + p.id) }} className="w-full text-left active:opacity-90">
                      {img && <img src={img} alt="" className="w-full max-h-[420px] object-cover" />}
                      <div className="p-3">
                        <p className="text-cream font-bold text-[14.5px] mb-1">{p.title}</p>
                        <p className="text-cream font-black text-[15px]">
                          {p.price ? `${p.price.toLocaleString()} ${p.currency || "BIF"}` : "Free"}
                        </p>
                        <p className="text-subtle text-[11.5px] mt-1">
                          {p.duration_minutes} min{p.location ? ` · 📍 ${p.location}` : ""}
                        </p>
                      </div>
                    </button>
                  </article>
                </Fragment>
              )
            }

            // Regular post render
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
                  {p.author_id !== myId && (
                    <FollowButton userId={p.author_id} size="sm" />
                  )}
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
                  <ExpandableText text={p.content} className="px-3 pb-3 text-cream text-[14px] leading-[1.5] whitespace-pre-wrap" />
                )}

                {(() => {
                  const paths = Array.isArray(p.image_paths) && p.image_paths.length > 0
                    ? p.image_paths
                    : (p.image_path ? [p.image_path] : [])
                  if (paths.length === 0) return null
                  return (
                    <PostImages
                      paths={paths}
                      bucket="community-media"
                      onDoubleTap={() => toggleLike(p.id, p._source)}
                      onPostOpen={() => { tap("light"); nav("/post/" + p._source + "/" + p.id) }}
                    />
                  )
                })()}

                {/* Engagement summary */}
                {((reactionCounts.get(p._source + ":" + p.id) || 0) > 0 || (commentCounts.get(p._source + ":" + p.id) || 0) > 0) && (
                  <div className="flex items-center justify-between px-3 pt-2.5 pb-1 border-t border-white/5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); tap("light"); setLikesModalFor({ postId: p.id, source: p._source }) }}
                      className="flex items-center gap-1.5 text-muted text-[12px] active:opacity-70"
                    >
                      {myReactions.has(p._source + ":" + p.id) ? (
                        <>{(() => {
                          const total = reactionCounts.get(p._source + ":" + p.id) || 0
                          if (total === 1) return <>You liked this</>
                          if (total === 2) return <>You and <strong className="text-cream">1</strong> other</>
                          return <>You and <strong className="text-cream">{total - 1}</strong> others</>
                        })()}</>
                      ) : (
                        <><strong className="text-cream">{reactionCounts.get(p._source + ":" + p.id) || 0}</strong> {reactionCounts.get(p._source + ":" + p.id) === 1 ? "reaction" : "reactions"}</>
                      )}
                    </button>
                    {(commentCounts.get(p._source + ":" + p.id) || 0) > 0 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); tap("light"); setCommentsModalFor({ postId: p.id, source: p._source }) }}
                        className="text-muted text-[12px] active:opacity-70"
                      >
                        {commentCounts.get(p._source + ":" + p.id)} {commentCounts.get(p._source + ":" + p.id) === 1 ? "comment" : "comments"}
                      </button>
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
                      color={myReactions.has(p._source + ":" + p.id) ? "#EC4899" : "#888"}
                      fill={myReactions.has(p._source + ":" + p.id) ? "#EC4899" : "none"}
                    />
                    <span className="text-[12.5px] font-bold" style={{ color: myReactions.has(p._source + ":" + p.id) ? "#EC4899" : "#888" }}>
                      {reactionCounts.get(p._source + ":" + p.id) || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => { tap("light"); setCommentsFor({ id: p.id, source: p._source }) }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl flex-1 justify-center"
                  >
                    <MessageCircle size={18} strokeWidth={2.2} color="#888" />
                    <span className="text-muted text-[12.5px] font-bold">{commentCounts.get(p._source + ":" + p.id) || 0}</span>
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

              {((idx + 1) % 4 === 0 || (idx === posts.length - 1 && posts.length < 4)) && suggested.length > 0 && (
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
          })}
          </>
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
          key={commentsFor.source + ":" + commentsFor.id}
          postId={commentsFor.id}
          source={commentsFor.source}
          onClose={() => setCommentsFor(null)}
          onCountChange={(n) => {
            const key = commentsFor.source + ":" + commentsFor.id
            setCommentCounts((prev) => {
              if (prev.get(key) === n) return prev   // no-op if unchanged → breaks loop
              const next = new Map(prev)
              next.set(key, n)
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
          onOptimistic={addPendingPost}
          onResolve={(tempId) => { resolvePendingPost(tempId); load() }}
          onFail={failPendingPost}
          onRetryStart={(tempId) =>
            setPendingPosts((c) =>
              c.map((x) => x._tempId === tempId ? { ...x, _status: "uploading", _error: null } : x)
            )
          }
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

      {likesModalFor && (
        <PostLikesModal
          postId={likesModalFor.postId}
          source={likesModalFor.source}
          count={reactionCounts.get(likesModalFor.source + ":" + likesModalFor.postId) || 0}
          onClose={() => setLikesModalFor(null)}
        />
      )}

      {commentsModalFor && (
        <PostCommentsPreview
          key={commentsModalFor.source + ":" + commentsModalFor.postId}
          postId={commentsModalFor.postId}
          source={commentsModalFor.source}
          count={commentCounts.get(commentsModalFor.source + ":" + commentsModalFor.postId) || 0}
          onClose={() => setCommentsModalFor(null)}
          onOpenSheet={() => setCommentsFor({ id: commentsModalFor.postId, source: commentsModalFor.source })}
        />
      )}

      {matchModal && (
        <MatchModal
          me={profile}
          them={matchModal}
          onClose={() => setMatchModal(null)}
          onMessage={() => { setMatchModal(null); nav('/messages/' + matchModal.id) }}
        />
      )}

      <BottomNav />
    </div>
  )
}

function EmptyFeed({ nav, suggested, myId }) {
  const [listings, setListings] = useState([])
  const [services, setServices] = useState([])

  useEffect(() => {
    ;(async () => {
      const [ln, sv] = await Promise.all([
        supabase.from("listings").select("id, title, price, currency, image_paths").eq("status", "active").order("created_at", { ascending: false }).limit(4),
        supabase.from("services").select("id, title, price, currency, duration_minutes, image_paths").eq("status", "active").order("created_at", { ascending: false }).limit(4),
      ])
      setListings(ln.data || [])
      setServices(sv.data || [])
    })()
  }, [])

  return (
    <div className="px-3 py-5 pb-24">
      <p className="text-cream font-black text-[20px] mb-1">Welcome to Nakubonye</p>
      <p className="text-muted text-[13px] leading-relaxed mb-6">
        Follow people, join communities, and save listings to personalize your feed. Meanwhile, here's what's happening.
      </p>

      {suggested.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-cream font-bold text-[15px]">People to follow</p>
            <button onClick={() => nav("/discover")} className="text-purple-300 text-[12.5px] font-bold">See all</button>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {suggested.slice(0, 8).map((u) => (
              <button key={u.id} onClick={() => { tap("light"); nav("/profile/" + u.id) }}
                className="shrink-0 flex flex-col items-center gap-2 active:opacity-80"
                style={{ width: 88 }}>
                <div className="w-16 h-16 rounded-full overflow-hidden bg-purple-600 grid place-items-center border-2 border-purple-500/40">
                  {u.photo_url ? (
                    <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-xl font-black">{(u.display_name || "?")[0]}</span>
                  )}
                </div>
                <p className="text-cream text-[11.5px] font-semibold truncate w-full text-center">
                  {(u.display_name || u.username || "User").split(" ")[0]}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {trending.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-cream font-bold text-[15px]">🔥 {trendingLabel}</p>
            <button onClick={() => nav("/reels")} className="text-purple-300 text-[12.5px] font-bold">See all</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {trending.slice(0, 4).map((r) => (
              <button key={r.id} onClick={() => { tap("light"); nav("/reels") }}
                className="relative rounded-xl overflow-hidden aspect-[9/16] active:opacity-90">
                {r.thumbnail_url && <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover" />}
                <div className="absolute inset-x-0 bottom-0 px-2 pb-2 pt-6"
                     style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.8))" }}>
                  <p className="text-white text-[11px] font-bold line-clamp-2 text-left">{r.caption || "Reel"}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {listings.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-cream font-bold text-[15px]">🛒 Fresh listings</p>
            <button onClick={() => nav("/marketplace")} className="text-purple-300 text-[12.5px] font-bold">See all</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {listings.map((l) => {
              const img = l.image_paths?.[0] ? supabase.storage.from("listing-media").getPublicUrl(l.image_paths[0]).data?.publicUrl : null
              return (
                <button key={l.id} onClick={() => { tap("light"); nav("/marketplace/" + l.id) }}
                  className="rounded-xl overflow-hidden bg-white/[0.03] border border-white/8 text-left active:opacity-90">
                  <div className="aspect-square bg-black/40">
                    {img && <img src={img} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="p-2">
                    <p className="text-cream text-[12px] font-bold line-clamp-1">{l.title}</p>
                    <p className="text-cream font-black text-[12.5px]">
                      {l.price ? l.price.toLocaleString() + " " + (l.currency || "BIF") : "Free"}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {services.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-cream font-bold text-[15px]">🔧 Services near you</p>
            <button onClick={() => nav("/services")} className="text-purple-300 text-[12.5px] font-bold">See all</button>
          </div>
          <div className="flex flex-col gap-2">
            {services.map((s) => {
              const img = s.image_paths?.[0] ? supabase.storage.from("service-media").getPublicUrl(s.image_paths[0]).data?.publicUrl : null
              return (
                <button key={s.id} onClick={() => { tap("light"); nav("/services/" + s.id) }}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/8 text-left active:opacity-90">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/40 shrink-0">
                    {img && <img src={img} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-bold text-[13px] truncate">{s.title}</p>
                    <p className="text-muted text-[11.5px]">{s.duration_minutes} min</p>
                    <p className="text-cream font-black text-[13px]">
                      {s.price ? s.price.toLocaleString() + " " + (s.currency || "BIF") : "Free"}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <button
        onClick={() => { tap("light"); nav("/communities") }}
        className="w-full h-12 rounded-2xl text-white font-bold text-[14px] inline-flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}>
        Explore communities
      </button>
    </div>
  )
}
