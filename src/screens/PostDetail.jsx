import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Heart, MessageCircle, Share2, MoreVertical } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import VerifiedBadge from "../components/VerifiedBadge"
import Poll from "../components/Poll"
import PostCommentsSheet from "../components/PostCommentsSheet"
import PostActionsSheet from "../components/PostActionsSheet"
import ReactionPicker from "../components/ReactionPicker"
import BrandGlow from "../components/BrandGlow"

export default function PostDetail() {
  const { source, id } = useParams()
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [post, setPost] = useState(null)
  const [author, setAuthor] = useState(null)
  const [authorPhoto, setAuthorPhoto] = useState("")
  const [community, setCommunity] = useState(null)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [myEmoji, setMyEmoji] = useState("❤️")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState("")
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [galleryIdx, setGalleryIdx] = useState(0)

  useEffect(() => {
    if (!id || !source) return
    let cancelled = false
    ;(async () => {
      setLoading(true); setError("")
      try {
        let row = null
        if (source === "personal") {
          const { data } = await supabase
            .from("user_posts")
            .select("id, user_id, content, image_path, image_paths, audience, created_at")
            .eq("id", id).maybeSingle()
          row = data ? { ...data, _source: "personal", author_id: data.user_id } : null
        } else if (source === "community") {
          const { data } = await supabase
            .from("community_posts")
            .select("id, author_id, community_id, content, image_path, image_paths, created_at")
            .eq("id", id).maybeSingle()
          row = data ? { ...data, _source: "community" } : null
        }
        if (cancelled) return
        if (!row) { setError("Post not found"); setLoading(false); return }
        setPost(row)

        const authorId = row.author_id || row.user_id
        const [profRes, photoRes] = await Promise.all([
          supabase.from("profiles").select("id, display_name, username, is_verified").eq("id", authorId).maybeSingle(),
          supabase.from("profile_photos").select("storage_path").eq("user_id", authorId).order("is_primary", { ascending: false }).limit(1).maybeSingle(),
        ])
        if (cancelled) return
        setAuthor(profRes.data || null)
        setAuthorPhoto(photoRes.data?.storage_path ? publicPhotoUrl(photoRes.data.storage_path) : "")

        if (row.community_id) {
          const { data: c } = await supabase
            .from("communities")
            .select("id, name, slug, emoji, cover_color")
            .eq("id", row.community_id).maybeSingle()
          if (!cancelled) setCommunity(c || null)
        }

        const likeTable  = source === "personal" ? "user_post_likes" : "community_post_reactions"
        const cmtTable   = source === "personal" ? "user_post_comments" : "community_post_comments"
        const [{ data: myLike }, { count: likeCnt }, { count: cmtCnt }] = await Promise.all([
          myId ? supabase.from(likeTable).select("post_id, reaction").eq("post_id", id).eq("user_id", myId).maybeSingle() : Promise.resolve({ data: null }),
          supabase.from(likeTable).select("post_id", { count: "exact", head: true }).eq("post_id", id),
          supabase.from(cmtTable).select("id", { count: "exact", head: true }).eq("post_id", id),
        ])
        if (cancelled) return
        setLiked(!!myLike)
        if (myLike?.reaction) setMyEmoji(myLike.reaction)
        setLikeCount(likeCnt || 0)
        setCommentCount(cmtCnt || 0)
        setLoading(false)
      } catch (e) {
        if (!cancelled) { setError(e.message || String(e)); setLoading(false) }
      }
    })()
    return () => { cancelled = true }
  }, [id, source, myId])

  async function toggleLike(emoji = null) {
    if (!myId || busy || !post) return
    tap("light"); setBusy(true)
    const likeTable = source === "personal" ? "user_post_likes" : "community_post_reactions"

    // Changing reaction on an already-liked post
    if (emoji && liked && emoji !== myEmoji) {
      setMyEmoji(emoji)
      await supabase.from(likeTable).update({ reaction: emoji }).eq("post_id", post.id).eq("user_id", myId)
      setBusy(false)
      return
    }

    const next = !liked
    setLiked(next)
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)))
    if (next) {
      const useEmoji = emoji || "❤️"
      setMyEmoji(useEmoji)
      const row = source === "personal"
        ? { post_id: post.id, user_id: myId, reaction: useEmoji }
        : { post_id: post.id, user_id: myId, reaction: useEmoji }
      await supabase.from(likeTable).insert(row)

      const targetId = post.author_id || post.user_id
      if (targetId && targetId !== myId) {
        try {
          await supabase.from("notifications").insert({
            user_id: targetId,
            actor_id: myId,
            type: "like_post",
            ref_id: String(post.id),
            ref_type: "post",
            body: useEmoji === "❤️" ? "loved your post" : "reacted to your post",
          })
        } catch (e) { console.warn("notify failed", e) }
      }
    } else {
      await supabase.from(likeTable).delete().eq("post_id", post.id).eq("user_id", myId)
    }
    setBusy(false)
  }

  async function share() {
    tap("light")
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: "Nakubonye", url })
      else { await navigator.clipboard.writeText(url); alert("Link copied") }
    } catch {}
  }

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, display: "flex", flexDirection: "column", background: "#0B0B14", overflow: "hidden" }}>
      <BrandGlow />

      <header className="shrink-0 h-12 px-3 flex items-center justify-between" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Post</span>
        <span className="w-9 h-9" />
      </header>

      <div className="flex-1 overflow-y-auto pb-10">
        {loading ? (
          <div className="p-4">
            <div className="rounded-xl bg-white/[0.03] border border-white/8 h-64 shimmer" />
          </div>
        ) : error ? (
          <div className="py-16 text-center px-6">
            <p className="text-danger text-[14px] mb-3">{error}</p>
            <button onClick={() => nav(-1)} className="text-purple-300 font-bold text-[13px]">Go back</button>
          </div>
        ) : !post ? null : (
          <article className="mx-2 my-2 rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
            {/* Community badge */}
            {community && (
              <button
                onClick={() => { tap("light"); nav("/communities/" + community.id) }}
                className="w-full flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/[0.02] text-left"
              >
                <span className="w-6 h-6 rounded-lg grid place-items-center text-[12px]" style={{ background: community.cover_color || "rgba(168,85,247,0.25)" }}>
                  {community.emoji || "•"}
                </span>
                <span className="text-purple-300 text-[11.5px] font-bold tracking-wide truncate">{community.name}</span>
              </button>
            )}
            {!community && post._source === "personal" && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/[0.02]">
                <span className="w-6 h-6 rounded-lg grid place-items-center text-[12px] bg-pink-500/20">
                  {post.audience === "matches" ? "💜" : post.audience === "private" ? "🔒" : "🌍"}
                </span>
                <span className="text-pink-300 text-[11.5px] font-bold tracking-wide">
                  {post.author_id === myId
                    ? "Your post · " + (post.audience === "matches" ? "Matches" : post.audience === "private" ? "Only me" : "Everyone")
                    : "Posted to their profile"}
                </span>
              </div>
            )}

            {/* Author header */}
            <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
              <button
                onClick={() => { tap("light"); nav("/profile/" + (post.author_id || post.user_id)) }}
                className="w-9 h-9 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0"
              >
                {authorPhoto ? (
                  <img src={authorPhoto} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-purple-400 font-black text-sm">
                    {(author?.display_name || author?.username || "?")[0].toUpperCase()}
                  </div>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-cream font-bold text-[13.5px] truncate flex items-center gap-1">
                  {author?.display_name || author?.username || "Someone"}
                  {author?.is_verified && <VerifiedBadge size={13} />}
                </p>
                <p className="text-subtle text-[11px]">
                  {new Date(post.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <button
                onClick={() => { tap("light"); setActionsOpen(true) }}
                className="w-9 h-9 rounded-full grid place-items-center text-muted"
                aria-label="More"
              >
                <MoreVertical size={18} />
              </button>
            </div>

            {/* Content */}
            {post.content && (
              <p className="px-3 pb-3 text-cream text-[14.5px] leading-[1.5] whitespace-pre-wrap">{post.content}</p>
            )}

            <Poll postId={post.id} postType={post._source} />

            {/* Image gallery */}
            {(() => {
              const paths = Array.isArray(post.image_paths) && post.image_paths.length > 0
                ? post.image_paths
                : (post.image_path ? [post.image_path] : [])
              if (paths.length === 0) return null
              const urls = paths.map((p) => supabase.storage.from("community-media").getPublicUrl(p).data?.publicUrl)
              const idx = Math.min(galleryIdx, urls.length - 1)
              return (
                <div className="relative">
                  <img src={urls[idx]} alt="" className="w-full max-h-[520px] object-cover" />
                  {urls.length > 1 && (
                    <>
                      {/* counter pill */}
                      <span className="absolute top-2 right-2 px-2 h-6 rounded-full bg-black/60 text-white text-[11px] font-bold flex items-center">
                        {idx + 1}/{urls.length}
                      </span>
                      {/* dots */}
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                        {urls.map((_, i) => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === idx ? "#fff" : "rgba(255,255,255,0.4)" }} />
                        ))}
                      </div>
                      {/* prev / next tap zones */}
                      {idx > 0 && (
                        <button
                          onClick={() => setGalleryIdx(idx - 1)}
                          className="absolute left-0 top-0 bottom-0 w-1/3 bg-transparent"
                          aria-label="Previous"
                        />
                      )}
                      {idx < urls.length - 1 && (
                        <button
                          onClick={() => setGalleryIdx(idx + 1)}
                          className="absolute right-0 top-0 bottom-0 w-1/3 bg-transparent"
                          aria-label="Next"
                        />
                      )}
                    </>
                  )}
                </div>
              )
            })()}

            {/* Counts */}
            {(likeCount > 0 || commentCount > 0) && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-white/5 text-[12px] text-muted">
                <span>{likeCount > 0 ? `${likeCount} like${likeCount === 1 ? "" : "s"}` : ""}</span>
                <span>{commentCount > 0 ? `${commentCount} comment${commentCount === 1 ? "" : "s"}` : ""}</span>
              </div>
            )}

            {/* Action bar */}
            <div className="flex items-center justify-around px-3 py-2 border-t border-white/5">
              <button
                onClick={() => toggleLike()}
                onContextMenu={(e) => { e.preventDefault(); setPickerOpen(true) }}
                onTouchStart={(e) => {
                  const t = setTimeout(() => setPickerOpen(true), 420)
                  e.currentTarget._longPressTimer = t
                }}
                onTouchEnd={(e) => {
                  if (e.currentTarget._longPressTimer) { clearTimeout(e.currentTarget._longPressTimer); e.currentTarget._longPressTimer = null }
                }}
                onTouchMove={(e) => {
                  if (e.currentTarget._longPressTimer) { clearTimeout(e.currentTarget._longPressTimer); e.currentTarget._longPressTimer = null }
                }}
                disabled={busy}
                className="flex items-center gap-1.5 h-9 px-3 rounded-full active:scale-[0.97] transition-transform disabled:opacity-50"
              >
                {liked ? (
                  <span className="text-[18px] leading-none">{myEmoji}</span>
                ) : (
                  <Heart size={18} strokeWidth={2.2} color="#aaa" />
                )}
                <span className="text-[12.5px] font-bold" style={{ color: liked ? "#EC4899" : "#aaa" }}>
                  {liked ? myEmoji === "❤️" ? "Love" : myEmoji === "👍" ? "Like" : "Reacted" : "Like"}
                </span>
              </button>
              <button
                onClick={() => { tap("light"); setCommentsOpen(true) }}
                className="flex items-center gap-1.5 h-9 px-3 rounded-full active:scale-[0.97] transition-transform"
              >
                <MessageCircle size={18} strokeWidth={2.2} color="#aaa" />
                <span className="text-[12.5px] font-bold text-[#aaa]">Comment</span>
              </button>
              <button
                onClick={share}
                className="flex items-center gap-1.5 h-9 px-3 rounded-full active:scale-[0.97] transition-transform"
              >
                <Share2 size={18} strokeWidth={2.2} color="#aaa" />
                <span className="text-[12.5px] font-bold text-[#aaa]">Share</span>
              </button>
            </div>
          </article>
        )}
      </div>

      {pickerOpen && post && (
        <>
          <div className="fixed inset-0 z-[400]" onClick={() => setPickerOpen(false)} />
          <div className="fixed left-0 right-0 bottom-24 z-[401] flex justify-center pointer-events-none">
            <div className="pointer-events-auto">
              <ReactionPicker
                onPick={(emoji) => toggleLike(emoji)}
                onClose={() => setPickerOpen(false)}
              />
            </div>
          </div>
        </>
      )}

      {actionsOpen && post && (
        <PostActionsSheet
          post={post}
          onClose={() => setActionsOpen(false)}
          onDeleted={() => { setActionsOpen(false); nav(-1) }}
          onUpdated={(next) => setPost((cur) => ({ ...cur, ...next }))}
        />
      )}

      {commentsOpen && post && (
        <PostCommentsSheet
          postId={post.id}
          source={post._source}
          onClose={() => setCommentsOpen(false)}
          onCountChange={(n) => setCommentCount(n)}
        />
      )}
    </div>
  )
}
