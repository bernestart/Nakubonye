import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, Users, BarChart3, Tag, Check } from 'lucide-react'
import BrandGlow from '../components/BrandGlow'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { tap } from '../lib/haptic'
import CreatorOnboarding from './CreatorOnboarding'

export default function CreatorMode() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [accountType, setAccountType] = useState('personal')
  const [busy, setBusy] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showConfirmOff, setShowConfirmOff] = useState(false)

  useEffect(() => {
    if (!myId) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('account_type')
          .eq('id', myId)
          .maybeSingle()
        if (!cancelled) setAccountType(data?.account_type || 'personal')
      } catch (e) { console.warn('load account_type failed', e) }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [myId])

  async function turnOn() {
    if (busy || !myId) return
    setBusy(true); tap('medium')
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_type: 'creator' })
        .eq('id', myId)
      if (error) throw error
      setAccountType('creator')
      setShowOnboarding(true)
    } catch (e) {
      console.warn('enable creator mode failed', e)
      alert('Could not turn on creator mode: ' + (e.message || e))
    } finally { setBusy(false) }
  }

  async function turnOff() {
    if (busy || !myId) return
    setBusy(true); tap('medium')
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_type: 'personal', creator_onboarded_at: null })
        .eq('id', myId)
      if (error) throw error
      setAccountType('personal')
      setShowConfirmOff(false)
    } catch (e) {
      console.warn('disable creator mode failed', e)
      alert('Could not turn off creator mode: ' + (e.message || e))
    } finally { setBusy(false) }
  }

  const isCreator = accountType === 'creator'

  if (showOnboarding) {
    return (
      <CreatorOnboarding
        onClose={() => setShowOnboarding(false)}
        onFinish={() => setShowOnboarding(false)}
      />
    )
  }

  return (
    <div className="min-h-dvh bg-transparent text-cream">
      <BrandGlow />
      <div className="sticky top-0 z-30 bg-transparent backdrop-blur-md border-b border-white/8">
        <div className="max-w-[480px] mx-auto flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => { tap('light'); nav(-1) }}
            className="w-9 h-9 rounded-full grid place-items-center text-cream"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-cream font-extrabold text-[16px]">
            {isCreator ? 'Creator mode' : 'Turn on creator mode'}
          </h1>
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-5 py-5">
        {isCreator ? (
          <ActiveView onTurnOff={() => setShowConfirmOff(true)} />
        ) : (
          <IntroView onTurnOn={turnOn} busy={busy} loading={loading} />
        )}
      </div>

      {showConfirmOff && (
        <ConfirmOff
          busy={busy}
          onCancel={() => setShowConfirmOff(false)}
          onConfirm={turnOff}
        />
      )}
    </div>
  )
}

// ---------- Intro (matches FB's "Turn on pro mode" screen) ----------
function IntroView({ onTurnOn, busy, loading }) {
  return (
    <>
      <div className="relative w-full rounded-3xl overflow-hidden mb-6">
        <img
          src="/illustrations/entry.jpg"
          alt=""
          className="w-full h-auto block"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-20"
          style={{ background: 'linear-gradient(180deg, rgba(11,11,20,0) 0%, rgba(11,11,20,0.5) 100%)' }}
        />
      </div>

      <h2 className="text-cream font-extrabold text-[22px] leading-tight text-center mb-2">
        Turn on creator mode
      </h2>
      <p className="text-muted text-[13.5px] leading-relaxed text-center mb-6 px-2">
        Add new tools to your profile so you can grow as a creator on Nakubonye.
      </p>

      <div className="flex flex-col gap-3 mb-6">
        <Benefit
          icon={<BarChart3 size={18} />}
          title="Get paid for your content"
          body="If you're eligible, unlock monetization tools to earn money by creating new content."
        />
        <Benefit
          icon={<Users size={18} />}
          title="See content insights"
          body="Learn more about your audience and see how well your content is performing."
        />
        <Benefit
          icon={<Sparkles size={18} />}
          title="Grow your audience"
          body="Your follower setting will be set to Public so anyone can see your public content. You can still share privately to matches."
        />
        <Benefit
          icon={<Tag size={18} />}
          title="Get discovered with tagging"
          body="Your tagging setting will be set to Public so anyone can tag you and help others discover your profile. You can change this anytime."
        />
      </div>

      <button
        onClick={onTurnOn}
        disabled={busy || loading}
        className="w-full h-12 rounded-full text-white font-bold text-[14.5px] disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)' }}
      >
        {busy ? 'Turning on…' : 'Turn on'}
      </button>

      <p className="text-subtle text-[11px] text-center mt-4 leading-relaxed">
        Nakubonye will show more information about profiles in creator mode.
        By selecting "Turn on," you agree to our Commercial Terms.
      </p>
    </>
  )
}

