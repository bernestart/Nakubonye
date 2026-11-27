import { getMediaUrl } from '../lib/api';
import { getRankedFeed, getCommunityPosts, toggleLikeAPI, API_BASE_URL } from '../lib/api';
import { AnimatePresence } from "framer-motion";
import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from "react-router-dom"
import { ImagePlus, Heart, Send, X, Users, Play, Camera, PenSquare, Video, Image as ImageIcon, MessageCircle, Share2 , MoreVertical , Volume2 , VolumeX } from "lucide-react"
import VerifiedBadge from "../components/VerifiedBadge"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import { mixFeed } from "../lib/mixFeed"
import { logImpression, logView, logDwell, logSkip } from "../lib/feedSignals"

// ─── Ranking signals ──────────────────────────────────────
// Fetch my interaction history with post authors (last 90 days)
// + my reel vs post affinity, so mixFeed can personalize ranking.
import BottomNav from "../components/BottomNav"
import NotificationBell from "../components/NotificationBell"
import AppHeader from "../components/AppHeader"
import StoriesRow from "../components/StoriesRow"
import SuggestedPeople from "../components/SuggestedPeople"
import PostImages from "../components/PostImages"
import ResharedPost from "../components/ResharedPost"
import Poll from "../components/Poll"
import ExpandableText from "../components/ExpandableText"
import PostLikesModal from "../components/PostLikesModal"
import PostCommentsPreview from "../components/PostCommentsPreview"
import MatchModal from "../components/MatchModal"
import { lazy, Suspense } from "react";
const PostCommentsSheet = lazy(() => import("../components/PostCommentsSheet"));
import PostActionsSheet from "../components/PostActionsSheet"
import ShareSheet from "../components/ShareSheet"
import RepostsSheet from "../components/RepostsSheet"
import ReactionPicker from "../components/ReactionPicker"
import FollowButton from "../components/FollowButton"
import PostComposer from "../components/PostComposer"
import BrandGlow from "../components/BrandGlow"
import NewPostsPill from "../components/NewPostsPill"
import PostFeedbackSheet from "../components/PostFeedbackSheet"

// Audience enforcement — mirrors Facebook/IG rules.
// public: everyone. matches: only my matches. circle: only members. private: only author.
function canSeePost(post, ctx) {
  const aud = post.audience || "public"
  if (aud === "public" || aud === "everyone") return true
  const authorId = post.author_id || post.user_id
  if (aud === "private") return authorId === ctx.myId
  if (aud === "matches") return authorId === ctx.myId || ctx.matchIds.has(authorId)
  if (typeof aud === "string" && aud.startsWith("circle:")) {
    if (authorId === ctx.myId) return true
    const cid = aud.slice(7)
    return ctx.myCircleIds.has(cid)
  }
  // Unknown audience → fail closed (hide)
  return false
}

