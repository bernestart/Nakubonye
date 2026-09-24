import { useState } from "react"
import { X, Flag, EyeOff, AlertTriangle , Trash2 } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"

const REASONS = [
  "Nudity or sexual content",
  "Violence or dangerous content",
  "Harassment or bullying",
  "Hate speech",
  "Spam or misleading",
  "Something else",
]

export default function ReelActionsSheet({ reel, onClose, onHidden, onDeleted }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [screen, setScreen] = useState("menu") // menu | report
  const [reason, setReason] = useState(null)
  const [details, setDetails] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function hideReel() {
    if (!myId) return
    setBusy(true); tap("light")
    const { error: err } = await supabase.from("reel_hides").insert({ reel_id: reel.id, user_id: myId })
    setBusy(false)
    if (err && !err.message.includes("duplicate")) { setError(err.message); return }
    onHidden?.(reel.id)
    onClose?.()
  }

  async function submitReport() {
    if (!myId || !reason) return
    setBusy(true); tap("light")
    const { error: err } = await supabase.from("reel_reports").insert({
      reel_id: reel.id,
      reporter_id: myId,
      reason,
      details: details.trim() || null,
    })
  async function deleteReel() {
    if (!confirm("Delete this reel permanently? Cannot be undone.")) return
    setBusy(true); setError("")
    const { error: err } = await supabase.rpc("delete_my_reel", { p_reel_id: reel.id })
    setBusy(false)
    if (err) { setError(err.message); return }
    onDeleted?.(reel.id)
    onClose?.()
  }

    setBusy(false)
    if (err) { setError(err.message); return }
    onClose?.()
    alert("Thanks — we'll review this reel.")
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

        {screen === "menu" && (
          <>
            <h3 className="text-cream font-extrabold text-[17px] mb-4">Reel options</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={hideReel}
                disabled={busy}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                  <EyeOff size={17} className="text-purple-300" />
                </div>
                <div className="flex-1">
                  <p className="text-cream font-semibold text-[14.5px]">Hide this reel</p>
                  <p className="text-muted text-[12px]">You won't see it again</p>
                </div>
              </button>

              <button
                onClick={() => setScreen("report")}
                className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/8 border border-red-500/25 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 grid place-items-center">
                  <Flag size={17} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-cream font-semibold text-[14.5px]">Report this reel</p>
                  <p className="text-muted text-[12px]">Flag inappropriate content</p>
                </div>
              </button>

              {reel.user_id === myId && (
                <button
                  onClick={deleteReel}
                  disabled={busy}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/12 border border-red-500/40 text-left disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-500/25 border border-red-500/50 grid place-items-center">
                    <Trash2 size={17} className="text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-cream font-semibold text-[14.5px]">Delete reel</p>
                    <p className="text-muted text-[12px]">Remove permanently</p>
                  </div>
                </button>
              )}

              <button
                onClick={onClose}
                className="w-full h-11 mt-2 text-muted font-semibold text-[13.5px]"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {screen === "report" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-cream font-extrabold text-[17px]">Why are you reporting?</h3>
              <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-1.5 mb-4">
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className="flex items-center gap-3 p-3 rounded-2xl border text-left"
                  style={{
                    background: reason === r ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
                    borderColor: reason === r ? "rgba(168,85,247,0.5)" : "rgba(255,255,255,0.06)",
                  }}
                >
                  <span
                    className="w-5 h-5 rounded-full border-2 shrink-0 grid place-items-center"
                    style={{ borderColor: reason === r ? "#A855F7" : "rgba(255,255,255,0.2)" }}
                  >
                    {reason === r && <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />}
                  </span>
                  <span className="text-cream text-[13.5px] font-medium">{r}</span>
                </button>
              ))}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 300))}
              placeholder="Add details (optional)…"
              rows={2}
              className="w-full bg-elevated border border-white/8 rounded-2xl px-4 py-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none mb-3"
            />

            {error && (
              <p className="text-red-400 text-[12.5px] mb-3 flex items-center gap-2">
                <AlertTriangle size={14} /> {error}
              </p>
            )}

            <button
              onClick={submitReport}
              disabled={!reason || busy}
              className="w-full h-12 rounded-full bg-red-500/90 text-white font-bold text-[14.5px] disabled:opacity-40"
            >
              {busy ? "Submitting…" : "Submit report"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
