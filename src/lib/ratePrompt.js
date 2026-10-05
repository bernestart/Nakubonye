// Tracks sessions + decides when to show the rate prompt.
// Rules:
//   - Only after 5 sessions
//   - Only once per install (dismiss = don't show again for 90 days)
//   - Skip if already rated

const KEY_SESSIONS = "nakubonye_sessions_v1"
const KEY_PROMPTED = "nakubonye_prompted_at_v1"
const KEY_RATED = "nakubonye_rated_v1"

const PROMPT_AFTER_SESSIONS = 5
const DISMISS_COOLDOWN_DAYS = 90

function get(key, def) {
  try {
    const v = localStorage.getItem(key)
    return v == null ? def : JSON.parse(v)
  } catch { return def }
}

function set(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// Called once on app boot. Counts a session if last session was >30min ago.
export function recordSession() {
  const now = Date.now()
  const sessions = get(KEY_SESSIONS, [])
  const last = sessions[sessions.length - 1] || 0
  if (now - last > 30 * 60 * 1000) {
    sessions.push(now)
    if (sessions.length > 50) sessions.splice(0, sessions.length - 50)
    set(KEY_SESSIONS, sessions)
  }
  return sessions.length
}

export function shouldPrompt() {
  if (get(KEY_RATED, false)) return false
  const sessions = get(KEY_SESSIONS, [])
  if (sessions.length < PROMPT_AFTER_SESSIONS) return false
  const promptedAt = get(KEY_PROMPTED, 0)
  if (promptedAt === 0) return true
  const daysSince = (Date.now() - promptedAt) / (24 * 60 * 60 * 1000)
  return daysSince >= DISMISS_COOLDOWN_DAYS
}

export function markPrompted() {
  set(KEY_PROMPTED, Date.now())
}

export function markRated() {
  set(KEY_RATED, true)
}
