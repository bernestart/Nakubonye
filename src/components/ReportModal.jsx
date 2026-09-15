import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const REASONS = [
  { value: 'fake_profile',   label: 'Fake profile / catfishing' },
  { value: 'harassment',     label: 'Harassment or bullying' },
  { value: 'scam',           label: 'Scam or asking for money' },
  { value: 'sexual_content', label: 'Unwanted sexual content' },
  { value: 'hate',           label: 'Hate speech or discrimination' },
  { value: 'threats',        label: 'Threats or violence' },
  { value: 'underage',       label: 'Underage concern' },
  { value: 'spam',           label: 'Spam' },
  { value: 'other',          label: 'Something else' },
]

export default function ReportModal({ open, onClose, target, onReported }) {
  const { session } = useAuth()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (!open) return null

  async function submit() {
    if (!reason) { setError('Please choose a reason.'); return }
    if (!session?.user?.id || !target?.id) { setError('Something is wrong.'); return }
    setBusy(true); setError('')

    const { error: err } = await supabase.from('reports').insert({
      reporter_id: session.user.id,
      reported_user_id: target.id,
      reason,
      details: details.trim() || null,
      status: 'pending',
    })

    setBusy(false)
    if (err) { setError(err.message); return }

    setDone(true)
    onReported?.()
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-end sm:place-items-center bg-obsidian/85 backdrop-blur-md">
      <div className="w-full max-w-[480px] bg-surface rounded-t-[28px] sm:rounded-[24px] border border-white/10 p-5 max-h-[90vh] overflow-y-auto">
        {done ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-purple-500/20 grid place-items-center mx-auto mb-4">
              <span className="text-2xl">✓</span>
            </div>
            <h3 className="text-cream font-extrabold text-[18px] mb-2">Report received</h3>
            <p className="text-muted text-[13.5px] mb-6 px-6">
              Our team will review this. The person you reported won't know it was you.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-full bg-purple-600 text-white font-bold text-[13.5px]"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-cream font-extrabold text-[17px]">
                Report {target?.display_name || target?.username || 'user'}
              </h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center text-muted" aria-label="Close">
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <p className="text-muted text-[13px] mb-4">
              Your report is anonymous. This person will not be told you reported them.
            </p>

            <div className="flex flex-col gap-2 mb-4">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`text-left px-4 py-3 rounded-2xl border text-[14px] font-medium transition-colors ${
                    reason === r.value
                      ? 'bg-purple-600/20 border-purple-500 text-cream'
                      : 'bg-white/[0.03] border-white/8 text-muted'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Anything else we should know? (optional)"
              className="w-full bg-elevated border border-white/8 rounded-2xl px-4 py-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none mb-4"
            />

            {error && (
              <div className="mb-3 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={busy || !reason}
              className="w-full h-12 rounded-full bg-danger text-white font-bold text-[14.5px] disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Submit report'}
            </button>
            <button
              onClick={onClose}
              className="w-full h-11 text-muted font-semibold text-[13.5px]"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
