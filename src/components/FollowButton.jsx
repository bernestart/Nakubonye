import { useEffect, useState } from "react"
import { UserPlus, UserCheck } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"

export default function FollowButton({ userId, size = "md", onFollowChange }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [state, setState] = useState("loading") // "follow" | "following" | "follow_back" | "self"
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!myId || !userId || userId === myId) { setState("self"); return }
    let cancelled = false
    ;(async () => {
      const [out, inc] = await Promise.all([
        supabase.from("follows").select("follower_id").eq("follower_id", myId).eq("following_id", userId).maybeSingle(),
        supabase.from("follows").select("follower_id").eq("follower_id", userId).eq("following_id", myId).maybeSingle(),
      ])
      if (cancelled) return
      if (out.error) console.error("[FollowButton/load-out]", out.error)
      if (inc.error) console.error("[FollowButton/load-inc]", inc.error)
      if (out.data) setState("following")
      else if (inc.data) setState("follow_back")
      else setState("follow")
    })()
    return () => { cancelled = true }
  }, [myId, userId])

  if (!myId || !userId || userId === myId || state === "self" || state === "loading") return null

  async function toggle() {
    if (busy) return
    setBusy(true); tap("light")

    if (state === "following") {
      const prev = state
      setState("follow"); onFollowChange?.(false)
      const { error } = await supabase.from("follows").delete()
        .eq("follower_id", myId).eq("following_id", userId)
      if (error) {
        console.error("[FollowButton/delete]", error)
        setState(prev); onFollowChange?.(true)
      }
    } else {
      const prev = state
      setState("following"); onFollowChange?.(true)
      const { error } = await supabase.from("follows")
        .insert({ follower_id: myId, following_id: userId })
      if (error && !error.message.includes("duplicate")) {
        console.error("[FollowButton/insert]", error)
        setState(prev); onFollowChange?.(false)
      } else if (!error) {
        try {
          await supabase.from("notifications").insert({
            user_id: userId, actor_id: myId, type: "follow",
            ref_id: myId, ref_type: "profile", body: "started following you",
          })
        } catch (e) { console.warn("follow notify failed", e) }
      }
    }
    setBusy(false)
  }

  const isSmall = size === "sm"
  const cls = isSmall
    ? "h-7 px-2.5 rounded-full flex items-center gap-1 font-bold text-[11.5px]"
    : "h-9 px-3.5 rounded-full flex items-center gap-1.5 font-bold text-[13px]"
  const iconSize = isSmall ? 12 : 14
  const label = state === "following" ? "Following" : state === "follow_back" ? "Follow Back" : "Follow"

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={cls + " transition-all disabled:opacity-50"}
      style={{
        background: state === "following"
          ? "rgba(255,255,255,0.06)"
          : "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)",
        border: state === "following" ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
        color: state === "following" ? "#999" : "#fff",
        boxShadow: state === "following" ? "none" : "0 4px 12px rgba(236,72,153,0.35)",
      }}
    >
      {state === "following" ? <UserCheck size={iconSize} /> : <UserPlus size={iconSize} />}
      <span>{label}</span>
    </button>
  )
}
