import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ForgotPasswordModal({ onClose, initialEmail }) {
  const [email, setEmail] = useState(initialEmail || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setEmail(initialEmail || '')
  }, [initialEmail])

  async function submit() {
    setErr('')
    const em = email.trim().toLowerCase()
    if (!em.includes('@')) { setErr('Please enter a valid email.'); return }

    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(em, {
      redirectTo: window.location.origin + '/reset-password',
    })
    setBusy(false)

    if (error) { setErr(error.message); return }
    setDone(true)
  }

  return (
    <div
      onClick={() => !busy && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(11,11,20,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'grid', placeItems: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380,
          background: '#161B26',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.1)',
          padding: 24,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-cream font-extrabold text-[18px]">
            {done ? 'Check your email' : 'Reset your password'}
          </h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="w-8 h-8 rounded-full grid place-items-center text-muted disabled:opacity-40"
            aria-label="Close"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        {done ? (
          <div>
            <p className="text-muted text-[13.5px] leading-relaxed mb-5">
              We sent a reset link to <strong className="text-cream">{email.trim().toLowerCase()}</strong>.
              Click the link in that email to set a new password.
            </p>
            <p className="text-subtle text-[11.5px] leading-relaxed mb-5">
              Didn't get it? Check your spam folder. The link expires in 1 hour.
            </p>
            <button
              onClick={onClose}
              className="w-full h-11 rounded-full text-white font-bold text-[14px]"
              style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            <p className="text-muted text-[13.5px] leading-relaxed mb-5">
              Enter the email you signed up with. We'll send you a link to set a new password.
            </p>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={busy}
              className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-cream text-[15px] placeholder:text-subtle focus:outline-none focus:border-purple-500 disabled:opacity-50 mb-4"
            />

            {err && (
              <div className="mb-4 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
                {err}
              </div>
            )}

            <button
              onClick={submit}
              disabled={busy || !email.trim()}
              className="w-full h-12 rounded-full text-white font-bold text-[14.5px] disabled:opacity-50 mb-2"
              style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
            >
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
            <button
              onClick={onClose}
              disabled={busy}
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
