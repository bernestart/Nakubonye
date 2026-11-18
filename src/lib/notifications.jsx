import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './auth'
import { API_BASE_URL } from './api'

const NotificationsCtx = createContext(null)

export function NotificationsProvider({ children }) {
  const { session } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  
  useEffect(() => {
    if (!session?.user?.id) return;
    // TODO: Wire to Neon WebSockets /api/ws/notifications
  }, [session?.user?.id])

  return (
    <NotificationsCtx.Provider value={{ unreadCount, setUnreadCount }}>
      {children}
    </NotificationsCtx.Provider>
  )
}
export const useNotifications = () => useContext(NotificationsCtx)

// Keep the UI router (used in InAppNotificationBanner)
export function routeFor(n) {
  if (!n) return '/'
  if (n.type === 'like' || n.type === 'comment') return `/post/${n.post_id}`
  if (n.type === 'follow') return `/profile/${n.actor_id}`
  if (n.type === 'message') return `/messages/${n.actor_id}`
  return '/notifications'
}