function Benefit({ icon, title, body }) {
  return (
    <div className="flex items-start gap-3 py-1">
      <span className="w-9 h-9 rounded-xl bg-purple-500/12 border border-purple-500/30 grid place-items-center shrink-0 text-purple-300">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-cream font-bold text-[14px] mb-0.5">{title}</p>
        <p className="text-muted text-[12.5px] leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

// ---------- Active view (creator mode is on) ----------
function ActiveView({ onTurnOff }) {
  return (
    <>
      <div className="relative w-full rounded-3xl overflow-hidden mb-6">
        <img
          src="/illustrations/finish.jpg"
          alt=""
          className="w-full h-auto block"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-20"
          style={{ background: 'linear-gradient(180deg, rgba(11,11,20,0) 0%, rgba(11,11,20,0.5) 100%)' }}
        />
      </div>

      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-3xl mx-auto mb-4 grid place-items-center -mt-16 relative z-10"
          style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)', border: '3px solid #0B0B14' }}
        >
          <Sparkles size={36} className="text-white" strokeWidth={2.2} />
        </div>
        <h2 className="text-cream font-extrabold text-[20px] mb-2">
          Creator mode is on
        </h2>
        <p className="text-muted text-[13.5px] leading-relaxed px-4">
          Your profile is public-facing. Anyone can follow you and discover your posts.
        </p>
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-purple-300" />
          <p className="text-[12px] font-bold text-purple-300 uppercase tracking-wide">
            Coming soon
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <SameRow text="Creator dashboard — reach, growth, audience" muted />
          <SameRow text="Moderation tools — comment filters, keyword blocks" muted />
          <SameRow text="Monetization eligibility" muted />
        </div>
      </div>

      <button
        onClick={onTurnOff}
        className="w-full h-12 rounded-full bg-white/[0.06] border border-white/12 text-cream font-semibold text-[14px]"
      >
        Turn off creator mode
      </button>
      <p className="text-subtle text-[11.5px] text-center mt-3 leading-relaxed px-4">
        Turning off creator mode switches your profile back to matches-only.
        Followers who are not matches will be removed.
      </p>
    </>
  )
}

function SameRow({ text, muted }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`w-4 h-4 rounded-full grid place-items-center shrink-0 ${muted ? 'bg-purple-500/15 border border-purple-500/30' : 'bg-emerald-500/20 border border-emerald-500/40'}`}>
        <Check size={10} className={muted ? 'text-purple-300' : 'text-emerald-400'} strokeWidth={3} />
      </span>
      <span className={`text-[12.5px] ${muted ? 'text-muted' : 'text-cream/85'}`}>{text}</span>
    </div>
  )
}

// ---------- Confirm off sheet ----------
function ConfirmOff({ busy, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-end" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
        <h3 className="text-cream font-extrabold text-[16px] text-center mb-2">
          Turn off creator mode?
        </h3>
        <p className="text-muted text-[13px] text-center mb-5 leading-relaxed">
          Your profile will switch back to matches-only. Followers who are not
          your matches will be removed. You can turn it back on anytime.
        </p>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="w-full h-12 rounded-full bg-danger text-white font-bold text-[14px] mb-2 disabled:opacity-50"
        >
          {busy ? 'Turning off…' : 'Turn off creator mode'}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="w-full h-11 text-muted font-semibold text-[13.5px]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
