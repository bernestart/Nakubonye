import { useState } from "react"
import { Star, X } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import { markRated, markPrompted } from "../lib/ratePrompt"

export default function RatePrompt({ onClose }) {
  const { session } = useAuth()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (!rating || busy) return
    setBusy(true); tap("light")
    try {
      await supabase.from("feedback").insert({
        user_id: session?.user?.id || null,
        rating,
        comment: comment.trim() || null,
        context: "rate_prompt",
        device_hint: navigator.userAgent?.slice(0, 120) || null,
      })
      markRated()
    } catch (e) {
      console.warn("feedback submit failed", e)
    }
    setBusy(false)
    setDone(true)
    setTimeout(() => onClose?.(), 1400)
  }

  function dismiss() {
    markPrompted()
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-[600] flex items-end" onClick={dismiss}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-4"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-cream font-extrabold text-[16px]">
            {done ? "Thank you" : "How's Nakubonye so far?"}
          </h3>
          <button onClick={dismiss} className="w-8 h-8 rounded-full grid place-items-center text-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <p className="text-muted text-[13.5px] leading-relaxed pb-2">
            Your feedback helps us keep improving. 💜
          </p>
        ) : (
          <>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = n <= rating
                return (
                  <button
                    key={n}
                    onClick={() => { tap("light"); setRating(n) }}
                    className="w-11 h-11 rounded-full grid place-items-center active:scale-95 transition-transform"
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  >
                    <Star
                      size={30}
                      strokeWidth={2}
                      color={active ? "#F59E0B" : "#666"}
                      fill={active ? "#F59E0B" : "none"}
                    />
                  </button>
                )
              })}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Anything specific you'd like us to know? (optional)"
              className="w-full rounded-2xl bg-white/[0.05] border border-white/8 px-4 py-3 text-cream text-[13.5px] placeholder:text-muted focus:outline-none focus:border-purple-500 resize-none"
            />

            <button
              onClick={submit}
              disabled={!rating || busy}
              className="h-12 rounded-full text-white font-bold text-[14.5px] disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              {busy ? "Sending…" : "Send feedback"}
            </button>

            <button
              onClick={dismiss}
              className="text-muted text-[12.5px] font-semibold"
            >Maybe later</button>
          </>
        )}
      </div>
    </div>
  )
}
