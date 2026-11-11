import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Sparkles, Users, BarChart3, Tag, Check, ChevronRight,
  Banknote, Globe, X,
} from 'lucide-react'
import BrandGlow from '../components/BrandGlow'
import CreatorDashboard from '../components/CreatorDashboard'
import CreatorOnboarding from './CreatorOnboarding'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { tap } from '../lib/haptic'

export default function CreatorMode() {
  const nav = useNavigate()
  const { session, profile: authProfile, refreshProfile } = useAuth()
  const myId = session?.user?.id

  const [accountType, setAccountType] = useState(authProfile?.account_type || 'personal')
  const [category, setCategory] = useState(authProfile?.category_label || '')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showConfirmOff, setShowConfirmOff] = useState(false)
  const [showCategorySheet, setShowCategorySheet] = useState(false)

  useEffect(() => {
    setAccountType(authProfile?.account_type || 'personal')
    setCategory(authProfile?.category_label || '')
  }, [authProfile?.account_type, authProfile?.category_label])

  useEffect(() => {
    if (!myId) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('account_type, category_label')
          .eq('id', myId)
          .maybeSingle()
        if (!cancelled && data) {
          setAccountType(data.account_type || 'personal')
          setCategory(data.category_label || '')
        }
      } catch (e) {
        console.warn('load account_type failed', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [myId])

  async function turnOn() {
    if (busy || !myId) return
    tap('medium')
    setShowOnboarding(true)
  }

  async function handleOnboardingFinish() {
    setShowOnboarding(false)
    try { await refreshProfile() } catch {}
  }

  async function saveCategory(value) {
    if (!myId) return
    setCategory(value)
    setShowCategorySheet(false)
    tap('medium')
    try {
      const { error } = await supabase.from('profiles').update({ category_label: value }).eq('id', myId)
      if (error) throw error
      await refreshProfile()
    } catch (e) {
      console.warn(e)
      alert('Could not save category: ' + (e.message || e))
    }
  }

  async function turnOff() {
    if (busy || !myId) return
    setBusy(true)
    tap('medium')
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_type: 'personal', creator_onboarded_at: null })
        .eq('id', myId)
      if (error) throw error
      setShowConfirmOff(false)
      setAccountType('personal')
      await refreshProfile()
      nav('/me', { replace: true })
    } catch (e) {
      console.warn(e)
      alert('Could not turn off creator mode: ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const isCreator = accountType === 'creator'

  if (showOnboarding) {
    return <CreatorOnboarding onClose={() => setShowOnboarding(false)} onFinish={handleOnboardingFinish} />
  }

  return (
    <div className="min-h-dvh bg-transparent text-cream">
      <BrandGlow />
      <div className="sticky top-0 z-30 bg-transparent backdrop-blur-md border-b border-white/8">
        <div className="max-w-[480px] mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => { tap('light'); nav(-1) }} className="w-9 h-9 rounded-full grid place-items-center text-cream" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-cream font-extrabold text-[16px]">{isCreator ? 'Creator mode' : 'Turn on creator mode'}</h1>
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-5 py-5">
        {isCreator ? (
          <ActiveView myId={myId} onTurnOff={() => setShowConfirmOff(true)} category={category} onEditCategory={() => setShowCategorySheet(true)} />
        ) : (
          <IntroView onTurnOn={turnOn} busy={busy} loading={loading} />
        )}
      </div>

      {showConfirmOff && <ConfirmOff busy={busy} onCancel={() => setShowConfirmOff(false)} onConfirm={turnOff} />}
      {showCategorySheet && <CategorySheet current={category} onSelect={saveCategory} onCancel={() => setShowCategorySheet(false)} />}
    </div>
  )
}

function IntroView({ onTurnOn, busy, loading }) {
  return (
    <>
      <div className="relative w-full rounded-3xl overflow-hidden mb-6">
        <img src="/illustrations/creator/welcome.svg" alt="" className="w-full h-auto block" />
        <div className="absolute inset-x-0 bottom-0 h-20" style={{ background: 'linear-gradient(180deg, rgba(11,11,20,0) 0%, rgba(11,11,20,0.5) 100%)' }} />
      </div>
      <h2 className="text-cream font-extrabold text-[22px] leading-tight text-center mb-2">Turn on creator mode</h2>
      <p className="text-muted text-[13.5px] leading-relaxed text-center mb-6 px-2">Add new tools to your profile so you can grow as a creator on Nakubonye.</p>
      <div className="flex flex-col gap-3 mb-6">
        <Benefit icon={<BarChart3 size={18} />} title="Get paid for your content" body="If you're eligible, unlock monetization tools to earn money by creating new content." />
        <Benefit icon={<Users size={18} />} title="See content insights" body="Learn more about your audience and see how well your content is performing." />
        <Benefit icon={<Sparkles size={18} />} title="Grow your audience" body="Your follower setting will be set to Public so anyone can see your public content. You can still share privately to matches." />
        <Benefit icon={<Tag size={18} />} title="Get discovered with tagging" body="Your tagging setting will be set to Public so anyone can tag you and help others discover your profile. You can change this anytime." />
      </div>
      <button onClick={onTurnOn} disabled={busy || loading} className="w-full h-12 rounded-full text-white font-bold text-[14.5px] disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)' }}>
        {busy ? 'Turning on…' : 'Turn on'}
      </button>
      <p className="text-subtle text-[11px] text-center mt-4 leading-relaxed">Nakubonye will show more information about profiles in creator mode. By selecting "Turn on," you agree to our Commercial Terms.</p>
    </>
  )
}

function Benefit({ icon, title, body }) {
  return (
    <div className="flex items-start gap-3 py-1">
      <span className="w-9 h-9 rounded-xl bg-purple-500/12 border border-purple-500/30 grid place-items-center shrink-0 text-purple-300">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-cream font-bold text-[14px] mb-0.5">{title}</p>
        <p className="text-muted text-[12.5px] leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

function ActiveView({ myId, onTurnOff, category, onEditCategory }) {
  return (
    <>
      <div className="relative w-full rounded-3xl overflow-hidden mb-6">
        <img src="/illustrations/finish.jpg" alt="" className="w-full h-auto block" />
        <div className="absolute inset-x-0 bottom-0 h-20" style={{ background: 'linear-gradient(180deg, rgba(11,11,20,0) 0%, rgba(11,11,20,0.5) 100%)' }} />
      </div>
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-3xl mx-auto mb-4 grid place-items-center -mt-16 relative z-10" style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)', border: '3px solid #0B0B14' }}>
          <Sparkles size={36} className="text-white" strokeWidth={2.2} />
        </div>
        <h2 className="text-cream font-extrabold text-[20px] mb-2">Creator mode is on</h2>
        <p className="text-muted text-[13.5px] leading-relaxed px-4">Your profile is public-facing. Anyone can follow you and discover your posts.</p>
      </div>
      {myId && <CreatorDashboard myId={myId} />}
      <button onClick={onEditCategory} className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/8 mb-3 mt-6 active:bg-white/[0.05]">
        <span className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 grid place-items-center text-purple-300"><Tag size={16} /></span>
          <span className="flex flex-col items-start">
            <span className="text-cream font-semibold text-[13.5px]">Category</span>
            <span className="text-muted text-[11.5px]">{category || 'Choose what best describes you'}</span>
          </span>
        </span>
        <ChevronRight size={16} className="text-muted" />
      </button>
      <button onClick={onTurnOff} className="w-full h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[14px] active:bg-red-500/20 transition-colors mb-6">Turn off Creator Mode</button>
    </>
  )
}

const CREATOR_CATEGORIES = ['Digital Creator', 'Public Figure', 'Artist', 'Musician / Band', 'Writer', 'Filmmaker', 'Photographer', 'Entrepreneur', 'Business', 'Community Leader', 'Educator', 'Other']

function ConfirmOff({ onCancel, onConfirm, busy }) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center px-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[400px] bg-[#0B0B14] rounded-3xl border border-white/10 p-6 flex flex-col">
        <h3 className="text-cream font-extrabold text-[20px] mb-2 text-center">Turn off creator mode?</h3>
        <p className="text-muted text-[13.5px] leading-relaxed text-center mb-6">If you turn off creator mode, you will lose access to:</p>
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0"><BarChart3 size={16} className="text-red-400" /></div>
            <div><p className="text-cream font-bold text-[14px]">Insights & Dashboard</p><p className="text-muted text-[12.5px]">You won't be able to see your reach or audience analytics.</p></div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0"><Banknote size={16} className="text-red-400" /></div>
            <div><p className="text-cream font-bold text-[14px]">Monetization tools</p><p className="text-muted text-[12.5px]">You'll lose access to any earning and payout features.</p></div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0"><Globe size={16} className="text-red-400" /></div>
            <div><p className="text-cream font-bold text-[14px]">Public Audience</p><p className="text-muted text-[12.5px]">Your profile will revert to private (matches only).</p></div>
          </div>
        </div>
        <button onClick={onConfirm} disabled={busy} className="w-full h-12 rounded-full bg-red-500 text-white font-bold text-[14.5px] mb-3 disabled:opacity-50 active:bg-red-600">{busy ? 'Turning off…' : 'Turn off creator mode'}</button>
        <button onClick={onCancel} disabled={busy} className="w-full h-12 rounded-full bg-white/[0.06] text-cream font-bold text-[14.5px] disabled:opacity-50 active:bg-white/[0.1]">Cancel</button>
      </div>
    </div>
  )
}

function CategorySheet({ current, onSelect, onCancel }) {
  return (
    <div className="fixed inset-0 z-[400] flex items-end" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/70" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 flex flex-col" style={{ maxHeight: '80dvh' }}>
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-4" />
        <div className="px-5 pb-3 border-b border-white/8">
          <h3 className="text-cream font-extrabold text-[16px]">Category</h3>
          <p className="text-muted text-[12.5px] mt-1 leading-snug">Choose the category that best describes your profile. It appears under your name.</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {CREATOR_CATEGORIES.map((c) => (
            <button key={c} onClick={() => onSelect(c)} className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-left active:bg-white/[0.04] ${current === c ? 'bg-purple-500/10' : ''}`}>
              <span className="text-cream text-[14px] font-medium">{c}</span>
              {current === c && <span className="w-5 h-5 rounded-full bg-purple-500 grid place-items-center"><Check size={12} className="text-white" strokeWidth={3} /></span>}
            </button>
          ))}
        </div>
        <div className="px-5 pt-3 pb-4 border-t border-white/8" style={{ paddingBottom: 'max(20px, var(--safe-bottom, 8px))' }}>
          <button onClick={onCancel} className="w-full h-11 text-muted font-semibold text-[13.5px]">Cancel</button>
        </div>
      </div>
    </div>
  )
}
