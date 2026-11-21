import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { API_BASE_URL } from '../lib/api'

// Facebook-style login + forgot password (Email OTP). Better Auth + Worker only.
const GRAD = { background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }
const INPUT = 'w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white text-[15px] placeholder:text-white/30 outline-none focus:border-purple-400/60'

async function postJson(path, body) {
  const r = await fetch(API_BASE_URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => null)
  return { ok: r.ok, data }
}

export default function SignIn() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [mode, setMode] = useState('login') // login | forgot | reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [newPw, setNewPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const em = email.trim().toLowerCase()

  async function submit(e) {
    e.preventDefault()
    setError(''); setInfo(''); setLoading(true)
    try {
      if (mode === 'login') {
        try {
          await signIn(em, password)
          navigate('/feed', { replace: true })
        } catch (err) {
          setError(String(err && err.message).includes('fetch') ? 'Check your connection and try again.' : 'The email or password you entered is incorrect.')
        }
      } else if (mode === 'forgot') {
        await postJson('/api/auth/email-otp/send-verification-otp', { email: em, type: 'forget-password' })
        setInfo('If an account exists for that email, we sent a code.')
        setMode('reset')
      } else {
        const r = await postJson('/api/auth/email-otp/reset-password', { email: em, otp: code, password: newPw })
        if (!r.ok) { setError('That code is invalid or expired.'); return }
        setCode(''); setNewPw(''); setPassword('')
        setInfo('Password updated. Log in with your new password.')
        setMode('login')
      }
    } finally { setLoading(false) }
  }

  const titles = { login: 'Log in to Nakubonye', forgot: 'Find your account', reset: 'Choose a new password' }
  const canSubmit = mode === 'login' ? em && password : mode === 'forgot' ? em : em && code.length === 6 && newPw.length >= 8

  return (
    <div className="min-h-screen bg-obsidian flex flex-col px-7 py-8 relative">
      {mode !== 'login' && (
        <button type="button" onClick={() => { setMode('login'); setError(''); setInfo('') }} className="absolute top-6 left-6 text-white/60 hover:text-white"><ArrowLeft size={24} /></button>
      )}
      <div className="mt-14 mb-8 text-center">
        <div className="w-[60px] h-[60px] mx-auto rounded-[18px] flex items-center justify-center mb-4 shadow-lg shadow-purple-900/40" style={{ background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)' }}>
          <span className="text-white font-black text-[28px] leading-none">N</span>
        </div>
        <h1 className="text-white text-[26px] leading-tight font-black tracking-tight">{titles[mode]}</h1>
        {mode === 'forgot' && <p className="text-purple-100/65 text-[14px] mt-2">Enter your email and we will send you a code.</p>}
      </div>

      <div className="w-full max-w-[400px] mx-auto">
        {error && <div className="text-red-300 text-[13px] bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 mb-4">{error}</div>}
        {info && <div className="text-emerald-200 text-[13px] bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-3 mb-4">{info}</div>}

        <form onSubmit={submit} className="space-y-3">
          <input className={INPUT} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          {mode === 'login' && <input className={INPUT} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />}
          {mode === 'reset' && (
            <>
              <input className={INPUT + ' text-center tracking-[0.3em]'} inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              <input className={INPUT} type="password" placeholder="New password (8+ characters)" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </>
          )}
          <button type="submit" disabled={!canSubmit || loading} className="w-full text-white font-bold text-[16px] rounded-full py-[15px] disabled:opacity-40 active:scale-[0.98] transition-transform" style={GRAD}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : mode === 'forgot' ? 'Send code' : 'Update password'}
          </button>
        </form>

        {mode === 'login' && (
          <>
            <button type="button" onClick={() => { setMode('forgot'); setError(''); setInfo('') }} className="block mx-auto mt-5 text-purple-300 text-[13.5px] font-semibold">Forgot password?</button>
            <div className="flex items-center gap-3 my-6"><div className="flex-1 h-px bg-white/10" /><span className="text-white/40 text-[12px]">or</span><div className="flex-1 h-px bg-white/10" /></div>
            <button type="button" onClick={() => navigate('/signup')} className="w-full text-purple-200 font-bold text-[15px] rounded-full py-[14px] border border-purple-400/50 active:scale-[0.98] transition-transform">Create new account</button>
          </>
        )}
      </div>
    </div>
  )
}
