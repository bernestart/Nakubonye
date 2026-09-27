import { useState } from "react"
import { Send, X, ChevronDown, ChevronUp } from "lucide-react"

export default function ReelPublishSheet({
  preview,
  caption, setCaption,
  coverTime, setCoverTime, duration,
  audienceState, setAudienceState,
  allowComments, setAllowComments,
  allowRemix, setAllowRemix,
  locationState, setLocationState,
  taggedUsers,
  onOpenTagPicker,
  error, busy, progress,
  onSubmit, onClose,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <div className="fixed inset-0 z-[300] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 flex flex-col"
        style={{ maxHeight: "85dvh", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <header className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/8">
          <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center text-muted">
            <X size={20} />
          </button>
          <h2 className="text-cream font-bold text-[15px]">New reel</h2>
          <button
            onClick={onSubmit}
            disabled={busy}
            className="h-9 px-4 rounded-full text-white font-bold text-[13px] inline-flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            <Send size={13} /> {busy ? "Posting…" : "Share"}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 pt-3">
          <div className="flex gap-3 mb-3">
            <div className="relative shrink-0 rounded-xl overflow-hidden bg-black" style={{ width: 64, height: 64 }}>
              <video src={preview} muted playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] text-center py-0.5 font-bold">Cover</div>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 500))}
              placeholder="Write a caption…"
              rows={3}
              className="flex-1 rounded-xl bg-white/[0.06] border border-white/10 px-3 py-2.5 text-white text-[14px] placeholder:text-white/45 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          <button
            onClick={() => setAdvancedOpen((v) => !v)}
            className="w-full h-10 rounded-xl bg-white/[0.04] border border-white/8 text-cream text-[13px] font-semibold flex items-center justify-center gap-1.5 mb-3"
          >
            {advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {advancedOpen ? "Hide options" : "More options"}
          </button>

          {advancedOpen && (
            <>
              <div className="mb-4">
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">Cover frame</p>
                <input type="range" min={0} max={Math.max(0, Math.floor(duration || 0))} step={0.1}
                  value={coverTime} onChange={(e) => setCoverTime(parseFloat(e.target.value))} className="w-full" />
                <p className="text-white/50 text-[11.5px] mt-1">Thumbnail at {coverTime.toFixed(1)}s</p>
              </div>

              <div className="mb-4">
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">Audience</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "public", label: "Public", icon: "🌍" },
                    { id: "matches", label: "Matches", icon: "💜" },
                    { id: "private", label: "Only me", icon: "🔒" },
                  ].map((a) => (
                    <button key={a.id} onClick={() => setAudienceState(a.id)}
                      className="h-12 rounded-xl font-bold text-[13px] flex flex-col items-center justify-center gap-0.5"
                      style={{
                        background: audienceState === a.id
                          ? "linear-gradient(135deg, rgba(236,72,153,0.22) 0%, rgba(168,85,247,0.22) 100%)"
                          : "rgba(255,255,255,0.04)",
                        border: audienceState === a.id ? "1px solid rgba(236,72,153,0.6)" : "1px solid rgba(255,255,255,0.08)",
                        color: audienceState === a.id ? "#fff" : "#888",
                      }}>
                      <span className="text-base leading-none">{a.icon}</span>
                      <span>{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 mb-4">
                <ToggleRow label="Allow comments" sub="People can comment on this reel" on={allowComments} onToggle={() => setAllowComments((v) => !v)} />
                <ToggleRow label="Allow remix" sub="Others can use this reel in theirs" on={allowRemix} onToggle={() => setAllowRemix((v) => !v)} />
              </div>

              <div className="mb-4">
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">Location</p>
                <input value={locationState} onChange={(e) => setLocationState(e.target.value.slice(0, 80))}
                  placeholder="Add a location (optional)"
                  className="w-full h-11 rounded-xl bg-white/[0.06] border border-white/10 px-4 text-white text-[13.5px] placeholder:text-white/45 focus:outline-none focus:border-purple-500" />
              </div>

              <div className="mb-4">
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">Tag people</p>
                <button onClick={onOpenTagPicker}
                  className="w-full min-h-11 rounded-xl bg-white/[0.06] border border-white/10 px-4 py-2.5 flex flex-wrap items-center gap-1.5 text-left">
                  {taggedUsers.length === 0 ? (
                    <span className="text-white/45 text-[13.5px]">Tag people (optional)</span>
                  ) : (
                    taggedUsers.map((u) => (
                      <span key={u.id} className="text-purple-200 text-[12.5px] font-semibold">
                        @{u.username || u.display_name}
                      </span>
                    ))
                  )}
                </button>
              </div>
            </>
          )}

          {error && <p className="text-red-400 text-[12.5px] text-center mb-3">{error}</p>}

          {busy && progress > 0 && (
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-3">
              <div className="h-full bg-purple-500" style={{ width: progress + "%" }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ label, sub, on, onToggle }) {
  return (
    <button onClick={onToggle}
      className="w-full rounded-xl bg-white/[0.04] border border-white/8 p-3 flex items-center justify-between text-left">
      <div>
        <p className="text-cream font-semibold text-[13.5px]">{label}</p>
        <p className="text-muted text-[11.5px] mt-0.5">{sub}</p>
      </div>
      <div className="w-11 h-6 rounded-full relative shrink-0"
        style={{ background: on ? "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" : "rgba(255,255,255,0.12)" }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
          style={{ left: on ? "calc(100% - 22px)" : "2px" }} />
      </div>
    </button>
  )
}
