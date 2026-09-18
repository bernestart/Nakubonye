import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Check, Hammer, Sparkles, Send } from "lucide-react"
import BrandGlow from "../components/BrandGlow"

const LIVE = [
  { name: "Discover", desc: "Swipe to meet people" },
  { name: "Chat & DMs", desc: "Text, photos, voice notes" },
  { name: "Stories", desc: "24h photos & video" },
  { name: "Community feed", desc: "Share in groups" },
  { name: "Community chat", desc: "Talk with members" },
  { name: "Coins & Premium", desc: "Boosts, pins, super likes" },
  { name: "Online & last seen", desc: "See who's active" },
  { name: "Read receipts", desc: "Know when they saw it" },
  { name: "Verification", desc: "Verified badges" },
]

const BUILDING = [
  { name: "Story filters", desc: "More looks for your photos" },
  { name: "Voice & video calls", desc: "Talk face to face" },
  { name: "Reels", desc: "Short videos feed" },
  { name: "Profile themes", desc: "Customize your profile" },
]

const PLANNED = [
  { name: "Music in stories", desc: "Add a song to your status" },
  { name: "Community events", desc: "Meetups and gatherings" },
  { name: "AI match suggestions", desc: "Better matches over time" },
  { name: "Native mobile app", desc: "Faster, offline, push notifications" },
]

export default function Roadmap() {
  const nav = useNavigate()
  const [voted, setVoted] = useState(() => {
    try { return JSON.parse(localStorage.getItem("roadmap_votes") || "[]") } catch { return [] }
  })

  function vote(name) {
    if (voted.includes(name)) return
    const next = [...voted, name]
    setVoted(next)
    try { localStorage.setItem("roadmap_votes", JSON.stringify(next)) } catch {}
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      margin: "0 auto", maxWidth: 480,
      display: "flex", flexDirection: "column",
      background: "#0B0B14", overflow: "hidden",
    }}>
      <BrandGlow />
      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2 border-b border-white/8">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[16px]">What we're building</span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-10">
        <p className="text-muted text-[13.5px] leading-relaxed mb-6">
          Nakubonye grows with you. Here's what's live, what's in progress, and what's coming. Tap a feature to vote — it helps us know what to build next.
        </p>

        <Section icon={<Check size={14} strokeWidth={3} />} color="#22C55E" title="Live now" subtitle={`${LIVE.length} features`}>
          {LIVE.map((f) => (
            <Row key={f.name} name={f.name} desc={f.desc} badge="LIVE" badgeColor="#22C55E" />
          ))}
        </Section>

        <Section icon={<Hammer size={14} strokeWidth={2.6} />} color="#F59E0B" title="Being built" subtitle="Tap to vote">
          {BUILDING.map((f) => (
            <Row
              key={f.name}
              name={f.name}
              desc={f.desc}
              badge={voted.includes(f.name) ? "VOTED" : "VOTE"}
              badgeColor={voted.includes(f.name) ? "#22C55E" : "#F59E0B"}
              onClick={() => vote(f.name)}
              clickable
            />
          ))}
        </Section>

        <Section icon={<Sparkles size={14} strokeWidth={2.6} />} color="#A855F7" title="Planned" subtitle="Tap to vote">
          {PLANNED.map((f) => (
            <Row
              key={f.name}
              name={f.name}
              desc={f.desc}
              badge={voted.includes(f.name) ? "VOTED" : "VOTE"}
              badgeColor={voted.includes(f.name) ? "#22C55E" : "#A855F7"}
              onClick={() => vote(f.name)}
              clickable
            />
          ))}
        </Section>

        <div className="mt-6 p-4 rounded-2xl bg-white/[0.03] border border-white/8">
          <p className="text-cream font-bold text-[13.5px] mb-1">Have an idea?</p>
          <p className="text-muted text-[12.5px] mb-3">
            Message us on WhatsApp — we read every suggestion.
          </p>
          <a
            href="https://wa.me/25765394084"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-white font-bold text-[13px]"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            <Send size={14} /> Send feedback
          </a>
        </div>

        <p className="text-center text-subtle text-[11px] mt-10 leading-relaxed">
          © Nakubonye 2026 · Bujumbura, Burundi
        </p>
      </div>
    </div>
  )
}

function Section({ icon, color, title, subtitle, children }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full grid place-items-center" style={{ background: color + "22", color }}>
          {icon}
        </span>
        <div>
          <p className="text-cream font-bold text-[14.5px]">{title}</p>
          <p className="text-subtle text-[11.5px]">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function Row({ name, desc, badge, badgeColor, onClick, clickable }) {
  const Wrapper = clickable ? "button" : "div"
  return (
    <Wrapper
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/8 text-left w-full ${clickable ? "active:scale-[0.98] transition-transform" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-cream font-semibold text-[13.5px]">{name}</p>
        <p className="text-muted text-[12px] truncate">{desc}</p>
      </div>
      <span
        className="shrink-0 text-[10px] font-black tracking-wider px-2 py-1 rounded-full"
        style={{ background: badgeColor + "22", color: badgeColor }}
      >
        {badge}
      </span>
    </Wrapper>
  )
}
