import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

export default function ProfileFriendsStrip({ userId, isMe = false }) {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [people, setPeople] = useState([])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      // Get people this user follows (their "friends" in FB terms)
      const { data: rows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId)
        .limit(30)

      const ids = (rows || []).map((r) => r.following_id).filter(Boolean)
      if (ids.length === 0) { setPeople([]); setLoading(false); return }

      const [profsRes, photoRes, myFollowsRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, username, is_verified, date_of_birth").in("id", ids),
        supabase.from("profile_photos")
          .select("user_id, storage_path, is_primary, display_order")
          .in("user_id", ids)
          .order("is_primary", { ascending: false })
          .order("display_order", { ascending: true }),
        myId ? supabase.from("follows").select("following_id").eq("follower_id", myId) : Promise.resolve({ data: [] }),
      ])

      const pMap = new Map((profsRes.data || []).map((p) => [p.id, p]))
      const photoMap = new Map()
      ;(photoRes.data || []).forEach((x) => { if (!photoMap.has(x.user_id)) photoMap.set(x.user_id, x.storage_path) })

      // Mutual counts — count how many of my follows also follow these people
      const myFollowSet = new Set((myFollowsRes.data || []).map((r) => r.following_id))
      let mutualMap = new Map()
      if (myFollowSet.size > 0 && ids.length > 0) {
        const { data: mutualRows } = await supabase
          .from("follows")
          .select("following_id, follower_id")
          .in("following_id", ids)
          .in("follower_id", [...myFollowSet])
        ;(mutualRows || []).forEach((r) => {
          mutualMap.set(r.following_id, (mutualMap.get(r.following_id) || 0) + 1)
        })
      }

      if (cancelled) return
      setPeople(ids.slice(0, 8).map((id) => {
        const prof = pMap.get(id)
        const mutuals = mutualMap.get(id) || 0
        let statusText = ""
        if (mutuals > 0) statusText = `${mutuals} mutual`
        else if (prof?.date_of_birth) {
          const d = new Date(prof.date_of_birth)
          const now = new Date()
          const thisYear = new Date(now.getFullYear(), d.getMonth(), d.getDate())
          const daysUntil = Math.ceil((thisYear - now) / (1000 * 60 * 60 * 24))
          if (daysUntil >= 0 && daysUntil < 7) {
            statusText = daysUntil === 0 ? "Birthday today" : `Birthday in ${daysUntil}d`
          }
        }
        return {
          id,
          display_name: prof?.display_name || prof?.username || "User",
          username: prof?.username,
          photo: photoMap.get(id) ? publicPhotoUrl(photoMap.get(id)) : null,
          statusText,
        }
      }))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [userId, myId])

  if (loading || people.length === 0) return null

  return (
    <section className="px-4 pt-3 pb-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-cream font-extrabold text-[17px]">Connections</h2>
        <button
          onClick={() => { tap("light"); nav("/user/" + userId + "/following") }}
          className="text-blue-400 text-[14px] font-bold"
        >
          See all
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {people.map((p) => (
          <button
            key={p.id}
            onClick={() => { tap("light"); nav("/profile/" + p.id) }}
            className="shrink-0 flex flex-col items-center gap-1.5"
            style={{ width: 96 }}
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-elevated border border-white/8">
                {p.photo ? (
                  <img src={p.photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-purple-400 font-black text-xl">
                    {(p.display_name || "?")[0].toUpperCase()}
                  </div>
                )}
              </div>
              <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0B0B14]" />
            </div>
            <p className="text-cream text-[12px] font-bold truncate w-full text-center leading-tight">
              {p.display_name.split(" ")[0]}
            </p>
            {p.statusText && (
              <p className="text-muted text-[10.5px] truncate w-full text-center leading-tight">
                {p.statusText}
              </p>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
