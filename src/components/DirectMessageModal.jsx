import { useEffect, useState } from 'react'
import { X, Send, Coins, ShoppingBag } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWallet } from '../lib/wallet'
import { tap } from '../lib/haptic'

export default function DirectMessageModal({ open, onClose, target, onSuccess }) {
  const nav = useNavigate()
  const { balance, refresh } = useWallet()

  const [cost, setCost] = useState(null)
  const [loadingCost, setLoadingCost] = useState(true)
  const [text, setText] = useState('')
  const [state, setState] = useState('compose')
  const [sendResult, setSendResult] = useState(null) // compose | sending | insufficient | success
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingCost(true); setText(''); setState('compose'); setError('')
    ;(async () => {
      const { data, error: err } = await supabase
        .from('coin_config')
        .select('value')
        .eq('key', 'direct_message_cost')
        .single()
      if (cancelled) return
      if (err || !data) {
        setError('Could not load price.')
        setLoadingCost(false)
        return
      }
      setCost(Number(data.value))
      setLoadingCost(false)
    })()
    return () => { cancelled = true }
  }, [open, target?.id])

  if (!open || !target) return null

  const trimmed = text.trim()
  const canSend = trimmed.length > 0 && cost != null && balance >= cost

  async function send() {
    if (!trimmed || !cost) return
    setState('sending'); setError('')
    tap('medium')

    const { data, error: err } = await supabase.rpc('send_direct_message', {
      p_recipient_id: target.id,
      p_first_message: trimmed,
    })

    if (err) {
      if (/insufficient/i.test(err.message)) {
        setState('insufficient')
      } else {
        setError(err.message)
        setState('compose')
      }
      return
    }

    const row = Array.isArray(data) ? data[0] : data
    setSendResult({
      wasFree: !!row?.was_free,
      cost: Number(row?.cost ?? 0),
      balance: Number(row?.new_balance ?? 0),
    })

    await refresh()
    setState('success')
    tap('match')

    const conversationId = row?.conversation_id || data?.[0]?.conversation_id || data?.conversation_id
    setTimeout(() => {
      onSuccess?.(conversationId)
    }, 1400)
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
              <Send size={26} strokeWidth={2.6} className="text-white" />
            </div>
            <h3 className="text-cream font-extrabold text-[20px] mb-2">Message sent</h3>
            <p className="text-muted text-[13.5px] px-6">
              {sendResult?.wasFree
                ? 'Free with Premium ✨'
                : sendResult?.cost
                  ? `${sendResult.cost} coins · balance now ${sendResult.balance}`
                  : 'Opening your conversation…'}
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
              You need {Math.max(0, (cost || 0) - balance)} more coin{Math.max(0, (cost || 0) - balance) === 1 ? '' : 's'} to send this direct message.
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
            <button onClick={onClose} className="w-full h-11 text-muted font-semibold text-[13.5px]">
              Cancel
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center mx-auto mb-4 shadow-[0_8px_24px_rgba(124,58,237,0.5)]">
              <Send size={24} strokeWidth={2.6} className="text-white" />
            </div>
            <h3 className="text-cream font-extrabold text-[18px] text-center mb-1.5">
              Message {target.display_name || target.username || 'them'}
            </h3>
            <p className="text-muted text-[13.5px] text-center mb-5 px-4">
              You're not matched yet. Sending a direct message opens a chat right away.
            </p>

            {loadingCost ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder={`Say something real to ${target.display_name || 'them'}…`}
                  className="w-full bg-elevated border border-white/8 rounded-2xl px-4 py-3 text-cream text-[14.5px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none mb-3"
                />

                <div className="rounded-2xl bg-white/[0.03] border border-white/8 divide-y divide-white/8 mb-5">
                  <Row label="Cost" value={`${cost} coins`} />
                  <Row label="Your balance" value={`${balance} coins`} />
                  <Row label="After sending" value={canSend || balance >= cost ? `${Math.max(0, balance - cost)} coins` : '—'} highlight={balance >= cost} />
                </div>

                {error && (
                  <div className="mb-3 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  onClick={send}
                  disabled={state === 'sending' || !canSend}
                  className="w-full h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-[14.5px] shadow-[0_10px_28px_rgba(124,58,237,0.5)] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send size={16} strokeWidth={2.6} />
                  {state === 'sending' ? 'Sending…' : balance < cost ? 'Not enough coins' : trimmed.length === 0 ? 'Write a message first' : `Send for ${cost} coins`}
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
