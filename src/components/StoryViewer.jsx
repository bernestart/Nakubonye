import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../lib/auth"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"
import { X, Send, Heart, MoreVertical, Eye, Volume2, VolumeX, Trash2, Star } from "lucide-react"

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
  const [reply, setReply] = useState("")
  const [reactionOpen, setReactionOpen] = useState(false)
  const [viewersOpen, setViewersOpen] = useState(false)
  const [viewers, setViewers] = useState([])
  const [viewersLoading, setViewersLoading] = useState(false)
  const [muted, setMuted] = useState(false)
  async function loadHighlights() {
    if (!myId) return
    try {
      const { data } = await supabase
        .from("story_highlights")
        .select("id, title, cover_story_id, created_at")
        .eq("user_id", myId)
        .order("created_at", { ascending: false })
      setMyHighlights(data || [])
    } catch (e) { console.warn("load highlights failed", e) }
  }

  async function addToHighlight(highlightId) {
    if (!story?.id || !highlightId) return
    try {
      // Prevent duplicate
      const { data: exists } = await supabase
        .from("story_highlight_items")
        .select("story_id")
        .eq("highlight_id", highlightId)
        .eq("story_id", story.id)
        .maybeSingle()
      if (!exists) {
        const { error } = await supabase.from("story_highlight_items").insert({
          highlight_id: highlightId,
          story_id: story.id,
          display_order: 0,
        })
        if (error) throw error
      }
      setHighlightPickerOpen(false)
      setMenuOpen(false)
      alert("Added to highlight")
    } catch (e) {
      console.warn("add to highlight failed", e)
      alert("Failed: " + (e.message || e))
    }
  }

  async function createHighlightAndAdd() {
    const title = newHighlightTitle.trim()
    if (!title || !myId) return
    try {
      const { data: h, error } = await supabase
        .from("story_highlights")
        .insert({ user_id: myId, title, cover_story_id: story?.id || null })
        .select("id")
        .single()
      if (error) throw error
      if (h?.id) await addToHighlight(h.id)
      setNewHighlightTitle("")
    } catch (e) {
      console.warn("create highlight failed", e)
      alert("Failed: " + (e.message || e))
    }
  }

  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false)
  const [myHighlights, setMyHighlights] = useState([])
  const [newHighlightTitle, setNewHighlightTitle] = useState("")

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

  function onTouchMove() {
    // no-op — drag-to-close removed
  }

  function onTouchEnd(e, tapAction) {
    clearTimeout(longPressTimer.current)
    if (pressFiredRef.current) {
      resumeNow()
      pressFiredRef.current = false
      return
    }
    if (tapAction) tapAction()
  }

  async function canReply() {
    if (!group?.user_id) return false
    const { data: session } = await supabase.auth.getSession()
    const myId = session?.session?.user?.id
    if (!myId) return false
    const { data: allowed, error } = await supabase.rpc('can_story_reply', {
      sender: myId,
      recipient: group.user_id,
    })
    if (error) return true // fail-open on error
    return allowed !== false
  }

  async function sendReply() {
    const body = reply.trim()
    if (!body || !group?.user_id) return
    const ok = await canReply()
    if (!ok) { setToast?.("This user isn't accepting story replies") || alert("This user isn't accepting story replies"); return }
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
    const ok = await canReply()
    if (!ok) { alert("This user isn't accepting story replies"); return }
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

  async function deleteStory() {
    if (!story || !isMine || deleting) return
    if (!confirm("Delete this story?")) return
    setDeleting(true)
    tap("light")
    try {
      // Delete storage object (best-effort)
      try {
        const url = story.media_url || ""
        const bucket = "stories"
        const marker = "/object/public/" + bucket + "/"
        const idx = url.indexOf(marker)
        if (idx !== -1) {
          const path = url.slice(idx + marker.length)
          await supabase.storage.from(bucket).remove([path])
        }
      } catch (e) { console.warn("storage delete failed", e) }

      const { error } = await supabase.from("stories").delete().eq("id", story.id).eq("user_id", myId)
      if (error) throw error

      setDeleting(false)
      setMenuOpen(false)

      // If there are more stories in this group, go next
      const list = group?.stories || []
      if (list.length > 1) {
        // Parent re-fetch on close is cleaner
        onViewed?.(story.id)
        // If the deleted story was the current, move to next or close
        if (storyIdx < list.length - 1) {
          setStoryIdx(storyIdx + 1)
          setProgress(0)
          startRef.current = Date.now()
          accumulatedRef.current = 0
        } else if (list.length === 1) {
          close()
        } else {
          setStoryIdx(0)
          setProgress(0)
        }
      } else {
        close()
      }
    } catch (e) {
      console.warn("delete story failed", e)
      setDeleting(false)
    }
  }

  function close() {
    onClose?.()
  }

  if (!story) return null

  const groupStories = group?.stories || []

  return createPortal(
    <div
      className="fixed inset-0 z-[220] bg-black select-none overflow-hidden"
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
        {isMine && (
          <button
            onClick={() => { tap("light"); setMenuOpen(true) }}
            className="w-8 h-8 rounded-full grid place-items-center text-white"
            aria-label="Story options"
          >
            <MoreVertical size={18} />
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
      {/* Owner menu — delete story */}
      {menuOpen && (
        <div
          className="absolute inset-0 z-[300] flex items-end"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <button
              onClick={() => { tap("light"); loadHighlights(); setHighlightPickerOpen(true); setMenuOpen(false) }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
            >
              <span className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 grid place-items-center">
                <Star size={17} color="#C084FC" />
              </span>
              <span className="text-cream font-semibold text-[14.5px]">Add to highlight</span>
            </button>

            <button
              onClick={deleteStory}
              disabled={deleting}
              className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/8 border border-red-500/25 text-left disabled:opacity-50"
            >
              <span className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 grid place-items-center">
                <Trash2 size={17} color="#F87171" />
              </span>
              <span className="text-cream font-semibold text-[14.5px]">
                {deleting ? "Deleting…" : "Delete story"}
              </span>
            </button>
            <button
              onClick={() => setMenuOpen(false)}
              className="w-full h-11 mt-2 text-muted font-semibold text-[13.5px]"
            >Cancel</button>
          </div>
        </div>
      )}

      {highlightPickerOpen && (
        <div
          className="absolute inset-0 z-[400] flex items-end"
          onClick={(e) => { e.stopPropagation(); setHighlightPickerOpen(false) }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-3"
            style={{ maxHeight: "75dvh", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-1" />
            <h3 className="text-cream font-extrabold text-[16px] mb-1">Add to highlight</h3>

            <div className="flex gap-2">
              <input
                value={newHighlightTitle}
                onChange={(e) => setNewHighlightTitle(e.target.value.slice(0, 40))}
                placeholder="New highlight name…"
                className="flex-1 h-11 rounded-full bg-white/[0.06] border border-white/10 px-4 text-cream text-[14px] placeholder:text-muted focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={createHighlightAndAdd}
                disabled={!newHighlightTitle.trim()}
                className="h-11 px-4 rounded-full text-white font-bold text-[13px] disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
              >
                Create
              </button>
            </div>

            {myHighlights.length > 0 && (
              <>
                <p className="text-muted text-[11px] font-bold uppercase tracking-wide mt-2">Your highlights</p>
                <div className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto">
                  {myHighlights.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => addToHighlight(h.id)}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/8 text-left active:opacity-80"
                    >
                      <span className="w-10 h-10 rounded-full bg-purple-600 grid place-items-center text-white font-black text-[14px]">
                        {h.title[0]?.toUpperCase()}
                      </span>
                      <span className="flex-1 text-cream font-semibold text-[14px] truncate">{h.title}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>,
    document.body
  )
}
