import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, X } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import AppHeader from "../components/AppHeader"

export default function MutedUsers() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])

  async function load() {
    if (!myId) return
    setLoading(true)
    const { data: rows } = await supabase
      .from("user_mutes")
      .select("muted_id, created_at")
      .eq("muter_id", myId)
      .order("created_at", { ascending: false })

    const ids = (rows || []).map((r) => r.muted_id)
    let profMap = new Map(), photoMap = new Map()
    if (ids.length > 0) {
      const [profs, phs] = await Promise.all([
        supabase.from("profiles").select("id, display_name, username, is_verified").in("id", ids),
        supabase.from("profile_photos").select("user_id, storage_path, is_primary, display_order").in("user_id", ids).order("is_primary", { ascending: false }).order("display_order", { ascending: true }),
      ])
      ;(profs.data || []).forEach((p) => profMap.set(p.id, p))
      ;(phs.data || []).forEach((x) => { if (!photoMap.has(x.user_id)) photoMap.set(x.user_id, x.storage_path) })
    }

    setUsers((rows || []).map((r) => ({
      id: r.muted_id,
      _profile: profMap.get(r.muted_id),
      _photo: photoMap.get(r.muted_id) ? publicPhotoUrl(photoMap.get(r.muted_id)) : null,
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [myId])

  async function unmute(id) {
    tap("light")
    setUsers((cur) => cur.filter((u) => u.id !== id))
    await supabase.from("user_mutes").delete().eq("muter_id", myId).eq("muted_id", id)
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
          <h1 className="text-cream font-extrabold text-[16px]">Muted users</h1>
        </div>

        <p className="px-4 py-4 text-muted text-[12.5px] leading-relaxed">
          Posts from muted users won't appear in your feed. They won't know they're muted.
        </p>

        {loading ? (
          <div className="px-4 flex flex-col gap-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-white/[0.03] shimmer" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-[42px] mb-2">🔇</p>
            <p className="text-cream font-bold text-[14.5px] mb-1">No muted users</p>
            <p className="text-muted text-[12.5px]">Use "Mute this user" from any post's menu.</p>
          </div>
        ) : (
          <div className="px-4 flex flex-col gap-1">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.03] border border-white/8">
                <button
                  onClick={() => { tap("light"); nav("/profile/" + u.id) }}
                  className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0"
                >
                  {u._photo ? <img src={u._photo} alt="" className="w-full h-full object-cover" /> : (u._profile?.display_name || "?")[0].toUpperCase()}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-cream font-semibold text-[13.5px] truncate">
                    {u._profile?.display_name || u._profile?.username || "User"}
                  </p>
                  {u._profile?.username && <p className="text-muted text-[11.5px] truncate">@{u._profile.username}</p>}
                </div>
                <button
                  onClick={() => unmute(u.id)}
                  className="h-9 px-3 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[12px]"
                >
                  Unmute
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
