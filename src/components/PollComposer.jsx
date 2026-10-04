import { useState } from "react"
import { createPortal } from "react-dom"
import { X, Plus, BarChart2 } from "lucide-react"
import { tap } from "../lib/haptic"

export default function PollComposer({ onClose, onSend }) {
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [multiple, setMultiple] = useState(false)
  const [busy, setBusy] = useState(false)

  function setOpt(i, v) {
    setOptions((cur) => cur.map((o, idx) => idx === i ? v.slice(0, 60) : o))
  }
  function addOpt() { if (options.length < 4) setOptions((cur) => [...cur, ""]) }
  function removeOpt(i) { if (options.length > 2) setOptions((cur) => cur.filter((_, idx) => idx !== i)) }

  const q = question.trim()
  const filled = options.map((o) => o.trim()).filter(Boolean)
  const ready = q && filled.length >= 2 && !busy

  async function send() {
    if (!ready) return
    setBusy(true); tap("light")
    const poll = {
      question: q,
      multiple_choice: multiple,
      options: filled.map((label, i) => ({ key: "o" + i, label })),
    }
    await onSend(poll)
    setBusy(false)
    onClose?.()
  }

  return createPortal(
    <div className="fixed inset-0 z-[600] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-3"
        style={{ maxHeight: "85dvh", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="text-purple-300" />
            <h3 className="text-cream font-extrabold text-[16px]">New poll</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center text-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 120))}
          placeholder="Ask a question…"
          autoFocus
          className="h-11 rounded-xl bg-white/[0.05] border border-white/8 px-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
        />

        <div className="flex flex-col gap-1.5">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={o}
                onChange={(e) => setOpt(i, e.target.value)}
                placeholder={"Option " + (i + 1)}
                className="flex-1 h-10 rounded-xl bg-white/[0.05] border border-white/8 px-3 text-cream text-[13.5px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
              />
              {options.length > 2 && (
                <button onClick={() => removeOpt(i)} className="w-9 h-9 rounded-full grid place-items-center bg-white/[0.05] border border-white/10 text-red-300" aria-label="Remove option">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {options.length < 4 && (
          <button
            onClick={addOpt}
            className="h-9 px-3 rounded-full bg-white/[0.05] border border-white/10 text-cream text-[12.5px] font-bold inline-flex items-center gap-1.5 self-start"
          >
            <Plus size={13} /> Add option
          </button>
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} className="w-4 h-4 accent-purple-500" />
          <span className="text-cream text-[13px] font-semibold">Allow multiple choices</span>
        </label>

        <button
          onClick={send}
          disabled={!ready}
          className="h-12 rounded-full text-white font-bold text-[14.5px] disabled:opacity-40 mt-1"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
        >
          {busy ? "Sending…" : "Send poll"}
        </button>
      </div>
    </div>,
    document.body
  )
}
