import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { Heart, MessageCircle, Share2, Volume2, VolumeX, MoreVertical, Bookmark } from "lucide-react"
import VerifiedBadge from "./VerifiedBadge"
import FollowButton from "./FollowButton"
import ReelComments from "./ReelComments"
import ShareSheet from "./ShareSheet"
import ReelActionsSheet from "./ReelActionsSheet"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

function filterStyle(id) {
  if (id === "warm")    return "sepia(0.35) saturate(1.3) brightness(1.05)"
  if (id === "cool")    return "hue-rotate(180deg) saturate(1.1) brightness(1.05)"
  if (id === "mono")    return "grayscale(1) contrast(1.1)"
  if (id === "vivid")   return "saturate(1.8) contrast(1.1)"
  if (id === "fade")    return "saturate(0.7) brightness(1.15) contrast(0.9)"
  if (id === "vintage") return "sepia(0.55) saturate(1.1) contrast(1.05)"
  if (id === "noir")    return "grayscale(1) contrast(1.3) brightness(0.95)"
  return "none"
}

function clipsOf(reel) {
  return Array.isArray(reel?.clips) && reel.clips.length > 0
    ? reel.clips
    : [{ url: reel.video_url, trim_start: reel.trim_start || 0, trim_end: reel.trim_end || null }]
}

