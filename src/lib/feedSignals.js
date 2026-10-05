import { supabase } from "./supabase"

// In-memory queue with batching. Signals flush every 3s or on unmount.
const QUEUE = []
let flushTimer = null

function schedule() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flush()
  }, 3000)
}

export async function flush() {
  if (QUEUE.length === 0) return
  const batch = QUEUE.splice(0, QUEUE.length)
  try {
    await supabase.from("post_signals").insert(batch)
  } catch (e) {
    console.warn("feedSignals flush failed", e)
    // Requeue on failure (up to 1 retry worth)
    QUEUE.push(...batch.slice(-50))
  }
}

// Dedup per-session: prevent impression spam for the same post
const SEEN = new Set()

function push(userId, postType, postId, authorId, signal, value = 0, dedup = false) {
  if (!userId || !postId) return
  const key = signal + ":" + postType + ":" + postId
  if (dedup && SEEN.has(key)) return
  if (dedup) SEEN.add(key)
  QUEUE.push({
    user_id: userId,
    post_type: postType,
    post_id: postId,
    author_id: authorId || null,
    signal,
    value,
  })
  schedule()
}

export function logImpression(userId, post) {
  const type = post._source || post.post_type || "personal"
  const authorId = post.author_id || post.user_id
  push(userId, type, post.id, authorId, "impression", 0, true)
}

export function logView(userId, post) {
  const type = post._source || post.post_type || "personal"
  const authorId = post.author_id || post.user_id
  push(userId, type, post.id, authorId, "view", 0, true)
}

export function logDwell(userId, post, seconds) {
  const type = post._source || post.post_type || "personal"
  const authorId = post.author_id || post.user_id
  const s = Math.min(60, Math.max(0, Math.round(seconds * 10) / 10))
  push(userId, type, post.id, authorId, "dwell", s)
}

export function logSkip(userId, post) {
  const type = post._source || post.post_type || "personal"
  const authorId = post.author_id || post.user_id
  push(userId, type, post.id, authorId, "skip", 0, true)
}

export function logOpen(userId, post) {
  const type = post._source || post.post_type || "personal"
  const authorId = post.author_id || post.user_id
  push(userId, type, post.id, authorId, "open", 0, true)
}

export function logShare(userId, post) {
  const type = post._source || post.post_type || "personal"
  const authorId = post.author_id || post.user_id
  push(userId, type, post.id, authorId, "share", 0)
}

export function logHide(userId, post) {
  const type = post._source || post.post_type || "personal"
  const authorId = post.author_id || post.user_id
  push(userId, type, post.id, authorId, "hide", 0)
}

export function logUnfollow(userId, post) {
  const type = post._source || post.post_type || "personal"
  const authorId = post.author_id || post.user_id
  push(userId, type, post.id, authorId, "unfollow", 0)
}

export function logComment(userId, post) {
  const type = post._source || post.post_type || "personal"
  const authorId = post.author_id || post.user_id
  push(userId, type, post.id, authorId, "comment", 0)
}

export function logLike(userId, post) {
  const type = post._source || post.post_type || "personal"
  const authorId = post.author_id || post.user_id
  push(userId, type, post.id, authorId, "like", 0)
}

// Called on page hide / unmount to flush pending signals
export function flushNow() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
  return flush()
}

// Install auto-flush on tab hide
if (typeof window !== "undefined" && !window.__nakubonye_signals_installed) {
  window.__nakubonye_signals_installed = true
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow()
  })
  window.addEventListener("beforeunload", () => { flushNow() })
}
