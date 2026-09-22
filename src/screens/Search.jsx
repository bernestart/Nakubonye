import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Search as SearchIcon, X, Users } from "lucide-react"
import VerifiedBadge from "../components/VerifiedBadge"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

const RECENT_KEY = "search_recent_v1"

export default function Search() {
  const nav = useNavigate()
  const [query, setQuery] = useState("")
  const [users, setUsers] = useState([])
  const [communities, setCommunities] = useState([])
  const [recent, setRecent] = useState(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") } catch { return [] }
  })
  const [loading, setLoading] = useState(false)

  const runSearch = useCallback(async (q) => {
    const term = q.trim()
    if (term.length < 2) { setUsers([]); setCommunities([]); setLoading(false); return }
    setLoading(true)

    const [uRes, cRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, username, is_verified, city")
        .or(`display_name.ilike.%${term}%,username.ilike.%${term}%`)
        .eq("is_active", true)
        .limit(20),
      supabase
        .from("communities")
        .select("id, name, emoji, cover_color, member_count")
        .ilike("name", `%${term}%`)
        .eq("is_active", true)
        .limit(10),
    ])

    const userList = uRes.data || []
    // Load photos
    if (userList.length > 0) {
      const { data: photos } = await supabase
        .from("profile_photos")
        .select("user_id, storage_path, is_primary, display_order")
        .in("user_id", userList.map((u) => u.id))
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
      const map = new Map()
      ;(photos || []).forEach((p) => { if (!map.has(p.user_id)) map.set(p.user_id, p.storage_path) })
      userList.forEach((u) => { u.photo_url = publicPhotoUrl(map.get(u.id)) })
    }

    setUsers(userList)
    setCommunities(cRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 250)
    return () => clearTimeout(t)
  }, [query, runSearch])

  function commitRecent(label) {
    if (!label) return
    const next = [label, ...recent.filter((x) => x !== label)].slice(0, 8)
    setRecent(next)
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch {}
  }

  function clearRecent() {
    setRecent([])
    try { localStorage.removeItem(RECENT_KEY) } catch {}
  }

  function openUser(u) {
    tap("light")
    commitRecent(u.display_name || u.username)
    nav("/profile/" + u.id)
  }

  function openCommunity(c) {
    tap("light")
    commitRecent(c.name)
    nav("/communities/" + c.id)
  }

  return (
    <div
      className="mobile-shell flex flex-col relative"
      style={{
        position: "fixed", inset: 0,
        margin: "0 auto", maxWidth: 480,
        background: "#0B0B14",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <header className="shrink-0 flex items-center gap-2 px-3 h-12 border-b border-white/8">
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <div className="flex-1 relative">
          <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 60))}
            placeholder="Search people or communities…"
            autoFocus
            className="w-full h-10 rounded-full bg-white/[0.06] border border-white/10 pl-10 pr-9 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full grid place-items-center bg-white/10 text-muted"
              aria-label="Clear"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 pb-10">
        {/* Empty state with recent searches */}
        {query.trim().length < 2 && (
          <>
            {recent.length > 0 ? (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase">
                    Recent
                  </p>
                  <button onClick={clearRecent} className="text-muted text-[11.5px] font-semibold">
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recent.map((r) => (
                    <button
                      key={r}
                      onClick={() => setQuery(r)}
                      className="h-8 px-3 rounded-full bg-white/[0.06] border border-white/10 text-cream text-[12.5px] font-medium"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid place-items-center py-16 text-center">
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/12 border border-purple-500/25 grid place-items-center mx-auto mb-3">
                    <SearchIcon size={22} className="text-purple-300" />
                  </div>
                  <p className="text-cream font-bold text-[15px] mb-1">Search Nakubonye</p>
                  <p className="text-muted text-[13px]">Find people and communities.</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Loading */}
        {loading && query.trim().length >= 2 && (
          <p className="text-subtle text-[12.5px] text-center py-6">Searching…</p>
        )}

        {/* Communities */}
        {!loading && communities.length > 0 && (
          <div className="mb-5">
            <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2 px-1">
              Communities
            </p>
            <div className="flex flex-col gap-1.5">
              {communities.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openCommunity(c)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/8 text-left"
                >
                  <span
                    className="w-11 h-11 rounded-2xl grid place-items-center shrink-0 text-lg font-black"
                    style={{ background: c.cover_color || "rgba(168,85,247,0.2)" }}
                  >
                    {c.emoji || (c.name || "?")[0]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-semibold text-[13.5px] truncate">{c.name}</p>
                    <p className="text-muted text-[12px]">{c.member_count ? c.member_count + " members" : "Community"}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Users */}
        {!loading && users.length > 0 && (
          <div className="mb-5">
            <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2 px-1">
              People
            </p>
            <div className="flex flex-col gap-1.5">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => openUser(u)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/8 text-left"
                >
                  <span className="w-11 h-11 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0">
                    {u.photo_url ? (
                      <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full grid place-items-center text-purple-400 font-black text-sm">
                        {(u.display_name || "?")[0]}
                      </span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-semibold text-[13.5px] truncate">
                      {u.display_name || u.username}
                      {u.is_verified && <VerifiedBadge size={14} className="ml-1" />}
                    </p>
                    {u.username && <p className="text-muted text-[12px] truncate">@{u.username}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {!loading && query.trim().length >= 2 && users.length === 0 && communities.length === 0 && (
          <div className="grid place-items-center py-16 text-center">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-purple-500/12 border border-purple-500/25 grid place-items-center mx-auto mb-3">
                <Users size={22} className="text-purple-300" />
              </div>
              <p className="text-cream font-bold text-[15px] mb-1">Nothing found</p>
              <p className="text-muted text-[13px]">Try a different search.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
