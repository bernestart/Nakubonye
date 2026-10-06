import { supabase } from "./supabase"

// In-memory cache per session, keyed by user id.
// Call invalidate() after blocking/unblocking to force a reload.
const cache = new Map()

export async function loadBlockedIds(myId) {
  if (!myId) return new Set()
  if (cache.has(myId)) return cache.get(myId)
  try {
    const { data } = await supabase
      .from("blocks")
      .select("blocker_id, blocked_id")
      .or("blocker_id.eq." + myId + ",blocked_id.eq." + myId)
    const set = new Set()
    ;(data || []).forEach((b) => {
      if (b.blocker_id === myId) set.add(b.blocked_id)
      if (b.blocked_id === myId) set.add(b.blocker_id)
    })
    cache.set(myId, set)
    return set
  } catch (e) {
    console.warn("loadBlockedIds failed", e)
    return new Set()
  }
}

export function invalidateBlockedIds(myId) {
  if (myId) cache.delete(myId)
  else cache.clear()
}
