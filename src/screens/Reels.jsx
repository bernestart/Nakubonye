import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Heart, MessageCircle, Share2, Plus, Volume2, VolumeX, ArrowLeft, MoreVertical, Bookmark } from "lucide-react"
import VerifiedBadge from "../components/VerifiedBadge"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import ReelComposer from "../components/ReelComposer"
import ReelComments from "../components/ReelComments"
import ReelActionsSheet from "../components/ReelActionsSheet"

export default function Reels() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [reels, setReels] = useState([])
  const [profiles, setProfiles] = useState(new Map())
  const [photos, setPhotos] = useState(new Map())
  const [likes, setLikes] = useState(new Set())
  const [likeCounts, setLikeCounts] = useState(new Map())
  const [muted, setMuted] = useState(true)
  const [composerOpen, setComposerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [viewCounts, setViewCounts] = useState(new Map())
  const [commentCounts, setCommentCounts] = useState(new Map())
  const [commentsFor, setCommentsFor] = useState(null)
  const [actionsFor, setActionsFor] = useState(null)
  const [remixFor, setRemixFor] = useState(null)
  const [hiddenIds, setHiddenIds] = useState(new Set())
  const [savedIds, setSavedIds] = useState(new Set())
  const [likedAuthors, setLikedAuthors] = useState(new Set())
  const [matchSet, setMatchSet] = useState(new Set())
  const containerRef = useRef(null)
  const videoRefs = useRef([])
  const clipIdxRefs = useRef({})
  const viewedThisSession = useRef(new Set())

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true)
    const { data: rows } = await supabase
      .from("reels")
      .select("id, user_id, video_url, clips, thumbnail_url, caption, duration_sec, trim_start, trim_end, mirrored, aspect_ratio, text_overlays, sticker_overlays, filter_id, audience, allow_comments, allow_remix, location, cover_frame_time, view_count, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50)

    const list = (rows || []).filter((r) => {
      if (hiddenIds.has(r.id)) return false
      if (r.user_id === myId) return true
      const aud = r.audience || "public"
      if (aud === "public") return true
      if (aud === "matches") return matchSet.has(r.user_id)
      if (aud === "private") return false
      return true
    })
    setReels(list)

    // viewCounts from DB
    const vc = new Map()
    list.forEach((r) => vc.set(r.id, Number(r.view_count) || 0))
    setViewCounts(vc)

    // Load my saved reels
    const { data: saveRows } = await supabase
      .from("reel_saves")
      .select("reel_id")
      .eq("user_id", myId)
    setSavedIds(new Set((saveRows || []).map((r) => r.reel_id)))

    // Load hidden reel ids for this user
    const { data: hideRows } = await supabase.from("reel_hides").select("reel_id").eq("user_id", myId)
    const hidden = new Set((hideRows || []).map((h) => h.reel_id))
    setHiddenIds(hidden)

    // Load my matches so we can filter friends-only reels
    const { data: matchRows } = await supabase
      .from("matches")
      .select("user_one_id, user_two_id")
      .or("user_one_id.eq." + myId + ",user_two_id.eq." + myId)
    const ms = new Set()
    ;(matchRows || []).forEach((m) => {
      ms.add(m.user_one_id === myId ? m.user_two_id : m.user_one_id)
    })
    setMatchSet(ms)

    if (list.length > 0) {
      const ids = [...new Set(list.map((r) => r.user_id))]
      const { data: profs } = await supabase.from("profiles").select("id, display_name, username, is_verified").in("id", ids)
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

      // Load likes
      const reelIds = list.map((r) => r.id)
      const { data: myLikes } = await supabase.from("reel_likes").select("reel_id").eq("user_id", myId).in("reel_id", reelIds)
      setLikes(new Set((myLikes || []).map((l) => l.reel_id)))

      const { data: allLikes } = await supabase.from("reel_likes").select("reel_id").in("reel_id", reelIds)
      const lc = new Map()
      ;(allLikes || []).forEach((l) => lc.set(l.reel_id, (lc.get(l.reel_id) || 0) + 1))
      setLikeCounts(lc)

      // Comment counts
      const { data: allComments } = await supabase.from("reel_comments").select("reel_id").in("reel_id", reelIds)
      const cc = new Map()
      ;(allComments || []).forEach((c) => cc.set(c.reel_id, (cc.get(c.reel_id) || 0) + 1))
      setCommentCounts(cc)
    }
    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  // Autoplay the currently visible video, pause others
  // Count a view when a reel stays visible for 3+ seconds
  useEffect(() => {
    if (!myId) return
    const visible = reels.filter((r) => !hiddenIds.has(r.id))
    const reel = visible[currentIdx]
    if (!reel) return
    if (viewedThisSession.current.has(reel.id)) return

    const timer = setTimeout(async () => {
      viewedThisSession.current.add(reel.id)
      try {
        await supabase.from("reel_views").insert({
          reel_id: reel.id,
          user_id: myId,
          watch_seconds: 3,
        })
        // Optimistically bump the counter in UI
        setViewCounts((prev) => {
          const next = new Map(prev)
          next.set(reel.id, (next.get(reel.id) || 0) + 1)
          return next
        })
      } catch {}
    }, 3000)

    return () => clearTimeout(timer)
  }, [currentIdx, reels, hiddenIds, myId])

  useEffect(() => {
    reels.forEach((_, i) => {
      const v = videoRefs.current[i]
      if (!v) return
      if (i === currentIdx) {
        const reel = reels[i]
        if (reel) clipIdxRefs.current[reel.id] = clipIdxRefs.current[reel.id] || 0
        v.play().catch(() => {})
      } else {
        v.pause()
      }
    })
  }, [currentIdx, reels])

  // IntersectionObserver to detect which reel is in view
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      const idx = Math.round(el.scrollTop / el.clientHeight)
      if (idx !== currentIdx && idx >= 0 && idx < reels.length) setCurrentIdx(idx)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [currentIdx, reels.length])

  async function toggleSave(reelId) {
    if (!myId) return
    tap("light")
    const isSaved = savedIds.has(reelId)
    const next = new Set(savedIds)
    if (isSaved) {
      next.delete(reelId)
      setSavedIds(next)
      await supabase.from("reel_saves").delete().eq("reel_id", reelId).eq("user_id", myId)
    } else {
      next.add(reelId)
      setSavedIds(next)
      await supabase.from("reel_saves").insert({ reel_id: reelId, user_id: myId })
    }
  }

  async function likeAuthor(userId) {
    if (!myId || !userId || userId === myId) return
    if (likedAuthors.has(userId)) return
    tap("medium")
    setLikedAuthors((prev) => new Set([...prev, userId]))
    await supabase.rpc("like_user", { target_user_id: userId })
  }

  async function toggleLike(reelId) {
    if (!myId) return
    tap("light")
    const isLiked = likes.has(reelId)
    const nextLikes = new Set(likes)
    const nextCounts = new Map(likeCounts)
    if (isLiked) {
      nextLikes.delete(reelId)
      nextCounts.set(reelId, Math.max(0, (nextCounts.get(reelId) || 1) - 1))
      setLikes(nextLikes); setLikeCounts(nextCounts)
      await supabase.from("reel_likes").delete().eq("reel_id", reelId).eq("user_id", myId)
    } else {
      nextLikes.add(reelId)
      nextCounts.set(reelId, (nextCounts.get(reelId) || 0) + 1)
      setLikes(nextLikes); setLikeCounts(nextCounts)
      await supabase.from("reel_likes").insert({ reel_id: reelId, user_id: myId })
    }
  }

  async function share(reel) {
    tap("light")
    const url = reel.video_url
    if (navigator.share) {
      try { await navigator.share({ title: "Nakubonye reel", url }) } catch {}
    } else {
      try { await navigator.clipboard.writeText(url); alert("Link copied!") } catch {}
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 40 }}>
      {/* Top bar overlay */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 pt-4 pb-3 pointer-events-none"
           style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55), transparent)" }}>
        <button
          onClick={() => nav(-1)}
          className="w-10 h-10 rounded-full grid place-items-center bg-black/40 backdrop-blur-md text-white pointer-events-auto"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-white font-black text-[17px] tracking-tight">Reels</span>
        <button
          onClick={() => setMuted((m) => !m)}
          className="w-10 h-10 rounded-full grid place-items-center bg-black/40 backdrop-blur-md text-white pointer-events-auto"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {loading ? (
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-[3px] border-purple-500/30 border-t-purple-500 mx-auto mb-4 animate-spin" />
            <p className="text-white/60 text-[13px] font-medium tracking-wide">Loading reels…</p>
          </div>
        </div>
      ) : reels.length === 0 ? (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <div>
            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/40 grid place-items-center mx-auto mb-4">
              <MessageCircle size={26} className="text-purple-300" />
            </div>
            <p className="text-white font-bold text-[17px] mb-1.5">No reels yet</p>
            <p className="text-white/60 text-[13.5px] mb-5">Be the first to post one.</p>
            <button
              onClick={() => setComposerOpen(true)}
              className="h-12 px-6 rounded-full text-white font-bold text-[14px] inline-flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              <Plus size={18} /> Create reel
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-y-scroll"
          style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none" }}
        >
          {reels.filter((r) => !hiddenIds.has(r.id)).map((reel, idx) => {
            const prof = profiles.get(reel.user_id)
            const photo = photos.get(reel.user_id)
            const name = prof?.display_name || prof?.username || "Someone"
            const isLiked = likes.has(reel.id)
            const count = likeCounts.get(reel.id) || 0
            return (
              <div
                key={reel.id}
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100dvh",
                  scrollSnapAlign: "start",
                  background: "#000",
                }}
              >
                <video
                  ref={(el) => (videoRefs.current[idx] = el)}
                  src={(() => {
                    const list = Array.isArray(reel.clips) && reel.clips.length > 0
                      ? reel.clips
                      : [{ url: reel.video_url, trim_start: reel.trim_start || 0, trim_end: reel.trim_end || null }]
                    const ci = clipIdxRefs.current[reel.id] || 0
                    return list[Math.min(ci, list.length - 1)].url
                  })()}
                  loop={false}
                  muted={muted}
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(e) => {
                    const list = Array.isArray(reel.clips) && reel.clips.length > 0
                      ? reel.clips
                      : [{ url: reel.video_url, trim_start: reel.trim_start || 0, trim_end: reel.trim_end || null }]
                    const ci = clipIdxRefs.current[reel.id] || 0
                    const clip = list[Math.min(ci, list.length - 1)]
                    if (clip.trim_start && e.target.currentTime < clip.trim_start) {
                      e.target.currentTime = clip.trim_start
                    }
                  }}
                  onTimeUpdate={(e) => {
                    const list = Array.isArray(reel.clips) && reel.clips.length > 0
                      ? reel.clips
                      : [{ url: reel.video_url, trim_start: reel.trim_start || 0, trim_end: reel.trim_end || null }]
                    const ci = clipIdxRefs.current[reel.id] || 0
                    const clip = list[Math.min(ci, list.length - 1)]
                    if (!clip.trim_end) return
                    if (e.target.currentTime >= clip.trim_end) {
                      // Advance to next clip or loop back to first
                      const nextCi = ci + 1 < list.length ? ci + 1 : 0
                      const nextClip = list[nextCi]
                      clipIdxRefs.current[reel.id] = nextCi
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
                  }}
                  onClick={() => {
                    const v = videoRefs.current[idx]
                    if (!v) return
                    if (v.paused) v.play().catch(() => {})
                    else v.pause()
                  }}
                  className="w-full h-full object-cover"
                  style={{
                    transform: reel.mirrored ? "scaleX(-1)" : "none",
                    filter: (() => {
                      const f = reel.filter_id || "none"
                      if (f === "warm") return "sepia(0.35) saturate(1.3) brightness(1.05)"
                      if (f === "cool") return "hue-rotate(180deg) saturate(1.1) brightness(1.05)"
                      if (f === "mono") return "grayscale(1) contrast(1.1)"
                      if (f === "vivid") return "saturate(1.8) contrast(1.1)"
                      if (f === "fade") return "saturate(0.7) brightness(1.15) contrast(0.9)"
                      if (f === "vintage") return "sepia(0.55) saturate(1.1) contrast(1.05)"
                      if (f === "noir") return "grayscale(1) contrast(1.3) brightness(0.95)"
                      return "none"
                    })(),
                  }}
                />

                {/* Text overlays baked on top */}
                {Array.isArray(reel.text_overlays) && reel.text_overlays.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      position: "absolute",
                      left: t.x * 100 + "%",
                      top: t.y * 100 + "%",
                      transform: "translate(-50%, -50%)",
                      color: t.color || "#ffffff",
                      fontWeight: 900,
                      fontSize: t.size || 24,
                      textShadow: "0 2px 12px rgba(0,0,0,0.9)",
                      WebkitTextStroke: "0.5px rgba(0,0,0,0.5)",
                      whiteSpace: "nowrap",
                      zIndex: 15,
                      pointerEvents: "none",
                      maxWidth: "90%",
                    }}
                  >
                    {t.text}
                  </div>
                ))}

                {Array.isArray(reel.sticker_overlays) && reel.sticker_overlays.map((st) => (
                  <div
                    key={st.id}
                    style={{
                      position: "absolute",
                      left: st.x * 100 + "%",
                      top: st.y * 100 + "%",
                      transform: "translate(-50%, -50%)",
                      fontSize: st.size || 56,
                      zIndex: 16,
                      pointerEvents: "none",
                    }}
                  >
                    {st.emoji}
                  </div>
                ))}

                {/* Dark gradient bottom for readability */}
                <div className="absolute inset-x-0 bottom-0 pointer-events-none"
                     style={{ height: "45%", background: "linear-gradient(0deg, rgba(0,0,0,0.75) 0%, transparent 100%)" }} />

                {/* Right action rail */}
                <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-20">
                  <button
                    onClick={() => toggleLike(reel.id)}
                    className="flex flex-col items-center gap-1"
                    aria-label="Like"
                  >
                    <span
                      className="w-12 h-12 rounded-full grid place-items-center"
                      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}
                    >
                      <Heart
                        size={24}
                        strokeWidth={2.4}
                        color={isLiked ? "#EC4899" : "#fff"}
                        fill={isLiked ? "#EC4899" : "none"}
                      />
                    </span>
                    <span className="text-white text-[11px] font-bold">{count}</span>
                  </button>

                  {reel.allow_comments !== false && (
                  <button
                    onClick={() => { tap("light"); setCommentsFor(reel.id) }}
                    className="flex flex-col items-center gap-1"
                    aria-label="Comments"
                  >
                    <span
                      className="w-12 h-12 rounded-full grid place-items-center"
                      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}
                    >
                      <MessageCircle size={24} strokeWidth={2.4} color="#fff" />
                    </span>
                    <span className="text-white text-[11px] font-bold">{commentCounts.get(reel.id) || 0}</span>
                  </button>
                  )}

                  <button
                    onClick={() => share(reel)}
                    className="flex flex-col items-center gap-1"
                    aria-label="Share"
                  >
                    <span
                      className="w-12 h-12 rounded-full grid place-items-center"
                      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}
                    >
                      <Share2 size={22} strokeWidth={2.4} color="#fff" />
                    </span>
                    <span className="text-white text-[11px] font-bold">Share</span>
                  </button>

                  <button
                    onClick={() => toggleSave(reel.id)}
                    className="flex flex-col items-center gap-1"
                    aria-label="Save"
                  >
                    <span
                      className="w-12 h-12 rounded-full grid place-items-center"
                      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}
                    >
                      <Bookmark
                        size={22}
                        strokeWidth={2.4}
                        color={savedIds.has(reel.id) ? "#F59E0B" : "#fff"}
                        fill={savedIds.has(reel.id) ? "#F59E0B" : "none"}
                      />
                    </span>
                    <span className="text-white text-[11px] font-bold">Save</span>
                  </button>

                  <button
                    onClick={() => { tap("light"); setActionsFor(reel) }}
                    className="flex flex-col items-center gap-1"
                    aria-label="More"
                  >
                    <span
                      className="w-12 h-12 rounded-full grid place-items-center"
                      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}
                    >
                      <MoreVertical size={22} strokeWidth={2.4} color="#fff" />
                    </span>
                  </button>
                </div>

                {/* Bottom info: author + caption + actions */}
                <div className="absolute left-3 right-20 bottom-4 z-20">
                  {/* Author row with Like button */}
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => { tap("light"); nav("/profile/" + reel.user_id) }}
                      className="w-9 h-9 rounded-full overflow-hidden bg-black/40 border border-white/25 shrink-0"
                    >
                      {photo ? (
                        <img src={publicPhotoUrl(photo)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-white font-black text-sm">
                          {name[0]}
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => { tap("light"); nav("/profile/" + reel.user_id) }}
                      className="min-w-0 flex items-center gap-1 text-left"
                    >
                      <span className="text-white font-bold text-[14px] truncate">
                        {name}
                      </span>
                      {prof?.is_verified && <VerifiedBadge size={13} />}
                    </button>

                    {reel.user_id !== myId && (
                      <button
                        onClick={() => likeAuthor(reel.user_id)}
                        disabled={likedAuthors.has(reel.user_id)}
                        className="shrink-0 h-7 px-2.5 rounded-full flex items-center gap-1 font-bold text-[11.5px] transition-all"
                        style={{
                          background: likedAuthors.has(reel.user_id)
                            ? "rgba(236,72,153,0.25)"
                            : "rgba(255,255,255,0.15)",
                          border: likedAuthors.has(reel.user_id)
                            ? "1px solid rgba(236,72,153,0.6)"
                            : "1px solid rgba(255,255,255,0.3)",
                          color: "#fff",
                          backdropFilter: "blur(8px)",
                        }}
                      >
                        <Heart
                          size={12}
                          fill={likedAuthors.has(reel.user_id) ? "#EC4899" : "none"}
                          color={likedAuthors.has(reel.user_id) ? "#EC4899" : "#fff"}
                        />
                        {likedAuthors.has(reel.user_id) ? "Liked" : "Like"}
                      </button>
                    )}
                  </div>

                  {/* Caption */}
                  {reel.caption && (
                    <p className="text-white/95 text-[13.5px] leading-[1.4] whitespace-pre-wrap mb-1" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
                      {reel.caption}
                    </p>
                  )}

                  {/* Location */}
                  {reel.location && (
                    <p className="text-white/75 text-[12px] flex items-center gap-1">
                      📍 {reel.location}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Floating "Create" FAB */}
      {!loading && reels.length > 0 && (
        <button
          onClick={() => { tap("medium"); setComposerOpen(true) }}
          className="absolute z-30 grid place-items-center"
          style={{
            right: 16,
            bottom: 24,
            width: 56, height: 56, borderRadius: 999,
            background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)",
            boxShadow: "0 10px 30px rgba(236,72,153,0.55)",
          }}
          aria-label="Create reel"
        >
          <Plus size={26} color="#fff" strokeWidth={2.6} />
        </button>
      )}

      {composerOpen && (
        <ReelComposer
          onClose={() => setComposerOpen(false)}
          onDone={() => { setComposerOpen(false); load() }}
        />
      )}

      {remixFor && (
        <ReelComposer
          remixOf={remixFor}
          onClose={() => setRemixFor(null)}
          onDone={() => { setRemixFor(null); load() }}
        />
      )}

      {actionsFor && (
        <ReelActionsSheet
          reel={actionsFor}
          onClose={() => setActionsFor(null)}
          onRemix={(r) => { setActionsFor(null); setRemixFor(r) }}
          onDeleted={(id) => {
            setReels((arr) => arr.filter((r) => r.id !== id))
            setCurrentIdx(0)
          }}
          onHidden={(id) => {
            setHiddenIds((prev) => new Set([...prev, id]))
            // If we hid the current reel, jump to next
            const visible = reels.filter((r) => !hiddenIds.has(r.id) && r.id !== id)
            const nextIdx = Math.min(currentIdx, Math.max(0, visible.length - 1))
            setCurrentIdx(nextIdx)
          }}
        />
      )}

      {commentsFor && (
        <ReelComments
          reelId={commentsFor}
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
    </div>
  )
}
