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
    const uid = session.user.id

    // Fetch my last-seen-notifications timestamp
    const { data: myProf } = await supabase
      .from('profiles')
      .select('notifications_seen_at')
      .eq('id', uid)
      .maybeSingle()
    const seenAt = myProf?.notifications_seen_at
      ? new Date(myProf.notifications_seen_at)
      : new Date(0)

    let count = 0

    // Paid DM openers received since last check
    const { count: dmCount } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('is_direct', true)
      .eq('recipient_id', uid)
      .gt('created_at', seenAt.toISOString())
    count += dmCount || 0

    // Pending super requests received since last check
    const { count: superCount } = await supabase
      .from('super_requests')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', uid)
      .eq('status', 'pending')
      .gt('created_at', seenAt.toISOString())
    count += superCount || 0

    setUnreadCount(count)
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { refresh() }, [refresh])

  // Realtime: any new message, any new super request, refresh
  useEffect(() => {
    if (!session?.user?.id) return
    const uid = session.user.id
    const ch = supabase
      .channel('notif-' + uid)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        () => { refresh() })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'super_requests', filter: 'recipient_id=eq.' + uid },
        () => { refresh() })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_reads', filter: 'user_id=eq.' + uid },
        () => { refresh() })
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
