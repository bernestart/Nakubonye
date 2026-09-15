import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotifications } from '../lib/notifications'
import { tap } from '../lib/haptic'

export default function NotificationBell() {
  const nav = useNavigate()
  const { unreadCount, loading } = useNotifications()

  function open() {
    tap('light')
    nav('/notifications')
  }

  return (
    <button
      onClick={open}
      className="w-9 h-9 rounded-full grid place-items-center text-muted relative"
      aria-label={unreadCount > 0 ? `${unreadCount} new notifications` : 'Notifications'}
    >
      <Bell size={18} strokeWidth={2.2} />
      {!loading && unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full grid place-items-center bg-gradient-to-br from-purple-600 to-pink-500 text-white text-[9.5px] font-bold border-2"
          style={{ borderColor: '#0B0B14' }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
