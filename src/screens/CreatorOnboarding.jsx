import { useState } from 'react'
import { X, Globe, Users, Sliders, Check, Sparkles, TrendingUp, Eye, Zap, GraduationCap, Banknote, Heart, Star, ChevronRight } from 'lucide-react'
import BrandGlow from '../components/BrandGlow'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { tap } from '../lib/haptic'

const TOTAL_STEPS = 6

export default function CreatorOnboarding({ onClose, onFinish }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [step, setStep] = useState(0)
  const [audience, setAudience] = useState('public')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [shareUpdate, setShareUpdate] = useState(true)
  const [busy, setBusy] = useState(false)

  function next() { tap('light'); setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1)) }
  function back() { tap('light'); setStep((s) => Math.max(0, s - 1)) }

  async function finish() {
    if (busy || !myId) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          creator_default_audience: audience,
          creator_onboarded_at: new Date().toISOString(),
        })
        .eq('id', myId)
      if (error) throw error
      onFinish?.()
    } catch (e) {
      console.warn('finish onboarding failed', e)
      alert('Could not save: ' + (e.message || e))
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[400] bg-transparent flex flex-col">
      <BrandGlow />
      <div className="flex items-center justify-between px-3 h-14 shrink-0">
        <button
          onClick={() => { tap('light'); onClose() }}
          className="w-9 h-9 rounded-full grid place-items-center text-cream"
          aria-label="Close"
        >
          <X size={22} />
        </button>
        <span className="text-muted text-[12.5px] font-semibold">
          {step + 1} of {TOTAL_STEPS}
        </span>
        <span className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingLeft: '20px', paddingRight: '20px', paddingBottom: '140px', overflowX: 'hidden' }}>
        {step === 0 && <StepWelcome />}
        {step === 1 && <StepDefineAudience />}
        {step === 2 && (
          <StepPickAudience
            audience={audience}
            setAudience={setAudience}
            onReview={() => setReviewOpen(true)}
          />
        )}
        {step === 3 && <StepMonetization />}
        {step === 4 && <StepCreatorTools />}
        {step === 5 && (
          <StepFrame shareUpdate={shareUpdate} setShareUpdate={setShareUpdate} />
        )}
      </div>

      <div className="px-5 pb-5 shrink-0"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div className="flex justify-center gap-1.5 mb-4">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${i === step ? 'w-6 bg-purple-500' : 'w-4 bg-white/15'}`}
            />
          ))}
        </div>
        {step === TOTAL_STEPS - 1 ? (
          <button
            onClick={finish}
            disabled={busy}
            className="w-full h-12 rounded-full text-white font-bold text-[14.5px] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)' }}
          >
            {busy ? 'Finishing…' : 'Finish'}
          </button>
        ) : (
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={back}
                className="h-12 px-5 rounded-full bg-white/[0.06] border border-white/12 text-cream font-semibold text-[14px]"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="flex-1 h-12 rounded-full text-white font-bold text-[14.5px]"
              style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)' }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {reviewOpen && (
        <ReviewSheet
          audience={audience}
          onClose={() => setReviewOpen(false)}
          onConfirm={() => { setReviewOpen(false); next() }}
        />
      )}
    </div>
  )
}

// ---------- Illustrations ----------
function PhotoIllustration({ src }) {
  return (
    <div
      className="relative overflow-hidden mb-6"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)' }}
    >
      <img src={src} alt="" className="w-full h-auto block" />
      <div
        className="absolute inset-x-0 bottom-0 h-20"
        style={{ background: 'linear-gradient(180deg, rgba(11,11,20,0) 0%, rgba(11,11,20,0.55) 100%)' }}
      />
    </div>
  )
}

// Rich SVG scene: megaphone + speech bubbles + sparkles
function MegaIllustration() {
  return (
    <div
      className="relative overflow-hidden mb-6 flex items-center justify-center"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)', height: '256px', background: 'linear-gradient(135deg, #2A1055 0%, #4C1D95 50%, #7C3AED 100%)' }}
    >
      <svg viewBox="0 0 300 200" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Radiating arcs from megaphone */}
        <g stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M 170 100 Q 190 80 200 70" />
          <path d="M 175 105 Q 205 100 215 100" />
          <path d="M 170 110 Q 190 130 200 140" />
        </g>
        {/* Speech bubbles */}
        <g fill="rgba(255,255,255,0.9)">
          <rect x="200" y="55" width="50" height="30" rx="8" />
          <polygon points="210,85 215,92 220,85" />
          <rect x="205" y="60" width="40" height="3" rx="1.5" fill="#7C3AED" />
          <rect x="205" y="68" width="30" height="3" rx="1.5" fill="#A78BFA" />
          <rect x="205" y="76" width="35" height="3" rx="1.5" fill="#A78BFA" />
        </g>
        <g fill="rgba(196,181,253,0.85)">
          <rect x="90" y="120" width="40" height="24" rx="7" />
          <polygon points="98,144 102,150 106,144" />
        </g>
        {/* Megaphone */}
        <g transform="translate(90 90) rotate(-15)">
          <path d="M 0 10 L 45 0 L 45 50 L 0 40 Z" fill="#A78BFA" />
          <rect x="-8" y="18" width="10" height="14" rx="2" fill="#7C3AED" />
          <circle cx="45" cy="25" r="4" fill="#7C3AED" />
        </g>
        {/* Stars */}
        <g fill="#F4F1FF" opacity="0.85">
          <circle cx="60" cy="50" r="2" />
          <circle cx="80" cy="70" r="1.5" />
          <circle cx="240" cy="140" r="2.5" />
          <circle cx="255" cy="165" r="1.5" />
          <circle cx="70" cy="160" r="2" />
        </g>
      </svg>
    </div>
  )
}

// Rich SVG scene: floating coins + shine + sparkles
function CoinsIllustration() {
  return (
    <div
      className="relative overflow-hidden mb-6 flex items-center justify-center"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)', height: '256px', background: 'linear-gradient(135deg, #2A1055 0%, #4C1D95 55%, #7C3AED 100%)' }}
    >
      <svg viewBox="0 0 300 200" className="w-full h-full">
        {/* Gold coins — 3 stacked, 2 floating */}
        <g>
          <ellipse cx="130" cy="140" rx="45" ry="14" fill="#B45309" />
          <ellipse cx="130" cy="132" rx="45" ry="14" fill="#FBBF24" />
          <ellipse cx="130" cy="132" rx="30" ry="9" fill="#FCD34D" />
          <text x="130" y="137" textAnchor="middle" fontSize="14" fontWeight="900" fill="#B45309">₦</text>

          <ellipse cx="180" cy="155" rx="40" ry="12" fill="#B45309" />
          <ellipse cx="180" cy="148" rx="40" ry="12" fill="#FBBF24" />
          <ellipse cx="180" cy="148" rx="26" ry="8" fill="#FCD34D" />

          <ellipse cx="95" cy="160" rx="38" ry="11" fill="#B45309" />
          <ellipse cx="95" cy="154" rx="38" ry="11" fill="#FBBF24" />
          <ellipse cx="95" cy="154" rx="24" ry="7" fill="#FCD34D" />

          <ellipse cx="210" cy="85" rx="30" ry="9" fill="#B45309" />
          <ellipse cx="210" cy="80" rx="30" ry="9" fill="#FBBF24" />
          <ellipse cx="210" cy="80" rx="18" ry="5" fill="#FCD34D" />
          <text x="210" y="84" textAnchor="middle" fontSize="11" fontWeight="900" fill="#B45309">₦</text>

          <ellipse cx="75" cy="60" rx="22" ry="7" fill="#B45309" />
          <ellipse cx="75" cy="56" rx="22" ry="7" fill="#FBBF24" />
          <ellipse cx="75" cy="56" rx="13" ry="4" fill="#FCD34D" />
        </g>
        {/* Shine sparkles */}
        <g stroke="#FEF3C7" strokeWidth="2" strokeLinecap="round">
          <line x1="240" y1="40" x2="240" y2="55" />
          <line x1="233" y1="47" x2="247" y2="47" />
          <line x1="60" y1="100" x2="60" y2="110" />
          <line x1="55" y1="105" x2="65" y2="105" />
        </g>
        <circle cx="150" cy="40" r="2" fill="#F4F1FF" />
        <circle cx="50" cy="130" r="1.5" fill="#F4F1FF" />
        <circle cx="250" cy="120" r="1.5" fill="#F4F1FF" />
      </svg>
    </div>
  )
}

// Rich SVG scene: rising chart + bars + arrow + sparkles
function ChartIllustration() {
  return (
    <div
      className="relative overflow-hidden mb-6 flex items-center justify-center"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)', height: '256px', background: 'linear-gradient(135deg, #2A1055 0%, #4C1D95 55%, #7C3AED 100%)' }}
    >
      <svg viewBox="0 0 300 200" className="w-full h-full">
        {/* Grid lines */}
        <g stroke="rgba(255,255,255,0.08)" strokeWidth="1">
          <line x1="40" y1="50" x2="270" y2="50" />
          <line x1="40" y1="90" x2="270" y2="90" />
          <line x1="40" y1="130" x2="270" y2="130" />
          <line x1="40" y1="170" x2="270" y2="170" />
        </g>
        {/* Bars */}
        <g>
          <rect x="55" y="140" width="30" height="30" rx="6" fill="#A78BFA" />
          <rect x="100" y="120" width="30" height="50" rx="6" fill="#C4B5FD" />
          <rect x="145" y="90" width="30" height="80" rx="6" fill="#7C3AED" />
          <rect x="190" y="60" width="30" height="110" rx="6" fill="#A78BFA" />
          <rect x="235" y="45" width="30" height="125" rx="6" fill="#C4B5FD" />
        </g>
        {/* Trend arrow */}
        <g stroke="#F4F1FF" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 55 145 L 105 120 L 155 90 L 205 65 L 250 45" />
        </g>
        <polygon points="250,45 235,45 250,58" fill="#F4F1FF" />
        {/* Sparkles */}
        <g fill="#F4F1FF" opacity="0.9">
          <circle cx="70" cy="35" r="2" />
          <circle cx="260" cy="30" r="1.5" />
          <circle cx="30" cy="100" r="1.5" />
          <circle cx="280" cy="150" r="2" />
        </g>
      </svg>
    </div>
  )
}

function Big({ children }) {
  return <h2 className="text-cream font-extrabold text-[22px] leading-tight mb-2 text-center">{children}</h2>
}
function Sub({ children }) {
  return <p className="text-muted text-[13.5px] leading-relaxed mb-6 text-center px-2">{children}</p>
}
function SectionTitle({ children }) {
  return <p className="text-cream font-bold text-[14.5px] mb-3 mt-4">{children}</p>
}
function Row({ icon, title, body, tint = 'text-purple-300' }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className={`w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 grid place-items-center shrink-0 ${tint}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-cream font-semibold text-[13.5px] leading-tight mb-0.5">{title}</p>
        {body && <p className="text-muted text-[12.5px] leading-snug">{body}</p>}
      </div>
    </div>
  )
}

