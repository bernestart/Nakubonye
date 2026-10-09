import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { useAuth } from './auth'

const NotifCtx = createContext(null)

export function NotificationsProvider({ children }) {
  const nav = useNavigate()
  const { session } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // In-app banner (shown when a push arrives while the app is in foreground)
  const [banner, setBanner] = useState(null)

  useEffect(() => {
    function onPush(e) {
      const n = e?.detail
      if (!n) return
      let data = n.data || {}
      if (typeof data === "string") {
        try { data = JSON.parse(data) } catch { data = {} }
      }
      setBanner({ title: n.title || "", body: n.body || "", data })
    }
    window.addEventListener("nk-push-received", onPush)
    return () => window.removeEventListener("nk-push-received", onPush)
  }, [])

  useEffect(() => {
    function normalize(n) {
      if (!n) return null
      let data = n.data || {}
      if (typeof data === "string") {
        try { data = JSON.parse(data) } catch { data = {} }
      }
      return { ...n, data }
    }

    function onTap(e) {
      const n = normalize(e?.detail)
      if (!n) return
      if (!session?.user?.id) {
        window.__nkPendingTap = n
        return
      }
      try { nav(routeFor(n)) } catch (err) { console.warn("push nav failed", err) }
    }

    window.addEventListener("nk-push-tapped", onTap)

    if (session?.user?.id) {
      const pending = window.__nkPendingTap
      if (pending) {
        const n = normalize(pending)
        console.log("[notif] consuming buffered tap", n)
        try { nav(routeFor(n)) } catch (err) { console.warn("pending tap nav failed", err) }
        window.__nkPendingTap = null
      }
    }

    return () => window.removeEventListener("nk-push-tapped", onTap)
  }, [nav, session?.user?.id])

  const dismissBanner = useCallback(() => setBanner(null), [])

  const refresh = useCallback(async () => {
    if (!session?.user?.id) {
      setUnreadCount(0)
      setLoading(false)
      return
    }
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .is('read_at', null)
    setUnreadCount(count || 0)
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { refresh() }, [refresh])

  // Realtime: increment/decrement locally — no DB roundtrip on every event
  useEffect(() => {
    if (!session?.user?.id) return
    const uid = session.user.id
    const ch = supabase
      .channel('notif-' + uid)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + uid },
        (payload) => {
          // Only bump if the new row is unread
          if (payload?.new && !payload.new.read_at) {
            setUnreadCount((c) => c + 1)
          }
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + uid },
        (payload) => {
          const wasUnread = payload?.old && !payload.old.read_at
          const isUnread = payload?.new && !payload.new.read_at
          if (wasUnread && !isUnread) setUnreadCount((c) => Math.max(0, c - 1))
          else if (!wasUnread && isUnread) setUnreadCount((c) => c + 1)
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + uid },
        (payload) => {
          if (payload?.old && !payload.old.read_at) {
            setUnreadCount((c) => Math.max(0, c - 1))
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session?.user?.id])

  return (
    <NotifCtx.Provider value={{ unreadCount, loading, refresh, banner, dismissBanner }}>
      {children}
    </NotifCtx.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotifCtx)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider')
  return ctx
}


export function routeFor(notif) {
  const data = notif?.data || {}
  const t = data.type || "default"
  const commentId = data.comment_id || ""

  if (t === "message") {
    return data.actor_id ? "/messages/" + data.actor_id : "/messages"
  }
  if (t === "like" || t === "follow" || t === "like_profile") {
    return data.actor_id ? "/profile/" + data.actor_id : "/notifications"
  }
  if (t === "match") {
    return data.actor_id ? "/messages/" + data.actor_id : "/matches"
  }
  if (t === "post_like" || t === "like_post" || t === "community_post_reaction") {
    const id = data.post_id
    if (!id) return "/notifications"
    const src = t === "community_post_reaction" ? "community" : "personal"
    return "/post/" + src + "/" + id
  }
  if (t === "post_comment" || t === "comment_post" || t === "comment_reply" ||
      t === "community_post_comment" || t === "community_comment_reply") {
    const id = data.post_id
    if (!id) return "/notifications"
    const src = (t.indexOf("community") === 0) ? "community" : "personal"
    const base = "/post/" + src + "/" + id
    return commentId ? base + "?comment=" + commentId : base
  }
  if (t === "reel_like" || t === "reel_comment" || t === "reel_comment_reply" ||
      t === "comment_reaction" || t === "like_reel" || t === "comment_reel") {
    const parts = []
    if (data.reel_id) parts.push("id=" + data.reel_id)
    if (commentId)    parts.push("comment=" + commentId)
    return parts.length ? "/reels?" + parts.join("&") : "/reels"
  }
  if (t === "mention" || t === "story_mention") {
    return "/stories"
  }
  if (t === "new_login" || t === "security") {
    return "/settings/security"
  }
  return "/notifications"
}
