import { NavLink } from 'react-router-dom'
import { Compass, Heart, MessageCircle, User } from 'lucide-react'
import { tap } from '../lib/haptic'
import { useChatsUnread, useMatchesUnread } from '../lib/badges'

const items = [
  { to: '/discover', label: 'Discover', Icon: Compass },
  { to: '/likes',    label: 'Likes',    Icon: Heart },
  { to: '/matches',  label: 'Matches',  Icon: TwoHearts },
  { to: '/messages', label: 'Chat',     Icon: MessageCircle },
  { to: '/me',       label: 'Profile',  Icon: User },
]

// Custom composed icon — two overlapping hearts, outline style
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
        background: 'rgba(11, 11, 20, 0.55)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.03)',
        zIndex: 40,
      }}
    >
      <div
        className="grid grid-cols-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
      >
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => tap('light')}
            aria-label={label}
            className="flex flex-col items-center justify-center gap-1 pt-3 pb-1"
          >
            {({ isActive }) => (
              <>
                <span
                  className="grid place-items-center transition-all duration-200 relative"
                  style={{
                    width: 44,
                    height: 26,
                    borderRadius: 999,
                    background: isActive ? 'rgba(168, 85, 247, 0.18)' : 'transparent',
                    boxShadow: isActive ? '0 0 18px rgba(168, 85, 247, 0.55), inset 0 0 0 1px rgba(196, 181, 253, 0.35)' : 'none',
                  }}
                >
                  <Icon
                    size={21}
                    strokeWidth={isActive ? 2.4 : 1.9}
                    fill={isActive ? 'currentColor' : 'none'}
                    color={isActive ? '#C4B5FD' : '#7A7A8C'}
                  />
                  {to === '/messages' && chatsUnread > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -6,
                        minWidth: 18,
                        height: 18,
                        padding: "0 5px",
                        borderRadius: 999,
                        background: "#EF4444",
                        color: "#fff",
                        fontSize: 10.5,
                        fontWeight: 800,
                        lineHeight: "18px",
                        textAlign: "center",
                        boxShadow: "0 0 8px rgba(239,68,68,0.6)",
                      }}
                    >
                      {chatsUnread > 9 ? "9+" : chatsUnread}
                    </span>
                  )}
                  {to === '/matches' && matchesUnread > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -6,
                        minWidth: 18,
                        height: 18,
                        padding: "0 5px",
                        borderRadius: 999,
                        background: "#EF4444",
                        color: "#fff",
                        fontSize: 10.5,
                        fontWeight: 800,
                        lineHeight: "18px",
                        textAlign: "center",
                        boxShadow: "0 0 8px rgba(239,68,68,0.6)",
                      }}
                    >
                      {matchesUnread > 9 ? "9+" : matchesUnread}
                    </span>
                  )}
                </span>
                <span
                  className="text-[10.5px] font-semibold tracking-wide"
                  style={{ color: isActive ? '#C4B5FD' : '#5A6072' }}
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
