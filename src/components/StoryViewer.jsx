import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../lib/auth"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"
import { X, Send, Heart, MoreVertical, Eye, Volume2, VolumeX } from "lucide-react"

const REACTIONS = ["❤️", "😂", "😍", "👍", "🔥", "😮", "😢", "🙏"]
const IMAGE_DURATION = 5000

export default function StoryViewer({ groups, startIndex = 0, onClose, onViewed }) {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [groupIdx, setGroupIdx] = useState(startIndex)
  const [storyIdx, setStoryIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [reply, setReply] = useState("")
  const [reactionOpen, setReactionOpen] = useState(false)
  const [viewersOpen, setViewersOpen] = useState(false)
  const [viewers, setViewers] = useState([])
  const [viewersLoading, setViewersLoading] = useState(false)
  const [muted, setMuted] = useState(false)

  const videoRef = useRef(null)
  const startRef = useRef(Date.now())
  const accumulatedRef = useRef(0)
  const pausedRef = useRef(false)
  const longPressTimer = useRef(null)
  const pressFiredRef = useRef(false)
  const touchStartY = useRef(0)
  const touchStartTimeRef = useRef(0)
  const closingRef = useRef(false)

  const group = groups[groupIdx]
  const story = group?.stories?.[storyIdx]
  const isMine = group?.user_id === myId
  const avatar = group?.avatar_path ? publicPhotoUrl(group.avatar_path) : null

  // ==== Load viewers on own story ====
  useEffect(() => {
    if (!isMine || !story) return
    let cancelled = false
    setViewersLoading(true)
    ;(async () => {
      const { data: rows } = await supabase
        .from("story_views")
        .select("user_id, viewed_at")
        .eq("story_id", story.id)
        .order("viewed_at", { ascending: false })
        .limit(100)
      if (cancelled || !rows) { setViewersLoading(false); return }
      const ids = [...new Set(rows.map((r) => r.user_id))]
      if (ids.length === 0) { setViewers([]); setViewersLoading(false); return }
      const { data: profs } = await supabase.from("profiles").select("id, display_name, username").in("id", ids)
      const { data: ph } = await supabase.from("profile_photos").select("user_id, storage_path, is_primary, display_order").in("user_id", ids)
        .order("is_primary", { ascending: false }).order("display_order", { ascending: true })
      const pMap = new Map((profs || []).map((p) => [p.id, p]))
      const phMap = new Map()
      ;(ph || []).forEach((p) => { if (!phMap.has(p.user_id)) phMap.set(p.user_id, p.storage_path) })
      setViewers(rows.map((r) => ({
        user_id: r.user_id,
        viewed_at: r.viewed_at,
        display_name: pMap.get(r.user_id)?.display_name,
        username: pMap.get(r.user_id)?.username,
        photo_url: publicPhotoUrl(phMap.get(r.user_id)),
      })))
      setViewersLoading(false)
    })()
    return () => { cancelled = true }
  }, [isMine, story?.id])

  // ==== Progress timer ====
  useEffect(() => {
    if (!story) return
    onViewed?.(group.user_id, story.id)
    setProgress(0)
    accumulatedRef.current = 0
    startRef.current = Date.now()
    pausedRef.current = false
    setPaused(false)
    setReactionOpen(false)

    const DURATION = story.media_type === "video" ? null : IMAGE_DURATION
    let rafId
    if (DURATION != null) {
      const tick = () => {
        if (!pausedRef.current) {
          const elapsed = accumulatedRef.current + (Date.now() - startRef.current)
          const p = Math.min(1, elapsed / DURATION)
          setProgress(p)
          if (p >= 1) { advance(); return }
        }
        rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(rafId)
    }
    // Video: progress synced by onTimeUpdate
    return () => cancelAnimationFrame(rafId)
  }, [groupIdx, storyIdx, story?.id])

  // ==== Video ref play/pause ====
  useEffect(() => {
    const v = videoRef.current
    if (!v || !story || story.media_type !== "video") return
    if (paused) v.pause()
    else v.play().catch(() => {})
  }, [paused, story?.id, storyIdx, groupIdx])

  // ==== Preload next story ====
  useEffect(() => {
    const next = group?.stories?.[storyIdx + 1]
      || groups[groupIdx + 1]?.stories?.[0]
    if (!next) return
    const img = new Image()
    if (next.media_type === "image") img.src = next.media_url
  }, [groupIdx, storyIdx])

  function advance() {
    setProgress(0)
    accumulatedRef.current = 0
    startRef.current = Date.now()
    if (storyIdx < (group?.stories?.length || 0) - 1) {
      setStoryIdx(storyIdx + 1)
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(groupIdx + 1)
      setStoryIdx(0)
    } else {
      onClose?.()
    }
  }

  function back() {
    setProgress(0)
    accumulatedRef.current = 0
    startRef.current = Date.now()
    if (storyIdx > 0) {
      setStoryIdx(storyIdx - 1)
    } else if (groupIdx > 0) {
      const prev = groups[groupIdx - 1]
      setGroupIdx(groupIdx - 1)
      setStoryIdx(Math.max(0, (prev?.stories?.length || 1) - 1))
    }
  }

  function pauseNow() {
    if (pausedRef.current) return
    accumulatedRef.current += Date.now() - startRef.current
    pausedRef.current = true
    setPaused(true)
    try { videoRef.current?.pause() } catch {}
  }
  function resumeNow() {
    if (!pausedRef.current) return
    startRef.current = Date.now()
    pausedRef.current = false
    setPaused(false)
    try { videoRef.current?.play() } catch {}
  }

  // ==== Gesture handling ====
  function onTouchStart(e) {
    touchStartY.current = e.touches[0].clientY
    touchStartTimeRef.current = Date.now()
    pressFiredRef.current = false
    closingRef.current = false
    clearTimeout(longPressTimer.current)
    longPressTimer.current = setTimeout(() => {
      pressFiredRef.current = true
      pauseNow()
    }, 220)
  }

  function onTouchMove(e) {
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0 && e.touches.length === 1) {
      setDragY(dy)
      if (dy > 20) {
        clearTimeout(longPressTimer.current)
      }
    }
  }

  function onTouchEnd(e, tapAction) {
    clearTimeout(longPressTimer.current)
    const dy = dragY
    setDragY(0)
    if (dy > 100) {
      closingRef.current = true
      onClose?.()
      return
    }
    if (pressFiredRef.current) {
      resumeNow()
      pressFiredRef.current = false
      return
    }
    if (Math.abs(dy) < 10 && tapAction) tapAction()
  }

  async function sendReply() {
    const body = reply.trim()
    if (!body || !group?.user_id) return
    nav("/messages/" + group.user_id, {
      state: {
        prefill: body,
        storyReply: {
          story_id: story.id,
          media_url: story.media_url,
          media_type: story.media_type,
        },
      },
    })
  }

  async function sendReaction(emoji) {
    setReactionOpen(false)
    if (!group?.user_id) return
    nav("/messages/" + group.user_id, {
      state: {
        prefill: emoji,
        storyReply: {
          story_id: story.id,
          media_url: story.media_url,
          media_type: story.media_type,
        },
      },
    })
  }

  function close() {
    onClose?.()
  }

  if (!story) return null

  const groupStories = group?.stories || []
  const dragOpacity = Math.max(0, 1 - Math.abs(dragY) / 300)

  return (
    <div
      className="fixed inset-0 z-[220] bg-black select-none overflow-hidden"
      style={{
        transform: `translateY(${dragY}px) scale(${1 - Math.min(dragY, 200) / 1000})`,
        transition: dragY === 0 ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
        opacity: dragOpacity,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={(e) => onTouchEnd(e, null)}
    >
      {/* Media */}
      <div className="absolute inset-0 grid place-items-center bg-black">
        {story.media_type === "video" ? (
          <video
            ref={videoRef}
            src={story.media_url}
            autoPlay
            playsInline
            muted={muted}
            preload="auto"
            onTimeUpdate={(e) => {
              const v = e.target
              if (v.duration > 0) setProgress(v.currentTime / v.duration)
            }}
            onEnded={advance}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <img src={story.media_url} alt="" className="max-w-full max-h-full object-contain" />
        )}
      </div>

      {/* Progress bars */}
      <div className="absolute top-3 left-3 right-3 flex gap-1 z-20"
           style={{ paddingTop: "env(safe-area-inset-top)" }}>
        {groupStories.map((s, i) => (
          <div key={s.id} className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full bg-white"
              style={{
                width: i < storyIdx ? "100%" : i === storyIdx ? `${progress * 100}%` : "0%",
                transition: i === storyIdx ? "none" : "width 180ms linear",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header — auto-hides when paused (WhatsApp behavior) */}
      <div
        className="absolute top-8 left-3 right-3 flex items-center gap-3 z-20"
        style={{
          opacity: paused ? 0 : 1,
          transition: "opacity 200ms",
          pointerEvents: paused ? "none" : "auto",
        }}
      >
        <div className="w-9 h-9 rounded-full overflow-hidden bg-elevated border border-white/15">
          {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : null}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-[14px] truncate">{group.display_name}</p>
          <p className="text-white/60 text-[11px]">
            {new Date(story.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
        {story.media_type === "video" && (
          <button
            onClick={() => setMuted((m) => !m)}
            className="w-8 h-8 rounded-full grid place-items-center text-white"
            aria-label="Toggle sound"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        )}
        <button onClick={close} className="w-9 h-9 grid place-items-center text-white" aria-label="Close">
          <X size={22} />
        </button>
      </div>

      {/* Caption */}
      {story.caption && !paused && (
        <div className="absolute bottom-28 left-4 right-4 z-20">
          <p className="text-white text-[15px] font-medium bg-black/40 backdrop-blur-md rounded-2xl px-4 py-3">
            {story.caption}
          </p>
        </div>
      )}

      {/* Bottom — reply bar (own story shows viewers button instead) */}
      <div className="absolute bottom-4 left-3 right-3 z-30 flex items-center gap-2"
           style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        {isMine ? (
          <button
            onClick={() => setViewersOpen(true)}
            className="flex items-center gap-2 h-11 rounded-full bg-white/10 border border-white/20 backdrop-blur-md px-4 text-white font-bold text-[13.5px]"
          >
            <Eye size={16} />
            Seen by {viewers.length || 0}
          </button>
        ) : (
          <>
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value.slice(0, 200))}
              onKeyDown={(e) => { if (e.key === "Enter") sendReply() }}
              onFocus={pauseNow}
              onBlur={resumeNow}
              placeholder={"Reply to " + (group?.display_name?.split(" ")[0] || "them") + "…"}
              className="flex-1 h-11 rounded-full bg-white/10 border border-white/20 backdrop-blur-md px-4 text-white text-[14px] placeholder:text-white/60 focus:outline-none focus:bg-white/15"
            />
            {reply.trim() ? (
              <button
                onClick={sendReply}
                className="w-11 h-11 rounded-full grid place-items-center shrink-0"
                style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
                aria-label="Send reply"
              >
                <Send size={18} strokeWidth={2.6} className="text-white" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => setReactionOpen((o) => !o)}
                  className="w-11 h-11 rounded-full grid place-items-center shrink-0 bg-white/10 border border-white/20 backdrop-blur-md"
                  aria-label="Reactions"
                >
                  <span className="text-[18px]">😊</span>
                </button>
                <button
                  onClick={() => sendReaction("❤️")}
                  className="w-11 h-11 rounded-full grid place-items-center shrink-0 bg-white/10 border border-white/20 backdrop-blur-md"
                  aria-label="Like story"
                >
                  <Heart size={20} fill="#EC4899" color="#EC4899" />
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Reaction picker */}
      {reactionOpen && !isMine && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex gap-1 p-2 rounded-full bg-elevated border border-white/15 backdrop-blur-md shadow-2xl"
             onClick={(e) => e.stopPropagation()}>
          {REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => sendReaction(e)}
              className="w-9 h-9 rounded-full grid place-items-center text-[20px] active:scale-90 transition-transform"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Tap zones (behind the reply bar) */}
      <button
        onClick={() => {}}
        onMouseDown={onTouchStart}
        onMouseUp={(e) => onTouchEnd(e, back)}
        onTouchStart={onTouchStart}
        onTouchEnd={(e) => onTouchEnd(e, back)}
        aria-label="Previous"
        className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
      />
      <button
        onClick={() => {}}
        onMouseDown={onTouchStart}
        onMouseUp={(e) => onTouchEnd(e, advance)}
        onTouchStart={onTouchStart}
        onTouchEnd={(e) => onTouchEnd(e, advance)}
        aria-label="Next"
        className="absolute right-0 top-0 bottom-0 w-2/3 z-10"
      />

      {/* Paused indicator */}
      {paused && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
          <div className="w-16 h-16 rounded-full grid place-items-center bg-black/50 backdrop-blur-md border border-white/25">
            <span className="text-white text-[24px] leading-none" style={{ letterSpacing: -2 }}>❚❚</span>
          </div>
        </div>
      )}

      {/* Viewers sheet (own story) */}
      {viewersOpen && (
        <div className="fixed inset-0 z-[300] flex items-end" onClick={() => setViewersOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 flex flex-col"
            style={{ maxHeight: "75dvh" }}
          >
            <div className="shrink-0 px-5 pt-3 pb-3 border-b border-white/8">
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h3 className="text-cream font-extrabold text-[16px]">
                  Seen by {viewers.length}
                </h3>
                <button onClick={() => setViewersOpen(false)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {viewersLoading ? (
                <p className="text-subtle text-[12.5px] text-center py-10">Loading…</p>
              ) : viewers.length === 0 ? (
                <p className="text-subtle text-[12.5px] text-center py-10">No views yet</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {viewers.map((v) => (
                    <button
                      key={v.user_id + v.viewed_at}
                      onClick={() => { setViewersOpen(false); onClose?.(); nav("/messages/" + v.user_id) }}
                      className="flex items-center gap-3 p-3 rounded-2xl text-left active:scale-[0.98] transition-transform"
                    >
                      <span className="w-11 h-11 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0">
                        {v.photo_url ? (
                          <img src={v.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="w-full h-full grid place-items-center text-purple-400 font-black text-sm">
                            {(v.display_name || "?")[0]}
                          </span>
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-cream font-semibold text-[13.5px] truncate">
                          {v.display_name || v.username || "Someone"}
                        </p>
                        <p className="text-muted text-[12px]">
                          {new Date(v.viewed_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
