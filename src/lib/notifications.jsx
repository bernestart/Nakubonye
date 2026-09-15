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

    // Count unread messages (conversations with last_message_at > my last read)
    let count = 0

    const { data: convRows } = await supabase
      .from('conversations')
      .select('id, match_id, initiator_id, recipient_id, is_direct, last_message_at')
      .order('last_message_at', { ascending: false })
      .limit(30)

    if (convRows?.length) {
      const { data: matchRows } = await supabase
        .from('matches')
        .select('id')
        .or(`user_one_id.eq.${uid},user_two_id.eq.${uid}`)
      const myMatchIds = new Set((matchRows || []).map((m) => m.id))

      const relevant = convRows.filter((c) => {
        if (c.is_direct) return c.initiator_id === uid || c.recipient_id === uid
        return myMatchIds.has(c.match_id)
      })

      if (relevant.length) {
        const { data: readRows } = await supabase
          .from('conversation_reads')
          .select('conversation_id, last_read_at')
          .eq('user_id', uid)
          .in('conversation_id', relevant.map((c) => c.id))
        const readMap = new Map((readRows || []).map((r) => [r.conversation_id, r.last_read_at]))

        relevant.forEach((c) => {
          if (!c.last_message_at) return
          const readAt = readMap.get(c.id)
          if (!readAt || new Date(c.last_message_at) > new Date(readAt)) count++
        })
      }
    }

    // Count pending super requests received
    const { count: superCount } = await supabase
      .from('super_requests')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', uid)
      .eq('status', 'pending')
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
        { event: 'INSERT', schema: 'public', table: 'messages' },
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
