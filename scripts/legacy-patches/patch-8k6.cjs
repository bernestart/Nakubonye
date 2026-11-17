const fs = require('fs')

// ── 1. auth.jsx — new_login notification when a new device signs in ──
{
  const p = 'src/lib/auth.jsx'
  let s = fs.readFileSync(p, 'utf8')

  const oldFn = `    function logLoginEvent(userId, sessionCreatedAt, method, accessToken) {
      if (!userId) return
      const sid = accessToken ? String(accessToken).slice(-20) : null
      const key = String(sessionCreatedAt || "") + ":" + userId + ":" + (sid || "")
      if (loggedSessions.has(key)) return
      loggedSessions.add(key)
      try {
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
        const hint = (ua || "").slice(0, 120)
        supabase.from("login_events").insert({
          user_id: userId,
          user_agent: ua,
          device_hint: hint,
          method: method || "password",
          session_id: sid,
          is_active: true,
        }).then(() => {}, () => {})
      } catch {}
    }`

  const newFn = `    async function logLoginEvent(userId, sessionCreatedAt, method, accessToken) {
      if (!userId) return
      const sid = accessToken ? String(accessToken).slice(-20) : null
      const key = String(sessionCreatedAt || "") + ":" + userId + ":" + (sid || "")
      if (loggedSessions.has(key)) return
      loggedSessions.add(key)
      try {
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
        const hint = (ua || "").slice(0, 120)

        const { data: existing } = await supabase
          .from("login_events")
          .select("id")
          .eq("user_id", userId)
          .eq("device_hint", hint)
          .limit(1)
          .maybeSingle()
        const isNewDevice = !existing

        const { count } = await supabase
          .from("login_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
        const isFirstEver = (count || 0) === 0

        const { data: inserted } = await supabase
          .from("login_events")
          .insert({
            user_id: userId,
            user_agent: ua,
            device_hint: hint,
            method: method || "password",
            session_id: sid,
            is_active: true,
          })
          .select("id")
          .single()

        if (isNewDevice && !isFirstEver && inserted?.id) {
          try {
            await supabase.from("notifications").insert({
              user_id: userId,
              actor_id: userId,
              type: "new_login",
              ref_id: String(inserted.id),
              ref_type: "security",
              body: "New sign-in to your account",
            })
          } catch (e) { console.warn("login alert notify failed", e) }
        }
      } catch (e) { console.warn("logLoginEvent failed", e) }
    }`

  if (!s.includes(oldFn)) throw new Error('logLoginEvent anchor missing')
  s = s.replace(oldFn, newFn)

  fs.writeFileSync(p, s)
  console.log('OK auth.jsx: new_login notification')
}

// ── 2. Notifications.jsx — handle new_login type + security nav ──
{
  const p = 'src/screens/Notifications.jsx'
  let s = fs.readFileSync(p, 'utf8')

  // Add ShieldCheck import if missing
  const lucideLine = s.split('\n').find((l) => l.includes('from "lucide-react"'))
  if (lucideLine && !lucideLine.includes('ShieldCheck')) {
    s = s.replace(lucideLine, lucideLine.replace('{', '{ ShieldCheck,'))
  }

  // Add new_login to type map
  const mapAnchor = `    mention:      { Icon: AtSign,          color: "text-purple-400" },`
  if (s.includes(mapAnchor) && !s.includes('new_login')) {
    s = s.replace(mapAnchor, mapAnchor + `\n    new_login:    { Icon: ShieldCheck,     color: "text-amber-400" },`)
  } else if (!s.includes('new_login') && s.includes('message:      { Icon: MessageCircle,   color: "text-blue-400" },')) {
    // alt anchor
    const alt = `    message:      { Icon: MessageCircle,   color: "text-blue-400" },`
    s = s.replace(alt, alt + `\n    new_login:    { Icon: ShieldCheck,     color: "text-amber-400" },`)
  }

  // Add security navigation
  const navAnchor = `    else if (n.ref_type === "profile" && n.actor_id) nav("/profile/" + n.actor_id)`
  if (s.includes(navAnchor) && !s.includes('ref_type === "security"')) {
    s = s.replace(navAnchor, navAnchor + `\n    else if (n.ref_type === "security") nav("/settings/security")`)
  }

  fs.writeFileSync(p, s)
  console.log('OK Notifications.jsx: new_login type + security nav')
}
