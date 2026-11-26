import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, Play , Loader2 } from "lucide-react"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import "../lib/authFetch";   // side-effect: patches window.fetch to attach Bearer token
import StoryComposer from "./StoryComposer"
import StoryViewer from "./StoryViewer"
import StoryRing from "./StoryRing";
import { API_BASE_URL } from '../lib/api';

const TILE_W = 112
const TILE_H = 190

export default function StoriesRow() {
  const { session, profile } = useAuth()
  const myId = session?.user?.id
  const [groups, setGroups] = useState([])
  const [myStory, setMyStory] = useState(null)
  const [myPhoto, setMyPhoto] = useState(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [pendingStories, setPendingStories] = useState([])
  const [viewerState, setViewerState] = useState(null)
  const stripRef = useRef(null)
  const [viewed, setViewed] = useState(() => {
    try { return JSON.parse(localStorage.getItem("story_views") || "{}") } catch { return {} }
  })
  const viewedRef = useRef(viewed)
  useEffect(() => { viewedRef.current = viewed }, [viewed])

  const viewQueueRef = useRef([])
  const flushTimerRef = useRef(null)
  const flushViews = useCallback(async () => {
    if (!viewQueueRef.current.length) return
    const ids = [...new Set(viewQueueRef.current)]
    viewQueueRef.current = []
    try {
      await fetch(`${API_BASE_URL}/api/stories/views`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ story_ids: ids }) })
    } catch {}
  }, [])

  useEffect(() => {
    const onHide = () => { flushViews() }
    window.addEventListener("pagehide", onHide)
    window.addEventListener("beforeunload", onHide)
    return () => {
      window.removeEventListener("pagehide", onHide)
      window.removeEventListener("beforeunload", onHide)
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
      flushViews()
    }
  }, [flushViews])

  const load = useCallback(async () => {
    if (!myId) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/stories/feed?limit=30`)
      const j = await res.json()
      if (!j.success) return
      const data = j.data || {}
      const rings = data.rings || []
      const nextViewed = { ...viewedRef.current }
      for (const ring of rings) for (const s of ring.stories) if (s.viewed) nextViewed[s.id] = true
      setViewed(nextViewed)
      try { localStorage.setItem("story_views", JSON.stringify(nextViewed)) } catch {}
      setMyPhoto(data.my_avatar_path ? publicPhotoUrl(data.my_avatar_path) : null)
      if (data.my_story && data.my_story.stories && data.my_story.stories.length) {
        setMyStory({ user_id: myId, display_name: data.my_story.display_name || profile?.display_name || "You", stories: data.my_story.stories })
      } else setMyStory(null)
      setGroups(rings)
    } catch {}
  }, [myId, profile])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") load() }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [load])

  function markViewed(userId, storyId) {
    const next = { ...viewedRef.current, [storyId]: true }
    setViewed(next)
    try { localStorage.setItem("story_views", JSON.stringify(next)) } catch {}
    if (userId === myId) return
    viewQueueRef.current.push(storyId)
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    flushTimerRef.current = setTimeout(flushViews, 2000)
  }

  // 1. Grab pending optimistic stories for the current user
  const pendingForMe = pendingStories.filter(p => p.user_id === myId);
  
  // 2. Merge them into myStory (or create a temp myStory if it's the first upload)
  const effectiveMyStory = myStory ? {
    ...myStory,
    stories: [...(myStory.stories || []), ...pendingForMe]
  } : (pendingForMe.length > 0 ? {
    user_id: myId,
    display_name: profile?.display_name || "You",
    photo_url: profile?.photo_url,
    stories: pendingForMe
  } : null);

  // 3. Build the final allGroups array
  const allGroups = effectiveMyStory ? [effectiveMyStory, ...groups] : groups;

  function tileBody(group) {
    const first = group.stories[0]
    if (!first) return null
    if (first.media_type === "video") {
      return (
        <>
          <video src={first.media_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
          <span className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full grid place-items-center bg-black/60">
            <Play size={10} fill="#fff" strokeWidth={0} />
          </span>
        </>
      )
    }
    return <img src={first.media_url} alt="" className="w-full h-full object-cover" />
  }

  function addPendingStory(item) { setPendingStories((c) => [item, ...c]) }
  function resolvePendingStory(tempId) { setPendingStories((c) => c.filter((x) => x._tempId !== tempId)) }
  function failPendingStory(tempId, error) {
    setPendingStories((c) => c.map((x) => x._tempId === tempId ? { ...x, _status: "failed", _error: error } : x))
  }

  return (
    <>
      <div ref={stripRef} className="flex gap-2.5 overflow-x-auto px-3 py-2.5" style={{ scrollbarWidth: "none" }}>
        {/* Create story */}
        <button
          type="button"
          onClick={() => { tap("light"); setComposerOpen(true) }}
          className="shrink-0 relative overflow-hidden"
          style={{
            width: TILE_W, height: TILE_H,
            borderRadius: 14,
            background: "linear-gradient(160deg, #2E1065 0%, #7C3AED 100%)",
          }}
        >
          {myPhoto && (
            <img src={myPhoto} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          )}
          <div className="absolute inset-0 grid place-items-center">
            <div className="w-11 h-11 rounded-full grid place-items-center"
              style={{ background: "#1D4ED8", border: "3px solid #fff", boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}>
              <Plus size={22} strokeWidth={3.4} color="#fff" />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-2 pb-2 pt-8"
            style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.75))" }}>
            <span className="text-white text-[11px] font-bold truncate block text-left">Create story</span>
          </div>
        </button>

        {/* Your story */}
        {myStory && (
          <button
            type="button"
            onClick={() => { tap("light"); setViewerState({ startIndex: 0 }) }}
            className="shrink-0 relative overflow-hidden"
            style={{
              width: TILE_W, height: TILE_H,
              borderRadius: 12,
              border: "2px solid transparent",
              background: "linear-gradient(#0B0B14,#0B0B14) padding-box, linear-gradient(135deg,#C084FC,#EC4899) border-box",
            }}
          >
            {tileBody(myStory)}
            <span className="absolute top-1.5 right-1.5 z-10 h-6 px-1.5 rounded-full grid place-items-center text-white text-[10.5px] font-black"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
              {myStory.stories.length}
            </span>
            <div className="absolute inset-x-0 bottom-0 px-2 pb-2 pt-8"
              style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.80) 60%)" }}>
              <span className="text-white text-[11.5px] font-bold truncate block text-left leading-tight">Your story</span>
              {myStory.stories[0]?.created_at && (
                <span className="text-white/70 text-[9.5px] font-medium truncate block text-left">
                  {(() => {
                    const diff = Date.now() - new Date(myStory.stories[0].created_at).getTime()
                    const mins = Math.floor(diff / 60000)
                    if (mins < 60) return mins + "m"
                    return Math.floor(mins / 60) + "h"
                  })()}
                </span>
              )}
            </div>
          </button>
        )}

        {/* Pending */}
        
  {Object.values(pendingStories.reduce((acc, ps) => {
    if (!acc[ps.user_id]) acc[ps.user_id] = { ...ps, _count: 0, _items: [] };
    acc[ps.user_id]._count++;
    acc[ps.user_id]._items.push(ps);
    return acc;
  }, {})).map((groupedPending) => (
    <div 
      key={groupedPending.user_id} 
      onClick={() => { 
        tap("light"); 
        // Open viewer at the index of this user in allGroups
        const idx = allGroups.findIndex(x => x.user_id === groupedPending.user_id);
        if (idx !== -1) setViewerState({ startIndex: idx });
      }}
      className="shrink-0 relative overflow-hidden bg-black cursor-pointer" 
      style={{ width: TILE_W, height: TILE_H, borderRadius: 12, border: "2.5px solid transparent" }}
    >
      {groupedPending._localPreview ? (
        <img src={groupedPending._localPreview} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-black opacity-60" />
      )}
      <div className="absolute top-2 right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
        {groupedPending._count}
      </div>
      {groupedPending._items && groupedPending._items.some((x) => x._status === "failed") ? (
        <>
          <div className="absolute inset-0 grid place-items-center bg-red-900/60 px-1">
            <span className="text-white text-[10px] font-bold text-center leading-tight">Upload failed</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setPendingStories((c) => c.filter((x) => !(x.user_id === groupedPending.user_id && x._status === "failed")))
            }}
            className="absolute bottom-4 left-1 right-1 text-[9px] font-bold text-white/80 underline"
          >
            Dismiss
          </button>
        </>
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <Loader2 className="animate-spin text-white/50" size={24} />
        </div>
      )}
      <div className="absolute bottom-1 left-1 right-1 text-[10px] font-bold text-white drop-shadow truncate">Your story</div>
    </div>
  ))}
  
        {/* Other users */}
        {groups.map((g) => {
          const seen = g.stories.every((s) => viewed[s.id])
          const idx = allGroups.findIndex((x) => x.user_id === g.user_id)
          return (
            <button
              key={g.user_id}
              onClick={() => { tap("light"); setViewerState({ startIndex: idx }) }}
              className="shrink-0 relative overflow-hidden"
              style={{
                width: TILE_W, height: TILE_H,
                borderRadius: 12,
                border: seen ? "2px solid rgba(255,255,255,0.32)" : "2.5px solid transparent",
                background: (() => {
                  if (seen) return "rgba(255,255,255,0.02)"
                  const first = g.stories[0]
                  const aud = first?.audience
                  if (aud === "inner_circle" || aud === "close") {
                    return "linear-gradient(#0B0B14,#0B0B14) padding-box, linear-gradient(135deg,#10B981,#34D399) border-box"
                  }
                  return "linear-gradient(#0B0B14,#0B0B14) padding-box, linear-gradient(135deg,#C084FC,#EC4899) border-box"
                })(),
              }}
            >
              {tileBody(g)}
              
              {/* FACEBOOK-STYLE STORY RING AVATAR */}
              <div className="absolute top-2 left-2 z-10">
                <StoryRing user={g} viewedStories={viewed} size={36}>
                  <img 
                    src={g.photo_url || g.avatar_path || ""} 
                    alt="" 
                    className="w-full h-full object-cover bg-gray-800" 
                  />
                </StoryRing>
              </div>

              <div className="absolute inset-x-0 bottom-0 px-2 pb-2 pt-8"
                style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.80) 60%)" }}>
                <span className="text-white text-[11.5px] font-bold truncate block text-left leading-tight">
                  {g.display_name.split(" ")[0]}
                </span>
                {g.stories[0]?.created_at && (
                  <span className="text-white/70 text-[9.5px] font-medium truncate block text-left">
                    {(() => {
                      const diff = Date.now() - new Date(g.stories[0].created_at).getTime()
                      const mins = Math.floor(diff / 60000)
                      if (mins < 60) return `${mins}m`
                      const hrs = Math.floor(mins / 60)
                      return `${hrs}h`
                    })()}
                  </span>
                )}
              </div>
              {(() => {
                const first = g.stories[0]
                const aud = first?.audience
                if (aud !== "inner_circle" && aud !== "close") return null
                return (
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wider"
                    style={{ background: "linear-gradient(135deg,#10B981,#34D399)", color: "#fff" }}>
                    💫 IC
                  </span>
                )
              })()}
            </button>
          )
        })}

        {/* Invite */}
        {groups.length === 0 && (
          <button
            onClick={async () => {
              tap("light")
              const url = window.location.origin
              const text = "Join me on Nakubonye — share your story. " + url
              if (navigator.share) {
                try { await navigator.share({ title: "Nakubonye", text, url }) } catch {}
              } else {
                try { await navigator.clipboard.writeText(text); alert("Link copied!") } catch {}
              }
            }}
            className="shrink-0 relative overflow-hidden"
            style={{
              width: TILE_W, height: TILE_H,
              borderRadius: 14,
              border: "2px dashed rgba(168,85,247,0.35)",
              background: "linear-gradient(160deg, rgba(168,85,247,0.08) 0%, rgba(236,72,153,0.06) 100%)",
            }}
          >
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center px-2">
                <div className="w-10 h-10 rounded-full grid place-items-center mx-auto mb-2"
                  style={{ background: "linear-gradient(135deg, #C084FC 0%, #EC4899 100%)", boxShadow: "0 4px 14px rgba(168,85,247,0.4)" }}>
                  <span className="text-white text-[20px] leading-none">+</span>
                </div>
                <p className="text-cream text-[11px] font-bold leading-tight">Invite friends</p>
                <p className="text-muted text-[9.5px] mt-1 leading-tight">Share your link</p>
              </div>
            </div>
          </button>
        )}
      </div>

      {composerOpen && (
        <StoryComposer
          onClose={() => setComposerOpen(false)}
          onDone={() => { setComposerOpen(false); load() }}
          onOptimistic={addPendingStory}
          onResolve={(tempId) => { resolvePendingStory(tempId); load() }}
          onFail={failPendingStory}
          onRetryStart={(tempId) => setPendingStories((c) => c.map((x) => x._tempId === tempId ? { ...x, _status: "uploading", _error: null } : x))}
        />
      )}

      {viewerState && (
        <StoryViewer
          groups={allGroups}
          startIndex={viewerState.startIndex}
          onClose={() => { setViewerState(null); load() }}
          onViewed={markViewed}
        />
      )}
    </>
  )
}
