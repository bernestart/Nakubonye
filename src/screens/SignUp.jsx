import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { API_BASE_URL } from '../lib/api'

// Meta-style create-account wizard: one question per screen, resumable. Better Auth + Worker + Neon only.
const MIN_AGE = 13 // keep equal to MIN_AGE in backend/_worker.js
const ALLOW_SKIP_CODE = true // set false once email delivery is confirmed
const SAVE_KEY = 'nk_signup'
const ALL = ['name', 'birthday', 'gender', 'email', 'password', 'otp', 'username']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const USERNAME_RE = /^[a-z0-9._]{3,30}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GRAD = { background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }
const INPUT = 'w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white text-[15px] placeholder:text-white/30 outline-none focus:border-purple-400/60'
const ERR = {
  UNDER_MIN_AGE: 'You must be at least ' + MIN_AGE + ' years old to use Nakubonye.',
  USERNAME_TAKEN: 'That username is taken. Try another one.',
  INVALID_USERNAME: 'Usernames use letters, numbers, dots and underscores (3-30 characters).',
  INVALID_DOB: 'Please check your birthday.',
  INVALID_NAME: 'Please check your name.',
  UNAUTHENTICATED: 'Your session expired. Please log in again.',
  LEGACY_ACCOUNT_ID: 'This account is no longer supported. Please create a new one.',
}
const TEXT = {
  name: ["What's your name?", 'Enter the name you use in real life.'],
  birthday: ["What's your birthday?", 'Your birthday is not shown publicly unless you choose to.'],
  gender: ["What's your gender?", 'You can change who sees this later.'],
  email: ["What's your email address?", "We'll send a code to confirm it."],
  password: ['Create a password', 'Use at least 8 characters. Do not reuse a password from another site.'],
  otp: ['Enter the confirmation code', ''],
  username: ['Choose your username', 'People can find you with this. You can change it later.'],
}

function loadSaved() { try { return JSON.parse(sessionStorage.getItem(SAVE_KEY)) || {} } catch (e) { return {} } }
function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '') }
function validDate(y, m, d) { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d }
function ageOf(y, m, d) {
  const now = new Date()
  let a = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--
  return a
}

