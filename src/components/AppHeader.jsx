import { useEffect, useRef, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Search, Bell, Plus, MessageCircle } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import { useNotifications } from "../lib/notifications"

export default function AppHeader({ onScrollTop }) {
  const nav = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const myId = session?.user?.id
  const { unreadCount, loading: notifLoading } = useNotifications()
  const [onlineCount, setOnlineCount] = useState(0)
  const logoRef = useRef(null)

  // Load online count (profiles active in last 2 minutes)
  useEffect(() => {
    if (!myId) return
    let cancelled = false

    async function fetchOnline() {
      const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gt("last_seen_at", cutoff)
        .neq("id", myId)
        .eq("is_active", true)
      if (!cancelled) setOnlineCount(count || 0)
    }

    fetchOnline()
    const interval = setInterval(fetchOnline, 30000)

    const ch = supabase
      .channel("online-header-" + myId)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => fetchOnline())
      .subscribe()

    return () => {
      cancelled = true
      clearInterval(interval)
      supabase.removeChannel(ch)
    }
  }, [myId])

  function handleLogoClick() {
    tap("light")
    if (onScrollTop) onScrollTop()
    else window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function openSearch() {
    tap("light")
    nav("/search")
  }

  function openNotifications() {
    tap("light")
    nav("/notifications")
  }

  function openOnline() {
    if (onlineCount === 0) return
    tap("light")
    nav("/online")
  }

  return (
    <header
      className="sticky top-0 z-40 shrink-0"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        background: "#0B0B14",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="h-11 px-4 flex items-center justify-between">
        {/* Logo — tap scrolls to top */}
        <button
          onClick={handleLogoClick}
          aria-label="Nakubonye"
          className="w-8 h-8 rounded-[10px] grid place-items-center shrink-0 active:scale-95 transition-transform"
          style={{
            background: "linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)",
            boxShadow: "0 4px 14px rgba(168,85,247,0.4)",
          }}
        >
          <span className="text-white font-black text-[15px] leading-none">N</span>
        </button>

        {/* Online pill — center */}
        <button
          onClick={openOnline}
          disabled={onlineCount === 0}
          aria-label={onlineCount + " people online"}
          className="h-7 px-3 rounded-full flex items-center gap-1.5 transition-all"
          style={{
            background: onlineCount > 0 ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.03)",
            border: onlineCount > 0 ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(255,255,255,0.06)",
            opacity: onlineCount === 0 ? 0.5 : 1,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: onlineCount > 0 ? "#22C55E" : "#888",
              boxShadow: onlineCount > 0 ? "0 0 8px rgba(34,197,94,0.9)" : "none",
              animation: onlineCount > 0 ? "pulse-dot 2s ease-in-out infinite" : "none",
            }}
          />
          <span
            className="text-[11.5px] font-bold tracking-tight"
            style={{ color: onlineCount > 0 ? "#4ADE80" : "#666" }}
          >
            {onlineCount > 0 ? `${onlineCount} online` : "No one online"}
          </span>
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { tap("light"); nav("/messages") }}
            aria-label="Messages"
            className="w-9 h-9 rounded-full grid place-items-center text-muted active:scale-95 transition-transform"
          >
            <MessageCircle size={20} strokeWidth={2.2} />
          </button>

          <button
            onClick={() => { tap("light"); nav("/create") }}
            aria-label="Create"
            className="w-9 h-9 rounded-full grid place-items-center active:scale-95 transition-transform"
            style={{
              background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)",
              boxShadow: "0 4px 12px rgba(236,72,153,0.4)",
            }}
          >
            <Plus size={20} color="#fff" strokeWidth={2.6} />
          </button>

          <button
            onClick={openSearch}
            aria-label="Search"
            className="w-9 h-9 rounded-full grid place-items-center text-muted active:scale-95 transition-transform"
          >
            <Search size={20} strokeWidth={2.2} />
          </button>

          <button
            onClick={openNotifications}
            aria-label="Notifications"
            className="w-9 h-9 rounded-full grid place-items-center text-muted relative active:scale-95 transition-transform"
          >
            <Bell size={20} strokeWidth={2.2} />
            {!notifLoading && unreadCount > 0 && (
              <span
                className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full grid place-items-center text-white text-[9.5px] font-black"
                style={{
                  background: "#EF4444",
                  boxShadow: "0 0 8px rgba(239,68,68,0.7)",
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
      `}</style>
    </header>
  )
}
