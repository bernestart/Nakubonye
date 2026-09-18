import { useCallback, useEffect, useState } from "react"
import { Plus, Play } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import StoryComposer from "./StoryComposer"
import StoryViewer from "./StoryViewer"

const TILE_W = 105
const TILE_H = 170

export default function StoriesRow() {
  const { session, profile } = useAuth()
  const myId = session?.user?.id
  const [groups, setGroups] = useState([])
  const [myStory, setMyStory] = useState(null)
  const [myPhoto, setMyPhoto] = useState(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [viewerState, setViewerState] = useState(null)
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
      .select("id, user_id, media_url, media_type, caption, created_at, expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(200)

    if (!rows) return

    const byUser = new Map()
    rows.forEach((s) => {
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
  }, [myId, viewed])

  useEffect(() => { load() }, [load])

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
    const next = { ...viewed, [storyId]: true }
    setViewed(next)
    try { localStorage.setItem("story_views", JSON.stringify(next)) } catch {}
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

  return (
    <>
      <div className="flex gap-2.5 overflow-x-auto px-3 py-2.5" style={{ scrollbarWidth: "none" }}>
        {/* My story tile */}
        <button
          onClick={() => { tap("light"); myStory ? setViewerState({ startIndex: 0 }) : setComposerOpen(true) }}
          className="shrink-0 relative overflow-hidden"
          style={{
            width: TILE_W, height: TILE_H,
            borderRadius: 14,
            border: myStory ? "2px solid transparent" : "2px solid rgba(255,255,255,0.12)",
            background: myStory
              ? "linear-gradient(#0B0B14,#0B0B14) padding-box, linear-gradient(135deg,#C084FC,#EC4899) border-box"
              : "rgba(255,255,255,0.03)",
          }}
        >
          {myStory ? tileBody(myStory) : (
            myPhoto
              ? <img src={myPhoto} alt="" className="w-full h-full object-cover opacity-70" />
              : <div className="w-full h-full grid place-items-center bg-elevated text-purple-400 font-black text-2xl">
                  {(profile?.display_name || "Y")[0]}
                </div>
          )}

          {/* Plus badge — big circle when no story, small corner badge when story exists */}
          {!myStory ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); tap("light"); setComposerOpen(true) }}
              aria-label="Add story"
              className="absolute left-1/2 -translate-x-1/2"
              style={{ top: 12, width: 34, height: 34, borderRadius: 999, background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}
            >
              <Plus size={20} strokeWidth={3.2} color="#0B0B14" />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); tap("light"); setComposerOpen(true) }}
              aria-label="Add story"
              className="absolute grid place-items-center"
              style={{ top: 6, left: 6, width: 24, height: 24, borderRadius: 999, background: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }}
            >
              <Plus size={14} strokeWidth={3.2} color="#0B0B14" />
            </button>
          )}

          {/* Bottom gradient + label */}
          <div className="absolute inset-x-0 bottom-0 px-2 pb-2 pt-6"
            style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.75))" }}>
            <span className="text-white text-[11px] font-bold truncate block text-left">My story</span>
          </div>
        </button>

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
                borderRadius: 14,
                border: seen ? "2px solid rgba(255,255,255,0.15)" : "2px solid transparent",
                background: seen
                  ? "rgba(255,255,255,0.03)"
                  : "linear-gradient(#0B0B14,#0B0B14) padding-box, linear-gradient(135deg,#C084FC,#EC4899) border-box",
              }}
            >
              {tileBody(g)}
              <div className="absolute inset-x-0 bottom-0 px-2 pb-2 pt-6"
                style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.75))" }}>
                <span className="text-white text-[11px] font-bold truncate block text-left">
                  {g.display_name.split(" ")[0]}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {composerOpen && (
        <StoryComposer
          onClose={() => setComposerOpen(false)}
          onDone={() => { setComposerOpen(false); load() }}
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
