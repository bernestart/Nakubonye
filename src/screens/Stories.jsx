import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Users, Share2 } from "lucide-react"
import BrandGlow from "../components/BrandGlow"
import StoriesRow from "../components/StoriesRow"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

export default function Stories() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [storyCount, setStoryCount] = useState(null)
  const [suggested, setSuggested] = useState([])
  const [communities, setCommunities] = useState([])
  const [myCommunityIds, setMyCommunityIds] = useState(new Set())
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    if (!myId) return

    const { count } = await supabase
      .from("stories")
      .select("id", { count: "exact", head: true })
      .gt("expires_at", new Date().toISOString())
      .neq("user_id", myId)
    setStoryCount(count || 0)

    const { data: rows } = await supabase.rpc("get_discover_profiles", {
      p_limit: 8,
      p_same_city: false,
      p_shared_interests: false,
      p_same_country: false,
      p_verified_only: false,
      p_online_only: false,
      p_community_id: null,
    })
    const list = (rows || []).slice(0, 8).map((r) => ({
      id: r.id,
      display_name: r.display_name,
      username: r.username,
      photo_url: publicPhotoUrl(r.primary_photo),
    }))
    setSuggested(list)

    const { data: allComms } = await supabase
      .from("communities")
      .select("id, name, description, emoji, cover_color, member_count")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(20)

    const { data: mine } = await supabase
      .from("community_memberships")
      .select("community_id")
      .eq("user_id", myId)

    const myIds = new Set((mine || []).map((m) => m.community_id))
    setMyCommunityIds(myIds)
    setCommunities((allComms || []).filter((c) => !myIds.has(c.id)).slice(0, 4))
  }, [myId])

  useEffect(() => { load() }, [load])

  async function joinCommunity(c) {
    if (busyId || myCommunityIds.has(c.id)) return
    setBusyId(c.id); tap("light")
    const { error: err } = await supabase
      .from("community_memberships")
      .insert({ user_id: myId, community_id: c.id })
    if (err) { setBusyId(null); return }
    setMyCommunityIds((s) => new Set([...s, c.id]))
    setCommunities((list) => list.filter((x) => x.id !== c.id))
    setBusyId(null)
  }

  async function share() {
    tap("light")
    const url = "https://nakubonye.vercel.app"
    const text = "Join me on Nakubonye — meet real people. " + url
    if (navigator.share) {
      try { await navigator.share({ title: "Nakubonye", text, url }) } catch {}
    } else {
      try { await navigator.clipboard.writeText(text); alert("Link copied!") } catch {}
    }
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      margin: "0 auto", maxWidth: 480,
      display: "flex", flexDirection: "column",
      background: "#0B0B14", overflow: "hidden",
    }}>
      <BrandGlow />
      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2 border-b border-white/8">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[16px]">Stories</span>
      </header>

      <div className="flex-1 overflow-y-auto pb-8">
        <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase px-4 pt-4 mb-1">
          All stories · 24h
        </p>
        <StoriesRow />

        {storyCount === 0 && (
          <div className="mx-4 mt-4 rounded-2xl bg-white/[0.03] border border-white/8 p-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 grid place-items-center mx-auto mb-3">
              <Users size={20} className="text-purple-300" />
            </div>
            <p className="text-cream font-bold text-[14.5px] mb-1">No stories yet today</p>
            <p className="text-muted text-[12.5px] leading-relaxed mb-4">
              Be the first. Share a moment — it disappears in 24h.
            </p>
            <button
              onClick={share}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-white font-bold text-[13px]"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              <Share2 size={14} /> Invite friends
            </button>
          </div>
        )}

        {suggested.length > 0 && (
          <>
            <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase px-4 mt-6 mb-2">
              People you might like
            </p>
            <div className="flex flex-col gap-1.5 px-3">
              {suggested.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { tap("light"); nav("/profile/" + u.id) }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/8 text-left"
                >
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0">
                    {u.photo_url ? (
                      <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-sm font-black text-purple-400">
                        {(u.display_name || "?")[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-semibold text-[13.5px] truncate">
                      {u.display_name || u.username}
                    </p>
                    {u.username && <p className="text-muted text-[12px] truncate">@{u.username}</p>}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {communities.length > 0 && (
          <>
            <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase px-4 mt-6 mb-2">
              Communities to join
            </p>
            <div className="flex flex-col gap-1.5 px-3">
              {communities.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/8"
                >
                  <div
                    className="w-11 h-11 rounded-2xl grid place-items-center shrink-0 text-lg font-black"
                    style={{ background: c.cover_color || "rgba(168,85,247,0.2)" }}
                  >
                    {c.emoji || (c.name || "?")[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-semibold text-[13.5px] truncate">{c.name}</p>
                    <p className="text-muted text-[12px] truncate">
                      {c.member_count ? c.member_count + " members" : c.description || "Community"}
                    </p>
                  </div>
                  <button
                    onClick={() => joinCommunity(c)}
                    disabled={busyId === c.id}
                    className="h-9 px-3 rounded-full font-bold text-[12px] shrink-0 disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)", color: "#fff" }}
                  >
                    {busyId === c.id ? "…" : "Join"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <button
          onClick={share}
          className="mx-4 mt-6 w-[calc(100%-2rem)] h-12 rounded-full text-white font-bold text-[14px] inline-flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
        >
          <Share2 size={16} /> Invite friends to Nakubonye
        </button>
      </div>
    </div>
  )
}
