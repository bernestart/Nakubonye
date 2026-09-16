import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import BrandGlow from '../components/BrandGlow'

export default function SignIn() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const em = email.trim().toLowerCase()
    if (!em.includes('@')) return setError('Please enter a valid email.')
    if (!password) return setError('Please enter your password.')

    setBusy(true)
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: em,
      password,
    })
    setBusy(false)

    if (signInError) return setError(friendlyError(signInError))

    const userId = data.session.user.id
    const { data: prof } = await supabase
      .from('profiles')
      .select('date_of_birth, gender, bio, city')
      .eq('id', userId)
      .single()

    const { data: links } = await supabase
      .from('profile_interests')
      .select('interest_id')
      .eq('profile_id', userId)

    const complete =
      prof?.date_of_birth &&
      prof?.gender &&
      prof?.bio &&
      prof?.city &&
      (links?.length || 0) >= 3

    nav(complete ? '/discover' : '/onboarding', { replace: true })
  }

  return (
    <div className="mobile-shell flex flex-col relative overflow-hidden isolate">
      <BrandGlow />

      <header className="px-6 pt-8 pb-4 shrink-0">
        <Link to="/" className="text-white/60 text-[13.5px] font-medium hover:text-white/85">
          ← Back
        </Link>
      </header>

      <main className="flex-1 px-6 pb-6 overflow-y-auto">
        <div
          className="w-[52px] h-[52px] rounded-[16px] grid place-items-center mb-6"
          style={{
            background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)',
            boxShadow: '0 10px 30px rgba(168,85,247,0.45)',
          }}
        >
          <span className="text-white font-black text-[26px] leading-none">N</span>
        </div>

        <h1 className="text-white text-[30px] leading-[1.08] font-black tracking-tight mb-2">
          Welcome back
        </h1>
        <p className="text-purple-100/65 text-[14.5px] mb-8">
          Log in to continue meeting people.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-white/70 text-[12.5px] font-semibold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={busy}
              className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white text-[15px] placeholder:text-white/30 focus:outline-none focus:border-purple-500/70 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-white/70 text-[12.5px] font-semibold mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
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
            type="submit"
            disabled={busy}
            className="mt-2 w-full text-white font-bold text-[16px] rounded-full py-[16px] transition-transform active:scale-[0.98] disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)',
              boxShadow: '0 12px 36px rgba(236,72,153,0.5), 0 4px 14px rgba(168,85,247,0.35)',
            }}
          >
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="text-center text-white/55 text-[13.5px] mt-7">
          New here?{' '}
          <Link to="/signup" className="text-purple-300 font-semibold">
            Create an account
          </Link>
        </p>
      </main>
    </div>
  )
}