// ---------- Steps ----------
function StepWelcome() {
  return (
    <div>
      <PhotoIllustration src="/illustrations/welcome.jpg" />
      <Big>Welcome to creator mode!</Big>
      <Sub>
        You've unlocked more tools on your profile to help you grow your public
        presence and achieve your goals.
      </Sub>
      <SectionTitle>Let's quickly cover the basics:</SectionTitle>
      <Row icon={<Users size={16} />} title="Define your audience" />
      <Row icon={<Banknote size={16} />} title="Learn about monetization tools" />
      <Row icon={<Zap size={16} />} title="Explore creator tools" />
      <Row icon={<Sparkles size={16} />} title="Celebrate!" />
    </div>
  )
}

function StepDefineAudience() {
  return (
    <div>
      <PhotoIllustration src="/illustrations/audience.jpg" />
      <Big>Define your audience</Big>
      <Sub>
        Decide who can see your future content. The audience for any of your
        previously shared content won't be changed.
      </Sub>
      <SectionTitle>You can let more people see your content</SectionTitle>
      <p className="text-muted text-[13px] leading-relaxed">
        If you want to grow your audience, we suggest setting your audience to
        <span className="text-cream font-semibold"> Public </span>
        to let more people, including your followers, see and engage with your content.
      </p>
    </div>
  )
}

