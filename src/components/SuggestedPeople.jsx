import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Heart, Check, Loader2 } from "lucide-react"
import { tap } from "../lib/haptic"
import { supabase } from "../lib/supabase"

export default function SuggestedPeople({ people, onMatch }) {
  const nav = useNavigate()
  const [liked, setLiked] = useState(new Set())
  const [busyId, setBusyId] = useState(null)

  if (!people || people.length === 0) return null

  async function like(user) {
    if (busyId || liked.has(user.id)) return
    setBusyId(user.id); tap("medium")

    const { data, error } = await supabase.rpc("like_user", { target_user_id: user.id })
    setBusyId(null)

    if (error) { console.warn("like error:", error.message); return }
    if (data?.denied) return
    setLiked((s) => new Set([...s, user.id]))
    if (data?.matched) {
      tap("match")
      onMatch?.(user)
    }
  }

  return (
    <div className="mb-2 rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
      <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase px-3 pt-3 mb-2">
        People you may know
      </p>
      <div className="flex gap-3 overflow-x-auto px-3 pb-3" style={{ scrollbarWidth: "none" }}>
        {people.slice(0, 8).map((u) => {
          const isLiked = liked.has(u.id)
          const busy = busyId === u.id
          return (
            <div
              key={u.id}
              className="shrink-0 flex flex-col items-center gap-1.5"
              style={{ width: 92 }}
            >
              <button
                onClick={() => { tap("light"); nav("/profile/" + u.id) }}
                className="w-[72px] h-[72px] rounded-full overflow-hidden bg-elevated border-2 border-white/10 active:opacity-80"
              >
                {u.photo_url ? (
                  <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full grid place-items-center text-purple-400 font-black text-xl">
                    {(u.display_name || "?")[0]}
                  </span>
                )}
              </button>
              <span className="text-cream text-[12px] font-semibold truncate w-full text-center">
                {(u.display_name || u.username || "User").split(" ")[0]}
              </span>
              <button
                onClick={() => like(u)}
                disabled={busy || isLiked}
                className="h-7 px-3 rounded-full text-[11.5px] font-bold inline-flex items-center gap-1 active:opacity-80 disabled:opacity-60"
                style={
                  isLiked
                    ? { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#aaa" }
                    : { background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)", color: "#fff" }
                }
              >
                {busy ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : isLiked ? (
                  <><Check size={12} strokeWidth={3} /> Liked</>
                ) : (
                  <><Heart size={12} strokeWidth={2.6} fill="currentColor" /> Like</>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
