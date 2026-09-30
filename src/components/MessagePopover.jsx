import { useState } from "react"
import { motion } from "framer-motion"
import {
  Copy, Forward, Reply, Trash2, Type, Plus, X, Pin, PinOff,
} from "lucide-react"
import { tap } from "../lib/haptic"
import EmojiPicker from "./chat/EmojiPicker"

const QUICK_REACTIONS = ["❤️", "😆", "😮", "😢", "😡", "👍"]

export default function MessagePopover({
  message, isMine, isPinned, canUnsend,
  onClose, onReply, onForward, onDelete, onReact, onPin,
}) {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const hasText = !!(message.content && message.content.trim())

  function closeAnd(fn) {
    return () => { fn?.(); onClose?.() }
  }

  return (
    <>
      <div className="fixed inset-0 z-[400] bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="fixed left-0 right-0 bottom-0 z-[401] mx-auto w-full max-w-[480px] bg-[#0B0B14] rounded-t-[24px] border-t border-white/10"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="pt-3 pb-1.5">
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto" />
        </div>

        {/* Emoji row — Messenger order */}
        <div className="flex items-center justify-between px-4 pt-2 pb-3">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              onClick={closeAnd(() => { tap("light"); onReact?.(e) })}
              className="w-11 h-11 rounded-full grid place-items-center text-[26px] leading-none active:scale-90 transition-transform"
            >
              {e}
            </button>
          ))}
          <button
            onClick={() => { tap("light"); setEmojiOpen(true) }}
            className="w-11 h-11 rounded-full grid place-items-center bg-white/[0.08] active:scale-90 transition-transform"
            aria-label="More reactions"
          >
            <Plus size={20} className="text-cream" />
          </button>
        </div>

        <div className="h-px bg-white/[0.06] mx-0" />

        {/* Vertical actions — plain rows */}
        <div className="py-1">
          {hasText && (
            <SheetRow
              icon={<Copy size={20} />}
              label="Copy"
              onClick={async () => {
                try { await navigator.clipboard.writeText(message.content || ""); tap("light") } catch {}
                onClose?.()
              }}
            />
          )}
          {hasText && (
            <SheetRow
              icon={<Type size={20} />}
              label="Select text"
              onClick={() => { tap("light"); onClose?.() }}
            />
          )}
          <SheetRow
            icon={<Forward size={20} />}
            label="Forward"
            onClick={closeAnd(() => { tap("light"); onForward?.(message) })}
          />
          <SheetRow
            icon={<Reply size={20} />}
            label="Reply"
            onClick={closeAnd(() => { tap("light"); onReply?.(message) })}
          />
          {isMine ? (
            canUnsend && (
              <SheetRow
                icon={<Trash2 size={20} className="text-red-400" />}
                label="Delete"
                danger
                onClick={closeAnd(() => { tap("light"); onDelete?.(message.id) })}
              />
            )
          ) : (
            <SheetRow
              icon={isPinned ? <PinOff size={20} /> : <Pin size={20} />}
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

function SheetRow({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-4 active:bg-white/[0.05] transition-colors ${danger ? "text-red-400" : "text-cream"}`}
    >
      <span className="w-6 h-6 grid place-items-center shrink-0">{icon}</span>
      <span className="font-semibold text-[15px]">{label}</span>
    </button>
  )
}