export default function ReelViewer({ reel, currentUserId, onClose }) {
  const nav = useNavigate()
  const videoRef = useRef(null)
  const clipIdxRef = useRef(0)
  const lastTapRef = useRef(0)

  const [author, setAuthor] = useState(null)
  const [authorPhoto, setAuthorPhoto] = useState("")
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [likedAuthor, setLikedAuthor] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [saveCount, setSaveCount] = useState(0)
  const [viewCount, setViewCount] = useState(0)
  const [muted, setMuted] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [heartBurst, setHeartBurst] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const myId = currentUserId

  // Load initial data
  useEffect(() => {
    if (!reel?.id || !myId) return
    let cancelled = false
    ;(async () => {
      const [profRes, photoRes, myLikeRes, mySaveRes, likeCntRes, cmtCntRes, saveCntRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, username, is_verified").eq("id", reel.user_id).maybeSingle(),
        supabase.from("profile_photos").select("storage_path").eq("user_id", reel.user_id).order("is_primary", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("reel_likes").select("reel_id").eq("reel_id", reel.id).eq("user_id", myId).maybeSingle(),
        supabase.from("reel_saves").select("reel_id").eq("reel_id", reel.id).eq("user_id", myId).maybeSingle(),
        supabase.from("reel_likes").select("reel_id", { count: "exact", head: true }).eq("reel_id", reel.id),
        supabase.from("reel_comments").select("id", { count: "exact", head: true }).eq("reel_id", reel.id),
        supabase.from("reel_saves").select("reel_id", { count: "exact", head: true }).eq("reel_id", reel.id),
      ])
      if (cancelled) return
      setAuthor(profRes.data || null)
      setAuthorPhoto(photoRes.data?.storage_path ? publicPhotoUrl(photoRes.data.storage_path) : "")
      setLiked(!!myLikeRes.data)
      setSaved(!!mySaveRes.data)
      setLikeCount(likeCntRes.count || 0)
      setCommentCount(cmtCntRes.count || 0)
      setSaveCount(saveCntRes.count || 0)
      setViewCount(Number(reel.view_count) || 0)
    })()
    return () => { cancelled = true }
  }, [reel?.id, reel?.user_id, myId])

  // Count view after 3s
  useEffect(() => {
    if (!reel?.id || !myId) return
    const t = setTimeout(async () => {
      try {
        await supabase.from("reel_views").insert({ reel_id: reel.id, user_id: myId, watch_seconds: 3 })
        // Re-fetch the column — DB trigger only bumps on this user's first-ever view
        const { data: fresh } = await supabase
          .from("reels")
          .select("view_count")
          .eq("id", reel.id)
          .maybeSingle()
        if (fresh) setViewCount(Number(fresh.view_count) || 0)
      } catch {}
    }, 3000)
    return () => clearTimeout(t)
  }, [reel?.id, myId])

  // Video handlers
  function handleCanPlay(e) {
    e.target.muted = muted
    e.target.play().catch(() => {})
  }
  function handleLoadedMetadata(e) {
    const list = clipsOf(reel)
    const clip = list[Math.min(clipIdxRef.current, list.length - 1)]
    if (clip.trim_start && e.target.currentTime < clip.trim_start) {
      e.target.currentTime = clip.trim_start
    }
  }
  function handleTimeUpdate(e) {
    const list = clipsOf(reel)
    const ci = clipIdxRef.current || 0
    const clip = list[Math.min(ci, list.length - 1)]
    if (!clip.trim_end) return
    if (e.target.currentTime >= clip.trim_end) {
      const nextCi = ci + 1 < list.length ? ci + 1 : 0
      const nextClip = list[nextCi]
      clipIdxRef.current = nextCi
      const v = e.target
      v.src = nextClip.url
      v.load()
      const onReady = () => {
        v.currentTime = nextClip.trim_start || 0
        v.play().catch(() => {})
        v.removeEventListener("loadeddata", onReady)
      }
      v.addEventListener("loadeddata", onReady)
    }
  }
  function handleVideoTap() {
    const now = Date.now()
    if (now - lastTapRef.current < 280) {
      // Double tap → like + heart
      if (!liked) toggleLike()
      setHeartBurst(true)
      setTimeout(() => setHeartBurst(false), 800)
    }
    lastTapRef.current = now
  }

  async function toggleLike() {
    if (!myId || busy) return
    tap("light")
    setBusy(true)
    const next = !liked
    setLiked(next)
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)))
    if (next) await supabase.from("reel_likes").insert({ reel_id: reel.id, user_id: myId })
    else      await supabase.from("reel_likes").delete().eq("reel_id", reel.id).eq("user_id", myId)
    setBusy(false)
  }
  async function toggleSave() {
    if (!myId || busy) return
    tap("light")
    setBusy(true)
    const next = !saved
    setSaved(next)
    setSaveCount((c) => Math.max(0, c + (next ? 1 : -1)))
    if (next) await supabase.from("reel_saves").insert({ reel_id: reel.id, user_id: myId })
    else      await supabase.from("reel_saves").delete().eq("reel_id", reel.id).eq("user_id", myId)
    setBusy(false)
  }
  async function likeAuthor() {
    if (!myId || reel.user_id === myId || likedAuthor) return
    tap("medium")
    setLikedAuthor(true)
    await supabase.rpc("like_user", { target_user_id: reel.user_id })
  }
  async function share() {
    tap("light")
    const url = `${window.location.origin}/reels`
    try {
      if (navigator.share) await navigator.share({ title: "Watch this reel", text: reel.caption || "", url })
      else { await navigator.clipboard.writeText(url); alert("Link copied") }
    } catch {}
  }

  if (!reel) return null
  const name = author?.display_name || author?.username || "User"

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#000" }}>
      <video
        ref={videoRef}
        src={clipsOf(reel)[Math.min(clipIdxRef.current, clipsOf(reel).length - 1)].url}
        loop={false}
        muted={muted}
        playsInline
        autoPlay
        onCanPlay={handleCanPlay}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onClick={handleVideoTap}
        className="w-full h-full object-cover"
        style={{
          transform: reel.mirrored ? "scaleX(-1)" : "none",
          filter: filterStyle(reel.filter_id),
        }}
      />

      {/* Heart burst on double-tap */}
      {heartBurst && (
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: [0.4, 1.3, 1.3, 1.15], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.8, times: [0, 0.2, 0.7, 1] }}
          className="absolute inset-0 grid place-items-center pointer-events-none"
          style={{ zIndex: 20 }}
        >
          <Heart size={110} fill="#EC4899" strokeWidth={0} />
        </motion.div>
      )}

      {/* Text overlays */}
      {Array.isArray(reel.text_overlays) && reel.text_overlays.map((t) => (
        <div key={t.id} style={{
          position: "absolute", left: t.x * 100 + "%", top: t.y * 100 + "%",
          transform: "translate(-50%, -50%)", color: t.color || "#ffffff",
          fontWeight: 900, fontSize: t.size || 24,
          textShadow: "0 2px 12px rgba(0,0,0,0.9)",
          WebkitTextStroke: "0.5px rgba(0,0,0,0.5)",
          whiteSpace: "nowrap", zIndex: 15, pointerEvents: "none", maxWidth: "90%",
        }}>{t.text}</div>
      ))}

      {/* Sticker overlays */}
      {Array.isArray(reel.sticker_overlays) && reel.sticker_overlays.map((st) => (
        <div key={st.id} style={{
          position: "absolute", left: st.x * 100 + "%", top: st.y * 100 + "%",
          transform: "translate(-50%, -50%)", fontSize: st.size || 56,
          zIndex: 16, pointerEvents: "none",
        }}>{st.emoji}</div>
      ))}

      {/* Top: close + mute */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-30">
        <button
          className="w-10 h-10 rounded-full grid place-items-center bg-black/40 text-white"
          style={{ backdropFilter: "blur(10px)" }}
          onClick={onClose}
          aria-label="Close"
        >✕</button>
        <button
          className="w-10 h-10 rounded-full grid place-items-center bg-black/40 text-white"
          style={{ backdropFilter: "blur(10px)" }}
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX size={20} color="#fff" /> : <Volume2 size={20} color="#fff" />}
        </button>
      </div>

      {/* Bottom gradient */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: "45%", background: "linear-gradient(0deg, rgba(0,0,0,0.75) 0%, transparent 100%)" }} />

      {/* Right action rail */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-20">
        <button onClick={toggleLike} className="flex flex-col items-center gap-1" aria-label="Like">
          <span className="w-12 h-12 rounded-full grid place-items-center" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}>
            <Heart size={24} strokeWidth={2.4} color={liked ? "#EC4899" : "#fff"} fill={liked ? "#EC4899" : "none"} />
          </span>
          <span className="text-white text-[11px] font-bold">{likeCount}</span>
        </button>

        {reel.allow_comments !== false && (
          <button onClick={() => { tap("light"); setCommentsOpen(true) }} className="flex flex-col items-center gap-1" aria-label="Comments">
            <span className="w-12 h-12 rounded-full grid place-items-center" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}>
              <MessageCircle size={24} strokeWidth={2.4} color="#fff" />
            </span>
            <span className="text-white text-[11px] font-bold">{commentCount}</span>
          </button>
        )}

        <button onClick={() => { tap("light"); setShareOpen(true) }} className="flex flex-col items-center gap-1" aria-label="Share">
          <span className="w-12 h-12 rounded-full grid place-items-center" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}>
            <Share2 size={22} strokeWidth={2.4} color="#fff" />
          </span>
          <span className="text-white text-[11px] font-bold">Share</span>
        </button>

        <button onClick={toggleSave} className="flex flex-col items-center gap-1" aria-label="Save">
          <span className="w-12 h-12 rounded-full grid place-items-center" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}>
            <Bookmark size={22} strokeWidth={2.4} color={saved ? "#F59E0B" : "#fff"} fill={saved ? "#F59E0B" : "none"} />
          </span>
          <span className="text-white text-[11px] font-bold">Save</span>
        </button>

        <button onClick={() => { tap("light"); setActionsOpen(true) }} className="flex flex-col items-center gap-1" aria-label="More">
          <span className="w-12 h-12 rounded-full grid place-items-center" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}>
            <MoreVertical size={22} strokeWidth={2.4} color="#fff" />
          </span>
        </button>
      </div>

      {/* Bottom: author row + caption + location */}
      <div className="absolute left-3 right-20 bottom-4 z-20">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => { tap("light"); onClose(); nav("/profile/" + reel.user_id) }}
            className="w-9 h-9 rounded-full overflow-hidden bg-black/40 border border-white/25 shrink-0"
          >
            {authorPhoto ? (
              <img src={authorPhoto} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-white font-black text-sm">{name[0]}</div>
            )}
          </button>
          <button
            onClick={() => { tap("light"); onClose(); nav("/profile/" + reel.user_id) }}
            className="min-w-0 flex items-center gap-1 text-left"
          >
            <span className="text-white font-bold text-[14px] truncate">{name}</span>
            {author?.is_verified && <VerifiedBadge size={13} />}
          </button>

          {reel.user_id !== myId && (
            <FollowButton userId={reel.user_id} size="sm" />
          )}

          {reel.user_id !== myId && (
            <button
              onClick={likeAuthor}
              disabled={likedAuthor}
              className="shrink-0 h-7 px-2.5 rounded-full flex items-center gap-1 font-bold text-[11.5px] transition-all"
              style={{
                background: likedAuthor ? "rgba(236,72,153,0.25)" : "rgba(255,255,255,0.15)",
                border: likedAuthor ? "1px solid rgba(236,72,153,0.6)" : "1px solid rgba(255,255,255,0.3)",
                color: "#fff",
                backdropFilter: "blur(8px)",
              }}
            >
              <Heart size={12} fill={likedAuthor ? "#EC4899" : "none"} color={likedAuthor ? "#EC4899" : "#fff"} />
              {likedAuthor ? "Liked" : "Like"}
            </button>
          )}
        </div>

        {reel.caption && (
          <p className="text-white/95 text-[13.5px] leading-[1.4] whitespace-pre-wrap mb-1" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
            {reel.caption}
          </p>
        )}

        {reel.location && (
          <p className="text-white/75 text-[12px] flex items-center gap-1">📍 {reel.location}</p>
        )}

        <p className="text-white/60 text-[11px] mt-1">{viewCount} views</p>
      </div>

      {commentsOpen && (
        <ReelComments
          reelId={reel.id}
          onClose={() => setCommentsOpen(false)}
          onCountChange={(n) => setCommentCount(n)}
        />
      )}

      {shareOpen && (
        <ShareSheet
          post={{
            id: reel.id,
            content: reel.caption || "",
            thumbnail_url: reel.thumbnail_url,
            author_id: reel.user_id,
            created_at: reel.created_at,
            audience: reel.audience || "public",
          }}
          source="reel"
          onClose={() => setShareOpen(false)}
        />
      )}

      {actionsOpen && (
        <ReelActionsSheet
          reel={reel}
          onClose={() => setActionsOpen(false)}
          onRemix={() => {}}
          onDeleted={() => { setActionsOpen(false); onClose() }}
          onHidden={() => { setActionsOpen(false); onClose() }}
        />
      )}
    </div>
  )
}
