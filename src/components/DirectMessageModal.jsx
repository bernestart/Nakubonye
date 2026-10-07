import { useEffect, useState } from 'react'
import { X, Send } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { tap } from '../lib/haptic'

export default function DirectMessageModal({ open, onClose, target, onSuccess }) {
  const nav = useNavigate()
  const [text, setText] = useState('')
  const [state, setState] = useState('compose')   // compose | sending | success
  const [sendResult, setSendResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setText(''); setState('compose'); setError('')
  }, [open, target?.id])

  if (!open || !target) return null

  const trimmed = text.trim()
  const canSend = trimmed.length > 0 && state === 'compose'

  async function send() {
    if (!trimmed) return
    setState('sending'); setError(''); tap('medium')

    const { data, error: err } = await supabase.rpc('send_direct_message', {
      p_recipient_id: target.id,
      p_first_message: trimmed,
    })

    if (err) {
      setError(err.message)
      setState('compose')
      return
    }

    const row = Array.isArray(data) ? data[0] : data
    setSendResult({
      conversation_id: row?.conversation_id,
    })
    setState('success')
    tap('match')

    setTimeout(() => {
      onSuccess?.(row?.conversation_id)
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
            <p className="text-muted text-[13.5px] px-6">Opening your conversation…</p>
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
              This starts a conversation right away.
            </p>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder={`Say something real to ${target.display_name || 'them'}…`}
              className="w-full bg-elevated border border-white/8 rounded-2xl px-4 py-3 text-cream text-[14.5px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none mb-3"
            />

            {error && (
              <div className="mb-3 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <button
              onClick={send}
              disabled={!canSend}
              className="w-full h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-[14.5px] shadow-[0_10px_28px_rgba(124,58,237,0.5)] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={16} strokeWidth={2.6} />
              {state === 'sending' ? 'Sending…' : trimmed.length === 0 ? 'Write a message first' : 'Send'}
            </button>
            <button
              onClick={onClose}
              disabled={state === 'sending'}
              className="w-full h-11 text-muted font-semibold text-[13.5px] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
