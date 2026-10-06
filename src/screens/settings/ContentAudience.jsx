import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Globe, Image, PlayCircle, Download, Shuffle, Video, Users, Lock, ChevronRight } from "lucide-react"
import { tap } from "../../lib/haptic"
import { useSettings } from "../../lib/settings.jsx"
import BrandGlow from "../../components/BrandGlow"

const REELS_VIS_LEVELS = [
  { id: "everyone",  label: "Everyone",       sub: "Anyone on Nakubonye can see your reels",  icon: Globe },
  { id: "matches",   label: "Matches",        sub: "Only people you've matched with",         icon: Users },
  { id: "following", label: "People I follow", sub: "Only accounts you follow",                icon: Users },
  { id: "nobody",    label: "Nobody",         sub: "No one can see your reels",               icon: Lock },
]

const POST_AUDIENCE_LEVELS = [
  { id: "public",  label: "Everyone",   sub: "Anyone on Nakubonye can see this", icon: Globe },
  { id: "matches", label: "Matches",    sub: "Only people you've matched with",  icon: Users },
  { id: "private", label: "Only me",    sub: "Just for you",                     icon: Lock },
]

export default function ContentAudience() {
  const nav = useNavigate()
  const { settings, update, loading } = useSettings()
  const [sheet, setSheet] = useState(null)
  const [sheetKind, setSheetKind] = useState("post")

  const current = POST_AUDIENCE_LEVELS.find((o) => o.id === (settings.default_post_audience || "public")) || POST_AUDIENCE_LEVELS[0]
  const currentReelsVis = REELS_VIS_LEVELS.find((o) => o.id === (settings.who_can_see_reels || "everyone")) || REELS_VIS_LEVELS[0]

  function openPostAudienceSheet() {
    tap("light")
    setSheetKind("post")
    setSheet({
      title: "Default audience for new posts",
      options: POST_AUDIENCE_LEVELS,
      current: settings.default_post_audience || "public",
      key: "default_post_audience",
    })
  }

  function openReelsVisSheet() {
    tap("light")
    setSheetKind("reels")
    setSheet({
      title: "Who can see your reels",
      options: REELS_VIS_LEVELS,
      current: settings.who_can_see_reels || "everyone",
      key: "who_can_see_reels",
    })
  }

  function select(id) {
    tap("light")
    if (!sheet?.key) return
    update({ [sheet.key]: id })
    setSheet(null)
  }

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, display: "flex", flexDirection: "column", background: "#0B0B14", overflow: "hidden" }}>
      <BrandGlow />
      <header className="shrink-0 flex items-center gap-2 px-3 h-14 border-b border-white/6" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-extrabold text-[16px]">Content & audience</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <p className="text-muted text-[12.5px] px-4 py-3 leading-relaxed">
          Defaults for what you post, and how others can reuse it.
        </p>

        {loading ? null : (
          <div className="flex flex-col">
            <button
              onClick={openPostAudienceSheet}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03]"
            >
              <Globe size={18} className="text-cream shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-cream text-[15px] font-medium">Default audience for new posts</p>
                <p className="text-muted text-[12px] mt-0.5 truncate">{current.label}</p>
              </div>
              <ChevronRight size={18} className="text-muted shrink-0" />
            </button>

            {/* Story visibility lives in Privacy screen — link to it */}
            <button
              onClick={() => { tap("light"); nav("/settings/privacy") }}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03]"
            >
              <Image size={18} className="text-cream shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-cream text-[15px] font-medium">Story visibility</p>
                <p className="text-muted text-[12px] mt-0.5 truncate">Also in Privacy settings</p>
              </div>
              <ChevronRight size={18} className="text-muted shrink-0" />
            </button>

            <button
              onClick={openReelsVisSheet}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03]"
            >
              <PlayCircle size={18} className="text-cream shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-cream text-[15px] font-medium">Reels visibility</p>
                <p className="text-muted text-[12px] mt-0.5 truncate">{currentReelsVis.label}</p>
              </div>
              <ChevronRight size={18} className="text-muted shrink-0" />
            </button>

            {/* Allow downloads — deferred until a download button exists in ReelViewer */}

            <ToggleRowCU
              icon={<Shuffle size={18} />}
              label="Allow remix / duet"
              sub="Others can create a remix using your reel"
              value={settings.allow_reel_remix !== false}
              onChange={(v) => update({ allow_reel_remix: v })}
            />

            <SoonRow icon={<Video size={18} />} label="Live video visibility" />
          </div>
        )}
      </div>

      {sheet && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setSheet(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <h3 className="text-cream font-extrabold text-[16px] mb-2">{sheet.title}</h3>
            {sheet.options.map((o) => {
              const Icon = o.icon
              const active = o.id === sheet.current
              return (
                <button
                  key={o.id}
                  onClick={() => select(o.id)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03] last:border-b-0"
                >
                  <Icon size={18} className="text-cream shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-cream text-[14.5px] font-medium">{o.label}</p>
                    <p className="text-muted text-[12px] mt-0.5">{o.sub}</p>
                  </div>
                  {active && <span className="text-purple-400 text-[16px]">✓</span>}
                </button>
              )
            })}
            <button
              onClick={() => setSheet(null)}
              className="w-full h-11 mt-2 text-muted font-semibold text-[13.5px]"
            >Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleRowCU({ icon, label, sub, value, onChange }) {
  return (
    <button
      onClick={() => { tap("light"); onChange(!value) }}
      className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03]"
    >
      <span className="shrink-0 text-cream">{icon}</span>
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-cream text-[15px] font-medium">{label}</p>
        {sub && <p className="text-muted text-[12px] mt-0.5 truncate">{sub}</p>}
      </div>
      <span
        className="w-11 h-6 rounded-full relative shrink-0 transition-colors"
        style={{ background: value ? "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" : "rgba(255,255,255,0.12)" }}
      >
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: value ? "calc(100% - 22px)" : 2 }} />
      </span>
    </button>
  )
}

function SoonRow({ icon, label }) {
  return (
    <div className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 opacity-40">
      <span className="shrink-0 text-cream">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-cream text-[15px] font-medium">{label}</p>
      </div>
      <span className="text-subtle text-[11px] shrink-0">Soon</span>
    </div>
  )
}
