import { useEffect, useState } from "react"
import { UserPlus, UserCheck } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"

export default function FollowButton({ userId, size = "md", onFollowChange }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!myId || !userId || userId === myId) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", myId)
        .eq("following_id", userId)
        .maybeSingle()
      if (!cancelled) { setFollowing(!!data); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [myId, userId])

  if (!myId || !userId || userId === myId) return null

  async function toggle() {
    if (busy || loading) return
    setBusy(true); tap("light")
    const next = !following
    setFollowing(next)
    onFollowChange?.(next)

    if (next) {
      const { error } = await supabase.from("follows").insert({ follower_id: myId, following_id: userId })
      if (error && !error.message.includes("duplicate")) {
        setFollowing(false); onFollowChange?.(false)
      }
    } else {
      const { error } = await supabase.from("follows").delete().eq("follower_id", myId).eq("following_id", userId)
      if (error) {
        setFollowing(true); onFollowChange?.(true)
      }
    }
    setBusy(false)
  }

  const isSmall = size === "sm"
  const cls = isSmall
    ? "h-7 px-2.5 rounded-full flex items-center gap-1 font-bold text-[11.5px]"
    : "h-9 px-3.5 rounded-full flex items-center gap-1.5 font-bold text-[13px]"
  const iconSize = isSmall ? 12 : 14

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={cls + " transition-all disabled:opacity-50"}
      style={{
        background: following
          ? "rgba(255,255,255,0.06)"
          : "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)",
        border: following ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
        color: following ? "#999" : "#fff",
        boxShadow: following ? "none" : "0 4px 12px rgba(236,72,153,0.35)",
      }}
    >
      {following ? <UserCheck size={iconSize} /> : <UserPlus size={iconSize} />}
      <span>{following ? "Following" : "Follow"}</span>
    </button>
  )
}
