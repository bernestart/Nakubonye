import { useState } from "react"
import { Flag, RotateCcw, X } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"

const REASONS = [
  "Doesn't match my interest",
  "Scam",
  "Sexual",
  "Disturbing",
  "I don't like the creator",
  "Other"
]

export default function PostFeedbackSheet({ post, onClose, onHide, onReport }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [busy, setBusy] = useState(false)

  async function submitFeedback(reason) {
    if (busy) return
    setBusy(true)
    tap("light")
    try {
      await supabase.from("post_feedback").insert({
        user_id: myId,
        post_id: String(post.id),
        post_source: post._source,
        reason
      })
    } catch (err) {
      console.warn("Feedback save failed", err)
    }
    onHide?.(post)
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-[450] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#1C1C1E] rounded-t-[24px] border-t border-white/10 p-5"
        style={{ paddingBottom: "max(20px, var(--safe-bottom, 8px))" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-cream font-extrabold text-[17px]">Why aren't you interested?</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center bg-white/10 text-muted">
            <X size={16} />
          </button>
        </div>

        {/* Reason Pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => submitFeedback(r)}
              disabled={busy}
              className="px-4 py-2 rounded-full bg-white/[0.08] text-cream text-[13.5px] font-semibold active:bg-white/[0.15] transition-colors disabled:opacity-50"
            >
              {r}
            </button>
          ))}
        </div>

        <h4 className="text-cream font-bold text-[14.5px] mb-3">Other steps you can take</h4>
        
        <div className="flex flex-col gap-2">
          <button
            onClick={() => { tap("light"); onReport?.(post); onClose?.() }}
            className="flex items-center gap-3 p-3 rounded-xl active:bg-white/[0.05] text-left"
          >
            <Flag size={20} className="text-cream" />
            <span className="text-cream font-semibold text-[14.5px]">Report post</span>
          </button>
          
          {/* Unhide post is a visual placeholder until you have a "hidden posts" settings page */}
          <button
            onClick={() => { tap("light"); alert("This post is now hidden from your feed."); onClose?.() }}
            className="flex items-center gap-3 p-3 rounded-xl active:bg-white/[0.05] text-left"
          >
            <RotateCcw size={20} className="text-cream" />
            <span className="text-cream font-semibold text-[14.5px]">Unhide post</span>
          </button>
        </div>
      </div>
    </div>
  )
}
