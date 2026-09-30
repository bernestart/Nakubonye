import { motion } from "framer-motion"
import { Reply, Copy, Forward, Trash2, Pin, PinOff } from "lucide-react"
import { tap } from "../lib/haptic"

const REACTIONS = ["❤️", "😆", "😮", "😢", "😡", "👍"]
const PANEL_W = 300
const PANEL_H = 108

export default function MessagePopover({
  message, anchor, isMine, isPinned, canUnsend,
  onClose, onReply, onCopy, onForward, onDelete, onReact, onPin,
}) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 360
  const vh = typeof window !== "undefined" ? window.innerHeight : 640

  const showAbove = anchor.y > PANEL_H + 40
  const top = showAbove ? anchor.y - PANEL_H - 10 : anchor.y + 14
  const left = Math.max(8, Math.min(vw - PANEL_W - 8, anchor.x - PANEL_W / 2))

  function closeAnd(fn) {
    return () => { fn?.(); onClose?.() }
  }

  return (
    <>
      {/* Backdrop — captures taps anywhere to dismiss */}
      <div className="fixed inset-0 z-[400]" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: showAbove ? 6 : -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        className="fixed z-[401] rounded-2xl overflow-hidden"
        style={{
          top, left, width: PANEL_W,
          background: "#1C1C24",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.75)",
        }}
      >
        {/* Emoji row */}
        <div className="flex items-center justify-between px-2 pt-2 pb-1.5">
          {REACTIONS.map((e) => (
            <button
              key={e}
              onClick={closeAnd(() => { tap("light"); onReact?.(e) })}
              className="w-11 h-11 rounded-full grid place-items-center text-[22px] leading-none active:scale-90 transition-transform"
            >
              {e}
            </button>
          ))}
        </div>

        {/* Action row */}
        <div className="flex items-stretch border-t border-white/8">
          <PopAction icon={<Reply size={15} />} label="Reply" onClick={closeAnd(() => { tap("light"); onReply?.(message) })} />
          {message.content && (
            <PopAction
              icon={<Copy size={15} />}
              label="Copy"
              onClick={async () => {
                try { await navigator.clipboard.writeText(message.content || ""); tap("light") } catch {}
                onClose?.()
              }}
            />
          )}
          <PopAction icon={<Forward size={15} />} label="Forward" onClick={closeAnd(() => { tap("light"); onForward?.(message) })} />
          {isMine ? (
            canUnsend && (
              <PopAction icon={<Trash2 size={15} />} label="Delete" danger onClick={closeAnd(() => { tap("light"); onDelete?.(message.id) })} />
            )
          ) : (
            <PopAction
              icon={isPinned ? <PinOff size={15} /> : <Pin size={15} />}
              label={isPinned ? "Unpin" : "Pin"}
              onClick={closeAnd(() => { tap("light"); onPin?.(message) })}
            />
          )}
        </div>
      </motion.div>
    </>
  )
}

function PopAction({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 active:bg-white/[0.06] transition-colors ${danger ? "text-danger" : "text-cream"}`}
    >
      {icon}
      <span className="text-[10.5px] font-semibold">{label}</span>
    </button>
  )
}
