import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Heart, MessageCircle, Share2, Plus, Volume2, VolumeX, ArrowLeft } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import ReelComposer from "../components/ReelComposer"

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
  const containerRef = useRef(null)
  const videoRefs = useRef([])

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true)
    const { data: rows } = await supabase
      .from("reels")
      .select("id, user_id, video_url, thumbnail_url, caption, duration_sec, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50)

    const list = rows || []
    setReels(list)

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
    }
    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  // Autoplay the currently visible video, pause others
  useEffect(() => {
    reels.forEach((_, i) => {
      const v = videoRefs.current[i]
      if (!v) return
      if (i === currentIdx) {
        v.currentTime = 0
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
        <div className="absolute inset-0 grid place-items-center text-white/60 text-[14px]">Loading reels…</div>
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
          {reels.map((reel, idx) => {
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
                  src={reel.video_url}
                  loop
                  muted={muted}
                  playsInline
                  preload="metadata"
                  onClick={() => {
                    const v = videoRefs.current[idx]
                    if (!v) return
                    if (v.paused) v.play().catch(() => {})
                    else v.pause()
                  }}
                  className="w-full h-full object-cover"
                />

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

                  <button
                    onClick={() => { tap("light"); setComposerOpen(true) }}
                    className="flex flex-col items-center gap-1"
                    aria-label="Comment"
                  >
                    <span
                      className="w-12 h-12 rounded-full grid place-items-center"
                      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}
                    >
                      <MessageCircle size={24} strokeWidth={2.4} color="#fff" />
                    </span>
                    <span className="text-white text-[11px] font-bold">Chat</span>
                  </button>

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
                </div>

                {/* Bottom info: author + caption */}
                <div className="absolute left-3 right-20 bottom-24 z-20">
                  <div className="flex items-center gap-2.5 mb-2">
                    <button
                      onClick={() => { tap("light"); nav("/profile/" + reel.user_id) }}
                      className="w-10 h-10 rounded-full overflow-hidden bg-black/40 border border-white/20 shrink-0"
                    >
                      {photo ? (
                        <img src={publicPhotoUrl(photo)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-white font-black text-sm">
                          {name[0]}
                        </div>
                      )}
                    </button>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-[14px] truncate">
                        {name} {prof?.is_verified && <span className="text-purple-300">✓</span>}
                      </p>
                    </div>
                  </div>
                  {reel.caption && (
                    <p className="text-white/95 text-[14px] leading-[1.4] whitespace-pre-wrap" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
                      {reel.caption}
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
    </div>
  )
}
