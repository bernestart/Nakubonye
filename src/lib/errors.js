// Turn any error into a message a user can act on.
// Priority order:
//   1. Known Supabase / Postgres pattern → friendly translation
//   2. Short readable message → show as-is
//   3. Fallback → generic

export function friendlyError(err) {
  const msg = (err?.message || String(err || '')).trim()
  const lower = msg.toLowerCase()

  if (!msg) return 'Something went wrong. Please try again.'

  // ---------- AUTH ----------
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'That email is already registered. Try logging in instead.'
  }
  if (lower.includes('user already exists')) {
    return 'That email is already registered. Try logging in instead.'
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Email or password is incorrect.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email first. Check your inbox.'
  }
  if (lower.includes('password should be at least') || lower.includes('password is too short')) {
    return 'Password must be at least 6 characters.'
  }
  if (lower.includes('weak password')) {
    return 'That password is too weak. Try a longer one.'
  }
  if (lower.includes('invalid email') || lower.includes('email address is invalid')) {
    return "That email doesn't look right."
  }
  if (lower.includes('signups not allowed') || lower.includes('signup disabled')) {
    return 'New signups are temporarily disabled. Try again later.'
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('email rate')) {
    return 'Too many attempts. Wait a minute and try again.'
  }
  if (lower.includes('jwt') || lower.includes('token expired') || lower.includes('not authenticated')) {
    return 'Your session expired. Please log in again.'
  }

  // ---------- COINS ----------
  if (lower.includes('insufficient coins')) return 'Not enough coins for that.'
  if (lower.includes('already have an active')) return 'You already have an active boost.'

  // ---------- PERMISSIONS / RLS ----------
  if (lower.includes('row-level security') || lower.includes('policy')) {
    return "You can't do that right now."
  }
  if (lower.includes('permission denied')) {
    return "You don't have access to that."
  }
  if (lower.includes('duplicate key')) return 'That already exists.'

  // ---------- NETWORK ----------
  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('fetch')) {
    return 'Connection problem. Check your internet.'
  }
  if (lower.includes('timeout')) return 'That took too long. Try again.'

  // ---------- MEDIA ----------
  if (lower.includes('microphone')) return 'Allow microphone access to make calls.'
  if (lower.includes('camera')) return 'Allow camera access to continue.'
  if (lower.includes('file too large') || lower.includes('payload too large')) {
    return 'That file is too large.'
  }

  // ---------- FALLBACK: show the real message if it looks readable ----------
  // Strip trailing punctuation and technical noise, then check length.
  const firstLine = msg.split('\n')[0].trim()

  // If it's short and doesn't contain obvious jargon, show it as-is.
  const jargon = /(sql|postgres|postgrest|column|constraint|relation|schema|row |fn_|rpc|json|null |undefined|stack|object|array|index \d|at Object|at async)/i
  if (firstLine.length > 0 && firstLine.length < 140 && !jargon.test(firstLine)) {
    // Capitalize first letter
    return firstLine.charAt(0).toUpperCase() + firstLine.slice(1)
  }

  return 'Something went wrong. Please try again.'
}
