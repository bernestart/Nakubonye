import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Check, ShieldCheck, Copy, Globe, Smartphone, ChevronDown,
  Clock, X, AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'

const MOBILE_AMOUNT_BIF = '15,000'
const MOBILE_NUMBER = '65394084'
const FORM_FEE_USD = 8

const SERVICES = [
  { id: 'lumicash', label: 'Lumicash (Lumitel)' },
  { id: 'bancobu',  label: 'Bancobu' },
  { id: 'enoti',    label: 'Enoti' },
  { id: 'ccm',      label: 'CCM' },
  { id: 'ingodo',   label: 'Ingodo yanje' },
  { id: 'coopec',   label: 'COOPEC e-Wallet' },
  { id: 'cashtel',  label: 'Cashtel' },
  { id: 'other',    label: 'Other service' },
]

const CATEGORIES = [
  'Content creator', 'Musician / Artist', 'Journalist', 'Public figure',
  'Business person', 'Sports person', 'Actor / Entertainer', 'Politician',
  'Educator', 'Health professional', 'Community leader', 'Other',
]

export default function Verify() {
  const nav = useNavigate()
  const { session, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [existing, setExisting] = useState(null)
  const [step, setStep] = useState('choose')        // choose | mobile | form
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true); setError('')
    const { data, error: err } = await supabase
      .from('badge_requests')
      .select('id, method, status, admin_note, created_at, reviewed_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (err) { setError(err.message); setLoading(false); return }
    setExisting(data || null)
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  function copyNumber() {
    navigator.clipboard.writeText(MOBILE_NUMBER).then(() => {
      tap('light')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const isVerified = profile?.is_verified === true
  const pending = existing?.status === 'pending'
  const approved = existing?.status === 'approved' || isVerified
  const rejected = existing?.status === 'rejected'

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-sky-600/22" style={{ filter: 'blur(120px)' }} />
        <div className="absolute bottom-[-180px] right-[-100px] w-[420px] h-[420px] rounded-full bg-purple-500/14" style={{ filter: 'blur(120px)' }} />
      </div>

      <header style={{ height: 52, flexShrink: 0 }}
        className="px-3 flex items-center gap-2 border-b border-white/8">
        <button onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px] flex-1">Get verified</span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 pb-12">
        {loading ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">Loading…</div>
        ) : error ? (
          <div className="text-danger text-[13px] bg-danger/10 border border-danger/30 rounded-2xl px-4 py-3">
            {error}
          </div>
        ) : approved ? (
          <ApprovedState />
        ) : pending ? (
          <PendingState existing={existing} />
        ) : rejected ? (
          <RejectedState note={existing?.admin_note} onRetry={() => { setStep('choose'); setExisting(null) }} />
        ) : step === 'choose' ? (
          <ChooseMethod onMobile={() => setStep('mobile')} onForm={() => setStep('form')} />
        ) : step === 'mobile' ? (
          <MobileMoneyFlow
            copied={copied}
            onCopy={copyNumber}
            onBack={() => setStep('choose')}
            onSubmitted={load}
          />
        ) : (
          <FormFlow
            email={session?.user?.email || ''}
            onBack={() => setStep('choose')}
            onSubmitted={load}
          />
        )}
      </div>
    </div>
  )
}

function ApprovedState() {
  return (
    <div className="text-center pt-4">
      <div className="w-20 h-20 rounded-full bg-[#1DA1F2] grid place-items-center mx-auto mb-5 shadow-[0_10px_40px_rgba(29,161,242,0.5)]">
        <Check size={40} strokeWidth={3} className="text-white" />
      </div>
      <h2 className="text-cream text-[22px] font-extrabold mb-2">You're verified</h2>
      <p className="text-muted text-[13.5px] leading-relaxed max-w-[300px] mx-auto">
        Your badge appears next to your name everywhere on Nakubonye.
      </p>
    </div>
  )
}

function PendingState({ existing }) {
  const method = existing?.method === 'form' ? 'Form application' : 'Mobile money payment'
  return (
    <div className="text-center pt-4">
      <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500/40 grid place-items-center mx-auto mb-5">
        <Clock size={36} strokeWidth={2.2} className="text-amber-400" />
      </div>
      <h2 className="text-cream text-[20px] font-extrabold mb-2">Under review</h2>
      <p className="text-muted text-[13.5px] leading-relaxed max-w-[300px] mx-auto mb-6">
        We're reviewing your request. Most approvals happen within 24 hours.
      </p>
      <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4 text-left">
        <div className="flex justify-between text-[12px] mb-2">
          <span className="text-muted">Method</span>
          <span className="text-cream font-semibold">{method}</span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="text-muted">Submitted</span>
          <span className="text-cream font-semibold">
            {existing?.created_at ? new Date(existing.created_at).toLocaleDateString() : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

function RejectedState({ note, onRetry }) {
  return (
    <div className="text-center pt-4">
      <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/40 grid place-items-center mx-auto mb-5">
        <X size={36} strokeWidth={2.4} className="text-red-400" />
      </div>
      <h2 className="text-cream text-[20px] font-extrabold mb-2">Not approved</h2>
      <p className="text-muted text-[13.5px] leading-relaxed max-w-[300px] mx-auto mb-5">
        {note || 'Your last request was not approved. You can try again.'}
      </p>
      <button onClick={onRetry}
        className="w-full h-12 rounded-full text-white font-bold text-[14.5px]"
        style={{ background: 'linear-gradient(135deg, #0EA5E9 0%, #A855F7 100%)', boxShadow: '0 10px 28px rgba(14,165,233,0.45)' }}>
        Try again
      </button>
    </div>
  )
}

function ChooseMethod({ onMobile, onForm }) {
  return (
    <div>
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-[#1DA1F2] grid place-items-center mx-auto mb-5 shadow-[0_10px_40px_rgba(29,161,242,0.45)]">
          <Check size={40} strokeWidth={3} className="text-white" />
        </div>
        <h1 className="text-cream text-[24px] font-extrabold tracking-tight mb-2">
          Get your verified badge
        </h1>
        <p className="text-muted text-[13.5px] leading-relaxed max-w-[300px] mx-auto">
          Join creators, public figures, and community leaders on Nakubonye.
        </p>
      </div>

      <div className="space-y-3">
        <MethodCard
          icon={Smartphone}
          title="Pay with mobile money"
          subtitle="15,000 BIF (≈ $5) · Mobile money & wallets"
          tag="Burundi"
          tagColor="#22C55E"
          onClick={onMobile}
        />
        <MethodCard
          icon={Globe}
          title="Apply with form"
          subtitle={`$${FORM_FEE_USD} · For international applicants`}
          tag="Global"
          tagColor="#A855F7"
          onClick={onForm}
        />
      </div>

      <p className="text-subtle text-[11.5px] leading-relaxed text-center mt-6">
        Verification never bypasses safety, blocking, or moderation rules.
      </p>
    </div>
  )
}

function MethodCard({ icon: Icon, title, subtitle, tag, tagColor, onClick }) {
  return (
    <button onClick={() => { tap('light'); onClick() }}
      className="w-full rounded-2xl bg-white/[0.04] border border-white/8 p-4 flex items-center gap-3.5 text-left active:bg-white/[0.06]">
      <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0"
        style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)' }}>
        <Icon size={20} strokeWidth={2.2} className="text-sky-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-cream font-bold text-[14.5px]">{title}</p>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wider"
            style={{ background: tagColor + '22', color: tagColor }}>
            {tag}
          </span>
        </div>
        <p className="text-muted text-[12px]">{subtitle}</p>
      </div>
    </button>
  )
}

function MobileMoneyFlow({ copied, onCopy, onBack, onSubmitted }) {
  const [service, setService] = useState('lumicash')
  const [serviceOpen, setServiceOpen] = useState(false)
  const [txnId, setTxnId] = useState('')
  const [senderName, setSenderName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!txnId.trim()) { setError('Please enter your transaction ID'); return }
    setBusy(true); setError(''); tap('medium')
    const payload = JSON.stringify({
      service: SERVICES.find(s => s.id === service)?.label || service,
      txn_id: txnId.trim(),
      sender_name: senderName.trim() || null,
    })
    const { data, error: err } = await supabase.rpc('submit_badge_request', {
      p_method: 'mobile_money',
      p_proof_text: payload,
      p_proof_url: null,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    if (!data?.ok) { setError(data?.error || 'Could not submit'); return }
    tap('match')
    onSubmitted()
  }

  return (
    <div>
      <button onClick={onBack} className="text-muted text-[12px] font-semibold mb-4">
        ← Choose another method
      </button>

      <h2 className="text-cream text-[19px] font-extrabold tracking-tight mb-1">
        Send 15,000 BIF
      </h2>
      <p className="text-muted text-[13px] leading-snug mb-5">
        Then submit the transaction ID from your mobile money confirmation SMS.
      </p>

      <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4 mb-4">
        <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
          Recipient
        </p>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-cream font-mono font-bold text-[20px] tracking-wider">{MOBILE_NUMBER}</p>
            <p className="text-muted text-[11.5px] mt-0.5">Nakubonye verification</p>
          </div>
          <button onClick={onCopy}
            className="w-11 h-11 rounded-xl grid place-items-center border border-white/10 bg-white/[0.05]"
            aria-label="Copy number">
            {copied ? <Check size={17} strokeWidth={2.6} className="text-emerald-400" />
                    : <Copy size={16} strokeWidth={2.4} className="text-cream" />}
          </button>
        </div>
        <div className="flex items-center justify-between border-t border-white/6 pt-3">
          <span className="text-cream text-[12.5px] font-semibold">Amount</span>
          <span className="text-cream font-bold text-[14px]">{MOBILE_AMOUNT_BIF} BIF</span>
        </div>
      </div>

      <p className="text-cream text-[13px] font-bold mb-2">Which service did you use?</p>
      <button onClick={() => { tap('light'); setServiceOpen(!serviceOpen) }}
        className="w-full rounded-2xl bg-white/[0.04] border border-white/8 px-4 py-3 flex items-center justify-between mb-2">
        <span className="text-cream text-[14px] font-semibold">
          {SERVICES.find(s => s.id === service)?.label}
        </span>
        <ChevronDown size={16} className="text-muted" strokeWidth={2.4} />
      </button>

      {serviceOpen && (
        <div className="rounded-2xl bg-white/[0.04] border border-white/8 overflow-hidden mb-4 max-h-[260px] overflow-y-auto">
          {SERVICES.map((s) => (
            <button key={s.id}
              onClick={() => { tap('light'); setService(s.id); setServiceOpen(false) }}
              className="w-full px-4 py-3 text-left text-[13.5px] text-cream border-b border-white/6 last:border-0 active:bg-white/[0.04]">
              {s.label}
            </button>
          ))}
        </div>
      )}

      <p className="text-cream text-[13px] font-bold mt-4 mb-2">Transaction ID</p>
      <input
        value={txnId}
        onChange={(e) => setTxnId(e.target.value)}
        placeholder="e.g. LM23098X7K2"
        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 text-cream text-[14px] placeholder:text-white/25 focus:outline-none focus:border-sky-500 mb-3"
      />

      <p className="text-cream text-[13px] font-bold mb-2">Your name (optional)</p>
      <input
        value={senderName}
        onChange={(e) => setSenderName(e.target.value)}
        placeholder="Name used to send the money"
        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 text-cream text-[14px] placeholder:text-white/25 focus:outline-none focus:border-sky-500 mb-4"
      />

      {error && (
        <div className="text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 mb-4">
          {error}
        </div>
      )}

      <button onClick={submit} disabled={busy || !txnId.trim()}
        className="w-full h-12 rounded-full text-white font-bold text-[14.5px] disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #0EA5E9 0%, #A855F7 100%)', boxShadow: '0 10px 28px rgba(14,165,233,0.45)' }}>
        {busy ? 'Submitting…' : 'Submit for review'}
      </button>
    </div>
  )
}

function FormFlow({ email: initialEmail, onBack, onSubmitted }) {
  const [category, setCategory] = useState(CATEGORIES[0])
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [social, setSocial] = useState('')
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!reason.trim() || reason.trim().length < 20) {
      setError('Please write at least 20 characters in "Why do you want to be verified?"')
      return
    }
    if (!social.trim()) { setError('Please add a link to your main social profile'); return }
    if (!email.trim() || !email.includes('@')) { setError('Please add a valid email'); return }
    setBusy(true); setError(''); tap('medium')
    const payload = JSON.stringify({
      category,
      reason: reason.trim(),
      social: social.trim(),
      email: email.trim(),
    })
    const { data, error: err } = await supabase.rpc('submit_badge_request', {
      p_method: 'form',
      p_proof_text: payload,
      p_proof_url: social.trim(),
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    if (!data?.ok) { setError(data?.error || 'Could not submit'); return }
    tap('match')
    onSubmitted()
  }

  return (
    <div>
      <button onClick={onBack} className="text-muted text-[12px] font-semibold mb-4">
        ← Choose another method
      </button>

      <h2 className="text-cream text-[19px] font-extrabold tracking-tight mb-1">
        Apply for verification
      </h2>
      <p className="text-muted text-[13px] leading-snug mb-5">
        ${FORM_FEE_USD} fee. We'll contact you to arrange payment after review.
      </p>

      <p className="text-cream text-[13px] font-bold mb-2">Category</p>
      <button onClick={() => { tap('light'); setCategoryOpen(!categoryOpen) }}
        className="w-full rounded-2xl bg-white/[0.04] border border-white/8 px-4 py-3 flex items-center justify-between mb-2">
        <span className="text-cream text-[14px] font-semibold">{category}</span>
        <ChevronDown size={16} className="text-muted" strokeWidth={2.4} />
      </button>
      {categoryOpen && (
        <div className="rounded-2xl bg-white/[0.04] border border-white/8 overflow-hidden mb-4 max-h-[240px] overflow-y-auto">
          {CATEGORIES.map((c) => (
            <button key={c}
              onClick={() => { tap('light'); setCategory(c); setCategoryOpen(false) }}
              className="w-full px-4 py-3 text-left text-[13.5px] text-cream border-b border-white/6 last:border-0 active:bg-white/[0.04]">
              {c}
            </button>
          ))}
        </div>
      )}

      <p className="text-cream text-[13px] font-bold mt-4 mb-2">
        Why do you want to be verified?
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Tell us about your work and audience (20–300 characters)"
        maxLength={300}
        rows={4}
        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 text-cream text-[14px] placeholder:text-white/25 focus:outline-none focus:border-sky-500 mb-3 resize-none"
      />
      <p className="text-subtle text-[11px] mb-4 text-right">{reason.length} / 300</p>

      <p className="text-cream text-[13px] font-bold mb-2">Main social profile link</p>
      <input
        value={social}
        onChange={(e) => setSocial(e.target.value)}
        placeholder="https://facebook.com/yourpage"
        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 text-cream text-[14px] placeholder:text-white/25 focus:outline-none focus:border-sky-500 mb-3"
      />

      <p className="text-cream text-[13px] font-bold mb-2">Contact email</p>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        placeholder="you@example.com"
        className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 text-cream text-[14px] placeholder:text-white/25 focus:outline-none focus:border-sky-500 mb-4"
      />

      {error && (
        <div className="flex items-start gap-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 mb-4">
          <AlertCircle size={14} strokeWidth={2.4} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button onClick={submit} disabled={busy}
        className="w-full h-12 rounded-full text-white font-bold text-[14.5px] disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #0EA5E9 0%, #A855F7 100%)', boxShadow: '0 10px 28px rgba(14,165,233,0.45)' }}>
        {busy ? 'Submitting…' : <><ShieldCheck size={16} strokeWidth={2.4} /> Submit for review</>}
      </button>
    </div>
  )
}
