import { useState } from 'react'
import CreatorStepLayout from '../components/creator/CreatorStepLayout'
import {
  X, Globe, Users, Sliders, Check, Sparkles, TrendingUp, Eye, Zap,
  GraduationCap, Banknote, Heart, Star, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { tap } from '../lib/haptic'

const TOTAL_STEPS = 6

const STEPS_DATA = [
  { title: 'Welcome', img: '/illustrations/creator/welcome.svg' },
  { title: 'Audience', img: '/illustrations/creator/audience.svg' },
  { title: 'Default audience', img: '/illustrations/creator/privacy.svg' },
  { title: 'Monetization', img: '/illustrations/creator/money.svg' },
  { title: 'Professional tools', img: '/illustrations/creator/tools.svg' },
  { title: 'Finish', img: '/illustrations/creator/finish.svg' },
]

export default function CreatorOnboarding({ onClose, onFinish }) {
  const { session, refreshProfile } = useAuth()
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
          account_type: 'creator',
          creator_default_audience: audience,
          creator_onboarded_at: new Date().toISOString(),
        })
        .eq('id', myId)
      if (error) throw error
      await refreshProfile()
      onFinish?.()
    } catch (e) {
      console.warn('finish onboarding failed', e)
      alert('Could not save: ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <CreatorStepLayout
      step={step}
      totalSteps={TOTAL_STEPS}
      title={STEPS_DATA[step]?.title || 'Creator Mode'}
      onBack={step === 0 ? onClose : back}
      onClose={onClose}
      onNext={step === TOTAL_STEPS - 1 ? finish : next}
      isLast={step === TOTAL_STEPS - 1}
      nextText="Next"
    >
      <div className="flex justify-center mb-6">
        <img
          src={STEPS_DATA[step]?.img}
          alt=""
          className="w-full max-w-[260px] h-auto object-contain drop-shadow-xl"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      </div>

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
      {step === 5 && <StepFrame shareUpdate={shareUpdate} setShareUpdate={setShareUpdate} />}

      {reviewOpen && (
        <ReviewSheet
          audience={audience}
          onClose={() => setReviewOpen(false)}
          onConfirm={() => { setReviewOpen(false); next() }}
        />
      )}
    </CreatorStepLayout>
  )
}

/* ---------- illustrations (previously undefined → crash) ---------- */
function IllustrationFrame({ children, from = '#4C1D95', to = '#7C3AED' }) {
  return (
    <div
      className="w-full max-w-[240px] h-[140px] mx-auto mb-6 rounded-3xl grid place-items-center relative overflow-hidden border border-white/10"
      style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
    >
      <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 30% 20%, #fff 0%, transparent 55%)' }} />
      <div className="relative">{children}</div>
    </div>
  )
}
function MegaIllustration() {
  return <IllustrationFrame from="#1E3A8A" to="#7C3AED"><Users size={54} className="text-white/90" /></IllustrationFrame>
}
function CoinsIllustration() {
  return <IllustrationFrame from="#B45309" to="#EC4899"><Banknote size={54} className="text-white/90" /></IllustrationFrame>
}
function ChartIllustration() {
  return <IllustrationFrame from="#047857" to="#3B82F6"><TrendingUp size={54} className="text-white/90" /></IllustrationFrame>
}

/* ---------- steps ---------- */
function StepWelcome() {
  return (
    <div>
      <h2 className="text-cream font-extrabold text-[22px] text-center mb-2">Welcome to creator mode!</h2>
      <Sub>
        You've unlocked more tools on your profile to help you grow your public
        presence and achieve your goals.
      </Sub>
      <SectionTitle>Let's quickly cover the basics:</SectionTitle>
      <Row icon={<Users size={16} />} title="Define your audience" body="Choose who can see the content you share." />
      <Row icon={<Banknote size={16} />} title="Learn about monetization tools" body="See how eligible creators can earn on Nakubonye." />
      <Row icon={<Zap size={16} />} title="Explore creator tools" body="Insights, growth tools and creator education." />
      <Row icon={<Sparkles size={16} />} title="Celebrate!" body="Try out a profile frame when you're done." />
    </div>
  )
}

function StepDefineAudience() {
  return (
    <div>
      <h2 className="text-cream font-extrabold text-[22px] text-center mb-2">Define your audience</h2>
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
      <h2 className="text-cream font-extrabold text-[22px] text-center mb-2">Choose your default audience</h2>
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
      <h2 className="text-cream font-extrabold text-[22px] text-center mb-2">Start earning today</h2>
      <Sub>
        In creator mode, your profile may be eligible to earn money on Nakubonye.
      </Sub>
      <SectionTitle>Not yet eligible</SectionTitle>
      <Row icon={<Star size={16} />} title="Gifts" body="Let your fans support you by sending gifts." />
      <Row icon={<Heart size={16} />} title="Subscriptions" body="Generate income monthly with exclusive content." />
    </div>
  )
}

function StepCreatorTools() {
  return (
    <div>
      <ChartIllustration />
      <h2 className="text-cream font-extrabold text-[22px] text-center mb-2">You've unlocked new creator tools</h2>
      <Sub>
        Explore tools in your creator dashboard to grow your public presence.
      </Sub>
      <SectionTitle>Explore your new tools</SectionTitle>
      <Row icon={<TrendingUp size={16} />} title="Insights" body="Learn more about your audience and see how well your content is performing." />
      <Row icon={<Sparkles size={16} />} title="Creation" body="Manage your posts and find new ideas to inspire you." />
      <Row icon={<Eye size={16} />} title="Growth" body="Respond to comments and access more tools to engage with fans." />
      <Row icon={<GraduationCap size={16} />} title="Creator education and support" body="Access resources and creator support to support your growth in creator mode." />
    </div>
  )
}

function StepFrame({ shareUpdate, setShareUpdate }) {
  return (
    <div>
      <h2 className="text-cream font-extrabold text-[22px] text-center mb-2">Celebrate with a profile frame!</h2>
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
          style={{ paddingBottom: 'max(20px, var(--safe-bottom, 8px))' }}>
          <button
            onClick={onConfirm}
            className="w-full h-12 rounded-full text-white font-bold text-[14.5px] mb-2"
            style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)' }}
          >
            Confirm
          </button>
          <button onClick={onClose} className="w-full h-11 text-muted font-semibold text-[13.5px]">
            Edit settings
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- shared UI ---------- */
function Sub({ children }) {
  return <p className="text-muted text-[13.5px] leading-relaxed text-center mb-6">{children}</p>
}
function SectionTitle({ children }) {
  return <h3 className="text-cream font-bold text-[15px] mb-4">{children}</h3>
}
function Row({ icon, title, body }) {
  return (
    <div className="flex items-start gap-3 mb-4 text-cream">
      <span className="text-purple-400 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold leading-snug">{title}</p>
        {body && <p className="text-muted text-[12.5px] leading-relaxed mt-0.5">{body}</p>}
      </div>
    </div>
  )
}
