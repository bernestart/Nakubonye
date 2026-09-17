import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import MatchModal from "./MatchModal"

export default function GlobalMatchCelebration() {
  const nav = useNavigate()
  const { session, profile } = useAuth()
  const myId = session?.user?.id
  const [matchModal, setMatchModal] = useState(null)
  const celebratedRef = useRef(new Set())

  useEffect(() => {
    if (!myId) return
    const ch = supabase
      .channel("global-match-" + myId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches" },
        async (payload) => {
          const m = payload.new
          if (!m) return
          if (m.user_one_id !== myId && m.user_two_id !== myId) return
          const otherId = m.user_one_id === myId ? m.user_two_id : m.user_one_id
          if (celebratedRef.current.has(otherId)) return
          celebratedRef.current.add(otherId)
          setTimeout(() => celebratedRef.current.delete(otherId), 8000)

          const { data: prof } = await supabase
            .from("profiles")
            .select("id, display_name, username, is_verified, last_seen_at")
            .eq("id", otherId)
            .maybeSingle()
          if (!prof) return
          const { data: photo } = await supabase
            .from("profile_photos")
            .select("storage_path")
            .eq("user_id", otherId)
            .order("is_primary", { ascending: false })
            .order("display_order", { ascending: true })
            .limit(1)
            .maybeSingle()
          tap("match")
          setMatchModal({ ...prof, photo_url: publicPhotoUrl(photo?.storage_path) })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [myId])

  if (!matchModal) return null

  return (
    <MatchModal
      me={profile}
      them={matchModal}
      onClose={() => setMatchModal(null)}
      onMessage={() => {
        const id = matchModal.id
        setMatchModal(null)
        nav("/messages/" + id)
      }}
    />
  )
}
