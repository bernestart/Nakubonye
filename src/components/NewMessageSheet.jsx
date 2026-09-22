import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { X, Search } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import DirectMessageModal from "./DirectMessageModal"

export default function NewMessageSheet({ onClose }) {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [query, setQuery] = useState("")
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [others, setOthers] = useState([])
  const [dmTarget, setDmTarget] = useState(null)

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true)

    // Load my matches (people I can message freely)
    const { data: matchRows } = await supabase
      .from("matches")
      .select("user_one_id, user_two_id")
      .or("user_one_id.eq." + myId + ",user_two_id.eq." + myId)

    const matchIds = (matchRows || []).map((m) => m.user_one_id === myId ? m.user_two_id : m.user_one_id)

    if (matchIds.length === 0) { setUsers([]); setLoading(false); return }

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name, username, is_verified, city")
      .in("id", matchIds)
      .eq("is_active", true)

    if (profs && profs.length > 0) {
      const { data: ph } = await supabase
        .from("profile_photos")
        .select("user_id, storage_path, is_primary, display_order")
        .in("user_id", profs.map((p) => p.id))
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
      const pm = new Map()
      ;(ph || []).forEach((p) => { if (!pm.has(p.user_id)) pm.set(p.user_id, p.storage_path) })
      profs.forEach((p) => { p.photo_url = publicPhotoUrl(pm.get(p.id)) })
    }

    setUsers((profs || []).sort((a, b) => (a.display_name || "").localeCompare(b.display_name || "")))
    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  const filtered = users.filter((u) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (u.display_name || "").toLowerCase().includes(q) || (u.username || "").toLowerCase().includes(q)
  })

  const filteredOthers = others
    .filter((u) => !users.some((m) => m.id === u.id))
    .filter((u) => {
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (u.display_name || "").toLowerCase().includes(q) || (u.username || "").toLowerCase().includes(q)
    })

  function openChat(u) {
    tap("light")
    onClose?.()
    nav("/messages/" + u.id)
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 flex flex-col"
        style={{ maxHeight: "85dvh", height: "85dvh" }}
      >
        <div className="shrink-0 px-5 pt-3 pb-3 border-b border-white/8">
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-cream font-extrabold text-[17px]">New message</h3>
            <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, 50))}
              placeholder="Search your matches…"
              className="w-full h-10 rounded-full bg-white/[0.06] border border-white/10 pl-10 pr-4 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="grid place-items-center h-40 text-muted text-[13px]">Loading…</div>
          ) : users.length === 0 ? (
            <div className="grid place-items-center py-16 text-center px-6">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-purple-500/12 border border-purple-500/25 grid place-items-center mx-auto mb-3">
                  <span className="text-[22px]">💬</span>
                </div>
                <p className="text-cream font-bold text-[15px] mb-1">No one to message yet</p>
                <p className="text-muted text-[13px] leading-relaxed">Match with people on Discover to start chatting.</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-subtle text-[13px] text-center py-10">No results</p>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map((u) => (
                <button
                  key={u.id}
                  onClick={() => openChat(u)}
                  className="flex items-center gap-3 p-3 rounded-2xl text-left active:scale-[0.98] transition-transform"
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
                      {u.is_verified && <span className="text-purple-400 ml-1">✓</span>}
                    </p>
                    {u.username && <p className="text-muted text-[12px] truncate">@{u.username}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Others — paid DM section */}
          {filteredOthers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/8">
              <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3 px-1 flex items-center gap-1.5">
                Others on Nakubonye
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold normal-case tracking-normal">
                  Uses coins
                </span>
              </p>
              <div className="flex flex-col gap-1">
                {filteredOthers.slice(0, 20).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { tap("light"); setDmTarget(u) }}
                    className="flex items-center gap-3 p-3 rounded-2xl text-left active:scale-[0.98] transition-transform"
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
                        {u.is_verified && <span className="text-purple-400 ml-1">✓</span>}
                      </p>
                      {u.username && <p className="text-muted text-[12px] truncate">@{u.username}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {dmTarget && (
        <DirectMessageModal
          open={true}
          target={dmTarget}
          onClose={() => setDmTarget(null)}
          onSuccess={() => {
            const uid = dmTarget.id
            setDmTarget(null)
            onClose?.()
            nav("/messages/" + uid)
          }}
        />
      )}
    </div>
  )
}
