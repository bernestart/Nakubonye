import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams, useLocation } from "react-router-dom"
import { ArrowLeft, Users, RefreshCw } from "lucide-react"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

export default function FollowList() {
  const nav = useNavigate()
  const { userId } = useParams()
  const location = useLocation()
  const type = location.pathname.endsWith("/followers") ? "followers" : "following"
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    let ids = []
    if (type === "followers") {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", userId)
        .order("created_at", { ascending: false })
      ids = (data || []).map((r) => r.follower_id)
    } else {
      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId)
        .order("created_at", { ascending: false })
      ids = (data || []).map((r) => r.following_id)
    }

    if (ids.length === 0) { setUsers([]); setLoading(false); return }

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name, username, is_verified, city")
      .in("id", ids)
      .eq("is_active", true)

    const list = profs || []
    if (list.length > 0) {
      const { data: ph } = await supabase
        .from("profile_photos")
        .select("user_id, storage_path, is_primary, display_order")
        .in("user_id", list.map((u) => u.id))
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
      const pm = new Map()
      ;(ph || []).forEach((p) => { if (!pm.has(p.user_id)) pm.set(p.user_id, p.storage_path) })
      list.forEach((u) => { u.photo_url = publicPhotoUrl(pm.get(u.id)) })
    }

    setUsers(list)
    setLoading(false)
  }, [userId, type])

  useEffect(() => { load() }, [load])

  const title = type === "followers" ? "Followers" : "Following"

  return (
    <div
      className="mobile-shell flex flex-col"
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
          <p className="text-cream font-bold text-[15px]">{title}</p>
          <p className="text-subtle text-[11.5px]">{users.length} {users.length === 1 ? "person" : "people"}</p>
        </div>
        <button
          onClick={() => { tap("light"); load() }}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Refresh"
        >
          <RefreshCw size={16} strokeWidth={2.3} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 pb-10">
        {loading && users.length === 0 ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">Loading…</div>
        ) : users.length === 0 ? (
          <div className="grid place-items-center py-16 text-center px-6">
            <div>
              <div className="w-14 h-14 rounded-full bg-purple-500/12 grid place-items-center mx-auto mb-3">
                <Users size={22} className="text-purple-300" />
              </div>
              <p className="text-cream font-bold text-[15px] mb-1">No {title.toLowerCase()} yet</p>
              <p className="text-muted text-[13px]">
                {type === "followers" ? "When people follow this account they'll show up here." : "Follow people to see them here."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => { tap("light"); nav("/profile/" + u.id) }}
                className="flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03]"
              >
                <span className="w-12 h-12 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0">
                  {u.photo_url ? (
                    <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full grid place-items-center text-purple-400 font-black text-base">
                      {(u.display_name || "?")[0]}
                    </span>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-cream font-semibold text-[14px] truncate">
                    {u.display_name || u.username}
                    {u.is_verified && <span className="text-purple-400 ml-1">✓</span>}
                  </p>
                  <p className="text-muted text-[12px] truncate">
                    {u.city ? "📍 " + u.city : u.username ? "@" + u.username : "Nakubonye user"}
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
