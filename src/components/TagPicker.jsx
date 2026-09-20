import { useEffect, useState } from "react"
import { X, Search } from "lucide-react"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"

export default function TagPicker({ initial = [], onClose, onSave }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(initial || [])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(20)
      if (cancelled) return
      setResults(data || [])
      setLoading(false)
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query])

  function toggle(user) {
    if (selected.find((s) => s.id === user.id)) {
      setSelected((arr) => arr.filter((s) => s.id !== user.id))
    } else {
      if (selected.length >= 20) return
      setSelected((arr) => [...arr, user])
    }
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-3"
        style={{ maxHeight: "80dvh", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto" />
        <div className="flex items-center justify-between">
          <h3 className="text-cream font-extrabold text-[16px]">Tag people</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((s) => (
              <button
                key={s.id}
                onClick={() => toggle(s)}
                className="flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-full"
                style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)" }}
              >
                <span className="text-purple-200 text-[12.5px] font-semibold">
                  {s.display_name || s.username}
                </span>
                <X size={12} color="#D8B4FE" />
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or username…"
            autoFocus
            className="w-full h-11 rounded-xl bg-white/[0.06] border border-white/10 pl-10 pr-4 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="overflow-y-auto flex flex-col gap-1">
          {loading && <p className="text-subtle text-[12.5px] text-center py-2">Searching…</p>}
          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-subtle text-[12.5px] text-center py-2">No results</p>
          )}
          {!loading && results.map((u) => {
            const isSelected = selected.some((s) => s.id === u.id)
            return (
              <button
                key={u.id}
                onClick={() => toggle(u)}
                className="flex items-center gap-3 p-2.5 rounded-xl text-left"
                style={{
                  background: isSelected ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
                  border: isSelected ? "1px solid rgba(168,85,247,0.4)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="w-10 h-10 rounded-full bg-purple-600 grid place-items-center text-white font-black text-sm shrink-0">
                  {(u.display_name || u.username || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-cream font-semibold text-[13.5px] truncate">
                    {u.display_name || u.username}
                  </p>
                  {u.username && <p className="text-muted text-[11.5px] truncate">@{u.username}</p>}
                </div>
                {isSelected && <span className="text-purple-400 text-[16px]">✓</span>}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => { onSave(selected); onClose() }}
          className="h-12 rounded-full text-white font-bold text-[14.5px] mt-1"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
        >
          Done ({selected.length})
        </button>
      </div>
    </div>
  )
}