export default function Feed() {
  const realtimeDebounceRef = useRef(null)
  const nav = useNavigate()
  const { session, profile } = useAuth()
  const myId = session?.user?.id
  const [posts, setPosts] = useState([])
  const [suggestedReels, setSuggestedReels] = useState([])
  const [mutedWordsSet, setMutedWordsSet] = useState(new Set())
  const [mutedUsersSet, setMutedUsersSet] = useState(new Set())
  const [communities, setCommunities] = useState(new Map())
  const [profiles, setProfiles] = useState(new Map())
  const [photos, setPhotos] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [myReactions, setMyReactions] = useState(new Set())
  const [reactionCounts, setReactionCounts] = useState(new Map())
  const [shareCounts, setShareCounts] = useState(new Map())
  const [signalScores, setSignalScores] = useState(new Map())
  const [authorSignals, setAuthorSignals] = useState(new Map())
  const [repostsFor, setRepostsFor] = useState(null)
  const [pickerFor, setPickerFor] = useState(null)
  const [myReactionTypes, setMyReactionTypes] = useState(new Map())
  const [reactionBreakdown, setReactionBreakdown] = useState(new Map())
  const [topReactors, setTopReactors] = useState(new Map())  // key → [{ name, emoji }]
  const [commentCounts, setCommentCounts] = useState(new Map())
  const [commentsFor, setCommentsFor] = useState(null)
  
  // --- FEED ALGORITHM TRACKING ---
  const observedPosts = useRef(new Set());
  const observerRef = useRef(null);

  useEffect(() => {
    if (!myId) return;
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          const postId = entry.target.getAttribute('data-post-id');
          if (postId && !observedPosts.current.has(postId)) {
            observedPosts.current.add(postId);
            try {
              await fetch(`${API_BASE_URL}/api/feed/impression`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: [{ post_id: postId, user_id: myId }] })
              }).catch(() => null)
            } catch (e) { console.warn("Impression track failed", e); }
          }
        }
      });
    }, { threshold: 0.5 });
    return () => observerRef.current?.disconnect();
  }, [myId, queryClient]);

  const observePost = (el) => {
    if (el) observerRef.current?.observe(el);
  };

  const trackClick = async (postId) => {
    if (!myId || !postId) return
    try {
      await fetch(`${API_BASE_URL}/api/feed/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [{ post_id: postId, user_id: myId }] })
      }).catch(() => null)
    } catch (e) { console.warn("Click track failed", e) }
  };
  // -------------------------------
  const [actionsFor, setActionsFor] = useState(null)
  const [feedbackFor, setFeedbackFor] = useState(null)
  const [shareFor, setShareFor] = useState(null)
  const [suggested, setSuggested] = useState([])
  const [matchModal, setMatchModal] = useState(null)
  const [likesModalFor, setLikesModalFor] = useState(null)
  const [commentsModalFor, setCommentsModalFor] = useState(null)
  const [feedMuted, setFeedMuted] = useState(true)
  const [composerChooserOpen, setComposerChooserOpen] = useState(false)
  const [postComposerOpen, setPostComposerOpen] = useState(false)
  const [pendingPosts, setPendingPosts] = useState([])
  const [pendingRealtimeCount, setPendingRealtimeCount] = useState(0)
  const [hiddenPostKeys, setHiddenPostKeys] = useState(new Set())
  function hidePost(key) { setHiddenPostKeys((prev) => { const n = new Set(prev); n.add(key); return n }) }
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

  const load = useCallback(async (opts = {}) => {
    if (!myId) return
    if (!opts?.silent) setLoading(true)
    setError("")
    try {
      const res = await queryClient.fetchQuery({
        queryKey: ['feed', myId],
        queryFn: () => fetch(`${API_BASE_URL}/api/feed/v2`).then(r => r.json()).catch(() => ({ success: false })),
        staleTime: 1000 * 60 * 5 // Cache for 5 minutes
      })
      if (!res || !res.success) { setError((res && res.error) || "Feed load failed"); setLoading(false); return }
      const d = res.data
      const matchIds = new Set(d.matchIds || [])
      const followIds = new Set(d.followIds || [])
      const myCircleIds = new Set(d.myCircleIds || [])
      const blockedIds = new Set(d.blockedIds || [])
      const mutedLocal = new Set(d.mutedIds || [])
      const mutedWordsLocal = new Set(d.mutedWords || [])
      const hiddenKeys = new Set(d.hiddenKeys || [])
      const snoozedIds = new Set(d.snoozedIds || [])
      setMutedUsersSet(mutedLocal)
      setMutedWordsSet(mutedWordsLocal)
      setCommunities(new Map((d.communities || []).map(c => [c.id, c])))
      const communityPosts = (d.sources?.community || []).map(r => ({ ...r, _source: "community" }))
      const personalPosts = (d.sources?.personal || []).map(r => ({ ...r, _source: "personal", author_id: r.author_id || r.user_id }))
      const reelItems = (d.sources?.reels || []).map(r => ({ ...r, _source: "reel" }))
      const listingItems = d.sources?.listings || []
      const serviceItems = d.sources?.services || []
      setSuggestedReels(d.suggestedReels || [])
      setSuggested((d.pymk || []).slice(0, 10).map(r => ({
        id: r.id, display_name: r.display_name, username: r.username,
        photo_url: publicPhotoUrl(r.primary_photo),
      })))
      const filteredPosts = [...communityPosts, ...personalPosts, ...listingItems, ...serviceItems]
        .filter(r => !hiddenKeys.has((r._source || "community") + ":" + r.id))
        .filter(r => !snoozedIds.has(String(r.author_id)))
        .filter(r => !blockedIds.has(String(r.author_id)))
        .filter(r => canSeePost(r, { myId, matchIds, myCircleIds }))
        .filter(r => {
          const a = String(r.author_id || r.user_id)
          if (mutedLocal.has(a)) return false
          const text = (r.content || "").toLowerCase()
          if (text && mutedWordsLocal.size > 0) { for (const w of mutedWordsLocal) { if (text.includes(w)) return false } }
          return true
        })
        .map(p => ({
          ...p,
          _likeCount: d.enrichment?.[p._source + ":" + p.id]?.likes || 0,
          _commentCount: d.enrichment?.[p._source + ":" + p.id]?.comments || 0,
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      const filteredReels = reelItems
        .filter(r => !hiddenKeys.has("reel:" + r.id))
        .filter(r => !mutedLocal.has(String(r.author_id)))
        .map(r => ({ ...r, _likeCount: d.enrichment?.["reel:" + r.id]?.likes || 0, _commentCount: 0 }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      seenReelIds.current = new Set()
      const interactions = new Map(Object.entries(d.interactions || {}))
      const signalScoresMap = new Map(Object.entries(d.signalScores || {}))
      const authorSignalsMap = new Map(Object.entries(d.authorSignals || {}))
      const list = mixFeed({
        posts: filteredPosts,
        reels: filteredReels,
        pageSize: 20,
        reelEvery: 10,
        seenReelIds: seenReelIds.current,
        scoreContext: {
          myId, matchIds, followIds, interactions,
          reelAffinity: d.reelAffinity || 1,
          signalScores: signalScoresMap,
          authorSignals: authorSignalsMap,
        },
      })
      setPosts(list)
      setHasMore(list.length > 0)
      setCursor(list.length > 0 ? list[list.length - 1].created_at : null)
      setProfiles(new Map((d.profiles || []).map(p => [p.id, p])))
      const photoMap = new Map()
      ;(d.photos || []).forEach(ph => { if (!photoMap.has(ph.user_id)) photoMap.set(ph.user_id, ph.storage_path) })
      setPhotos(photoMap)
      setMyPhotoUrl(d.myPhotoPath ? publicPhotoUrl(d.myPhotoPath) : null)
      const myLiked = new Set(), counts = new Map(), cc = new Map(), breakdown = new Map(), types = new Map(), top = new Map()
      for (const [key, e] of Object.entries(d.enrichment || {})) {
        counts.set(key, e.likes || 0)
        if (e.mine) { myLiked.add(key); types.set(key, e.myReaction || "❤️") }
        if (e.comments) cc.set(key, e.comments)
        if (e.reactions && Object.keys(e.reactions).length > 0) {
          const bd = new Map()
          for (const [em, n] of Object.entries(e.reactions)) bd.set(em, n)
          breakdown.set(key, bd)
        }
        if (e.reactors && e.reactors.length > 0) top.set(key, e.reactors)
      }
      setMyReactions(myLiked)
      setReactionCounts(counts)
      setCommentCounts(cc)
      setReactionBreakdown(breakdown)
      setMyReactionTypes(types)
      setTopReactors(top)
      setShareCounts(new Map(Object.entries(d.shareCounts || {})))
      setSignalScores(signalScoresMap)
      setAuthorSignals(authorSignalsMap)
      setLoading(false)
      setPendingRealtimeCount(0)
    } catch (e) {
      console.error("Feed load error:", e)
      setError((e && e.message) || "Load failed")
      setLoading(false)
    }
  }, [myId])

  // ---- Infinite scroll: fetch next page ----
  const loadMore = useCallback(async () => {
    if (!myId || loadingMoreRef.current || !hasMore || !cursor) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/feed/loadMore?cursor=${encodeURIComponent(cursor)}`).then(r => r.json()).catch(() => ({ success: false }))
      if (!res || !res.success) { setLoadingMore(false); loadingMoreRef.current = false; return }
      const d = res.data
      const matchIds = new Set(d.context?.matchIds || [])
      const followIds = new Set(d.context?.followIds || [])
      const blockedIds = new Set(d.context?.blockedIds || [])
      const mutedLocal = new Set(d.context?.mutedIds || [])
      const hiddenKeys = new Set(d.context?.hiddenKeys || [])
      const communityPosts = (d.sources?.community || []).map(r => ({ ...r, _source: "community" }))
      const personalPosts = (d.sources?.personal || []).map(r => ({ ...r, _source: "personal", author_id: r.author_id || r.user_id }))
      const reelItems = (d.sources?.reels || []).map(r => ({ ...r, _source: "reel" }))
      const listingItems = d.sources?.listings || []
      const serviceItems = d.sources?.services || []
      const postsSorted = [...communityPosts, ...personalPosts, ...listingItems, ...serviceItems]
        .filter(r => !hiddenKeys.has((r._source || "community") + ":" + r.id))
        .filter(r => !blockedIds.has(String(r.author_id)))
        .filter(r => !mutedLocal.has(String(r.author_id)))
        .filter(r => canSeePost(r, { myId, matchIds, myCircleIds: new Set() }))
        .map(p => ({
          ...p,
          _likeCount: d.enrichment?.[p._source + ":" + p.id]?.likes || 0,
          _commentCount: d.enrichment?.[p._source + ":" + p.id]?.comments || 0,
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      const reelsSorted = reelItems
        .filter(r => !hiddenKeys.has("reel:" + r.id))
        .filter(r => !mutedLocal.has(String(r.author_id)))
        .map(r => ({ ...r, _likeCount: d.enrichment?.["reel:" + r.id]?.likes || 0, _commentCount: 0 }))
      const merged = mixFeed({
        posts: postsSorted,
        reels: reelsSorted,
        pageSize: 20,
        reelEvery: 10,
        seenReelIds: seenReelIds.current,
        scoreContext: { myId, matchIds, followIds, interactions: new Map(), reelAffinity: 1 },
      })
      if (merged.length === 0) { setHasMore(false); setLoadingMore(false); loadingMoreRef.current = false; return }
      if (d.profiles?.length) setProfiles(prev => { const n = new Map(prev); for (const p of d.profiles) n.set(p.id, p); return n })
      if (d.photos?.length) setPhotos(prev => { const n = new Map(prev); for (const ph of d.photos) if (!n.has(ph.user_id)) n.set(ph.user_id, ph.storage_path); return n })
      const freshMy = new Set(), freshCounts = new Map(), freshCmts = new Map(), freshTypes = new Map()
      for (const [key, e] of Object.entries(d.enrichment || {})) {
        freshCounts.set(key, e.likes || 0)
        if (e.mine) { freshMy.add(key); freshTypes.set(key, e.myReaction || "❤️") }
        if (e.comments) freshCmts.set(key, e.comments)
      }
      setMyReactions(prev => new Set([...prev, ...freshMy]))
      setReactionCounts(prev => { const n = new Map(prev); freshCounts.forEach((v, k) => n.set(k, v)); return n })
      setCommentCounts(prev => { const n = new Map(prev); freshCmts.forEach((v, k) => n.set(k, v)); return n })
      setMyReactionTypes(prev => { const n = new Map(prev); freshTypes.forEach((v, k) => n.set(k, v)); return n })
      setPosts(prev => [...prev, ...merged])
      setCursor(merged.length > 0 ? merged[merged.length - 1].created_at : cursor)
      setHasMore(merged.length > 0)
    } catch (e) { console.warn("loadMore failed", e) }
    setLoadingMore(false)
    loadingMoreRef.current = false
  }, [myId, hasMore, cursor])

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

  // ---- Post view tracking: impressions, dwell, skip ----
  useEffect(() => {
    if (!myId) return
    const el = scrollRef.current
    if (!el) return

    const visible = new Map()  // postKey → { post, enteredAt, viewed }

    const extractKey = (article) => {
      const key = article.dataset.postKey
      if (!key) return null
      return key
    }

    const findPost = (key) => posts.find((p) => (p._source + ":" + p.id) === key)

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const key = extractKey(entry.target)
          if (!key) return
          if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
            if (visible.has(key)) return
            const post = findPost(key)
            if (!post) return
            visible.set(key, { post, enteredAt: Date.now(), viewed: false })
            logImpression(myId, post)
          } else if (!entry.isIntersecting) {
            const rec = visible.get(key)
            if (!rec) return
            const dwellSec = (Date.now() - rec.enteredAt) / 1000
            visible.delete(key)

            if (dwellSec >= 1.5 && !rec.viewed) {
              logView(myId, rec.post)
              rec.viewed = true
            }
            if (dwellSec >= 0.4) {
              logDwell(myId, rec.post, dwellSec)
            }
            if (dwellSec < 1.0) {
              logSkip(myId, rec.post)
            }
          }
        })
      },
      { threshold: [0, 0.4, 0.8] }
    )

    const observeAll = () => {
      const articles = el.querySelectorAll("[data-post-key]")
      articles.forEach((a) => obs.observe(a))
    }

    // Give DOM a tick to render
    const t = setTimeout(observeAll, 100)
    const mo = new MutationObserver(() => {
      clearTimeout(t)
      setTimeout(observeAll, 100)
    })
    mo.observe(el, { childList: true, subtree: true })

    return () => {
      clearTimeout(t)
      mo.disconnect()
      obs.disconnect()
      // Flush any remaining dwells on unmount
      visible.forEach((rec) => {
        const dwellSec = (Date.now() - rec.enteredAt) / 1000
        if (dwellSec >= 0.4) logDwell(myId, rec.post, dwellSec)
      })
      visible.clear()
    }
  }, [myId, posts])

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
    let since = new Date().toISOString()
    const pollId = setInterval(async () => {
      if (document.hidden) return
      try {
        const res = await fetch(`${API_BASE_URL}/api/feed/poll?since=${encodeURIComponent(since)}`).then(r => r.json()).catch(() => ({ success: false }))
        if (res && res.success && res.count > 0) {
          setPendingRealtimeCount((c) => c + res.count)
          since = new Date().toISOString()
        }
      } catch (e) { /* silent */ }
    }, 15000)
    return () => clearInterval(pollId)
  }, [myId])

  async function notifyReaction(post, emoji) {
    const targetId = post.author_id || post.user_id
    if (!targetId || !myId || targetId === myId) return
    try {
      await fetch(`${API_BASE_URL}/api/feed/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetId,
          type: 'like_post',
          refId: String(post.id),
          refType: 'post',
          body: emoji === "❤️" ? "loved your post" : "reacted to your post"
        })
      }).catch(() => null)
    } catch (e) { console.warn("notify failed", e) }
  }

  async function toggleLike(postId, source = "community", emoji = null) {
    if (!myId) return
    tap("light")
    const key = source + ":" + postId
    const isLiked = myReactions.has(key)
    const currentEmoji = myReactionTypes.get(key) || "❤️"
    const nextMine = new Set(myReactions)
    const nextCounts = new Map(reactionCounts)
    const nextTypes = new Map(myReactionTypes)

    const table = source === "personal" ? "user_post_likes"
                : source === "reel"     ? "reel_likes"
                : "community_post_reactions"
    const idCol = source === "reel" ? "reel_id" : "post_id"

    const nextBD = new Map(reactionBreakdown)
    const bd = new Map(nextBD.get(key) || [])

    if (emoji && isLiked && emoji !== currentEmoji) {
      // Change reaction — update row + breakdown
      bd.set(currentEmoji, Math.max(0, (bd.get(currentEmoji) || 1) - 1))
      if (bd.get(currentEmoji) === 0) bd.delete(currentEmoji)
      bd.set(emoji, (bd.get(emoji) || 0) + 1)
      nextBD.set(key, bd)
      nextTypes.set(key, emoji)
      setMyReactionTypes(nextTypes); setReactionBreakdown(nextBD)
      if (source !== "reel") {
        await toggleLikeAPI(postId, myId, 'like');
      }
      return
    }

    if (isLiked) {
      bd.set(currentEmoji, Math.max(0, (bd.get(currentEmoji) || 1) - 1))
      if (bd.get(currentEmoji) === 0) bd.delete(currentEmoji)
      nextBD.set(key, bd)
      nextMine.delete(key)
      nextTypes.delete(key)
      nextCounts.set(key, Math.max(0, (nextCounts.get(key) || 1) - 1))
      setMyReactions(nextMine); setReactionCounts(nextCounts); setMyReactionTypes(nextTypes); setReactionBreakdown(nextBD)
      await toggleLikeAPI(postId, myId, 'unlike');
    } else {
      const useEmoji = emoji || "❤️"
      bd.set(useEmoji, (bd.get(useEmoji) || 0) + 1)
      nextBD.set(key, bd)
      nextMine.add(key)
      nextTypes.set(key, useEmoji)
      nextCounts.set(key, (nextCounts.get(key) || 0) + 1)
      setMyReactions(nextMine); setReactionCounts(nextCounts); setMyReactionTypes(nextTypes); setReactionBreakdown(nextBD)
      const row = source === "personal"
        ? { post_id: postId, user_id: myId, reaction: useEmoji }
        : source === "reel"
          ? { reel_id: postId, user_id: myId }
          : { post_id: postId, user_id: myId, reaction: useEmoji }
      await toggleLikeAPI(postId, myId, 'like');

      // Notify the author (skip for reels — different flow)
      if (source !== "reel") {
        const post = posts.find((x) => x.id === postId && x._source === source)
        if (post) notifyReaction(post, useEmoji)
      }
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

            <NewPostsPill
              count={pendingRealtimeCount}
              onTap={() => { setPendingRealtimeCount(0); load({ silent: true }) }}
            />

            {/* SUGGESTED REELS CAROUSEL */}
            {suggestedReels.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between px-1 mb-2">
                  <h3 className="text-cream font-extrabold text-[15px]">Suggested Reels</h3>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
                  {suggestedReels.map((reel) => (
                    <button
                      key={"reel-carousel-" + reel.id}
                      onClick={() => { tap("light"); nav("/reels/" + reel.id) }} // Update this route if your reels route is different
                      className="snap-start shrink-0 w-[120px] h-[200px] rounded-xl overflow-hidden relative bg-[#1A1A24] border border-white/10"
                    >
                      {reel.thumbnail_url ? (
                        <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover opacity-90" />
                      ) : (
                        <video src={reel.video_url} className="w-full h-full object-cover opacity-90" muted playsInline />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
                        <p className="text-white text-[11px] font-bold line-clamp-2 leading-tight">
                          {reel.caption || "Watch Reel"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {posts.map((p, idx) => {
            if (hiddenPostKeys.has(p._source + ":" + p.id)) return null
            // REELS render as video cards
            if (p._source === "reel") {
              const rProf = profiles.get(p.author_id)
              const rPhoto = photos.get(p.author_id)
              const rName = rProf?.display_name || rProf?.username || "Someone"
              return (
                <Fragment key={"reel-" + p.id}>
                  <article ref={observePost} data-post-id={p.id} data-post-key={"reel:" + p.id} className="mb-2 rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
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
                ? getMediaUrl(p.image_paths[0], "listing-media")
                : null
              return (
                <Fragment key={"listing-" + p.id}>
                  <article ref={observePost} data-post-id={p.id} data-post-key={"listing:" + p.id} className="mb-2 rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
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
                ? getMediaUrl(p.image_paths[0], "service-media")
                : null
              return (
                <Fragment key={"service-" + p.id}>
                  <article ref={observePost} data-post-id={p.id} data-post-key={"service:" + p.id} className="mb-2 rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
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
            const imageUrl = p.image_path ? `https://nakubonye.bernestart.workers.dev/api/media/${p.image_path}` : null
            return (
              <Fragment key={p.id}>
              <article ref={observePost} data-post-id={p.id} data-post-key={p._source + ":" + p.id} className="mb-2 rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
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

                {/* Author header — FB anatomy */}
                <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
                  <button
                    onClick={() => { tap("light"); nav("/profile/" + p.author_id) }}
                    className="relative w-9 h-9 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0"
                  >
                    {photoPath ? (
                      <img src={publicPhotoUrl(photoPath)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-purple-400 font-black text-sm">{name[0]}</div>
                    )}
                    {p.author_id === myId && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0B0B14]" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-cream font-bold text-[13.5px] truncate max-w-[60%]">{name}</span>
                      {prof?.is_verified && <VerifiedBadge size={14} />}
                      {p.author_id !== myId && <FollowButton userId={p.author_id} size="sm" />}
                    </div>
                    <p className="text-subtle text-[11px] flex items-center gap-1 flex-wrap">
                      <span>{new Date(p.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      <span>·</span>
                      <span>{p.audience === "matches" ? "💜" : p.audience === "private" ? "🔒" : "🌐"}</span>
                      {(p.feeling_text || p.location_text) && (
                        <>
                          <span>·</span>
                          <span className="text-muted text-[11px] truncate">
                            {p.feeling_text && <>feeling {p.feeling_text}</>}
                            {p.feeling_text && p.location_text ? " · " : ""}
                            {p.location_text && <>📍 {p.location_text}</>}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => { tap("light"); setActionsFor(p) }}
                    className="w-8 h-8 rounded-full grid place-items-center text-muted shrink-0"
                    aria-label="Post options"
                  >
                    <MoreVertical size={18} />
                  </button>
                  <button
                    onClick={() => { tap("light"); setFeedbackFor(p) }}
                    className="w-8 h-8 rounded-full grid place-items-center text-muted shrink-0"
                    aria-label="Hide post"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Content */}
                {p.content && (
                  <div
                    className={"mx-3 mb-3 rounded-xl " + (p.background_style ? "p-4 min-h-[120px] flex items-center justify-center" : "")}
                    style={{ background: p.background_style || "transparent" }}
                  >
                    <ExpandableText
                      text={p.content}
                      className={"text-cream leading-[1.5] whitespace-pre-wrap w-full text-center " + (p.background_style ? "text-[20px] font-bold" : "text-[14px]")}
                    />
                  </div>
                )}

                {p.reshared_from_type && p.reshared_include_original && p.reshared_from_snapshot && (
                  <div className="px-3 pb-3">
                    <ResharedPost snapshot={{ ...p.reshared_from_snapshot, id: p.reshared_from_id, type: p.reshared_from_type }} />
                  </div>
                )}

                <Poll postId={p.id} postType={p._source} />

                {(() => {
                  const paths = Array.isArray(p.image_paths) && p.image_paths.length > 0
                    ? p.image_paths
                    : (p.image_path ? [p.image_path] : [])
                  if (paths.length === 0) return null
                  return (
                    <PostImages
                      paths={Array.isArray(p.image_paths) && p.image_paths.length > 0 ? p.image_paths : (p.image_path ? [p.image_path] : [])}
                      alts={p.image_alts || []}
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
                      {(() => {
                        const key = p._source + ":" + p.id
                        const bd = reactionBreakdown.get(key)
                        const sorted = bd ? [...bd.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3) : []
                        const reactors = topReactors.get(key) || []
                        const total = reactionCounts.get(key) || 0
                        const mine = myReactions.has(key)

                        return (
                          <>
                            {sorted.length > 0 && (
                              <span className="flex -space-x-1.5">
                                {sorted.map(([em], i) => (
                                  <span key={i} className="rounded-full grid place-items-center text-[11px] bg-[#0B0B14] border border-white/10" style={{ width: 18, height: 18 }}>
                                    {em}
                                  </span>
                                ))}
                              </span>
                            )}
                            <span className="truncate">
                              {mine ? (
                                <>
                                  You{reactors.length > 1 ? `, ${reactors.filter((r) => r.name).slice(0, 1).map((r) => r.name.split(" ")[0]).join(", ")}` : ""}
                                  {total > (reactors.length > 1 ? 2 : 1) ? ` and ${total - (reactors.length > 1 ? 2 : 1)} other${total - (reactors.length > 1 ? 2 : 1) === 1 ? "" : "s"}` : ""}
                                </>
                              ) : reactors[0] ? (
                                <>
                                  {reactors[0].name.split(" ")[0]}
                                  {total > 1 ? ` and ${total - 1} other${total - 1 === 1 ? "" : "s"}` : ""}
                                </>
                              ) : (
                                <>{total} {total === 1 ? "reaction" : "reactions"}</>
                              )}
                            </span>
                          </>
                        )
                      })()}
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
                    {(shareCounts.get(p._source + ":" + p.id) || 0) > 0 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); tap("light"); setRepostsFor({ id: p.id, source: p._source }) }}
                        className="text-muted text-[12px] active:opacity-70"
                      >
                        {shareCounts.get(p._source + ":" + p.id)} {shareCounts.get(p._source + ":" + p.id) === 1 ? "share" : "shares"}
                      </button>
                    )}
                  </div>
                )}

                {/* Engagement bar */}
                <div className="flex items-center justify-between px-2 py-1.5 border-t border-white/5">
                  <div className="relative flex-1">
                    {(() => {
                      const key = p._source + ":" + p.id
                      const reacted = myReactions.has(key)
                      const emoji = myReactionTypes.get(key) || "❤️"
                      return (
                        <button
                          onClick={() => toggleLike(p.id, p._source)}
                          onContextMenu={(e) => { e.preventDefault(); setPickerFor(key) }}
                          onTouchStart={(e) => {
                            const t = setTimeout(() => setPickerFor(key), 420)
                            e.currentTarget._longPressTimer = t
                          }}
                          onTouchEnd={(e) => {
                            if (e.currentTarget._longPressTimer) clearTimeout(e.currentTarget._longPressTimer)
                          }}
                          onTouchMove={(e) => {
                            if (e.currentTarget._longPressTimer) { clearTimeout(e.currentTarget._longPressTimer); e.currentTarget._longPressTimer = null }
                          }}
                          className="w-full flex items-center gap-1.5 px-3 py-2 rounded-xl justify-center"
                        >
                          {reacted ? (
                            <span className="text-[18px] leading-none">{emoji}</span>
                          ) : (
                            <Heart size={18} strokeWidth={2.2} color="#888" />
                          )}
                          <span className="text-[12.5px] font-bold" style={{ color: reacted ? "#EC4899" : "#888" }}>
                            {reactionCounts.get(key) || 0}
                          </span>
                        </button>
                      )
                    })()}
                  </div>
                  <button
                    onClick={() => { tap("light"); trackClick(p.id); setCommentsFor({ id: p.id, source: p._source }) }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl flex-1 justify-center"
                  >
                    <MessageCircle size={18} strokeWidth={2.2} color="#888" />
                    <span className="text-muted text-[12.5px] font-bold">{commentCounts.get(p._source + ":" + p.id) || 0}</span>
                  </button>
                  <button
                    onClick={() => { tap("light"); setShareFor(p) }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl flex-1 justify-center"
                  >
                    <Share2 size={18} strokeWidth={2.2} color="#888" />
                    <span className="text-muted text-[12.5px] font-bold">Share</span>
                  </button>
                </div>

                {pickerFor && (() => {
                  const [pkSource, pkId] = pickerFor.split(":")
                  const isThis = pkSource + ":" + pkId === p._source + ":" + p.id
                  if (!isThis) return null
                  return (
                    <>
                      <div className="fixed inset-0 z-[90]" onClick={() => setPickerFor(null)} />
                      <div className="absolute left-0 right-0 bottom-16 z-[91] flex justify-center pointer-events-none">
                        <div className="pointer-events-auto">
                          <ReactionPicker
                            onPick={(emoji) => toggleLike(p.id, p._source, emoji)}
                            onClose={() => setPickerFor(null)}
                          />
                        </div>
                      </div>
                    </>
                  )
                })()}
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
        <Suspense fallback={null}><PostCommentsSheet
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
        /></Suspense>
      )}

      {/* Composer chooser sheet */}
      {composerChooserOpen && (
        <div className="fixed inset-0 z-[210] flex items-end" onClick={() => setComposerChooserOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, var(--safe-bottom, 8px))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <h3 className="text-cream font-extrabold text-[16px] mb-1">Share something real</h3>
            <p className="text-muted text-[12.5px] mb-3">What would you like to create?</p>

            <button
              onClick={() => { tap("light"); setComposerChooserOpen(false); setPostComposerOpen(true) }}
              className="flex items-center gap-4 px-4 py-4 border-b border-white/6 text-left active:bg-white/[0.03]"
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
              className="flex items-center gap-4 px-4 py-4 border-b border-white/6 text-left active:bg-white/[0.03]"
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

      {feedbackFor && (
        <PostFeedbackSheet
          post={feedbackFor}
          onClose={() => setFeedbackFor(null)}
          onHide={(p) => hidePost(p._source + ":" + p.id)}
          onReport={(p) => { setFeedbackFor(null); setActionsFor(p); /* Opens report flow */ }}
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

      {repostsFor && (
        <RepostsSheet
          postId={repostsFor.id}
          postType={repostsFor.source}
          onClose={() => setRepostsFor(null)}
        />
      )}

      {shareFor && (
        <ShareSheet
          post={shareFor}
          source={shareFor._source}
          onClose={() => setShareFor(null)}
          onShared={() => {
            // Trigger a refresh of the feed after share
            load?.()
          }}
        />
      )}

      <AnimatePresence>
        {likesModalFor && (
          <PostLikesModal
            postId={likesModalFor.postId}
            source={likesModalFor.source}
            count={reactionCounts.get(likesModalFor.source + ":" + likesModalFor.postId) || 0}
            onClose={() => setLikesModalFor(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
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
      </AnimatePresence>

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
        Promise.resolve({ data: boot.listings || [] }),
        Promise.resolve({ data: boot.services || [] }),
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


      {listings.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-cream font-bold text-[15px]">🛒 Fresh listings</p>
            <button onClick={() => nav("/marketplace")} className="text-purple-300 text-[12.5px] font-bold">See all</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {listings.map((l) => {
              const img = l.image_paths?.[0] ? getMediaUrl(l.image_paths[0], "listing-media") : null
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
              const img = s.image_paths?.[0] ? getMediaUrl(s.image_paths[0], "service-media") : null
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
