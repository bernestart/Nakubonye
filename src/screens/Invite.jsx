import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Share2, Check, Gift, Users } from 'lucide-react'
import BrandGlow from '../components/BrandGlow'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'

export default function Invite() {
  const nav = useNavigate()
  const { session } = useAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemBusy, setRedeemBusy] = useState(false)
  const [redeemMsg, setRedeemMsg] = useState('')
  const [redeemErr, setRedeemErr] = useState('')
  const [alreadyReferred, setAlreadyReferred] = useState(false)

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true); setError('')

    // Ensure code exists
    let { data: myCode, error: genErr } = await supabase
      .rpc('generate_my_referral_code')

    if (genErr) {
      setError(genErr.message)
      setLoading(false)
      return
    }
    setCode(myCode || '')

    // Am I already referred?
    const { data: prof } = await supabase
      .from('profiles')
      .select('referred_by')
      .eq('id', session.user.id)
      .single()
    setAlreadyReferred(!!prof?.referred_by)

    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  async function copyCode() {
    if (!code) return
    tap('light')
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Could not copy — long-press to select')
    }
  }

  async function share() {
    if (!code) return
    tap('light')
    const url = window.location.origin
    const text = `Join me on Nakubonye — meet someone real.\n\nUse my code: ${code}\n${url}`
    if (navigator.share) {
      try { await navigator.share({ title: 'Nakubonye', text }) } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      } catch {}
    }
  }

  async function submitRedeem() {
    if (!redeemCode.trim()) return
    setRedeemBusy(true); setRedeemErr(''); setRedeemMsg('')

    const { data, error: err } = await supabase.rpc('redeem_referral_code', {
      p_code: redeemCode.trim(),
    })

    setRedeemBusy(false)

    if (err) {
      setRedeemErr(err.message)
      return
    }

    setRedeemMsg(`+${data?.rewarded || 50} coins added to your wallet 🎉`)
    setAlreadyReferred(true)
    setTimeout(() => {
      setRedeemOpen(false)
      setRedeemMsg('')
      setRedeemCode('')
    }, 2200)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />
      <header
        style={{ height: 52, flexShrink: 0 }}
        className="px-3 flex items-center gap-2 border-b border-white/8"
      >
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Invite friends</span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 pb-10">
        {/* Hero */}
        <div className="text-center mb-7">
          <div
            className="w-16 h-16 rounded-2xl grid place-items-center mx-auto mb-4"
            style={{
              background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)',
              boxShadow: '0 12px 36px rgba(168,85,247,0.5)',
            }}
          >
            <Gift size={28} strokeWidth={2.2} className="text-white" />
          </div>
          <h1 className="text-cream text-[24px] font-extrabold tracking-tight mb-2">
            Invite friends, earn coins
          </h1>
          <p className="text-muted text-[13.5px] leading-relaxed max-w-[300px] mx-auto">
            You get <strong className="text-cream">100 coins</strong> when a friend
            you invited completes their profile. They get{' '}
            <strong className="text-cream">50 coins</strong> immediately when they use your code.
          </p>
        </div>

        {/* My code */}
        <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
          Your code
        </p>

        <div
          className="rounded-2xl border border-purple-500/40 p-5 mb-4 relative overflow-hidden"
          style={{ background: 'linear-gradient(160deg, rgba(124,58,237,0.20) 0%, rgba(236,72,153,0.10) 100%)' }}
        >
          <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-purple-500/25 blur-2xl pointer-events-none" />
          <div className="relative">
            {loading ? (
              <div className="h-14 grid place-items-center">
                <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                <p
                  className="text-white font-black text-[38px] leading-none tracking-[0.18em] text-center mb-4 select-all"
                  style={{ fontFamily: 'ui-monospace, monospace' }}
                >
                  {code || '—'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={copyCode}
                    disabled={!code}
                    className="flex-1 h-11 rounded-full bg-white/[0.08] border border-white/15 text-cream font-semibold text-[13.5px] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {copied ? <Check size={15} strokeWidth={2.6} /> : <Copy size={15} strokeWidth={2.3} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={share}
                    disabled={!code}
                    className="flex-1 h-11 rounded-full text-white font-bold text-[13.5px] flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)',
                      boxShadow: '0 8px 24px rgba(236,72,153,0.45)',
                    }}
                  >
                    <Share2 size={15} strokeWidth={2.4} />
                    Share
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        {/* Have a code? */}
        <div className="mt-8 pt-6 border-t border-white/8">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-purple-400" strokeWidth={2.2} />
            <p className="text-cream font-bold text-[14.5px]">Have a friend's code?</p>
          </div>

          {alreadyReferred ? (
            <p className="text-muted text-[13px] leading-relaxed">
              You've already used a referral code. Thanks for joining through a friend.
            </p>
          ) : (
            <>
              <p className="text-muted text-[13px] leading-relaxed mb-4">
                Enter it to get 50 free coins right away.
              </p>
              <button
                onClick={() => setRedeemOpen(true)}
                className="w-full h-12 rounded-full bg-white/[0.06] border border-white/12 text-cream font-bold text-[14px]"
              >
                Enter a code
              </button>
            </>
          )}
        </div>
      </div>

      {/* Redeem sheet */}
      {redeemOpen && (
        <div
          onClick={() => !redeemBusy && setRedeemOpen(false)}
          className="fixed inset-0 z-[150] bg-obsidian/85 backdrop-blur-md grid place-items-end"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] mx-auto bg-surface rounded-t-[28px] border-t border-white/10 p-5"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <h3 className="text-cream font-extrabold text-[17px] mb-2">Enter your friend's code</h3>
            <p className="text-muted text-[13px] mb-4">
              6 characters. Upper or lower case — we'll sort it out.
            </p>

            <input
              value={redeemCode}
              onChange={(e) => { setRedeemCode(e.target.value.toUpperCase()); setRedeemErr('') }}
              placeholder="ABC123"
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              disabled={redeemBusy}
              className="w-full bg-elevated border border-white/10 rounded-2xl px-4 py-3.5 text-cream text-[18px] font-black tracking-[0.18em] text-center placeholder:text-white/20 focus:outline-none focus:border-purple-500 disabled:opacity-50 mb-3"
              style={{ fontFamily: 'ui-monospace, monospace' }}
            />

            {redeemErr && (
              <div className="mb-3 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
                {redeemErr}
              </div>
            )}
            {redeemMsg && (
              <div className="mb-3 text-emerald-300 text-[12.5px] bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2.5">
                {redeemMsg}
              </div>
            )}

            <button
              onClick={submitRedeem}
              disabled={redeemBusy || redeemCode.trim().length < 4}
              className="w-full h-12 rounded-full text-white font-bold text-[14.5px] mb-2 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)',
                boxShadow: '0 10px 28px rgba(236,72,153,0.4)',
              }}
            >
              {redeemBusy ? 'Redeeming…' : 'Redeem and get 50 coins'}
            </button>
            <button
              onClick={() => !redeemBusy && setRedeemOpen(false)}
              disabled={redeemBusy}
              className="w-full h-11 text-muted font-semibold text-[13.5px] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