function StepPickAudience({ audience, setAudience, onReview }) {
  const options = [
    { id: 'public', icon: <Globe size={18} />, title: 'Public · Suggested', body: 'Anyone can see what you share and interact with your public content.' },
    { id: 'matches', icon: <Users size={18} />, title: 'Matches only', body: 'Only your matches can see what you share. Public posts will only be commentable by matches.' },
    { id: 'custom', icon: <Sliders size={18} />, title: 'Custom', body: 'Manually choose who can see what you share and interact with your public content.' },
  ]
  return (
    <div>
      <MegaIllustration />
      <Big>Choose your default audience</Big>
      <Sub>
        Choosing a default audience automatically sets the audience for some
        content you share, but you can always change the audience for a specific
        post, story, or reel.
      </Sub>
      <div className="flex flex-col gap-2.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => { tap('light'); setAudience(o.id) }}
            className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-colors ${audience === o.id ? 'bg-purple-500/10 border-purple-500/60' : 'bg-white/[0.03] border-white/10'}`}
          >
            <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${audience === o.id ? 'bg-purple-500/25 text-purple-200' : 'bg-white/[0.05] text-muted'}`}>
              {o.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-cream font-semibold text-[14px] mb-0.5">{o.title}</p>
              <p className="text-muted text-[12.5px] leading-snug">{o.body}</p>
            </div>
            <span className={`mt-1 w-5 h-5 rounded-full border-2 grid place-items-center shrink-0 ${audience === o.id ? 'border-purple-400 bg-purple-500' : 'border-white/25'}`}>
              {audience === o.id && <Check size={12} className="text-white" strokeWidth={3} />}
            </span>
          </button>
        ))}
      </div>
      <button
        onClick={() => { tap('light'); onReview() }}
        className="mt-4 flex items-center gap-1 text-purple-300 font-semibold text-[13px]"
      >
        Review selection
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

