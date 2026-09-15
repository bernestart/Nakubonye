import { useEffect, useState } from 'react'
import { X, Zap, Coins, ShoppingBag } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWallet } from '../lib/wallet'
import { tap } from '../lib/haptic'

export default function SuperRequestModal({ open, onClose, target, onSuccess }) {
  const nav = useNavigate()
  const { balance, refresh } = useWallet()

  const [cost, setCost] = useState(null)
  const [loadingCost, setLoadingCost] = useState(true)
  const [state, setState] = useState('confirm') // confirm | sending | insufficient | success
  const [error, setError] = useState('')

  // Fetch the live cost once when the modal opens
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingCost(true)
    ;(async () => {
      const { data, error: err } = await supabase
        .from('coin_config')
        .select('value')
        .eq('key', 'super_request_cost')
        .single()
      if (cancelled) return
      if (err || !data) {
        setError('Could not load price. Try again.')
        setLoadingCost(false)
        return
      }
      setCost(Number(data.value))
      setLoadingCost(false)
    })()
    return () => { cancelled = true }
  }, [open])

  // Reset state every time the modal is reopened
  useEffect(() => {
    if (open) { setState('confirm'); setError('') }
  }, [open, target?.id])

  if (!open || !target) return null

  const after = cost != null ? Math.max(0, balance - cost) : 0
  const canAfford = cost != null && balance >= cost

  async function send() {
    if (!cost) return
    setState('sending'); setError('')
    tap('medium')

    const { error: err } = await supabase.rpc('send_super_request', {
      p_recipient_id: target.id,
      p_message: null,
    })

    if (err) {
      if (/insufficient/i.test(err.message)) {
        setState('insufficient')
      } else {
        setError(err.message)
        setState('confirm')
      }
      return
    }

    await refresh()
    setState('success')
    tap('match')
    setTimeout(() => { onSuccess?.() }, 1200)
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-end sm:place-items-center bg-obsidian/85 backdrop-blur-md">
      <div className="w-full max-w-[480px] bg-surface rounded-t-[28px] sm:rounded-[28px] border border-white/10 p-6 relative overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[340px] h-[340px] rounded-full bg-purple-600/30 blur-[80px] pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full grid place-items-center text-muted z-10"
          aria-label="Close"
        >
          <X size={18} strokeWidth={2.4} />
        </button>

        {state === 'success' ? (
          <div className="relative text-center py-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center mx-auto mb-4 shadow-[0_0_30px_rgba(124,58,237,0.6)]">
              <Zap size={28} strokeWidth={2.6} className="text-white" fill="currentColor" />
            </div>
            <h3 className="text-cream font-extrabold text-[20px] mb-2">Super request sent</h3>
            <p className="text-muted text-[13.5px] px-6">
              {target.display_name || 'They'} will see it at the top of their likes.
            </p>
          </div>
        ) : state === 'insufficient' ? (
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 grid place-items-center mx-auto mb-4">
              <Coins size={24} strokeWidth={2} className="text-red-400" />
            </div>
            <h3 className="text-cream font-extrabold text-[18px] text-center mb-2">
              Not enough coins
            </h3>
            <p className="text-muted text-[13.5px] text-center mb-5 px-4">
              You need {Math.max(0, (cost || 0) - balance)} more coin{Math.max(0, (cost || 0) - balance) === 1 ? '' : 's'} to send a Super request.
            </p>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/8 mb-5">
              <div>
                <p className="text-subtle text-[11px] font-medium">Your balance</p>
                <p className="text-cream text-[18px] font-bold">{balance} coins</p>
              </div>
              <div className="text-right">
                <p className="text-subtle text-[11px] font-medium">Needed</p>
                <p className="text-red-400 text-[18px] font-bold">{cost} coins</p>
              </div>
            </div>

            <button
              onClick={() => { onClose(); nav('/wallet') }}
              className="w-full h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-[14.5px] flex items-center justify-center gap-2 shadow-[0_10px_28px_rgba(124,58,237,0.5)] mb-2"
            >
              <ShoppingBag size={17} strokeWidth={2.4} />
              Get coins
            </button>
            <button
              onClick={onClose}
              className="w-full h-11 text-muted font-semibold text-[13.5px]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center mx-auto mb-4 shadow-[0_8px_24px_rgba(124,58,237,0.5)]">
              <Zap size={24} strokeWidth={2.6} className="text-white" fill="currentColor" />
            </div>
            <h3 className="text-cream font-extrabold text-[18px] text-center mb-1.5">
              Send a Super request?
            </h3>
            <p className="text-muted text-[13.5px] text-center mb-5 px-4">
              {target.display_name || 'This person'} will see your request at the top of their likes — a stronger signal than a normal like.
            </p>

            {loadingCost ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-white/[0.03] border border-white/8 divide-y divide-white/8 mb-5">
                  <Row label="Cost" value={`${cost} coins`} />
                  <Row label="Your balance" value={`${balance} coins`} />
                  <Row label="After sending" value={canAfford ? `${after} coins` : '—'} highlight={canAfford} />
                </div>

                {error && (
                  <div className="mb-3 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  onClick={send}
                  disabled={state === 'sending' || !canAfford}
                  className="w-full h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-[14.5px] shadow-[0_10px_28px_rgba(124,58,237,0.5)] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Zap size={16} strokeWidth={2.6} fill="currentColor" />
                  {state === 'sending' ? 'Sending…' : canAfford ? `Send for ${cost} coins` : 'Not enough coins'}
                </button>
                <button
                  onClick={onClose}
                  disabled={state === 'sending'}
                  className="w-full h-11 text-muted font-semibold text-[13.5px] disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-muted text-[13px] font-medium">{label}</span>
      <span className={`text-[14px] font-bold ${highlight ? 'text-emerald-400' : 'text-cream'}`}>
        {value}
      </span>
    </div>
  )
}
