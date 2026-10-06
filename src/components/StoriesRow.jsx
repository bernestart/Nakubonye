import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, Play } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import StoryComposer from "./StoryComposer"
import StoryViewer from "./StoryViewer"

const TILE_W = 112
const TILE_H = 190

async function filterStoriesByVisibility(stories, myId) {
  const ownerIds = [...new Set(stories.map((r) => r.user_id).filter((id) => id !== myId))]
  if (ownerIds.length === 0) return stories
  const [settingsRes, blocksRes, matchesRes, followsRes, innerCircleRes] = await Promise.all([
    supabase.from('user_settings').select('user_id, who_can_see_story').in('user_id', ownerIds),
    supabase.from('blocks').select('blocker_id, blocked_id').or(`blocker_id.eq.${myId},blocked_id.eq.${myId}`),
    supabase.from('matches').select('user_one_id, user_two_id').or(`user_one_id.eq.${myId},user_two_id.eq.${myId}`),
    supabase.from('follows').select('following_id').eq('follower_id', myId),
    supabase.from('story_hides').select('hidden_user_id').eq('owner_id', myId),
    supabase.from('inner_circle').select('user_id, member_id').or(`user_id.eq.${myId},member_id.eq.${myId}`),
  ])
  const settingsMap = new Map((settingsRes.data || []).map((r) => [r.user_id, r.who_can_see_story || 'everyone']))
  const blockedSet = new Set()
  ;(blocksRes.data || []).forEach((b) => {
    if (b.blocker_id === myId) blockedSet.add(b.blocked_id)
    if (b.blocked_id === myId) blockedSet.add(b.blocker_id)
  })
  const matchSet = new Set()
  ;(matchesRes.data || []).forEach((m) => {
    if (m.user_one_id === myId) matchSet.add(m.user_two_id)
    if (m.user_two_id === myId) matchSet.add(m.user_one_id)
  })
  const followSet = new Set((followsRes.data || []).map((f) => f.following_id))
  const storyHiddenSet = new Set((storyHidesRes?.data || []).map((r) => r.hidden_user_id))

  // Inner Circle: which owners have me in their circle
  const innerCircleVisibleSet = new Set()
  ;(innerCircleRes?.data || []).forEach((row) => {
    if (row.member_id === myId) innerCircleVisibleSet.add(row.user_id)
  })

  return stories.filter((r) => {
    if (r.user_id === myId) return true
    if (blockedSet.has(r.user_id)) return false
    if (storyHiddenSet.has(r.user_id)) return false
    const aud = r.audience && r.audience !== 'default' ? r.audience : (settingsMap.get(r.user_id) || 'everyone')
    if (aud === 'everyone' || aud === 'public') return true
    if (aud === 'nobody' || aud === 'private') return false
    if (aud === 'matches') return matchSet.has(r.user_id)
    if (aud === 'following') return followSet.has(r.user_id)
    return true
  })
}

