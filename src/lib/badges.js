import { useEffect, useState } from "react"
import { supabase } from "./supabase"
import { useAuth } from "./auth"

// Count of unread messages across all my conversations.
// A message counts as unread if sender_id != me and created_at > my last_read_at.
export function useChatsUnread() {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!myId) return
    let cancelled = false

    async function recount() {
      // Find my matches (I can be user_one or user_two)
      const { data: myMatches } = await supabase
        .from("matches")
        .select("id")
        .or(`user_one_id.eq.${myId},user_two_id.eq.${myId}`)
      const matchIds = (myMatches || []).map((m) => m.id)

      // Conversations I am part of: either as direct participant, or via a match
      let convQuery = supabase.from("conversations").select("id")
      if (matchIds.length > 0) {
        convQuery = convQuery.or(`and(initiator_id.eq.${myId},recipient_id.neq.${myId}),and(recipient_id.eq.${myId},initiator_id.neq.${myId}),match_id.in.(${matchIds.join(",")})`)
      } else {
        convQuery = convQuery.or(`and(initiator_id.eq.${myId},recipient_id.neq.${myId}),and(recipient_id.eq.${myId},initiator_id.neq.${myId})`)
      }
      const { data: convs } = await convQuery

      if (!convs || convs.length === 0) { if (!cancelled) setCount(0); return }
      const convIds = convs.map((c) => c.id)

      const { data: reads } = await supabase
        .from("conversation_reads")
        .select("conversation_id, last_read_at")
        .eq("user_id", myId)
        .in("conversation_id", convIds)

      const readMap = new Map((reads || []).map((r) => [r.conversation_id, r.last_read_at]))

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, conversation_id, created_at")
        .in("conversation_id", convIds)
        .neq("sender_id", myId)
        .order("created_at", { ascending: false })
        .limit(500)

      let n = 0
      for (const m of msgs || []) {
        const last = readMap.get(m.conversation_id)
        if (!last || new Date(m.created_at) > new Date(last)) n++
      }
      if (!cancelled) setCount(n)
    }

    recount()

    const channel = supabase
      .channel("chats-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => recount())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_reads", filter: `user_id=eq.${myId}` }, () => recount())
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [myId])

  return count
}

// Count of new matches I haven't opened yet (seen_at IS NULL).
export function useMatchesUnread() {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!myId) return
    let cancelled = false

    async function recount() {
      const { data } = await supabase
        .from("matches")
        .select("id")
        .is("seen_at", null)
        .or(`user_one_id.eq.${myId},user_two_id.eq.${myId}`)
      if (!cancelled) setCount(data?.length || 0)
    }

    recount()

    const channel = supabase
      .channel("matches-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => recount())
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [myId])

  return count
}
