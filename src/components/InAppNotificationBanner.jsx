import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { X, MessageCircle, Heart, UserPlus, Sparkles } from "lucide-react"
import { useNotifications, routeFor } from "../lib/notifications"
import { tap } from "../lib/haptic"

const ICON_FOR = {
  message: MessageCircle,
  like:    Heart,
  match:   Sparkles,
  follow:  UserPlus,
}

export default function InAppNotificationBanner() {
  const nav = useNavigate()
  const { banner, dismissBanner } = useNotifications()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!banner) { setVisible(false); return }
    setVisible(true)
    const t = setTimeout(() => { setVisible(false); dismissBanner() }, 4500)
    return () => clearTimeout(t)
  }, [banner, dismissBanner])

  function handleTap() {
    if (!banner) return
    tap("light")
    setVisible(false)
    nav(routeFor(banner))
    dismissBanner()
  }

  const data = banner?.data || {}
  const Icon = ICON_FOR[data.type] || MessageCircle

  return (
    <div
      className="fixed left-0 right-0 z-[60] flex justify-center pointer-events-none"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
    >
      <AnimatePresence>
        {visible && banner && (
          <motion.button
            key="banner"
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={handleTap}
            className="pointer-events-auto w-[92%] max-w-[440px] flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left"
            style={{
              background: "rgba(20, 12, 40, 0.94)",
              border: "1px solid rgba(255,255,255,0.10)",
              backdropFilter: "blur(16px)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
            }}
          >
            <span
              className="w-9 h-9 shrink-0 rounded-full grid place-items-center"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              <Icon size={16} strokeWidth={2.6} className="text-white" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-cream text-[13.5px] font-bold truncate leading-tight">
                {banner.title || "New notification"}
              </p>
              {banner.body && (
                <p className="text-cream/70 text-[12px] truncate leading-tight mt-0.5">
                  {banner.body}
                </p>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); tap("light"); setVisible(false); dismissBanner() }}
              className="w-7 h-7 shrink-0 rounded-full grid place-items-center text-muted"
              aria-label="Dismiss"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
