import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Check, Copy, Coins, Users, Clock, Eye, Sparkles,
  ShieldCheck, TrendingUp, Lock, Wallet, ChevronRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'

export default function Monetization() {
  const nav = useNavigate()
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(null)
  const [referral, setReferral] = useState(null)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [unlockBusy, setUnlockBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true); setError('')
    const [s, r] = await Promise.all([
      supabase.rpc('get_my_monetization_status'),
      supabase.rpc('get_my_referral_summary'),
    ])
    if (s.error) { setError(s.error.message); setLoading(false); return }
    if (r.error) { setError(r.error.message); setLoading(false); return }
    setStatus(s.data)
    setReferral(r.data)
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  async function handleUnlockPro() {
    if (unlockBusy) return
    setUnlockBusy(true); tap('medium')
    const { data, error: err } = await supabase.rpc('unlock_pro_mode')
    setUnlockBusy(false)
    if (err) { setError(err.message); return }
    if (!data?.ok) {
      setError(data?.error === 'not_eligible'
        ? "Keep growing — you're not quite there yet."
        : (data?.error || 'Could not unlock Pro.'))
      return
    }
    tap('match')
    load()
  }

  function copyCode() {
    if (!referral?.code) return
    navigator.clipboard.writeText(referral.code).then(() => {
      tap('light')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const tier = status?.tier || 'standard'
  const isPro = tier === 'pro' || tier === 'creator'
  const isCreator = tier === 'creator'

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      {/* Glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-purple-600/22" style={{ filter: 'blur(120px)' }} />
        <div className="absolute bottom-[-180px] right-[-100px] w-[420px] h-[420px] rounded-full bg-pink-500/14" style={{ filter: 'blur(120px)' }} />
      </div>

      <header style={{ height: 52, flexShrink: 0 }}
        className="px-3 flex items-center gap-2 border-b border-white/8">
        <button onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px] flex-1">Monetization</span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-12">
        {loading ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">Loading…</div>
        ) : error && !status ? (
          <div className="text-danger text-[13px] bg-danger/10 border border-danger/30 rounded-2xl px-4 py-3">
            {error}
          </div>
        ) : (
          <>
            {/* Status pill */}
            <div className="flex justify-center mb-5">
              <StatusPill tier={tier} />
            </div>

            {/* Hero card */}
            {isCreator ? (
              <CreatorHero status={status} onWithdraw={() => { tap('light'); setWithdrawOpen(true) }} />
            ) : isPro ? (
              <ProHero status={status} />
            ) : (
              <StandardHero
                status={status}
                busy={unlockBusy}
                onUnlock={handleUnlockPro}
              />
            )}

            {error && (
              <div className="mt-4 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
                {error}
              </div>
            )}

            {/* Creator journey — only for Pro */}
            {isPro && status?.eligibility?.gates && (
              <Journey status={status} />
            )}

            {/* Referrals */}
            {referral && !referral.error && (
              <ReferralCard
                referral={referral}
                copied={copied}
                onCopy={copyCode}
              />
            )}
          </>
        )}
      </div>

      {/* Withdraw modal */}
      {withdrawOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center px-6"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-[380px] rounded-3xl p-6 border border-white/10"
            style={{ background: 'linear-gradient(160deg, #14141F 0%, #1A1A28 100%)' }}>
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center mx-auto mb-4">
              <Sparkles size={24} className="text-white" />
            </div>
            <h3 className="text-cream text-[18px] font-extrabold text-center mb-2">
              Almost there
            </h3>
            <p className="text-muted text-[13.5px] leading-relaxed text-center mb-5">
              Withdrawals unlock when Nakubonye reaches its next milestone.
              Keep creating — we'll notify you the moment it opens.
            </p>
            <button onClick={() => { tap('light'); setWithdrawOpen(false) }}
              className="w-full h-11 rounded-full text-white font-bold text-[14px]"
              style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)', boxShadow: '0 10px 28px rgba(236,72,153,0.4)' }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// StatusPill
// ------------------------------------------------------------
function StatusPill({ tier }) {
  const cfg = tier === 'creator'
    ? { label: 'CREATOR', bg: 'linear-gradient(135deg, #F59E0B 0%, #EC4899 100%)', fg: '#FFFFFF' }
    : tier === 'pro'
    ? { label: 'PRO', bg: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)', fg: '#FFFFFF' }
    : { label: 'STANDARD', bg: 'rgba(255,255,255,0.08)', fg: '#8E8E9A' }
  return (
    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-black tracking-[0.14em]"
      style={{ background: cfg.bg, color: cfg.fg, boxShadow: tier === 'standard' ? 'none' : '0 6px 20px rgba(168,85,247,0.35)' }}>
      {tier === 'creator' && <Sparkles size={11} strokeWidth={3} />}
      {cfg.label}
    </span>
  )
}

// ------------------------------------------------------------
// StandardHero — 3 unlock paths
// ------------------------------------------------------------
function StandardHero({ status, busy, onUnlock }) {
  const c = status?.unlock_paths?.current || {}
  const t = status?.unlock_paths || {}

  const rows = [
    {
      icon: Users, label: 'Followers',
      cur: c.followers || 0, target: t.followers_verified || 1000,
    },
    {
      icon: Clock, label: 'Watch minutes',
      cur: c.watch_minutes || 0, target: t.watch_minutes || 10000,
    },
    {
      icon: Coins, label: 'Coins earned',
      cur: c.lifetime_coins || 0, target: t.lifetime_coins || 10000,
    },
  ]

  return (
    <div className="rounded-3xl p-5 mb-5 border border-purple-500/20"
      style={{ background: 'linear-gradient(160deg, rgba(124,58,237,0.18) 0%, rgba(236,72,153,0.10) 100%)' }}>
      <h2 className="text-cream text-[19px] font-extrabold tracking-tight mb-1">
        Unlock Pro
      </h2>
      <p className="text-muted text-[12.5px] leading-snug mb-5">
        Reach any one milestone to unlock Pro mode and start your creator journey.
      </p>

      <div className="space-y-4 mb-5">
        {rows.map((r) => (
          <UnlockRow key={r.label} {...r} />
        ))}
      </div>

      <button onClick={onUnlock} disabled={busy}
        className="w-full h-12 rounded-full text-white font-bold text-[14.5px] disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)', boxShadow: '0 10px 28px rgba(236,72,153,0.5)' }}>
        {busy ? 'Checking…' : (<><Sparkles size={16} strokeWidth={2.4} /> Unlock Pro</>)}
      </button>
    </div>
  )
}

function UnlockRow({ icon: Icon, label, cur, target }) {
  const pct = Math.min(100, Math.round((cur / Math.max(1, target)) * 100))
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={13} strokeWidth={2.4} className="text-purple-300" />
        <span className="text-cream text-[12.5px] font-semibold flex-1">{label}</span>
        <span className="text-muted text-[11.5px] tabular-nums">
          {fmt(cur)} / {fmt(target)}
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{ width: pct + '%', background: pct >= 100 ? '#10B981' : 'linear-gradient(90deg, #A855F7 0%, #EC4899 100%)' }} />
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// ProHero — small milestone hint
// ------------------------------------------------------------
function ProHero({ status }) {
  const gates = status?.eligibility?.gates || []
  const remaining = gates.filter((g) => !g.passed).length
  return (
    <div className="rounded-3xl p-5 mb-5 border border-purple-500/20"
      style={{ background: 'linear-gradient(160deg, rgba(124,58,237,0.15) 0%, rgba(236,72,153,0.08) 100%)' }}>
      <h2 className="text-cream text-[17px] font-extrabold tracking-tight mb-1">
        Pro unlocked
      </h2>
      <p className="text-muted text-[12.5px] leading-snug">
        You're on the creator journey. Complete the milestones below to start earning coins from your content.
      </p>
    </div>
  )
}

// ------------------------------------------------------------
// CreatorHero — wallet + withdraw
// ------------------------------------------------------------
function CreatorHero({ status, onWithdraw }) {
  // Coins come from referral data + wallet; we approximate from unlock_paths for now
  const coins = status?.unlock_paths?.current?.lifetime_coins || 0
  const usd = (coins / 1000).toFixed(2)
  return (
    <div className="rounded-3xl p-5 mb-5 border border-amber-500/30"
      style={{ background: 'linear-gradient(160deg, rgba(245,158,11,0.18) 0%, rgba(236,72,153,0.10) 100%)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-amber-400" />
        <span className="text-amber-300 text-[11px] font-black tracking-[0.14em] uppercase">Creator</span>
      </div>
      <p className="text-cream text-[26px] font-extrabold tracking-tight leading-none mb-1">
        {fmt(coins)} coins
      </p>
      <p className="text-muted text-[12.5px] mb-5">≈ ${usd} USD</p>
      <button onClick={onWithdraw}
        className="w-full h-11 rounded-full text-white font-bold text-[14px] flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #EC4899 100%)', boxShadow: '0 10px 28px rgba(245,158,11,0.45)' }}>
        <Wallet size={15} strokeWidth={2.4} />
        Withdraw
      </button>
    </div>
  )
}

// ------------------------------------------------------------
// Journey — Pro shows 3 rows: done, focus, upcoming
// ------------------------------------------------------------
function Journey({ status }) {
  const gates = status?.eligibility?.gates || []

  // Map 7 gates → 5 grouped steps
  const steps = groupGates(gates)

  const focusIdx = steps.findIndex((s) => !s.passed)
  const doneCount = steps.filter((s) => s.passed).length

  // Show: last done, current focus, next upcoming
  const visible = []
  if (focusIdx > 0) visible.push({ ...steps[focusIdx - 1], state: 'done' })
  if (focusIdx >= 0) visible.push({ ...steps[focusIdx], state: 'focus' })
  if (focusIdx >= 0 && focusIdx + 1 < steps.length) visible.push({ ...steps[focusIdx + 1], state: 'next' })
  if (focusIdx < 0) visible.push(...steps.slice(-3).map((s) => ({ ...s, state: 'done' })))

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase">
          Creator Journey
        </p>
        <p className="text-muted text-[11px] font-semibold">
          Step {doneCount + 1} of {steps.length}
        </p>
      </div>

      <div className="rounded-2xl bg-white/[0.04] border border-white/8 divide-y divide-white/6">
        {visible.map((s, i) => (
          <StepRow key={i} step={s} />
        ))}
      </div>
    </div>
  )
}

function StepRow({ step }) {
  const { state, label, current, target, pct } = step

  if (state === 'done') {
    return (
      <div className="flex items-center gap-3 p-4">
        <div className="w-6 h-6 rounded-full bg-emerald-500 grid place-items-center shrink-0">
          <Check size={13} strokeWidth={3} className="text-white" />
        </div>
        <span className="text-cream text-[14px] font-semibold flex-1">{label}</span>
        <span className="text-emerald-400 text-[11px] font-black tracking-wider">DONE</span>
      </div>
    )
  }

  if (state === 'focus') {
    const color = pct >= 70 ? '#F59E0B' : pct >= 40 ? '#F59E0B' : '#A855F7'
    return (
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-6 h-6 rounded-full border-2 border-purple-500 grid place-items-center shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          </div>
          <span className="text-cream text-[14px] font-bold flex-1">{label}</span>
          <span className="text-muted text-[11.5px] tabular-nums">
            {fmt(current)} / {fmt(target)}
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/8 overflow-hidden ml-9" style={{ width: 'calc(100% - 36px)' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: pct + '%', background: color }} />
        </div>
        <p className="text-subtle text-[11px] mt-2 ml-9">
          {fmt(target - current)} to go
        </p>
      </div>
    )
  }

  // next (upcoming)
  return (
    <div className="flex items-center gap-3 p-4 opacity-55">
      <div className="w-6 h-6 rounded-full border border-white/20 grid place-items-center shrink-0">
        <Lock size={11} strokeWidth={2.4} className="text-muted" />
      </div>
      <span className="text-muted text-[14px] font-semibold flex-1">{label}</span>
    </div>
  )
}

// ------------------------------------------------------------
// ReferralCard
// ------------------------------------------------------------
function ReferralCard({ referral, copied, onCopy }) {
  const active = referral.active_this_month || 0
  const max = referral.max_active_per_month || 10
  const next = referral.next_tier || {}

  return (
    <div className="mt-6">
      <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
        Invite friends
      </p>
      <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4">
        {/* Code */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2.5">
            <p className="text-muted text-[10px] font-semibold tracking-wider uppercase mb-0.5">Your code</p>
            <p className="text-cream font-mono font-bold text-[15px] tracking-wider">{referral.code || '—'}</p>
          </div>
          <button onClick={onCopy}
            className="w-11 h-11 rounded-xl grid place-items-center border border-white/10 bg-white/[0.05]"
            aria-label="Copy code">
            {copied ? <Check size={17} strokeWidth={2.6} className="text-emerald-400" />
                    : <Copy size={16} strokeWidth={2.4} className="text-cream" />}
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-cream text-[12.5px] font-semibold">Active this month</span>
          <span className="text-muted text-[11.5px] tabular-nums">{active} / {max}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden mb-3">
          <div className="h-full rounded-full"
            style={{ width: Math.min(100, (active / max) * 100) + '%', background: 'linear-gradient(90deg, #A855F7 0%, #EC4899 100%)' }} />
        </div>

        {next.next && (
          <p className="text-subtle text-[11.5px]">
            Invite {next.remaining} more friend{next.remaining === 1 ? '' : 's'} → <span className="text-amber-300 font-semibold">+{next.bonus} coins</span>
          </p>
        )}
        {!next.next && (
          <p className="text-emerald-400 text-[11.5px] font-semibold">
            Max tier reached this month 🎉
          </p>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Group 7 gates into 5 steps
// ------------------------------------------------------------
function groupGates(gates) {
  const by = {}
  gates.forEach((g) => { by[g.key] = g })

  function combine(keys, label, icon) {
    const items = keys.map((k) => by[k]).filter(Boolean)
    if (!items.length) return null
    const passed = items.every((it) => it.passed)
    const pct = Math.round(items.reduce((a, it) => a + (it.pct || 0), 0) / items.length)
    return {
      label,
      passed,
      pct,
      current: items[0].current,
      target: items[0].target_display,
      _items: items,
    }
  }

  const steps = [
    combine(['followers'], 'Followers'),
    combine(['watch_minutes'], 'Watch time'),
    combine(['qualified_views', 'unique_viewers'], 'Views & reach'),
    combine(['recent_posts', 'account_age'], 'Consistency'),
    combine(['clean_days'], 'Good standing'),
  ].filter(Boolean)

  return steps
}

function fmt(n) {
  const v = Number(n) || 0
  if (v >= 1000000) {
    const m = v / 1000000
    return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + 'M'
  }
  if (v >= 1000) {
    const k = v / 1000
    return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'K'
  }
  return v.toLocaleString()
}
