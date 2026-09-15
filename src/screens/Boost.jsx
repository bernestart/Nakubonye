import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Zap, Clock, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useWallet } from '../lib/wallet'
import { tap } from '../lib/haptic'
import BrandGlow from '../components/BrandGlow'

export default function Boost() {
  const nav = useNavigate()
  const { session } = useAuth()
  const { balance, refresh: refreshWallet } = useWallet()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [activeUntil, setActiveUntil] = useState(null)   // Date
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [cost, setCost] = useState(100)
  const [durationMin, setDurationMin] = useState(30)
  const [justStarted, setJustStarted] = useState(false)

  const tickRef = useRef(null)

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true); setError('')

    // read config
    const { data: cfg } = await supabase
      .from('coin_config')
      .select('key, value')
      .in('key', ['boost_cost', 'boost_duration_minutes'])
    if (cfg) {
      const costRow = cfg.find((r) => r.key === 'boost_cost')
      const durRow = cfg.find((r) => r.key === 'boost_duration_minutes')
      if (costRow) setCost(Number(costRow.value))
      if (durRow) setDurationMin(Number(durRow.value))
    }

    // check active boost
    const { data: b } = await supabase.rpc('get_my_active_boost')
    const row = Array.isArray(b) ? b[0] : b
    if (row?.is_active && row?.expires_at) {
      setActiveUntil(new Date(row.expires_at))
    } else {
      setActiveUntil(null)
    }

    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  // countdown
  useEffect(() => {
    clearInterval(tickRef.current)
    if (!activeUntil) { setSecondsLeft(0); return }

    const update = () => {
      const s = Math.max(0, Math.floor((activeUntil.getTime() - Date.now()) / 1000))
      setSecondsLeft(s)
      if (s <= 0) {
        clearInterval(tickRef.current)
        setActiveUntil(null)
        load()
      }
    }
    update()
    tickRef.current = setInterval(update, 1000)
    return () => clearInterval(tickRef.current)
  }, [activeUntil, load])

  async function start() {
    if (starting) return
    setStarting(true); setError('')
    tap('medium')

    const { data, error: err } = await supabase.rpc('start_boost')

    setStarting(false)

    if (err) {
      if (/insufficient/i.test(err.message)) {
        setError('Not enough coins for a boost. Get more in Wallet.')
      } else if (/already have an active/i.test(err.message)) {
        setError('You already have an active boost.')
        load()
      } else {
        setError(err.message)
      }
      return
    }

    const row = Array.isArray(data) ? data[0] : data
    if (row?.expires_at) {
      setActiveUntil(new Date(row.expires_at))
      setJustStarted(true)
      tap('match')
      await refreshWallet()
      setTimeout(() => setJustStarted(false), 2500)
    } else {
      load()
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />

      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Boost my profile</span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-10">
        {loading ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">Loading…</div>
        ) : activeUntil ? (
          <ActiveState
            secondsLeft={secondsLeft}
            totalSeconds={durationMin * 60}
            justStarted={justStarted}
          />
        ) : (
          <IdleState
            cost={cost}
            durationMin={durationMin}
            balance={balance}
            starting={starting}
            error={error}
            onStart={start}
          />
        )}
      </div>
    </div>
  )
}

function IdleState({ cost, durationMin, balance, starting, error, onStart }) {
  const canAfford = balance >= cost

  return (
    <div className="text-center">
      <div
        className="w-20 h-20 rounded-3xl grid place-items-center mx-auto mb-5"
        style={{
          background: 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)',
          boxShadow: '0 16px 44px rgba(245,158,11,0.55)',
        }}
      >
        <Zap size={36} strokeWidth={2.4} className="text-white" fill="currentColor" />
      </div>

      <h1 className="text-cream text-[24px] font-extrabold tracking-tight mb-2">
        Be seen first
      </h1>
      <p className="text-muted text-[14px] leading-relaxed max-w-[320px] mx-auto mb-7">
        Your profile jumps to the top of Discover for the next {durationMin} minutes.
        More eyes, more likes, more matches.
      </p>

      <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4 text-left mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-muted text-[13px]">Duration</span>
          <span className="text-cream text-[13.5px] font-semibold">{durationMin} minutes</span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-muted text-[13px]">Cost</span>
          <span className="text-cream text-[13.5px] font-semibold">{cost} coins</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted text-[13px]">Your balance</span>
          <span className={`text-[13.5px] font-semibold ${canAfford ? 'text-emerald-400' : 'text-red-400'}`}>
            {balance} coins
          </span>
        </div>
      </div>

      {!canAfford && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-left">
          <AlertCircle size={16} strokeWidth={2.3} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-cream text-[13px] font-semibold mb-0.5">Not enough coins</p>
            <p className="text-muted text-[12px] leading-snug">
              You need {cost - balance} more coins. Tap Wallet to get more.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-left">
          <p className="text-danger text-[12.5px]">{error}</p>
        </div>
      )}

      <button
        onClick={onStart}
        disabled={starting}
        className="w-full h-12 rounded-full text-white font-bold text-[15px] disabled:opacity-50 flex items-center justify-center gap-2"
        style={{
          background: 'linear-gradient(135deg, #FBBF24 0%, #F97316 100%)',
          boxShadow: '0 10px 30px rgba(245,158,11,0.5)',
        }}
      >
        <Zap size={16} strokeWidth={2.6} fill="currentColor" />
        {starting ? 'Starting…' : canAfford ? `Boost for ${cost} coins` : 'Not enough coins'}
      </button>

      <p className="text-subtle text-[11.5px] leading-relaxed mt-4">
        Premium members get 1 free boost every week.
      </p>
    </div>
  )
}

function ActiveState({ secondsLeft, totalSeconds, justStarted }) {
  const pct = Math.max(0, Math.min(1, secondsLeft / totalSeconds))
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  // SVG ring
  const R = 60
  const C = 2 * Math.PI * R
  const offset = C * (1 - pct)

  return (
    <div className="text-center">
      <div className="relative w-[170px] h-[170px] mx-auto mb-5">
        <svg viewBox="0 0 150 150" className="w-full h-full -rotate-90">
          <circle cx="75" cy="75" r={R} stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="none" />
          <circle
            cx="75" cy="75" r={R}
            stroke="url(#boostGrad)" strokeWidth="10" fill="none"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
          <defs>
            <linearGradient id="boostGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <Zap size={40} strokeWidth={2.4} className="text-amber-400" fill="currentColor" />
        </div>
      </div>

      <h1 className="text-cream text-[24px] font-extrabold tracking-tight mb-2">
        {justStarted ? 'Boost is live!' : "You're being boosted"}
      </h1>
      <p className="text-muted text-[14px] leading-relaxed max-w-[320px] mx-auto mb-6">
        Your profile is at the top of Discover. More people are seeing you right now.
      </p>

      <div className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/[0.06] border border-white/10">
        <Clock size={15} strokeWidth={2.4} className="text-amber-400" />
        <span className="text-cream text-[16px] font-bold tabular-nums">{mm}:{ss}</span>
        <span className="text-muted text-[12.5px]">left</span>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 text-emerald-400">
        <Check size={16} strokeWidth={3} />
        <span className="text-[13px] font-semibold">
          {justStarted ? 'Boost started' : 'Active'}
        </span>
      </div>
    </div>
  )
}