export default function SignUp() {
  const navigate = useNavigate()
  const { user, profile, signUp, verifyOtp, refreshProfile } = useAuth()
  const saved = useMemo(loadSaved, [])
  const resuming = !!user && !profile?.username
  const [form, setForm] = useState(() => {
    const base = { firstName: '', surname: '', month: '', day: '', year: '', gender: '', email: '', password: '', username: '', ...(saved.form || {}) }
    base.password = ''
    if (resuming) {
      const parts = String(user.name || '').trim().split(' ')
      if (!base.firstName) base.firstName = parts[0] || ''
      if (!base.surname) base.surname = parts.slice(1).join(' ')
      base.email = user.email || base.email
    }
    return base
  })
  const [step, setStep] = useState(() => {
    if (resuming) return saved.step === 'username' ? 'username' : 'name'
    return saved.step && !['otp', 'username'].includes(saved.step) ? saved.step : 'name'
  })
  const [otp, setOtp] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [codeError, setCodeError] = useState('')
  const [cool, setCool] = useState(0)
  const [avail, setAvail] = useState(null)

  useEffect(() => {
    try { sessionStorage.setItem(SAVE_KEY, JSON.stringify({ step, form: { ...form, password: '' } })) } catch (e) { /* ignore */ }
  }, [step, form])

  useEffect(() => {
    if (cool <= 0) return
    const t = setTimeout(() => setCool(cool - 1), 1000)
    return () => clearTimeout(t)
  }, [cool])

  useEffect(() => {
    if (step === 'username' && !form.username) {
      const s = slug(form.firstName) + (form.surname ? '.' + slug(form.surname) : '')
      if (s.length >= 3) setForm((f) => ({ ...f, username: s }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  useEffect(() => {
    if (step !== 'username') return
    const u = form.username.trim().toLowerCase()
    if (!USERNAME_RE.test(u) || u.startsWith('.') || u.endsWith('.') || u.includes('..')) { setAvail(u ? 'invalid' : null); return }
    setAvail('checking')
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const r = await fetch(API_BASE_URL + '/api/username/available?u=' + encodeURIComponent(u))
        const j = await r.json()
        if (!cancelled) setAvail(j && j.available ? true : false)
      } catch (e) { if (!cancelled) setAvail(null) }
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [form.username, step])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const y = Number(form.year), m = Number(form.month), d = Number(form.day)
  const dobOk = !!(y && m && d && validDate(y, m, d))
  const age = dobOk ? ageOf(y, m, d) : null
  const uname = form.username.trim().toLowerCase()
  const email = form.email.trim().toLowerCase()
  const valid = ({
    name: form.firstName.trim().length > 0 && form.surname.trim().length > 0,
    birthday: dobOk && age >= MIN_AGE && age <= 120,
    gender: !!form.gender,
    email: EMAIL_RE.test(email),
    password: form.password.length >= 8,
    otp: otp.length === 6,
    username: avail === true,
  })[step]

  async function sendCode() {
    setCodeError('')
    try {
      const r = await fetch(API_BASE_URL + '/api/auth/email-otp/send-verification-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'email-verification' }),
      })
      if (!r.ok) throw new Error('send failed')
      setCool(30)
    } catch (e) { setCodeError("We couldn't send the code. Check the email address or try again.") }
  }

  async function next() {
    setError('')
    if (step === 'name') return setStep('birthday')
    if (step === 'birthday') return setStep('gender')
    if (step === 'gender') return setStep(user ? 'username' : 'email')
    if (step === 'email') return setStep('password')
    setLoading(true)
    try {
      if (step === 'password') {
        await signUp(email, form.password, (form.firstName + ' ' + form.surname).trim())
        setOtp(''); setStep('otp'); await sendCode()
      } else if (step === 'otp') {
        await verifyOtp(email, otp)
        setStep('username')
      } else if (step === 'username') {
        const mm = String(m).padStart(2, '0'), dd = String(d).padStart(2, '0')
        const r = await fetch(API_BASE_URL + '/api/profile/bootstrap', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName: form.firstName, lastName: form.surname, username: uname, dateOfBirth: y + '-' + mm + '-' + dd, gender: form.gender }),
        })
        const j = await r.json().catch(() => null)
        if (!r.ok || !j || !j.success) throw new Error(ERR[j && j.error] || 'Something went wrong. Please try again.')
        await refreshProfile()
        try { sessionStorage.removeItem(SAVE_KEY) } catch (e) { /* ignore */ }
        navigate('/feed', { replace: true })
      }
    } catch (e) { setError(e.message || 'Something went wrong') } finally { setLoading(false) }
  }

  const BACK = { birthday: 'name', gender: 'birthday', email: 'gender', password: 'email' }
  const canBack = step === 'name' || !!BACK[step]
  function back() { setError(''); if (step === 'name') navigate('/'); else setStep(BACK[step]) }
  const idx = ALL.indexOf(step)
  const pwHint = form.password.length === 0 ? '' : form.password.length < 8 ? 'At least 8 characters' : 'Looks good'

  return (
    <div className="min-h-screen bg-obsidian flex flex-col px-7 py-8">
      <div className="flex items-center gap-3 mb-8">
        {canBack ? (
          <button type="button" onClick={back} className="text-white/60 hover:text-white"><ArrowLeft size={24} /></button>
        ) : <div className="w-6" />}
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ ...GRAD, width: ((idx + 1) / ALL.length) * 100 + '%' }} />
        </div>
      </div>

      <div className="w-full max-w-[400px] mx-auto flex-1 flex flex-col">
        <h1 className="text-white text-[28px] leading-tight font-black tracking-tight mb-2">{TEXT[step][0]}</h1>
        <p className="text-purple-100/65 text-[14px] mb-6">
          {step === 'otp' ? 'We sent a 6-digit code to ' + email + '.' : TEXT[step][1]}
        </p>

        {error && <div className="text-red-300 text-[13px] bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 mb-4">{error}</div>}

        <form onSubmit={(e) => { e.preventDefault(); if (valid && !loading) next() }} className="space-y-4">
          {step === 'name' && (
            <div className="flex gap-3">
              <input className={INPUT} placeholder="First name" value={form.firstName} onChange={set('firstName')} autoFocus />
              <input className={INPUT} placeholder="Surname" value={form.surname} onChange={set('surname')} />
            </div>
          )}

          {step === 'birthday' && (
            <>
              <div className="flex gap-2">
                <select className={INPUT + ' w-1/2'} value={form.month} onChange={set('month')}>
                  <option value="" className="bg-obsidian">Month</option>
                  {MONTHS.map((n, i) => <option key={n} value={i + 1} className="bg-obsidian">{n}</option>)}
                </select>
                <select className={INPUT + ' w-1/4'} value={form.day} onChange={set('day')}>
                  <option value="" className="bg-obsidian">Day</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => <option key={n} value={n} className="bg-obsidian">{n}</option>)}
                </select>
                <select className={INPUT + ' w-1/4'} value={form.year} onChange={set('year')}>
                  <option value="" className="bg-obsidian">Year</option>
                  {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map((n) => <option key={n} value={n} className="bg-obsidian">{n}</option>)}
                </select>
              </div>
              {dobOk && age < MIN_AGE && <p className="text-red-300 text-[13px]">You must be at least {MIN_AGE} to use Nakubonye.</p>}
              {y && m && d && !dobOk && <p className="text-red-300 text-[13px]">That date does not exist.</p>}
            </>
          )}

          {step === 'gender' && ['female', 'male', 'custom'].map((g) => (
            <label key={g} className={'flex items-center justify-between rounded-2xl border px-4 py-4 cursor-pointer ' + (form.gender === g ? 'border-purple-400/70 bg-white/[0.07]' : 'border-white/10 bg-white/[0.04]')}>
              <span className="text-white text-[15px] capitalize">{g}</span>
              <input type="radio" name="gender" value={g} checked={form.gender === g} onChange={set('gender')} />
            </label>
          ))}

          {step === 'email' && <input className={INPUT} type="email" placeholder="Email address" value={form.email} onChange={set('email')} autoFocus />}

          {step === 'password' && (
            <>
              <div className="relative">
                <input className={INPUT} type={showPw ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={set('password')} autoFocus />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-300 text-[13px]">{showPw ? 'Hide' : 'Show'}</button>
              </div>
              {pwHint && <p className={'text-[13px] ' + (form.password.length < 8 ? 'text-white/50' : 'text-emerald-300')}>{pwHint}</p>}
            </>
          )}

          {step === 'otp' && (
            <>
              <input className={INPUT + ' text-center text-[28px] tracking-[0.4em]'} inputMode="numeric" maxLength={6} placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} autoFocus />
              {codeError && <p className="text-red-300 text-[13px]">{codeError}</p>}
              <div className="flex items-center justify-between text-[13.5px]">
                <button type="button" disabled={cool > 0} onClick={sendCode} className="text-purple-300 disabled:text-white/30">{cool > 0 ? 'Resend in ' + cool + 's' : 'Resend code'}</button>
                {ALLOW_SKIP_CODE && <button type="button" onClick={() => setStep('username')} className="text-white/50">Skip for now</button>}
              </div>
            </>
          )}

          {step === 'username' && (
            <>
              <input className={INPUT} placeholder="username" value={form.username} onChange={set('username')} autoCapitalize="none" autoFocus />
              {avail === 'checking' && <p className="text-white/50 text-[13px]">Checking...</p>}
              {avail === true && <p className="text-emerald-300 text-[13px]">@{uname} is available</p>}
              {avail === false && <p className="text-red-300 text-[13px]">That username is taken</p>}
              {avail === 'invalid' && <p className="text-white/50 text-[13px]">3-30 characters: letters, numbers, . and _</p>}
            </>
          )}

          <button type="submit" disabled={!valid || loading} className="mt-2 w-full text-white font-bold text-[16px] rounded-full py-[16px] disabled:opacity-40 active:scale-[0.98] transition-transform" style={GRAD}>
            {loading ? 'Please wait...' : step === 'username' ? 'Create account' : step === 'otp' ? 'Confirm' : 'Next'}
          </button>
        </form>

        {step === 'name' && (
          <div className="text-center pt-6">
            <Link to="/signin" className="text-purple-300 font-semibold text-[13.5px]">Already have an account?</Link>
          </div>
        )}
      </div>
    </div>
  )
}
