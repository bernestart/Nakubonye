import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Key, Mail, Check, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'
import BrandGlow from '../components/BrandGlow'

export default function AccountSecurity() {
  const nav = useNavigate()
  const { session } = useAuth()

  // Password section
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)
  const [pwErr, setPwErr] = useState('')
  const [pwOk, setPwOk] = useState(false)

  // Email section
  const [newEmail, setNewEmail] = useState('')
  const [emailPw, setEmailPw] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailErr, setEmailErr] = useState('')
  const [emailOk, setEmailOk] = useState(false)

  async function changePassword() {
    setPwErr(''); setPwOk(false)
    if (!currentPw) { setPwErr('Enter your current password'); return }
    if (newPw.length < 6) { setPwErr('New password must be at least 6 characters'); return }
    if (newPw !== confirmPw) { setPwErr('Passwords do not match'); return }
    if (!session?.user?.email) { setPwErr('Session expired. Please log in again.'); return }

    setPwBusy(true); tap('light')

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPw,
    })
    if (signInErr) { setPwBusy(false); setPwErr('Current password is incorrect'); return }

    const { error: updErr } = await supabase.auth.updateUser({ password: newPw })
    setPwBusy(false)
    if (updErr) { setPwErr(updErr.message); return }

    setPwOk(true); setCurrentPw(''); setNewPw(''); setConfirmPw('')
    setTimeout(() => setPwOk(false), 3000)
  }

  async function changeEmail() {
    setEmailErr(''); setEmailOk(false)
    const em = newEmail.trim().toLowerCase()
    if (!em.includes('@')) { setEmailErr('Enter a valid email'); return }
    if (em === (session?.user?.email || '').toLowerCase()) { setEmailErr('That is already your email'); return }
    if (!emailPw) { setEmailErr('Enter your password to confirm'); return }
    if (!session?.user?.email) { setEmailErr('Session expired. Please log in again.'); return }

    setEmailBusy(true); tap('light')

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: emailPw,
    })
    if (signInErr) { setEmailBusy(false); setEmailErr('Password is incorrect'); return }

    const { error: updErr } = await supabase.auth.updateUser(
      { email: em },
      { emailRedirectTo: window.location.origin + '/settings/security' }
    )
    setEmailBusy(false)
    if (updErr) { setEmailErr(updErr.message); return }

    setEmailOk(true); setNewEmail(''); setEmailPw('')
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow variant="default" />

      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Account & security</span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-10">
        {/* Current email */}
        <div className="mb-6">
          <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
            Signed in as
          </p>
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/8">
            <Mail size={16} className="text-muted shrink-0" />
            <span className="text-cream text-[14px] truncate">{session?.user?.email}</span>
          </div>
        </div>

        {/* Password section */}
        <div className="mb-6">
          <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
            Change password
          </p>
          <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4 flex flex-col gap-3">
            <div>
              <label className="block text-muted text-[12px] font-semibold mb-1.5">Current password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Your current password"
                autoComplete="current-password"
                disabled={pwBusy}
                className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-muted text-[12px] font-semibold mb-1.5">New password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  disabled={pwBusy}
                  className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 pr-11 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center text-muted"
                  aria-label={showPw ? 'Hide' : 'Show'}
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-muted text-[12px] font-semibold mb-1.5">Confirm new password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Type it again"
                autoComplete="new-password"
                disabled={pwBusy}
                className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
            </div>

            {pwErr && (
              <div className="flex items-start gap-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{pwErr}</span>
              </div>
            )}
            {pwOk && (
              <div className="flex items-start gap-2 text-emerald-300 text-[12.5px] bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2.5">
                <Check size={14} className="shrink-0 mt-0.5" />
                <span>Password updated ✓</span>
              </div>
            )}

            <button
              type="button"
              onClick={changePassword}
              disabled={pwBusy}
              className="w-full h-11 rounded-full text-white font-bold text-[14px] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
            >
              <Key size={15} strokeWidth={2.4} />
              {pwBusy ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </div>

        {/* Email section */}
        <div className="mb-6">
          <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
            Change email
          </p>
          <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4 flex flex-col gap-3">
            <div>
              <label className="block text-muted text-[12px] font-semibold mb-1.5">New email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={emailBusy}
                className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-muted text-[12px] font-semibold mb-1.5">Confirm with your password</label>
              <input
                type="password"
                value={emailPw}
                onChange={(e) => setEmailPw(e.target.value)}
                placeholder="Your current password"
                autoComplete="current-password"
                disabled={emailBusy}
                className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
            </div>

            {emailErr && (
              <div className="flex items-start gap-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{emailErr}</span>
              </div>
            )}
            {emailOk && (
              <div className="flex items-start gap-2 text-emerald-300 text-[12.5px] bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2.5">
                <Check size={14} className="shrink-0 mt-0.5" />
                <span>
                  Confirmation sent to <strong>{newEmail || 'your new email'}</strong>.
                  Click the link in that email to finish the change.
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={changeEmail}
              disabled={emailBusy}
              className="w-full h-11 rounded-full bg-white/[0.06] border border-white/12 text-cream font-bold text-[14px] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Mail size={15} strokeWidth={2.4} />
              {emailBusy ? 'Sending…' : 'Change email'}
            </button>
          </div>

          <p className="text-subtle text-[11.5px] mt-2 leading-relaxed">
            You'll get a confirmation link at the new address. Until you click it, your current email stays active.
          </p>
        </div>
      </div>
    </div>
  )
}
