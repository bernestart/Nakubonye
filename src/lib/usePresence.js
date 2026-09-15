import { useEffect } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

export function usePresence() {
  const { session } = useAuth()
  const myId = session?.user?.id

  useEffect(() => {
    if (!myId) return

    const ping = () => {
      supabase.rpc('touch_last_seen').then(() => {}, () => {})
    }

    ping()
    const interval = setInterval(ping, 60000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') ping()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [myId])
}

export function isOnline(lastSeenAt, thresholdMinutes = 5) {
  if (!lastSeenAt) return false
  const ms = Date.now() - new Date(lastSeenAt).getTime()
  return ms < thresholdMinutes * 60 * 1000
}
