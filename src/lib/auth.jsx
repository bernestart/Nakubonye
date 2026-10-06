import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (!data.session) setLoading(false)
    })

    // Track which session creation timestamps we've already logged (avoid dupes)
    const loggedSessions = new Set()

    function logLoginEvent(userId, sessionCreatedAt, method, accessToken) {
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
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return
        setSession(newSession)
        if (!newSession) {
          setProfile(null)
          setLoading(false)
          return
        }
        // Log sign-in events (initial + token refresh aren't new sign-ins)
        if (event === "SIGNED_IN") {
          const ca = newSession?.user?.last_sign_in_at || newSession?.user?.updated_at || Date.now()
          logLoginEvent(newSession.user.id, ca, "password", newSession?.access_token)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return
    let cancelled = false

    ;(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, date_of_birth, gender, bio, city, country, is_verified, is_active, is_admin, profession, education, religion, relationship_status, body_height_cm, languages, body_type, personality, relationship_preference, music_genres, smoker, drinking, partying, exercise, tattoos, diet, pets, children, hide_online_status, hide_age, incognito_mode, only_matches_can_message, is_banned, banned_reason, cover_photo_path')
        .eq('id', session.user.id)
        .single()

      if (cancelled) return

      if (!data) {
        // Trigger may not have created a row yet. Try again once.
        await new Promise((r) => setTimeout(r, 700))
        const retry = await supabase
          .from('profiles')
          .select('id, username, display_name, date_of_birth, gender, bio, city, country, is_verified, is_active, is_admin, profession, education, religion, relationship_status, body_height_cm, languages, body_type, personality, relationship_preference, music_genres, smoker, drinking, partying, exercise, tattoos, diet, pets, children, hide_online_status, hide_age, incognito_mode, only_matches_can_message, is_banned, banned_reason, cover_photo_path')
          .eq('id', session.user.id)
          .single()
        if (!cancelled) {
          setProfile(retry.data || null)
          setLoading(false)
        }
        return
      }

      setProfile(data)
      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [session?.user?.id])

  const refreshProfile = async () => {
    if (!session?.user?.id) return null
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, date_of_birth, gender, bio, city, country, is_verified, is_active, is_admin, profession, education, religion, relationship_status, body_height_cm, languages, body_type, personality, relationship_preference, music_genres, smoker, drinking, partying, exercise, tattoos, diet, pets, children, hide_online_status, hide_age, incognito_mode, only_matches_can_message, is_banned, banned_reason, cover_photo_path')
      .eq('id', session.user.id)
      .single()
    if (data) setProfile(data)
    return data
  }

  const value = { session, profile, setProfile, loading, refreshProfile }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
