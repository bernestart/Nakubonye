import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Share2, Heart } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import AppHeader from "../components/AppHeader"

function buildMemoryWindow() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Facebook-like window: same calendar day, all previous years
  return { today }
}

function sameMonthDay(dateStr, refDate) {
  const d = new Date(dateStr)
  return d.getMonth() === refDate.getMonth() && d.getDate() === refDate.getDate()
}

export default function Memories() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState([])   // [{ year, items: [...] }]

  async function load() {
    if (!myId) return
    setLoading(true)
    const { today } = buildMemoryWindow()
    const thisYear = today.getFullYear()

    const [postsRes, comPostsRes, reelsRes, storiesRes] = await Promise.all([
      supabase.from("user_posts")
        .select("id, user_id, content, image_path, image_paths, created_at")
        .eq("user_id", myId)
        .lt("created_at", new Date(thisYear, 0, 1).toISOString())
        .limit(300),
      supabase.from("community_posts")
        .select("id, author_id, community_id, content, image_path, image_paths, created_at")
        .eq("author_id", myId)
        .lt("created_at", new Date(thisYear, 0, 1).toISOString())
        .limit(300),
      supabase.from("reels")
        .select("id, user_id, video_url, thumbnail_url, caption, created_at")
        .eq("user_id", myId)
        .eq("is_active", true)
        .lt("created_at", new Date(thisYear, 0, 1).toISOString())
        .limit(200),
      supabase.from("stories")
        .select("id, user_id, media_url, media_type, caption, created_at")
        .eq("user_id", myId)
        .lt("created_at", new Date(thisYear, 0, 1).toISOString())
        .limit(200),
    ])

    const items = []
    ;(postsRes.data || []).forEach((p) => {
      if (!sameMonthDay(p.created_at, today)) return
      items.push({ type: "post", id: p.id, _source: "personal", created_at: p.created_at, content: p.content, image_path: p.image_path })
    })
    ;(comPostsRes.data || []).forEach((p) => {
      if (!sameMonthDay(p.created_at, today)) return
      items.push({ type: "post", id: p.id, _source: "community", created_at: p.created_at, content: p.content, image_path: p.image_path, community_id: p.community_id })
    })
    ;(reelsRes.data || []).forEach((r) => {
      if (!sameMonthDay(r.created_at, today)) return
      items.push({ type: "reel", id: r.id, created_at: r.created_at, caption: r.caption, thumbnail_url: r.thumbnail_url, video_url: r.video_url })
    })
    ;(storiesRes.data || []).forEach((s) => {
      if (!sameMonthDay(s.created_at, today)) return
      items.push({ type: "story", id: s.id, created_at: s.created_at, caption: s.caption, media_url: s.media_url, media_type: s.media_type })
    })

    // Group by year, newest first
    const byYear = new Map()
    items.forEach((it) => {
      const y = new Date(it.created_at).getFullYear()
      if (!byYear.has(y)) byYear.set(y, [])
      byYear.get(y).push(it)
    })

    const sortedYears = [...byYear.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, its]) => ({
        year,
        items: its.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      }))

    setGroups(sortedYears)
    setLoading(false)
  }

  useEffect(() => { load() }, [myId])

  const totalCount = groups.reduce((s, g) => s + g.items.length, 0)

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, display: "flex", flexDirection: "column", background: "#0B0B14", overflow: "hidden" }}>
      <BrandGlow />
      <AppHeader />

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          <button
            onClick={() => { tap("light"); nav(-1) }}
            className="w-9 h-9 rounded-full grid place-items-center bg-white/[0.06] border border-white/10"
            aria-label="Back"
          >
            <ArrowLeft size={18} className="text-cream" />
          </button>
          <h1 className="text-cream font-extrabold text-[16px]">Memories</h1>
        </div>

        {loading ? (
          <div className="p-4 flex flex-col gap-3">
            {[0, 1].map((i) => <div key={i} className="h-32 rounded-2xl bg-white/[0.03] shimmer" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="py-20 text-center px-6">
            <p className="text-[46px] mb-3">📸</p>
            <p className="text-cream font-bold text-[15px] mb-1">No memories today</p>
            <p className="text-muted text-[13px]">Come back on other days to see what you posted in past years.</p>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-6">
            <p className="text-cream/85 text-[13px]">
              You have <span className="text-purple-300 font-bold">{totalCount}</span> {totalCount === 1 ? "memory" : "memories"} from past years on this day.
            </p>

            {groups.map((g) => (
              <div key={g.year}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <p className="text-purple-400 text-[11px] font-black tracking-[0.16em] uppercase">
                    {g.year} · {g.items.length} {g.items.length === 1 ? "memory" : "memories"}
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {g.items.map((it) => {
                    if (it.type === "post") {
                      return (
                        <button
                          key={"p-" + it._source + "-" + it.id}
                          onClick={() => { tap("light"); nav("/post/" + it._source + "/" + it.id) }}
                          className="rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden text-left active:opacity-90"
                        >
                          {it.image_path && (
                            <img
                              src={supabase.storage.from("community-media").getPublicUrl(it.image_path).data?.publicUrl}
                              alt=""
                              className="w-full max-h-[300px] object-cover"
                            />
                          )}
                          {it.content && (
                            <p className="px-3 py-3 text-cream text-[13.5px] leading-snug line-clamp-3">{it.content}</p>
                          )}
                          <div className="px-3 pb-3">
                            <p className="text-muted text-[11px]">
                              {new Date(it.created_at).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
                            </p>
                          </div>
                        </button>
                      )
                    }
                    if (it.type === "reel") {
                      return (
                        <button
                          key={"r-" + it.id}
                          onClick={() => { tap("light"); nav("/reels?r=" + it.id) }}
                          className="rounded-2xl bg-black border border-white/8 overflow-hidden text-left active:opacity-90 relative"
                        >
                          <div className="aspect-[9/16] max-h-[420px]">
                            {it.thumbnail_url ? (
                              <img src={it.thumbnail_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <video src={it.video_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <span className="absolute top-2 left-2 px-2 h-6 rounded-full bg-pink-500/80 text-white text-[10.5px] font-black tracking-wide flex items-center">▶ REEL</span>
                          {it.caption && (
                            <p className="absolute bottom-2 left-2 right-2 text-white text-[12.5px] font-semibold line-clamp-2 drop-shadow-lg">{it.caption}</p>
                          )}
                        </button>
                      )
                    }
                    return (
                      <button
                        key={"s-" + it.id}
                        onClick={() => { tap("light"); nav("/story-archive") }}
                        className="rounded-2xl bg-black border border-white/8 overflow-hidden text-left active:opacity-90 relative"
                      >
                        <div className="aspect-[9/16] max-h-[420px]">
                          {it.media_type === "video" ? (
                            <video src={it.media_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                          ) : (
                            <img src={it.media_url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <span className="absolute top-2 left-2 px-2 h-6 rounded-full bg-purple-500/80 text-white text-[10.5px] font-black tracking-wide flex items-center">STORY</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
