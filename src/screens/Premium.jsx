import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Crown, Check, Sparkles, Eye, Heart, Zap, Filter, RotateCcw,
  Star, MessageCircle, BadgeCheck, ShoppingBag, Ban, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'

const PLANS = [
  { key: 'weekly',      name: 'Weekly',      price: '$4.99',  per: '/week',    badge: '' },
  { key: 'monthly',     name: 'Monthly',     price: '$14.99', per: '/month',   badge: '' },
  { key: 'three_month', name: '3 Months',    price: '$34.99', per: '/3 months', badge: 'POPULAR' },
  { key: 'yearly',      name: 'Yearly',      price: '$99.99', per: '/year',    badge: 'BEST VALUE' },
]

const BENEFITS = [
  {
    Icon: Eye,
    title: 'See who liked you',
    desc: 'Everyone who liked you, in one place. Match back instantly.',
  },
  {
    Icon: Ban,
    title: 'Incognito mode',
    desc: 'Disappear from Discover. Only people you already liked can still see you.',
  },
  {
    Icon: EyeOff,
    title: 'Hide online status & age',
    desc: 'Control what shows on your profile and cards.',
  },
  {
    Icon: MessageCircle,
    title: 'Only matches can message you',
    desc: 'Block direct messages from anyone you have not matched with.',
  },
]

export default function Premium() {
  const nav = useNavigate()
  const { session } = useAuth()

  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState(null)
  const [isPremium, setIsPremium] = useState(false)
  const [selected, setSelected] = useState('three_month')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true)
    const { data: subData } = await supabase.rpc('get_my_subscription')
    const row = Array.isArray(subData) ? subData[0] : subData
    setSub(row || null)
    setIsPremium(!!row?.is_active)
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  function purchase(planKey) {
    tap('light')
    alert(
      `Real payments aren't connected yet.\n\n` +
      `Plan: ${PLANS.find(p => p.key === planKey)?.name} — ${PLANS.find(p => p.key === planKey)?.price}\n\n` +
      `When Stripe (or another provider) is wired, this button will open checkout. ` +
      `For now, ask the developer to grant your account premium with:\n\n` +
      `grant_premium('<your-user-id>', '${planKey}', 30)`
    )
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      {/* Purple glow backdrop */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-purple-600/25 blur-[120px]" />
        <div className="absolute bottom-[-180px] right-[-100px] w-[380px] h-[380px] rounded-full bg-pink-500/15 blur-[110px]" />
      </div>

      <header
        style={{ height: 52, flexShrink: 0 }}
        className="relative px-3 flex items-center gap-2 border-b border-white/8"
      >
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Premium</span>
      </header>

      <div className="relative flex-1 overflow-y-auto px-5 py-6 pb-8">
        {/* Hero */}
        <div className="text-center mb-7">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 grid place-items-center mx-auto mb-4 shadow-[0_12px_36px_rgba(124,58,237,0.55)]">
            <Crown size={28} strokeWidth={2.4} className="text-white" fill="currentColor" />
          </div>
          <p className="text-purple-400 text-[11px] font-black tracking-[0.18em] uppercase mb-2">
            Nakubonye Premium
          </p>
          <h1 className="text-cream text-[26px] leading-[1.1] font-extrabold tracking-tight mb-3">
            Meet better. Discover more.
          </h1>
          <p className="text-muted text-[14px] leading-relaxed max-w-[320px] mx-auto">
            See who likes you, like without limits, and unlock the controls that make finding someone real feel easier.
          </p>
        </div>

        {/* Current status */}
        {isPremium && sub ? (
          <div className="rounded-2xl bg-gradient-to-br from-purple-600/25 to-pink-500/15 border border-purple-500/40 p-5 mb-7">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center">
                <Crown size={18} strokeWidth={2.4} className="text-white" fill="currentColor" />
              </div>
              <div>
                <p className="text-cream font-bold text-[15px]">You're Premium</p>
                <p className="text-purple-300 text-[12px] font-medium capitalize">
                  {sub.plan?.replace('_', ' ')} plan
                </p>
              </div>
            </div>
            {sub.expires_at && (
              <p className="text-muted text-[12.5px]">
                Renews on{' '}
                <span className="text-cream font-semibold">
                  {new Date(sub.expires_at).toLocaleDateString([], {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </span>
              </p>
            )}
            <button
              onClick={() => alert('Manage subscription is only active once a payment provider is connected.')}
              className="mt-4 w-full h-10 rounded-full bg-white/[0.06] border border-white/15 text-cream font-semibold text-[13px]"
            >
              Manage subscription
            </button>
          </div>
        ) : null}

        {/* Plans */}
        {!isPremium && !loading && (
          <>
            <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
              Choose a plan
            </p>
            <div className="grid grid-cols-2 gap-2.5 mb-7">
              {PLANS.map((p) => {
                const on = selected === p.key
                return (
                  <button
                    key={p.key}
                    onClick={() => { tap('light'); setSelected(p.key) }}
                    className={`relative rounded-2xl p-4 border text-left transition-colors ${
                      on
                        ? 'bg-purple-600/20 border-purple-500 shadow-[0_0_24px_rgba(124,58,237,0.25)]'
                        : 'bg-white/[0.03] border-white/8'
                    }`}
                  >
                    {p.badge && (
                      <span className={`absolute -top-2 left-3 px-2 py-0.5 rounded-full text-[8.5px] font-black tracking-wide ${
                        p.badge === 'POPULAR'
                          ? 'bg-purple-600 text-white'
                          : 'bg-pink-500 text-white'
                      }`}>
                        {p.badge}
                      </span>
                    )}
                    <p className="text-cream font-bold text-[14px] mb-1">{p.name}</p>
                    <p className="text-cream text-[20px] font-extrabold tracking-tight">
                      {p.price}
                    </p>
                    <p className="text-muted text-[11px] font-medium mt-0.5">{p.per}</p>
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => purchase(selected)}
              disabled={busy}
              className="w-full h-12 rounded-full bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white font-bold text-[15px] shadow-[0_12px_36px_rgba(124,58,237,0.55)] mb-2 disabled:opacity-50"
            >
              Continue
            </button>
            <button
              onClick={() => alert('Restore purchase requires a payment provider. Not available yet.')}
              className="w-full h-10 text-muted font-semibold text-[13px] mb-8"
            >
              Restore purchase
            </button>
          </>
        )}

        {loading && (
          <div className="flex items-center justify-center py-10 mb-6">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          </div>
        )}

        {/* Benefits */}
        <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
          What you get
        </p>
        <div className="flex flex-col gap-2 mb-7">
          {BENEFITS.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/6"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25 grid place-items-center shrink-0">
                <Icon size={16} strokeWidth={2.3} className="text-purple-300" />
              </div>
              <div className="min-w-0">
                <p className="text-cream font-semibold text-[14px] mb-0.5 flex items-center gap-1.5">
                  <Check size={13} strokeWidth={3} className="text-purple-400 shrink-0" />
                  {title}
                </p>
                <p className="text-muted text-[12.5px] leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-subtle text-[11px] leading-relaxed mb-4">
          Premium never bypasses safety, blocking, reporting, or moderation.
          Cancel anytime in the app store.
        </p>
      </div>
    </div>
  )
}
