import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Search, X } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import AppHeader from "../components/AppHeader"

export default function InnerCircle() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  async function load() {
    if (!myId) return
    setLoading(true)
    const { data: rows } = await supabase
      .from("inner_circle")
      .select("member_id, created_at")
      .eq("user_id", myId)
      .order("created_at", { ascending: false })

    const ids = (rows || []).map((r) => r.member_id)
    let profMap = new Map(), photoMap = new Map()
    if (ids.length > 0) {
      const [profs, phs] = await Promise.all([
        supabase.from("profiles").select("id, display_name, username, is_verified").in("id", ids),
        supabase.from("profile_photos").select("user_id, storage_path, is_primary, display_order").in("user_id", ids).order("is_primary", { ascending: false }).order("display_order", { ascending: true }),
      ])
      ;(profs.data || []).forEach((p) => profMap.set(p.id, p))
      ;(phs.data || []).forEach((x) => { if (!photoMap.has(x.user_id)) photoMap.set(x.user_id, x.storage_path) })
    }
    setMembers(ids.map((id) => ({
      id,
      _profile: profMap.get(id),
      _photo: photoMap.get(id) ? publicPhotoUrl(photoMap.get(id)) : null,
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [myId])

  useEffect(() => {
    if (!searchOpen) return
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, is_verified")
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
        .neq("id", myId)
        .limit(20)
      const existing = new Set(members.map((m) => m.id))
      setResults((data || []).filter((u) => !existing.has(u.id)))
      setSearching(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query, searchOpen, members, myId])

  async function add(user) {
    tap("light")
    if (!myId) return
    setMembers((cur) => [{ id: user.id, _profile: user, _photo: null }, ...cur])
    setQuery(""); setSearchOpen(false); setResults([])
    await supabase.from("inner_circle").insert({ user_id: myId, member_id: user.id })
  }

  async function remove(id) {
    tap("light")
    setMembers((cur) => cur.filter((m) => m.id !== id))
    await supabase.from("inner_circle").delete().eq("user_id", myId).eq("member_id", id)
  }

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
          <h1 className="text-cream font-extrabold text-[16px] flex-1">Inner Circle</h1>
          <button
            onClick={() => { tap("light"); setSearchOpen((v) => !v) }}
            className="h-9 px-3 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[12.5px] inline-flex items-center gap-1.5"
          >
            {searchOpen ? <X size={14} /> : <Plus size={14} />} {searchOpen ? "Cancel" : "Add"}
          </button>
        </div>

        <p className="px-4 py-3 text-muted text-[12.5px] leading-relaxed">
          Your Inner Circle is a private list of people you share close content with — stories, posts, and more.
        </p>

        {searchOpen && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value.slice(0, 40))}
                placeholder="Search by name or username…"
                autoFocus
                className="w-full h-11 rounded-full bg-white/[0.06] border border-white/10 pl-10 pr-4 text-cream text-[14px] placeholder:text-muted focus:outline-none focus:border-purple-500"
              />
            </div>
            {searching && <p className="text-subtle text-[12px] text-center py-2">Searching…</p>}
            {!searching && query.length >= 2 && results.length === 0 && (
              <p className="text-subtle text-[12px] text-center py-2">No results</p>
            )}
            <div className="flex flex-col gap-1 mt-2">
              {results.map((u) => (
                <button
                  key={u.id}
                  onClick={() => add(u)}
                  className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.03] border border-white/8 text-left"
                >
                  <span className="w-10 h-10 rounded-full bg-purple-600 grid place-items-center text-white font-black text-[14px]">
                    {(u.display_name || u.username || "?")[0].toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-semibold text-[13.5px] truncate">{u.display_name || u.username}</p>
                    {u.username && <p className="text-muted text-[11.5px] truncate">@{u.username}</p>}
                  </div>
                  <Plus size={16} className="text-purple-300" />
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="px-4 flex flex-col gap-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-white/[0.03] shimmer" />)}
          </div>
        ) : members.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-[42px] mb-2">💫</p>
            <p className="text-cream font-bold text-[14.5px] mb-1">Inner Circle is empty</p>
            <p className="text-muted text-[12.5px]">Tap Add to bring people in.</p>
          </div>
        ) : (
          <div className="px-4 flex flex-col gap-1">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.03] border border-white/8">
                <button
                  onClick={() => { tap("light"); nav("/profile/" + m.id) }}
                  className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0"
                >
                  {m._photo ? <img src={m._photo} alt="" className="w-full h-full object-cover" /> : (m._profile?.display_name || "?")[0].toUpperCase()}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-cream font-semibold text-[13.5px] truncate">{m._profile?.display_name || m._profile?.username || "User"}</p>
                  {m._profile?.username && <p className="text-muted text-[11.5px] truncate">@{m._profile.username}</p>}
                </div>
                <button
                  onClick={() => remove(m.id)}
                  className="h-9 px-3 rounded-full bg-white/[0.06] border border-white/10 text-red-300 font-bold text-[12px]"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
