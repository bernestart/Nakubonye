import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Users, RefreshCw } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

export default function Online() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true)
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const { data: rows } = await supabase
      .from("profiles")
      .select("id, display_name, username, is_verified, city, last_seen_at")
      .gt("last_seen_at", cutoff)
      .neq("id", myId)
      .eq("is_active", true)
      .order("last_seen_at", { ascending: false })
      .limit(50)

    const list = rows || []
    if (list.length > 0) {
      const { data: ph } = await supabase
        .from("profile_photos")
        .select("user_id, storage_path, is_primary, display_order")
        .in("user_id", list.map((u) => u.id))
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
      const map = new Map()
      ;(ph || []).forEach((p) => { if (!map.has(p.user_id)) map.set(p.user_id, p.storage_path) })
      list.forEach((u) => { u.photo_url = publicPhotoUrl(map.get(u.id)) })
    }
    setPeople(list)
    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 20s
  useEffect(() => {
    const i = setInterval(load, 20000)
    return () => clearInterval(i)
  }, [load])

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
        <div className="flex-1">
          <p className="text-cream font-bold text-[15px]">Online now</p>
          <p className="text-subtle text-[11.5px] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px rgba(52,211,153,0.9)" }} />
            {people.length} {people.length === 1 ? "person" : "people"} active
          </p>
        </div>
        <button
          onClick={() => { tap("light"); load() }}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Refresh"
        >
          <RefreshCw size={17} strokeWidth={2.3} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 pb-10">
        {loading && people.length === 0 ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">Loading…</div>
        ) : people.length === 0 ? (
          <div className="grid place-items-center py-16 text-center px-6">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-purple-500/12 border border-purple-500/25 grid place-items-center mx-auto mb-3">
                <Users size={22} className="text-purple-300" />
              </div>
              <p className="text-cream font-bold text-[15px] mb-1">No one online</p>
              <p className="text-muted text-[13px]">Check back soon — we'll refresh automatically.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {people.map((u) => (
              <button
                key={u.id}
                onClick={() => { tap("light"); nav("/profile/" + u.id) }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/8 text-left active:scale-[0.99] transition-transform"
              >
                <div className="relative shrink-0">
                  <span className="w-12 h-12 rounded-full overflow-hidden bg-elevated border border-white/8 block">
                    {u.photo_url ? (
                      <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full grid place-items-center text-purple-400 font-black text-base">
                        {(u.display_name || "?")[0]}
                      </span>
                    )}
                  </span>
                  <span
                    className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2"
                    style={{ background: "#22C55E", borderColor: "#0B0B14", boxShadow: "0 0 6px rgba(34,197,94,0.8)" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-cream font-semibold text-[14px] truncate">
                    {u.display_name || u.username}
                    {u.is_verified && <span className="text-purple-400 ml-1">✓</span>}
                  </p>
                  <p className="text-muted text-[12px] truncate">
                    {u.city ? "📍 " + u.city : u.username ? "@" + u.username : "Online now"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
