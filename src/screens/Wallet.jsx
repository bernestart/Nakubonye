import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Sparkles, Plus, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import BrandGlow from '../components/BrandGlow'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useWallet } from '../lib/wallet'

const PACKAGES = [
  { key: 'starter', name: 'Starter', coins: 100, bonus: 0, price: '$1.99', label: '' },
  { key: 'popular', name: 'Popular', coins: 500, bonus: 50, price: '$7.99', label: 'MOST POPULAR' },
  { key: 'value',   name: 'Value',   coins: 1200, bonus: 200, price: '$17.99', label: 'BEST VALUE' },
  { key: 'premium', name: 'Premium', coins: 3000, bonus: 600, price: '$39.99', label: '' },
]

export default function Wallet() {
  const nav = useNavigate()
  const { session } = useAuth()
  const { balance, lifetimeEarned, lifetimeSpent, loading: walletLoading, error: walletError, refresh } = useWallet()

  const [txs, setTxs] = useState([])
  const [loadingTxs, setLoadingTxs] = useState(true)
  const [error, setError] = useState('')

  const loadTxs = useCallback(async () => {
    if (!session?.user?.id) return
    setLoadingTxs(true); setError('')
    const { data, error: err } = await supabase
      .from('coin_transactions')
      .select('id, amount, transaction_type, description, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (err) { setError(err.message); setLoadingTxs(false); return }
    setTxs(data || [])
    setLoadingTxs(false)
  }, [session?.user?.id])

  useEffect(() => { loadTxs() }, [loadTxs])

  function buyPack(pack) {
    // Real payment provider integration is not yet wired.
    // Show an honest modal instead of faking success.
    alert(
      `Real payments aren't connected yet.\n\n` +
      `${pack.name}: ${pack.coins + pack.bonus} coins for ${pack.price}.\n\n` +
      `When Stripe (or another provider) is connected, this button will open checkout. ` +
      `For now you can use the 50 free coins from signup.`
    )
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />
      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2 border-b border-white/8">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Wallet</span>
        <div className="flex-1" />
        <button
          onClick={() => { refresh(); loadTxs() }}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Refresh"
        >
          <RefreshCw size={17} strokeWidth={2.3} />
        </button>
      </header>

      {(error || walletError) && (
        <div className="mx-3 mt-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 shrink-0">
          {error || walletError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-8">
        {/* Balance card */}
        <div className="rounded-3xl overflow-hidden relative p-5 mb-6"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 50%, #EC4899 100%)' }}
        >
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4) 0%, transparent 40%)'
          }} />
          <div className="relative">
            <p className="text-white/80 text-[11px] font-black tracking-[0.16em] uppercase mb-2">
              Your balance
            </p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-white text-[42px] leading-none font-extrabold tracking-tight">
                {walletLoading ? '—' : balance.toLocaleString()}
              </span>
              <span className="text-white/85 text-[15px] font-bold">coins</span>
            </div>
            <div className="flex gap-4 text-white/85 text-[11.5px] font-medium">
              <span>Earned {lifetimeEarned.toLocaleString()}</span>
              <span>·</span>
              <span>Spent {lifetimeSpent.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Coin packages */}
        <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
          Buy coins
        </p>
        <div className="grid grid-cols-2 gap-3 mb-7">
          {PACKAGES.map((p) => {
            const total = p.coins + p.bonus
            return (
              <button
                key={p.key}
                onClick={() => buyPack(p)}
                className="relative rounded-2xl p-4 bg-surface border border-white/8 hover:border-purple-500/40 transition-colors text-left"
              >
                {p.label && (
                  <span className={`absolute -top-2 left-3 px-2 py-0.5 rounded-full text-[8.5px] font-black tracking-wide ${
                    p.label === 'MOST POPULAR' ? 'bg-purple-600 text-white' : 'bg-pink-500 text-white'
                  }`}>
                    {p.label}
                  </span>
                )}
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles size={13} strokeWidth={2.4} className="text-purple-400" />
                  <span className="text-cream font-bold text-[14px]">{p.name}</span>
                </div>
                <p className="text-cream text-[20px] font-extrabold tracking-tight">
                  {total.toLocaleString()}
                </p>
                {p.bonus > 0 && (
                  <p className="text-purple-400 text-[10.5px] font-semibold">
                    {p.coins} + {p.bonus} bonus
                  </p>
                )}
                <p className="text-muted text-[12px] mt-2 font-medium">{p.price}</p>
              </button>
            )
          })}
        </div>

        {/* Transactions */}
        <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
          Recent activity
        </p>

        {loadingTxs ? (
          <div className="flex flex-col gap-2">
            {[0,1,2].map((i) => (
              <div key={i} className="h-14 rounded-2xl bg-surface animate-pulse" />
            ))}
          </div>
        ) : txs.length === 0 ? (
          <div className="text-center py-10 px-6">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] grid place-items-center mx-auto mb-3">
              <Clock size={20} strokeWidth={2} className="text-muted" />
            </div>
            <p className="text-cream font-semibold text-[14.5px] mb-1">No activity yet</p>
            <p className="text-muted text-[12.5px]">Your coin history will appear here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {txs.map((t) => {
              const positive = t.amount > 0
              return (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-white/6">
                  <div className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${
                    positive ? 'bg-emerald-500/15' : 'bg-red-500/15'
                  }`}>
                    {positive
                      ? <TrendingUp size={16} strokeWidth={2.4} className="text-emerald-400" />
                      : <TrendingDown size={16} strokeWidth={2.4} className="text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream text-[13.5px] font-semibold truncate">
                      {t.description || humanizeType(t.transaction_type)}
                    </p>
                    <p className="text-subtle text-[11px] font-medium">
                      {new Date(t.created_at).toLocaleString([], {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className={`text-[14px] font-bold shrink-0 ${
                    positive ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {positive ? '+' : ''}{t.amount}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function humanizeType(t) {
  return (t || '').split('_').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ')
}
