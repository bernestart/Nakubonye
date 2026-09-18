import { useCallback, useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import StoryComposer from "./StoryComposer"
import StoryViewer from "./StoryViewer"

export default function StoriesRow() {
  const { session, profile } = useAuth()
  const myId = session?.user?.id
  const [groups, setGroups] = useState([])
  const [myStory, setMyStory] = useState(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [viewerState, setViewerState] = useState(null)
  const [viewed, setViewed] = useState(() => {
    try { return JSON.parse(localStorage.getItem("story_views") || "{}") } catch { return {} }
  })

  const load = useCallback(async () => {
    if (!myId) return
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
      return {
        user_id: uid,
        display_name: prof?.display_name || prof?.username || "Someone",
        avatar_path: photoMap.get(uid),
        stories: byUser.get(uid).slice().reverse(), // oldest → newest for playback
      }
    })

    // Put my own story first if I have one, then others; unviewed first
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

  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-3 py-2.5" style={{ scrollbarWidth: "none" }}>
        {/* Your story / Add story tile */}
        <button
          onClick={() => { tap("light"); myStory ? setViewerState({ startIndex: 0 }) : setComposerOpen(true) }}
          onContextMenu={(e) => { e.preventDefault(); setComposerOpen(true) }}
          className="shrink-0 flex flex-col items-center gap-1.5"
          style={{ width: 66 }}
        >
          <div className="relative w-14 h-14 rounded-full p-[2px]"
            style={{ background: myStory ? "linear-gradient(135deg,#C084FC,#EC4899)" : "rgba(255,255,255,0.15)" }}>
            <div className="w-full h-full rounded-full overflow-hidden bg-elevated border-2 border-[#0B0B14]">
              {myStory?.avatar_path || profile?.photo_url ? (
                <img src={myStory?.avatar_path ? publicPhotoUrl(myStory.avatar_path) : profile.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center text-purple-400 font-black text-base">
                  {(profile?.display_name || "Y")[0]}
                </div>
              )}
            </div>
            {!myStory && (
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full grid place-items-center bg-purple-600 border-2 border-[#0B0B14]">
                <Plus size={11} strokeWidth={3} className="text-white" />
              </span>
            )}
          </div>
          <span className="text-[10.5px] text-muted truncate w-full text-center">
            {myStory ? "Your story" : "Add story"}
          </span>
        </button>

        {/* Other users' stories */}
        {groups.map((g) => {
          const seen = g.stories.every((s) => viewed[s.id])
          const idx = myStory ? allGroups.findIndex((x) => x.user_id === g.user_id) : groups.findIndex((x) => x.user_id === g.user_id)
          return (
            <button
              key={g.user_id}
              onClick={() => { tap("light"); setViewerState({ startIndex: idx }) }}
              className="shrink-0 flex flex-col items-center gap-1.5"
              style={{ width: 66 }}
            >
              <div className="w-14 h-14 rounded-full p-[2px]"
                style={{ background: seen ? "rgba(255,255,255,0.15)" : "linear-gradient(135deg,#C084FC,#EC4899)" }}>
                <div className="w-full h-full rounded-full overflow-hidden bg-elevated border-2 border-[#0B0B14]">
                  {g.avatar_path ? (
                    <img src={publicPhotoUrl(g.avatar_path)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-purple-400 font-black text-base">
                      {g.display_name[0]}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[10.5px] text-cream truncate w-full text-center">
                {g.display_name.split(" ")[0]}
              </span>
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
