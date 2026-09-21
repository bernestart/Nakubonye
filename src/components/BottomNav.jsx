import { NavLink } from 'react-router-dom'
import { Compass, Heart, MessageCircle, User, Newspaper, Clapperboard } from 'lucide-react'
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
        background: 'linear-gradient(180deg, rgba(11,11,20,0.78) 0%, rgba(11,11,20,0.92) 100%)',
        backdropFilter: 'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
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
                    borderRadius: 999,
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(168,85,247,0.22) 0%, rgba(236,72,153,0.18) 100%)'
                      : 'transparent',
                    boxShadow: isActive
                      ? '0 0 20px rgba(168,85,247,0.5), inset 0 0 0 1px rgba(196,181,253,0.4)'
                      : 'none',
                    transition: 'all 240ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.4 : 1.9}
                    fill={isActive ? 'currentColor' : 'none'}
                    color={isActive ? '#DDD6FE' : '#7A7A8C'}
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
                        background: 'linear-gradient(135deg, #EC4899 0%, #EF4444 100%)',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 800,
                        lineHeight: '18px',
                        textAlign: 'center',
                        boxShadow: '0 0 10px rgba(239,68,68,0.7)',
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
                        background: 'linear-gradient(135deg, #EC4899 0%, #EF4444 100%)',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 800,
                        lineHeight: '18px',
                        textAlign: 'center',
                        boxShadow: '0 0 10px rgba(239,68,68,0.7)',
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
