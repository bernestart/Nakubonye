// Offline catch-up: sync unread notifications created while we were offline.
// Two-layer dedup:
//   1. last-push marker advanced on every completed sync
//   2. seen-set of DB notification ids — never scheduled twice
import { Capacitor } from "@capacitor/core"
import { LocalNotifications } from "@capacitor/local-notifications"
import { supabase } from "./supabase"

const KEY_LAST_PUSH = (uid) => `nk-notif-last-push-${uid}`
const KEY_LAST_SYNC = (uid) => `nk-notif-last-sync-${uid}`
const KEY_SEEN      = (uid) => `nk-notif-seen-${uid}`
const MAX_PER_SYNC  = 15

export function markPushReceived(userId) {
  if (!userId) return
  try { localStorage.setItem(KEY_LAST_PUSH(userId), new Date().toISOString()) } catch {}
}

export function markNotifSeen(userId, notifId) {
  if (!userId || !notifId) return
  try {
    const set = loadSeen(userId)
    set.add(`db:${notifId}`)
    saveSeen(userId, set)
  } catch {}
}

function loadSeen(uid) {
  try {
    const raw = localStorage.getItem(KEY_SEEN(uid))
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}

function saveSeen(uid, set) {
  try {
    const arr = [...set].slice(-300)
    localStorage.setItem(KEY_SEEN(uid), JSON.stringify(arr))
  } catch {}
}

function stripActorPrefix(body, actorName) {
  if (!body || !actorName) return body || ""
  const esc = actorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp("^" + esc + "\\s+", "i")
  const stripped = body.replace(re, "")
  return stripped || body
}

export async function syncMissedNotifications() {
  if (!Capacitor.isNativePlatform()) return
  if (typeof navigator !== "undefined" && !navigator.onLine) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  let lastPush = localStorage.getItem(KEY_LAST_PUSH(user.id))

  if (!lastPush) {
    const lookbackMs = 6 * 60 * 60 * 1000
    lastPush = new Date(Date.now() - lookbackMs).toISOString()
    localStorage.setItem(KEY_LAST_PUSH(user.id), lastPush)
    console.log("[notifSync] cold start — no marker, looking back 6h")
  }

  const since = new Date(lastPush).toISOString()

  const { data, error } = await supabase
    .from("notifications")
    .select("id, actor_id, type, ref_id, ref_type, body, created_at")
    .eq("user_id", user.id)
    .is("read_at", null)
    .gt("created_at", since)
    .order("created_at", { ascending: true })
    .limit(MAX_PER_SYNC)

  const stamp = new Date().toISOString()

  if (error || !data || data.length === 0) {
    // Nothing new — still advance marker so we don't re-scan the same window.
    localStorage.setItem(KEY_LAST_PUSH(user.id), stamp)
    localStorage.setItem(KEY_LAST_SYNC(user.id), stamp)
    return
  }

  // Layer 2: filter out anything already scheduled in a prior sync.
  const seen = loadSeen(user.id)
  const fresh = data.filter((n) => !seen.has(`db:${n.id}`))

  if (fresh.length === 0) {
    localStorage.setItem(KEY_LAST_PUSH(user.id), stamp)
    localStorage.setItem(KEY_LAST_SYNC(user.id), stamp)
    console.log("[notifSync] all rows already seen — advancing marker")
    return
  }

  // Look up actor display names
  const actorIds = [...new Set(fresh.map((n) => n.actor_id).filter(Boolean))]
  const nameMap = new Map()
  if (actorIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", actorIds)
    ;(profs || []).forEach((p) => {
      nameMap.set(p.id, p.display_name || p.username || "Someone")
    })
  }

  const now = Date.now()
  const scheduled = fresh.map((n, i) => {
    const actorName = nameMap.get(n.actor_id) || "Nakubonye"
    return {
      id: ((now + i) % 2147483647),
      title: actorName,
      body: stripActorPrefix(n.body || "", actorName),
      channelId: "default",
      autoCancel: true,
      extra: {
        type: n.type || "",
        actor_id: n.actor_id || "",
        post_id: n.ref_type === "post" ? String(n.ref_id || "") : "",
        reel_id: n.ref_type === "reel" ? String(n.ref_id || "") : "",
        notification_id: String(n.id),
      },
    }
  })

  try {
    await LocalNotifications.schedule({ notifications: scheduled })
    console.log("[notifSync] scheduled", scheduled.length, "missed")
    // Layer 1: advance marker ONLY after successful schedule.
    fresh.forEach((n) => seen.add(`db:${n.id}`))
    saveSeen(user.id, seen)
    localStorage.setItem(KEY_LAST_PUSH(user.id), stamp)
  } catch (e) {
    console.warn("[notifSync] schedule failed — marker NOT advanced", e)
    // Don't advance seen/marker on failure — retry next sync.
  }

  localStorage.setItem(KEY_LAST_SYNC(user.id), stamp)
}

export function resetSyncMarker() {
  try {
    const keys = Object.keys(localStorage)
    keys.forEach((k) => {
      if (k.startsWith("nk-notif-last-") || k.startsWith("nk-notif-seen-")) {
        localStorage.removeItem(k)
      }
    })
  } catch {}
}
