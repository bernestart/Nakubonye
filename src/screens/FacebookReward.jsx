import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWallet } from '../lib/wallet'
import { tap } from '../lib/haptic'
import BrandGlow from '../components/BrandGlow'

const FB_PAGE = 'https://www.facebook.com/Nakubonye'

export default function FacebookReward() {
  const nav = useNavigate()
  const { refresh } = useWallet()
  const [fbName, setFbName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function claim() {
    if (busy || !fbName.trim()) return
    setBusy(true); setError(''); tap('light')

    const { error: err } = await supabase.rpc('claim_facebook_reward', {
      p_fb_username: fbName.trim(),
    })

    setBusy(false)

    if (err) {
      if (/already claimed/i.test(err.message)) setError('You already claimed this reward.')
      else if (/enter your Facebook/i.test(err.message)) setError('Please enter your Facebook name.')
      else setError(err.message)
      return
    }

    await refresh()
    setDone(true)
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
        <span className="text-cream font-bold text-[15px]">Get 50 free coins</span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-10">
        {done ? (
          <div className="pt-16 text-center">
            <div
              className="w-20 h-20 rounded-3xl grid place-items-center mx-auto mb-6"
              style={{
                background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)',
                boxShadow: '0 16px 44px rgba(168,85,247,0.6)',
              }}
            >
              <Check size={40} strokeWidth={3} className="text-white" />
            </div>
            <h2 className="text-cream text-[22px] font-extrabold tracking-tight mb-2">
              +50 coins
            </h2>
            <p className="text-muted text-[13.5px] leading-relaxed max-w-[300px] mx-auto">
              Thanks for following us. Welcome to the Nakubonye family.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-7">
              <div className="w-16 h-16 rounded-2xl grid place-items-center mx-auto mb-4"
                style={{
                  background: 'linear-gradient(135deg, #1877F2 0%, #0a5ed8 100%)',
                  boxShadow: '0 12px 36px rgba(24,119,242,0.5)',
                }}>
                <span className="text-white font-black text-3xl">f</span>
              </div>
              <h1 className="text-cream text-[22px] font-extrabold tracking-tight mb-2">
                Follow us, get 50 coins
              </h1>
              <p className="text-muted text-[13.5px] leading-relaxed max-w-[320px] mx-auto">
                Follow the Nakubonye Facebook page and invite a friend to follow too. Then claim your 50 coins here.
              </p>
            </div>

            <a
              href={FB_PAGE}
              target="_blank"
              rel="noopener"
              onClick={() => tap('light')}
              className="block w-full text-center h-12 rounded-full text-white font-bold text-[15px] mb-3"
              style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0a5ed8 100%)', lineHeight: '48px' }}
            >
              1. Open our Facebook page
            </a>

            <p className="text-center text-muted text-[12.5px] mb-5">
              Tap Follow on our page. Invite a friend to follow too.
            </p>

            <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4">
              <label className="block text-cream text-[13px] font-semibold mb-2">
                2. Enter your Facebook name
              </label>
              <input
                value={fbName}
                onChange={(e) => setFbName(e.target.value.slice(0, 60))}
                placeholder="How you appear on Facebook"
                className="w-full bg-elevated border border-white/8 rounded-2xl px-4 py-3 text-cream text-[15px] placeholder:text-subtle focus:outline-none focus:border-purple-500 mb-3"
              />
              <button
                onClick={claim}
                disabled={busy || !fbName.trim()}
                className="w-full h-12 rounded-full text-white font-bold text-[15px] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)' }}
              >
                {busy ? 'Claiming…' : 'Claim 50 coins'}
              </button>
            </div>

            {error && (
              <div className="mt-4 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
                {error}
              </div>
            )}

            <p className="text-center text-subtle text-[11px] mt-5 leading-relaxed">
              One-time reward per account. We may verify that you actually follow us before paying out.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
