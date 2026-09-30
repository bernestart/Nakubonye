import { useEffect, useState } from "react"
import { X, Copy, Share2, Link2, Check } from "lucide-react"
import { supabase } from "../lib/supabase"
import { tap } from "../lib/haptic"

export default function InviteLinkSheet({ group, onClose }) {
  const [copied, setCopied] = useState(false)
  const [enabled, setEnabled] = useState(group?.invite_enabled !== false)
  const [busy, setBusy] = useState(false)

  const code = group?.invite_code || ""
  const url = code ? window.location.origin + "/join/" + code : ""

  async function copy() {
    tap("light")
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  async function share() {
    tap("light")
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join " + (group?.name || "group"),
          text: "Join my group on Nakubonye: " + (group?.name || ""),
          url,
        })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    } catch {}
  }

  async function toggleEnabled() {
    if (!group?.id || busy) return
    setBusy(true); tap("light")
    const next = !enabled
    const { error } = await supabase
      .from("groups")
      .update({ invite_enabled: next })
      .eq("id", group.id)
    setBusy(false)
    if (error) { alert(error.message); return }
    setEnabled(next)
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-3"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-1" />
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-cream font-extrabold text-[16px]">Invite via link</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center text-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] border border-white/10 px-3.5 h-12">
          <Link2 size={16} className="text-purple-300 shrink-0" />
          <span className="flex-1 text-cream text-[13px] font-mono truncate">
            {code ? "/join/" + code : "Generating…"}
          </span>
          <button onClick={copy} className="w-8 h-8 rounded-lg grid place-items-center text-purple-300" aria-label="Copy">
            {copied ? <Check size={16} strokeWidth={3} /> : <Copy size={16} />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={copy}
            className="h-11 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[13.5px] inline-flex items-center justify-center gap-2"
          >
            <Copy size={15} /> {copied ? "Copied" : "Copy link"}
          </button>
          <button
            onClick={share}
            className="h-11 rounded-full text-white font-bold text-[13.5px] inline-flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            <Share2 size={15} /> Share
          </button>
        </div>

        <button
          onClick={toggleEnabled}
          disabled={busy}
          className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
        >
          <div>
            <p className="text-cream font-semibold text-[13.5px]">Allow anyone with the link to join</p>
            <p className="text-muted text-[11.5px] mt-0.5">Turn off to disable this link</p>
          </div>
          <span
            className="w-11 h-6 rounded-full relative shrink-0 transition-colors"
            style={{ background: enabled ? "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" : "rgba(255,255,255,0.12)" }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
              style={{ left: enabled ? "calc(100% - 22px)" : 2 }}
            />
          </span>
        </button>

        <p className="text-subtle text-[11.5px] leading-relaxed text-center">
          Anyone with this link can join the group. You can disable it anytime.
        </p>
      </div>
    </div>
  )
}
