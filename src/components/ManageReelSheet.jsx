import { useState } from "react"
import { X, Pencil, Users, MessageSquare, Trash2, Eye, MapPin } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"

const AUDIENCE_OPTS = [
  { id: "public",  label: "Public",  icon: "🌍" },
  { id: "matches", label: "Matches", icon: "💜" },
  { id: "private", label: "Only me", icon: "🔒" },
]

export default function ManageReelSheet({ reel, onClose, onUpdated, onDeleted }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [screen, setScreen] = useState("menu") // menu | caption | audience
  const [caption, setCaption] = useState(reel.caption || "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function saveCaption() {
    setBusy(true); setError("")
    const { error: err } = await supabase.rpc("update_my_reel", {
      p_reel_id: reel.id,
      p_caption: caption.trim() || null,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    onUpdated?.({ ...reel, caption: caption.trim() || null })
    onClose?.()
  }

  async function setAudience(aud) {
    setBusy(true); setError("")
    const { error: err } = await supabase.rpc("update_my_reel", {
      p_reel_id: reel.id,
      p_audience: aud,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    onUpdated?.({ ...reel, audience: aud })
    onClose?.()
  }

  async function toggleComments() {
    setBusy(true); setError("")
    const next = !(reel.allow_comments !== false)
    const { error: err } = await supabase.rpc("update_my_reel", {
      p_reel_id: reel.id,
      p_allow_comments: next,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    onUpdated?.({ ...reel, allow_comments: next })
    onClose?.()
  }

  async function deleteReel() {
    if (!confirm("Delete this reel permanently? This cannot be undone.")) return
    setBusy(true); setError("")
    const { error: err } = await supabase.rpc("delete_my_reel", { p_reel_id: reel.id })
    setBusy(false)
    if (err) { setError(err.message); return }
    onDeleted?.(reel.id)
    onClose?.()
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
            <h3 className="text-cream font-extrabold text-[17px] mb-4">Manage reel</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setScreen("caption")}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                  <Pencil size={17} className="text-purple-300" />
                </div>
                <div className="flex-1">
                  <p className="text-cream font-semibold text-[14.5px]">Edit caption</p>
                  <p className="text-muted text-[12px] truncate">
                    {reel.caption ? reel.caption.slice(0, 40) + (reel.caption.length > 40 ? "…" : "") : "No caption"}
                  </p>
                </div>
              </button>

              <button
                onClick={() => setScreen("audience")}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                  <Users size={17} className="text-purple-300" />
                </div>
                <div className="flex-1">
                  <p className="text-cream font-semibold text-[14.5px]">Audience</p>
                  <p className="text-muted text-[12px] capitalize">{reel.audience || "public"}</p>
                </div>
              </button>

              <button
                onClick={toggleComments}
                disabled={busy}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                  <MessageSquare size={17} className="text-purple-300" />
                </div>
                <div className="flex-1">
                  <p className="text-cream font-semibold text-[14.5px]">
                    {reel.allow_comments !== false ? "Turn off comments" : "Turn on comments"}
                  </p>
                  <p className="text-muted text-[12px]">
                    Currently {reel.allow_comments !== false ? "allowed" : "disabled"}
                  </p>
                </div>
              </button>

              <button
                onClick={deleteReel}
                disabled={busy}
                className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/8 border border-red-500/25 text-left disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 grid place-items-center">
                  <Trash2 size={17} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-cream font-semibold text-[14.5px]">Delete reel</p>
                  <p className="text-muted text-[12px]">Remove it permanently</p>
                </div>
              </button>

              <button
                onClick={onClose}
                className="w-full h-11 mt-2 text-muted font-semibold text-[13.5px]"
              >
                Cancel
              </button>
            </div>

            {error && <p className="text-red-400 text-[12.5px] mt-3 text-center">{error}</p>}
          </>
        )}

        {screen === "caption" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-cream font-extrabold text-[17px]">Edit caption</h3>
              <button onClick={() => setScreen("menu")} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
                <X size={18} />
              </button>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 500))}
              placeholder="Write a caption…"
              rows={4}
              autoFocus
              className="w-full bg-elevated border border-white/8 rounded-2xl px-4 py-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none mb-3"
            />
            {error && <p className="text-red-400 text-[12.5px] mb-3">{error}</p>}
            <button
              onClick={saveCaption}
              disabled={busy}
              className="w-full h-12 rounded-full text-white font-bold text-[14.5px] disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              {busy ? "Saving…" : "Save caption"}
            </button>
          </>
        )}

        {screen === "audience" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-cream font-extrabold text-[17px]">Audience</h3>
              <button onClick={() => setScreen("menu")} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {AUDIENCE_OPTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAudience(a.id)}
                  disabled={busy}
                  className="h-16 rounded-xl font-bold text-[13px] flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                  style={{
                    background: (reel.audience || "public") === a.id
                      ? "linear-gradient(135deg, rgba(236,72,153,0.22) 0%, rgba(168,85,247,0.22) 100%)"
                      : "rgba(255,255,255,0.04)",
                    border: (reel.audience || "public") === a.id
                      ? "1px solid rgba(236,72,153,0.6)"
                      : "1px solid rgba(255,255,255,0.08)",
                    color: (reel.audience || "public") === a.id ? "#fff" : "#888",
                  }}
                >
                  <span className="text-lg leading-none">{a.icon}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
            {error && <p className="text-red-400 text-[12.5px] mt-3 text-center">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
