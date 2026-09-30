import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Search, X, Check } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"

export default function AddGroupMembers() {
  const nav = useNavigate()
  const { id: groupId } = useParams()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [existingIds, setExistingIds] = useState(new Set())
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from("group_members").select("user_id").eq("group_id", groupId)
      setExistingIds(new Set((data || []).map((m) => m.user_id)))
    })()
  }, [groupId])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    let cancelled = false
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .or("display_name.ilike.%" + q + "%,username.ilike.%" + q + "%")
        .limit(20)
      if (cancelled) return
      setResults((data || []).filter((u) => !existingIds.has(u.id)))
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, existingIds])

  function toggle(u) {
    if (selected.find((s) => s.id === u.id)) setSelected((a) => a.filter((s) => s.id !== u.id))
    else setSelected((a) => [...a, u])
  }

  async function add() {
    if (selected.length === 0 || !myId) return
    setBusy(true); setError(""); tap("light")
    const rows = selected.map((u) => ({ group_id: groupId, user_id: u.id, role: "member" }))
    const { error: insErr } = await supabase.from("group_members").insert(rows)
    setBusy(false)
    if (insErr) { setError(insErr.message); return }
    nav(-1)
  }

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, display: "flex", flexDirection: "column", background: "#0B0B14", overflow: "hidden" }}>
      <BrandGlow />
      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px] flex-1">Add members</span>
        <button onClick={add} disabled={busy || selected.length === 0}
          className="h-9 px-4 rounded-full text-white font-bold text-[13px] disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}>
          {busy ? "Adding…" : "Add"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selected.map((u) => (
              <button key={u.id} onClick={() => toggle(u)}
                className="flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-full"
                style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)" }}>
                <span className="text-purple-200 text-[12.5px] font-semibold">{u.display_name || u.username}</span>
                <X size={12} color="#D8B4FE" />
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-2xl bg-surface border border-white/8 px-3.5 h-11 mb-3">
          <Search size={16} className="text-muted shrink-0" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people to add…"
            autoFocus
            className="flex-1 bg-transparent border-0 text-cream text-[14px] placeholder:text-subtle focus:outline-none" />
        </div>

        {query.length >= 2 && results.length === 0 && (
          <p className="text-subtle text-[12.5px] text-center py-3">No results</p>
        )}

        <div className="flex flex-col gap-1">
          {results.map((u) => {
            const isSel = selected.some((s) => s.id === u.id)
            return (
              <button key={u.id} onClick={() => toggle(u)}
                className="flex items-center gap-3 p-3 rounded-xl text-left"
                style={{
                  background: isSel ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
                  border: isSel ? "1px solid rgba(168,85,247,0.4)" : "1px solid rgba(255,255,255,0.06)",
                }}>
                <div className="w-10 h-10 rounded-full bg-purple-600 grid place-items-center text-white font-black text-sm shrink-0">
                  {(u.display_name || u.username || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-cream font-semibold text-[13.5px] truncate">{u.display_name || u.username}</p>
                  {u.username && <p className="text-muted text-[11.5px]">@{u.username}</p>}
                </div>
                {isSel && <Check size={16} className="text-purple-400" strokeWidth={3} />}
              </button>
            )
          })}
        </div>

        {error && <div className="mt-3 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">{error}</div>}
      </div>
    </div>
  )
}
