import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

const NotifCtx = createContext(null)

export function NotificationsProvider({ children }) {
  const { session } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

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

  // Realtime: new notification → refresh count
  useEffect(() => {
    if (!session?.user?.id) return
    const uid = session.user.id
    const ch = supabase
      .channel('notif-' + uid)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + uid },
        () => refresh())
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + uid },
        () => refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session?.user?.id, refresh])

  return (
    <NotifCtx.Provider value={{ unreadCount, loading, refresh }}>
      {children}
    </NotifCtx.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotifCtx)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider')
  return ctx
}
