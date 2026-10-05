import { NavLink, useNavigate } from 'react-router-dom'
import { Compass, Heart, MessageCircle, User, Newspaper, Clapperboard , Plus } from 'lucide-react'
import { tap } from '../lib/haptic'
import { useChatsUnread, useMatchesUnread } from '../lib/badges'

const items = [
  { to: '/feed',     label: 'Feed',     Icon: Newspaper },
  { to: '/discover', label: 'Discover', Icon: Compass },
  { to: '/reels',    label: 'Reels',    Icon: Clapperboard },
  { to: '/matches',  label: 'Matches',  Icon: TwoHearts },
  { to: '/messages', label: 'Chat',     Icon: MessageCircle },
  { to: '/me',       label: 'Profile',  Icon: User },
]

function TwoHearts({ size = 22, strokeWidth = 1.9, fill = 'none', color }) {
  const s = size * 0.68
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size, color }}
    >
      <Heart
        size={s}
        strokeWidth={strokeWidth * 1.15}
        fill={fill}
        className="absolute"
        style={{ top: 0, left: 0 }}
      />
      <Heart
        size={s}
        strokeWidth={strokeWidth * 1.15}
        fill={fill}
        className="absolute"
        style={{ bottom: 0, right: 0 }}
      />
    </span>
  )
}

export default function BottomNav() {
  const nav = useNavigate()
  const chatsUnread = useChatsUnread()
  const matchesUnread = useMatchesUnread()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        background: 'rgba(11,11,20,0.92)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        zIndex: 40,
      }}
    >
      <div
        className="grid grid-cols-6"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
      >
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => tap('light')}
            aria-label={label}
            className="flex flex-col items-center justify-center gap-0.5 pt-2.5 pb-1.5 active:scale-[0.94] transition-transform"
          >
            {({ isActive }) => (
              <>
                <span
                  className="grid place-items-center relative"
                  style={{
                    width: 46,
                    height: 28,
                    transition: 'opacity 160ms',
                  }}
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.4 : 1.8}
                    fill={isActive ? 'currentColor' : 'none'}
                    color={isActive ? '#EC4899' : '#7A7A8C'}
                  />
                  {to === '/messages' && chatsUnread > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -6,
                        minWidth: 18,
                        height: 18,
                        padding: '0 5px',
                        borderRadius: 999,
                        background: '#EC4899',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 800,
                        lineHeight: '18px',
                        textAlign: 'center',
                        border: '1.5px solid #0B0B14',
                      }}
                    >
                      {chatsUnread > 9 ? '9+' : chatsUnread}
                    </span>
                  )}
                  {to === '/matches' && matchesUnread > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -6,
                        minWidth: 18,
                        height: 18,
                        padding: '0 5px',
                        borderRadius: 999,
                        background: '#EC4899',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 800,
                        lineHeight: '18px',
                        textAlign: 'center',
                        border: '1.5px solid #0B0B14',
                      }}
                    >
                      {matchesUnread > 9 ? '9+' : matchesUnread}
                    </span>
                  )}
                </span>
                <span
                  className="text-[10px] font-bold tracking-tight"
                  style={{
                    color: isActive ? '#DDD6FE' : '#5A6072',
                    transition: 'color 200ms',
                  }}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>

    </nav>
  )
}
