import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, Check, Users, UserPlus } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import VerifiedBadge from "../components/VerifiedBadge"
import FollowButton from "../components/FollowButton"

export default function OnboardingSuggestions() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [people, setPeople] = useState([])
  const [communities, setCommunities] = useState([])
  const [joinedIds, setJoinedIds] = useState(new Set())
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    if (!myId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)

      // People — use the PYMK RPC we built earlier; fallback to recent active
      let list = []
      try {
        const { data } = await supabase.rpc("get_pymk_profiles", { p_limit: 12 })
        if (data && data.length > 0) {
          list = data.map((r) => ({
            id: r.id,
            display_name: r.display_name,
            username: r.username,
            is_verified: r.is_verified,
            city: r.city,
            _photo: r.primary_photo ? publicPhotoUrl(r.primary_photo) : null,
          }))
        }
      } catch {}
      if (list.length === 0) {
        const { data: rawPeople } = await supabase
          .from("profiles")
          .select("id, display_name, username, is_verified, city")
          .eq("is_active", true)
          .neq("id", myId)
          .order("last_seen_at", { ascending: false, nullsFirst: false })
          .limit(24)

        // Filter out people who opted out of suggestions
        const { data: settingsRows } = await supabase
          .from("user_settings")
          .select("user_id, discoverable_suggestions")
        const optOutSet = new Set(
          (settingsRows || [])
            .filter((r) => r.discoverable_suggestions === false)
            .map((r) => r.user_id)
        )
        const data = (rawPeople || []).filter((p) => !optOutSet.has(p.id)).slice(0, 12)

        const ids = data.map((p) => p.id)
        let photoMap = new Map()
        if (ids.length > 0) {
          const { data: ph } = await supabase
            .from("profile_photos")
            .select("user_id, storage_path, is_primary, display_order")
            .in("user_id", ids)
            .order("is_primary", { ascending: false })
            .order("display_order", { ascending: true })
          ;(ph || []).forEach((x) => { if (!photoMap.has(x.user_id)) photoMap.set(x.user_id, x.storage_path) })
        }
        list = data.map((r) => ({
          ...r,
          _photo: photoMap.get(r.id) ? publicPhotoUrl(photoMap.get(r.id)) : null,
        }))
      }

      // Communities — top by member count
      const { data: comms } = await supabase
        .from("communities")
        .select("id, slug, name, emoji, cover_color, member_count, description")
        .eq("is_active", true)
        .order("member_count", { ascending: false })
        .limit(10)

      if (cancelled) return
      setPeople(list)
      setCommunities(comms || [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [myId])

  async function joinCommunity(c) {
    if (busyId) return
    setBusyId(c.id); tap("light")
    try {
      const { error } = await supabase.from("community_memberships").insert({
        community_id: c.id,
        user_id: myId,
        role: "member",
      })
      if (error && !error.message.includes("duplicate")) throw error
      setJoinedIds((s) => new Set([...s, c.id]))
    } catch (e) { console.warn("join failed", e) }
    setBusyId(null)
  }

  function finish() {
    tap("light")
    nav("/feed", { replace: true })
  }

  return (
    <div className="mobile-shell flex flex-col isolate" style={{ position: "relative" }}>
      <BrandGlow />

      <header className="px-7 pt-8 pb-4">
        <h1 className="text-cream text-[24px] font-extrabold tracking-tight mb-2">
          Welcome to Nakubonye 🎉
        </h1>
        <p className="text-muted text-[14.5px] mb-1">
          Follow some people and join a community to personalize your feed.
        </p>
        <p className="text-subtle text-[12.5px]">You can skip this and adjust later.</p>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex flex-col gap-2 mt-3">
            {[0,1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-white/[0.03] shimmer" />)}
          </div>
        ) : (
          <>
            {/* People section */}
            {people.length > 0 && (
              <section className="mb-7">
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus size={16} className="text-purple-300" />
                  <p className="text-cream font-extrabold text-[15px]">People to follow</p>
                </div>
                <div className="flex flex-col">
                  {people.slice(0, 8).map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 px-3 py-3 border-b border-white/6 last:border-b-0"
                    >
                      <button
                        onClick={() => { tap("light"); nav("/profile/" + u.id) }}
                        className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0"
                      >
                        {u._photo ? (
                          <img src={u._photo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (u.display_name || u.username || "?")[0].toUpperCase()
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-cream font-semibold text-[14px] truncate flex items-center gap-1">
                          {u.display_name || u.username || "Someone"}
                          {u.is_verified && <VerifiedBadge size={12} />}
                        </p>
                        {u.username && <p className="text-muted text-[12px] truncate">@{u.username}</p>}
                        {u.city && !u.username && <p className="text-muted text-[12px] truncate">{u.city}</p>}
                      </div>
                      <div className="shrink-0">
                        <FollowButton userId={u.id} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Communities section */}
            {communities.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Users size={16} className="text-purple-300" />
                  <p className="text-cream font-extrabold text-[15px]">Communities to join</p>
                </div>
                <div className="flex flex-col">
                  {communities.slice(0, 6).map((c) => {
                    const joined = joinedIds.has(c.id)
                    return (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 px-3 py-3 border-b border-white/6 last:border-b-0"
                      >
                        <span
                          className="w-11 h-11 rounded-full grid place-items-center text-[20px] shrink-0"
                          style={{ background: `${c.cover_color || "#A855F7"}22` }}
                        >
                          {c.emoji || "🌐"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-cream font-semibold text-[14px] truncate">{c.name}</p>
                          <p className="text-muted text-[12px] truncate">
                            {c.member_count || 0} member{c.member_count === 1 ? "" : "s"}
                          </p>
                        </div>
                        <button
                          onClick={() => joinCommunity(c)}
                          disabled={joined || busyId === c.id}
                          className="h-8 px-3.5 rounded-full font-bold text-[12.5px] disabled:opacity-60 inline-flex items-center gap-1.5 shrink-0"
                          style={joined
                            ? { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#aaa" }
                            : { background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)", color: "#fff" }}
                        >
                          {joined ? (
                            <><Check size={13} strokeWidth={3} /> Joined</>
                          ) : busyId === c.id ? "…" : "Join"}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="px-7 pb-8 pt-3">
        <button
          onClick={finish}
          className="w-full h-12 rounded-full text-white font-bold text-[15px] inline-flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
        >
          Continue to feed <ArrowRight size={16} />
        </button>
        <button
          onClick={finish}
          className="w-full mt-2 text-muted font-semibold text-[13.5px] py-1.5 active:opacity-70"
        >
          Skip for now
        </button>
      </footer>
    </div>
  )
}
