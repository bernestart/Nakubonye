import { useState, useEffect } from "react"
import { X, Search, Check } from "lucide-react"
import { supabase } from "../../lib/supabase"
import { publicPhotoUrl } from "../../lib/photo"

export default function TagPeople({ onClose, onAdd, existingTags = [] }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(existingTags)
  const [allowCollab, setAllowCollab] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, primary_photo")
        .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
        .limit(10)
      if (!cancelled) {
        setResults(data || [])
        setLoading(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  function toggleUser(user) {
    if (selected.find(u => u.id === user.id)) {
      setSelected(prev => prev.filter(u => u.id !== user.id))
    } else {
      if (selected.length >= 5) return // Max 5 tags like IG
      setSelected(prev => [...prev, user])
    }
  }

  function handleDone() {
    onAdd(selected, allowCollab)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0B0B14]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 pt-safe">
        <button onClick={onClose} className="p-2"><X className="text-white" size={24} /></button>
        <h2 className="text-white font-bold text-lg">Tag people</h2>
        <button onClick={handleDone} className="text-blue-400 font-bold px-2 py-1">Done</button>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2.5 border border-white/10">
          <Search size={18} className="text-white/50" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search"
            className="flex-1 bg-transparent text-white placeholder-white/50 outline-none"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {selected.length > 0 && (
          <div className="mb-6">
            <p className="text-white/50 text-xs font-bold uppercase mb-2">Selected</p>
            <div className="flex flex-col gap-2">
              {selected.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-2 bg-white/5 rounded-xl border border-white/10">
                  <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden">
                    {u.primary_photo && <img src={publicPhotoUrl(u.primary_photo)} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{u.display_name || u.username}</p>
                    {u.username && <p className="text-white/50 text-xs">@{u.username}</p>}
                  </div>
                  <button onClick={() => toggleUser(u)} className="text-red-400 p-2"><X size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && <p className="text-white/50 text-sm text-center py-4">Searching...</p>}

        {!loading && results.length > 0 && (
          <div className="flex flex-col gap-1">
            {results.map(u => {
              const isSelected = !!selected.find(s => s.id === u.id)
              return (
                <button
                  key={u.id}
                  onClick={() => toggleUser(u)}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 text-left transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-gray-700 overflow-hidden shrink-0">
                    {u.primary_photo ? (
                      <img src={publicPhotoUrl(u.primary_photo)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full grid place-items-center text-white/50 font-bold">{(u.display_name || "?")[0]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-[15px] truncate">{u.display_name || u.username}</p>
                    {u.username && <p className="text-white/50 text-[13px] truncate">@{u.username}</p>}
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 grid place-items-center ${isSelected ? "bg-blue-500 border-blue-500" : "border-white/30"}`}>
                    {isSelected && <Check size={14} className="text-white" />}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {!loading && query.length >= 2 && results.length === 0 && (
          <p className="text-white/50 text-sm text-center py-4">No users found.</p>
        )}
      </div>

      <div className="p-4 border-t border-white/10 bg-[#0B0B14] pb-safe">
        <div className="flex items-center justify-between gap-4">
          <p className="text-white/70 text-xs leading-snug flex-1">
            Anyone you tag can share to their story and friends for an additional 24 hours.
          </p>
          <button
            onClick={() => setAllowCollab(!allowCollab)}
            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${allowCollab ? "bg-blue-500" : "bg-white/20"}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${allowCollab ? "left-7" : "left-1"}`} />
          </button>
        </div>
      </div>
    </div>
  )
}
