import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import BrandGlow from '../components/BrandGlow'

export default function ResetPassword() {
  const nav = useNavigate()

  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Supabase parses the #access_token in the URL automatically when
    // detectSessionInUrl is true (default). So we just need to check if
    // a session is now present.
    const check = async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setHasSession(!!data.session)
      setChecking(false)
    }

    // Wait a tick so Supabase can parse the URL hash
    setTimeout(check, 400)

    return () => { cancelled = true }
  }, [])

  async function submit() {
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)

    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => nav('/discover', { replace: true }), 1500)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow variant="default" />

      <div className="flex-1 flex flex-col justify-center px-7">
        {checking ? (
          <div className="text-center text-muted text-[13px]">Checking link…</div>
        ) : !hasSession ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-3xl bg-red-500/15 border border-red-500/30 grid place-items-center mx-auto mb-5">
              <AlertTriangle size={26} strokeWidth={2.2} className="text-red-400" />
            </div>
            <h1 className="text-cream text-[22px] font-extrabold tracking-tight mb-3">
              Link expired or invalid
            </h1>
            <p className="text-muted text-[14px] leading-relaxed mb-6 max-w-[320px] mx-auto">
              This password reset link has already been used, or it's older than 1 hour.
              Please request a new one.
            </p>
            <button
              onClick={() => nav('/signin', { replace: true })}
              className="h-12 px-6 rounded-full text-white font-bold text-[14.5px]"
              style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
            >
              Back to sign in
            </button>
          </div>
        ) : done ? (
          <div className="text-center">
            <div
              className="w-20 h-20 rounded-3xl grid place-items-center mx-auto mb-6"
              style={{
                background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)',
                boxShadow: '0 16px 44px rgba(168,85,247,0.6)',
              }}
            >
              <Check size={40} strokeWidth={3} className="text-white" />
            </div>
            <h1 className="text-cream text-[22px] font-extrabold tracking-tight mb-2">
              Password updated
            </h1>
            <p className="text-muted text-[14px] leading-relaxed">
              Signing you in…
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-7">
              <div
                className="w-16 h-16 rounded-3xl grid place-items-center mx-auto mb-4"
                style={{
                  background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)',
                  boxShadow: '0 12px 36px rgba(168,85,247,0.5)',
                }}
              >
                <span className="text-white font-black text-2xl">N</span>
              </div>
              <h1 className="text-cream text-[24px] font-extrabold tracking-tight mb-2">
                Set a new password
              </h1>
              <p className="text-muted text-[14px]">
                Choose something you'll remember.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-white/70 text-[12.5px] font-semibold mb-2">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    disabled={busy}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 pr-12 text-white text-[15px] placeholder:text-white/30 focus:outline-none focus:border-purple-500/70 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center text-muted"
                    aria-label={showPw ? 'Hide' : 'Show'}
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-white/70 text-[12.5px] font-semibold mb-2">
                  Confirm password
                </label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Type it again"
                  autoComplete="new-password"
                  disabled={busy}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white text-[15px] placeholder:text-white/30 focus:outline-none focus:border-purple-500/70 disabled:opacity-50"
                />
              </div>

              {error && (
                <div className="text-red-300 text-[13px] bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="w-full h-12 rounded-full text-white font-bold text-[15px] disabled:opacity-60 mt-2"
                style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
              >
                {busy ? 'Saving…' : 'Set new password'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