export default function StoriesRow() {
  const { session, profile } = useAuth()
  const myId = session?.user?.id
  const [groups, setGroups] = useState([])
  const [myStory, setMyStory] = useState(null)
  const [myPhoto, setMyPhoto] = useState(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [pendingStories, setPendingStories] = useState([])
  const [viewerState, setViewerState] = useState(null)
  const [storiesCursor, setStoriesCursor] = useState(null)
  const [storiesHasMore, setStoriesHasMore] = useState(true)
  const [storiesLoadingMore, setStoriesLoadingMore] = useState(false)
  const stripRef = useRef(null)
  const [viewed, setViewed] = useState(() => {
    try { return JSON.parse(localStorage.getItem("story_views") || "{}") } catch { return {} }
  })

  const load = useCallback(async () => {
    if (!myId) return

    // My own photo (for empty "My story" tile)
    const { data: myPh } = await supabase
      .from("profile_photos")
      .select("storage_path")
      .eq("user_id", myId)
      .order("is_primary", { ascending: false })
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle()
    setMyPhoto(myPh?.storage_path ? publicPhotoUrl(myPh.storage_path) : null)

    const { data: rows } = await supabase
      .from("stories")
      .select("id, user_id, media_url, media_type, caption, created_at, expires_at, audience")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(30)

    if (!rows) return

    // ─── Filter stories by visibility ───
    const visibleStories = await filterStoriesByVisibility(rows, myId)

    const byUser = new Map()
    visibleStories.forEach((s) => {
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, [])
      byUser.get(s.user_id).push(s)
    })

    const userIds = [...byUser.keys()]
    if (userIds.length === 0) { setGroups([]); setMyStory(null); return }

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", userIds)
    const pMap = new Map((profs || []).map((p) => [p.id, p]))

    const { data: photos } = await supabase
      .from("profile_photos")
      .select("user_id, storage_path, is_primary, display_order")
      .in("user_id", userIds)
      .order("is_primary", { ascending: false })
      .order("display_order", { ascending: true })
    const photoMap = new Map()
    ;(photos || []).forEach((p) => {
      if (!photoMap.has(p.user_id)) photoMap.set(p.user_id, p.storage_path)
    })

    const list = userIds.map((uid) => {
      const prof = pMap.get(uid)
      const sorted = byUser.get(uid).slice().reverse()
      return {
        user_id: uid,
        display_name: prof?.display_name || prof?.username || "Someone",
        avatar_path: photoMap.get(uid),
        stories: sorted,
      }
    })

    const mine = list.find((g) => g.user_id === myId)
    const others = list.filter((g) => g.user_id !== myId)
    others.sort((a, b) => {
      const aSeen = a.stories.every((s) => viewed[s.id])
      const bSeen = b.stories.every((s) => viewed[s.id])
      return Number(aSeen) - Number(bSeen)
    })

    setMyStory(mine || null)
    setGroups(others)
    // Cursor for pagination — oldest story loaded
    const oldest = visibleStories[visibleStories.length - 1]?.created_at || rows[rows.length - 1]?.created_at || null
    setStoriesCursor(oldest)
    setStoriesHasMore(rows.length === 30)
  }, [myId, viewed])

  useEffect(() => { load() }, [load])

  async function loadMoreStories() {
    if (!myId || storiesLoadingMore || !storiesHasMore || !storiesCursor) return
    setStoriesLoadingMore(true)

    const { data: rows } = await supabase
      .from("stories")
      .select("id, user_id, media_url, media_type, caption, created_at, expires_at, audience")
      .gt("expires_at", new Date().toISOString())
      .lt("created_at", storiesCursor)
      .order("created_at", { ascending: false })
      .limit(30)

    if (!rows || rows.length === 0) {
      setStoriesHasMore(false)
      setStoriesLoadingMore(false)
      return
    }

    const visibleRows = await filterStoriesByVisibility(rows, myId)

    // Filter out stories already present by user_id (avoid duplicates)
    const existingUserIds = new Set([...groups.map((g) => g.user_id), ...(myStory ? [myStory.user_id] : [])])
    const newRows = visibleRows.filter((r) => !existingUserIds.has(r.user_id))

    if (newRows.length === 0) {
      setStoriesHasMore(rows.length === 30)
      setStoriesLoadingMore(false)
      if (rows.length === 30) {
        // recurse — this page was all already-known users
        return loadMoreStories()
      }
      return
    }

    // Group new stories by user
    const byUser = new Map()
    newRows.forEach((st) => {
      if (!byUser.has(st.user_id)) byUser.set(st.user_id, [])
      byUser.get(st.user_id).push(st)
    })

    const userIds = [...byUser.keys()]
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", userIds)
      const pMap = new Map((profs || []).map((p) => [p.id, p]))

      const { data: photos } = await supabase
        .from("profile_photos")
        .select("user_id, storage_path, is_primary, display_order")
        .in("user_id", userIds)
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
      const photoMap = new Map()
      ;(photos || []).forEach((pp) => {
        if (!photoMap.has(pp.user_id)) photoMap.set(pp.user_id, pp.storage_path)
      })

      const list = userIds.map((uid) => {
        const prof = pMap.get(uid)
        const sorted = byUser.get(uid).slice().reverse()
        return {
          user_id: uid,
          display_name: prof?.display_name || prof?.username || "Someone",
          avatar_path: photoMap.get(uid),
          stories: sorted,
        }
      })

      setGroups((prev) => [...prev, ...list])
    }

    setStoriesCursor(rows[rows.length - 1].created_at)
    setStoriesHasMore(rows.length === 30)
    setStoriesLoadingMore(false)
  }

  // Watch scroll on the strip — load more when near the end
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const onScroll = () => {
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 300) loadMoreStories()
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [loadMoreStories])

  useEffect(() => {
    if (!myId) return
    const ch = supabase
      .channel("stories-row-" + myId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stories" }, () => load())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "stories" }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [myId, load])

  function markViewed(userId, storyId) {
    // Local seen-state (fast)
    const next = { ...viewed, [storyId]: true }
    setViewed(next)
    try { localStorage.setItem("story_views", JSON.stringify(next)) } catch {}

    // Record view in DB (skip my own stories)
    if (userId === myId) return
    supabase
      .from("story_views")
      .upsert(
        { story_id: storyId, user_id: myId },
        { onConflict: "story_id,user_id", ignoreDuplicates: true }
      )
      .then(() => {})
  }

  const allGroups = myStory ? [myStory, ...groups] : groups

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
        {/* Create story — always visible */}
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

        {/* Your story — only if you have one */}
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

        {/* Pending stories */}
        {pendingStories.map((ps) => (
          <div
            key={ps._tempId}
            className="shrink-0 relative overflow-hidden"
            style={{
              width: TILE_W, height: TILE_H, borderRadius: 12,
              border: "2px solid transparent",
              background: "linear-gradient(#0B0B14,#0B0B14) padding-box, linear-gradient(135deg,#C084FC,#EC4899) border-box",
            }}
          >
            {ps.media_type === "video" ? (
              <video src={ps.media_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
            ) : (
              <img src={ps.media_url} alt="" className="w-full h-full object-cover" />
            )}
            {ps._status === "uploading" && (
              <div className="absolute inset-0 grid place-items-center bg-black/45">
                <span className="w-7 h-7 rounded-full border-2 border-white border-t-transparent animate-spin" />
              </div>
            )}
            {ps._status === "failed" && (
              <div className="absolute inset-0 grid place-items-center bg-black/65 px-2">
                <div className="text-center">
                  <p className="text-red-300 text-[10px] font-bold mb-1.5 leading-tight">Upload failed</p>
                  <div className="flex gap-1 justify-center">
                    <button
                      onClick={() => setPendingStories((c) => c.filter((x) => x._tempId !== ps._tempId))}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-cream"
                    >
                      Discard
                    </button>
                    <button
                      onClick={() => ps._retry?.()}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                      style={{ background: "linear-gradient(135deg,#EC4899,#A855F7)" }}
                    >
                      Retry
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 px-2 pb-2 pt-8"
                 style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.80) 60%)" }}>
              <span className="text-white text-[11.5px] font-bold truncate block text-left leading-tight">Your story</span>
              <span className="text-white/70 text-[9.5px] font-medium block text-left">Uploading…</span>
            </div>
          </div>
        ))}

        {/* Other users tiles */}
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
                border: seen ? "1.5px solid rgba(255,255,255,0.12)" : "2px solid transparent",
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

        {/* Invite friends tile — only when nobody else has a story */}
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
              width: TILE_W,
              height: TILE_H,
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
        {pendingStories.map((ps) => (
          <div key={ps._tempId} className="shrink-0 relative overflow-hidden"
            style={{
              width: TILE_W, height: TILE_H, borderRadius: 14,
              border: "2px solid transparent",
              background: "linear-gradient(#0B0B14,#0B0B14) padding-box, linear-gradient(135deg,#C084FC,#EC4899) border-box",
            }}
          >
            {ps.media_type === "video"
              ? <video src={ps.media_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
              : <img src={ps.media_url} alt="" className="w-full h-full object-cover" />}

            {ps._status === "uploading" && (
              <div className="absolute inset-0 grid place-items-center bg-black/45">
                <span className="w-7 h-7 rounded-full border-2 border-white border-t-transparent animate-spin" />
              </div>
            )}

            {ps._status === "failed" && (
              <div className="absolute inset-0 grid place-items-center bg-black/65 px-2">
                <div className="text-center">
                  <p className="text-red-300 text-[10px] font-bold mb-1.5 leading-tight">Upload failed</p>
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => setPendingStories((c) => c.filter((x) => x._tempId !== ps._tempId))}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-cream">Discard</button>
                    <button onClick={() => ps._retry?.()}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                      style={{ background: "linear-gradient(135deg,#EC4899,#A855F7)" }}>Retry</button>
                  </div>
                </div>
              </div>
            )}

            <div className="absolute bottom-1 left-1 right-1 text-[10px] font-bold text-white drop-shadow truncate">Your story</div>
          </div>
        ))}
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
