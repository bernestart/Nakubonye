import { useState } from "react"
import { motion } from "framer-motion"
import {
  Copy, Forward, Reply, Trash2, Type, Plus, X,
  Pin, PinOff, Heart, Smile,
} from "lucide-react"
import { tap } from "../lib/haptic"
import EmojiPicker from "./chat/EmojiPicker"

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"]

export default function MessagePopover({
  message, anchor, isMine, isPinned, canUnsend,
  onClose, onReply, onCopy, onForward, onDelete, onReact, onPin,
}) {
  const [emojiOpen, setEmojiOpen] = useState(false)

  const vw = typeof window !== "undefined" ? window.innerWidth : 360
  const vh = typeof window !== "undefined" ? window.innerHeight : 640

  const hasText = !!(message.content && message.content.trim())
  const rowCount = (hasText ? 2 : 0) + 2 + (isMine ? (canUnsend ? 1 : 0) : 1)
  // rows: Copy + Select text (if text) + Forward + Reply + (Delete/Pin)  = ~5
  const estH = 76 + 44 * (rowCount) + 40
  const showAbove = anchor.y > estH + 40
  const top = showAbove ? Math.max(8, anchor.y - estH - 12) : Math.min(vh - estH - 8, anchor.y + 14)
  const panelW = 260
  const left = Math.max(8, Math.min(vw - panelW - 8, anchor.x - panelW / 2))

  function closeAnd(fn) {
    return () => { fn?.(); onClose?.() }
  }

  return (
    <>
      <div className="fixed inset-0 z-[400]" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        className="fixed z-[401] rounded-2xl overflow-hidden"
        style={{
          top, left, width: panelW,
          background: "#242526",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.75)",
        }}
      >
        {/* Emoji reaction row */}
        <div className="flex items-center justify-between px-2 pt-2 pb-1.5 border-b border-white/[0.06]">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              onClick={closeAnd(() => { tap("light"); onReact?.(e) })}
              className="w-9 h-9 rounded-full grid place-items-center text-[22px] leading-none active:scale-90 transition-transform"
            >
              {e}
            </button>
          ))}
          <button
            onClick={() => { tap("light"); setEmojiOpen(true) }}
            className="w-9 h-9 rounded-full grid place-items-center bg-white/[0.06] active:scale-90 transition-transform"
            aria-label="More reactions"
          >
            <Plus size={16} className="text-cream" />
          </button>
        </div>

        {/* Vertical actions */}
        <div className="flex flex-col">
          {hasText && (
            <ActionRow
              icon={<Copy size={17} />}
              label="Copy"
              onClick={async () => {
                try { await navigator.clipboard.writeText(message.content || ""); tap("light") } catch {}
                onClose?.()
              }}
            />
          )}
          {hasText && (
            <ActionRow
              icon={<Type size={17} />}
              label="Select text"
              onClick={() => {
                tap("light")
                onClose?.()
              }}
            />
          )}
          <ActionRow
            icon={<Forward size={17} />}
            label="Forward"
            onClick={closeAnd(() => { tap("light"); onForward?.(message) })}
          />
          <ActionRow
            icon={<Reply size={17} />}
            label="Reply"
            onClick={closeAnd(() => { tap("light"); onReply?.(message) })}
          />
          {isMine ? (
            canUnsend && (
              <ActionRow
                icon={<Trash2 size={17} className="text-red-400" />}
                label="Delete"
                danger
                onClick={closeAnd(() => { tap("light"); onDelete?.(message.id) })}
              />
            )
          ) : (
            <ActionRow
              icon={isPinned ? <PinOff size={17} /> : <Pin size={17} />}
              label={isPinned ? "Unpin" : "Pin"}
              onClick={closeAnd(() => { tap("light"); onPin?.(message) })}
            />
          )}
        </div>
      </motion.div>

      {/* Full emoji picker overlay */}
      {emojiOpen && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setEmojiOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-4"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
            <div className="flex items-center justify-between mb-3">
              <p className="text-cream font-bold text-[15px]">React</p>
              <button onClick={() => setEmojiOpen(false)} className="w-8 h-8 rounded-full grid place-items-center text-muted">
                <X size={18} />
              </button>
            </div>
            <EmojiPicker
              onPick={(e) => { tap("light"); onReact?.(e); onClose?.() }}
            />
          </div>
        </div>
      )}
    </>
  )
}

function ActionRow({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3.5 px-4 py-3 text-left active:bg-white/[0.05] transition-colors ${danger ? "text-red-400" : "text-cream"}`}
    >
      <span className="w-5 h-5 grid place-items-center shrink-0">{icon}</span>
      <span className="font-semibold text-[14.5px]">{label}</span>
    </button>
  )
}
