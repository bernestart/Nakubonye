import { X, Reply, Copy, Forward, Trash2, Smile } from "lucide-react"
import { tap } from "../lib/haptic"

const REACTIONS = ["❤️", "😂", "😍", "👍", "🔥", "😮", "😢", "😡"]

export default function MessageActionsSheet({ message, isMine, onClose, onReply, onCopy, onForward, onDelete, onReact }) {
  async function copyText() {
    try {
      await navigator.clipboard.writeText(message.content || "")
      tap("light")
      onClose?.()
    } catch {
      alert("Could not copy")
    }
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

        {/* Emoji reactions row */}
        <div className="flex justify-between gap-1 mb-4">
          {REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => { tap("light"); onReact?.(e); onClose?.() }}
              className="w-9 h-9 rounded-full grid place-items-center text-lg active:scale-90 transition-transform"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Actions list */}
        <div className="flex flex-col gap-1.5">
          <ActionRow icon={<Reply size={17} />} label="Reply" onClick={() => { onReply?.(message); onClose?.() }} />
          {message.content && (
            <ActionRow icon={<Copy size={17} />} label="Copy text" onClick={copyText} />
          )}
          <ActionRow icon={<Forward size={17} />} label="Forward" onClick={() => { onForward?.(message); onClose?.() }} />
          {isMine && (
            <ActionRow
              icon={<Trash2 size={17} className="text-red-400" />}
              label="Delete"
              danger
              onClick={() => { onClose?.(); onDelete?.(message.id) }}
            />
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full h-11 mt-3 text-muted font-semibold text-[13.5px]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function ActionRow({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-3.5 rounded-2xl text-left ${danger ? "bg-red-500/8 border border-red-500/25" : "bg-white/[0.04] border border-white/8"}`}
    >
      <span className={`w-9 h-9 rounded-xl grid place-items-center ${danger ? "bg-red-500/20 border border-red-500/40" : "bg-purple-600/20 border border-purple-500/30"}`}>
        {icon}
      </span>
      <span className="flex-1 text-cream font-semibold text-[14px]">{label}</span>
    </button>
  )
}