function StepMonetization() {
  return (
    <div>
      <CoinsIllustration />
      <Big>Start earning today</Big>
      <Sub>
        In creator mode, your profile may be eligible to earn money on Nakubonye.
      </Sub>
      <SectionTitle>Not yet eligible</SectionTitle>
      <Row icon={<Star size={16} />} title="Gifts"
        body="Let your fans support you by sending gifts." />
      <Row icon={<Heart size={16} />} title="Subscriptions"
        body="Generate income monthly with exclusive content." />
    </div>
  )
}

function StepCreatorTools() {
  return (
    <div>
      <ChartIllustration />
      <Big>You've unlocked new creator tools</Big>
      <Sub>
        Explore tools in your creator dashboard to grow your public presence.
      </Sub>
      <SectionTitle>Explore your new tools</SectionTitle>
      <Row icon={<TrendingUp size={16} />} title="Insights"
        body="Learn more about your audience and see how well your content is performing." />
      <Row icon={<Sparkles size={16} />} title="Creation"
        body="Manage your posts and find new ideas to inspire you." />
      <Row icon={<Eye size={16} />} title="Growth"
        body="Respond to comments and access more tools to engage with fans." />
      <Row icon={<GraduationCap size={16} />} title="Creator education and support"
        body="Access resources and creator support to support your growth in creator mode." />
    </div>
  )
}

function StepFrame({ shareUpdate, setShareUpdate }) {
  return (
    <div>
      <PhotoIllustration src="/illustrations/frame.jpg" />
      <Big>Celebrate with a profile frame!</Big>
      <Sub>
        Try out this new profile frame now that you've turned on creator mode.
      </Sub>
      <button
        onClick={() => { tap('light'); setShareUpdate(!shareUpdate) }}
        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/10 mb-4"
      >
        <span className="text-cream font-semibold text-[13.5px] text-left">
          Add frame and share update to Feed
        </span>
        <span className={`w-6 h-6 rounded-lg border-2 grid place-items-center shrink-0 ${shareUpdate ? 'border-purple-400 bg-purple-500' : 'border-white/25'}`}>
          {shareUpdate && <Check size={14} className="text-white" strokeWidth={3} />}
        </span>
      </button>
      <p className="text-muted text-[12.5px] mb-2">To: 🌐 Public</p>
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4">
        <p className="text-cream/85 text-[13px] leading-relaxed">
          I'm excited to start this new creative journey in creator mode! Check out
          my profile to learn more about me and follow me to stay connected.
          <span className="text-purple-300 font-semibold"> #creatormode</span>
        </p>
      </div>
    </div>
  )
}

function ReviewSheet({ audience, onClose, onConfirm }) {
  const label = audience === 'public' ? 'Public · Suggested'
    : audience === 'matches' ? 'Matches only'
    : 'Custom'
  const items = [
    { t: 'Who can see your posts, stories, and reels?', b: `${label} · Applies to future posts and reels, and current or future stories.` },
    { t: 'Allow others to share your public stories and reels?', b: 'On · Applies to each setting' },
    { t: 'Who can comment on your public posts?', b: label },
    { t: 'Public profile info', b: `${label} · Currently set to Matches` },
    { t: 'Who can see the people you follow?', b: `${label} · Currently set to Only me` },
    { t: 'Search engine indexing outside Nakubonye', b: 'On' },
  ]
  return (
    <div className="fixed inset-0 z-[500] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 flex flex-col"
        style={{ maxHeight: '85dvh' }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8">
          <span className="w-9" />
          <h3 className="text-cream font-extrabold text-[15px]">Review selection</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center text-muted">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-cream font-bold text-[15px] mb-1">Use {label} settings?</p>
          <p className="text-muted text-[12.5px] leading-relaxed mb-4">
            We suggest these settings for creators who want to grow their audience.
          </p>
          <div className="flex flex-col gap-4">
            {items.map((it, i) => (
              <div key={i}>
                <p className="text-cream font-semibold text-[13.5px] mb-1">{it.t}</p>
                <p className="text-muted text-[12.5px] leading-snug">{it.b}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="px-5 pt-3 pb-4 border-t border-white/8"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={onConfirm}
            className="w-full h-12 rounded-full text-white font-bold text-[14.5px] mb-2"
            style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)' }}
          >
            Confirm
          </button>
          <button
            onClick={onClose}
            className="w-full h-11 text-muted font-semibold text-[13.5px]"
          >
            Edit settings
          </button>
        </div>
      </div>
    </div>
  )
}
