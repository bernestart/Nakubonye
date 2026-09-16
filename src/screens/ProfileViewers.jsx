import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, Lock, MapPin, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl, calcAge } from '../lib/photo'
import { tap } from '../lib/haptic'
import BrandGlow from '../components/BrandGlow'

export default function ProfileViewers() {
  const nav = useNavigate()
  const { session } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewers, setViewers] = useState([])
  const [premiumRequired, setPremiumRequired] = useState(false)

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true); setError(''); setPremiumRequired(false)

    const { data, error: err } = await supabase.rpc('get_my_profile_viewers', { p_limit: 100 })

    if (err) {
      if (/premium/i.test(err.message)) {
        setPremiumRequired(true)
        setLoading(false)
        return
      }
      setError(err.message)
      setLoading(false)
      return
    }

    const rows = data || []
    setViewers(rows.map((r) => ({
      id: r.id,
      username: r.username,
      display_name: r.display_name,
      age: r.age ?? calcAge(r.date_of_birth),
      city: r.city,
      country: r.country,
      is_verified: r.is_verified,
      photo_url: publicPhotoUrl(r.primary_photo),
      viewed_at: r.viewed_at,
      view_count: r.view_count,
    })))

    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

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
        <span className="text-cream font-bold text-[15px]">Profile views</span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-10">
        {error && (
          <div className="mb-4 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">Loading…</div>
        ) : premiumRequired ? (
          <PremiumGate onUpgrade={() => nav('/premium')} />
        ) : viewers.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="text-center mb-6">
              <div
                className="w-16 h-16 rounded-3xl grid place-items-center mx-auto mb-4"
                style={{
                  background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
                  boxShadow: '0 12px 36px rgba(168,85,247,0.5)',
                }}
              >
                <Eye size={28} strokeWidth={2.2} className="text-white" />
              </div>
              <h1 className="text-cream text-[22px] font-extrabold tracking-tight mb-1.5">
                Who viewed you
              </h1>
              <p className="text-muted text-[13.5px] leading-relaxed max-w-[320px] mx-auto">
                {viewers.length} {viewers.length === 1 ? 'person has' : 'people have'} checked out your profile.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {viewers.map((v) => (
                <button
                  key={v.id}
                  onClick={() => { tap('light'); nav('/profile/' + v.id) }}
                  className="relative rounded-2xl overflow-hidden bg-surface border border-white/8 aspect-[3/4] text-left"
                >
                  {v.photo_url ? (
                    <img src={v.photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-4xl opacity-25">👤</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-obsidian via-obsidian/55 to-transparent" />

                  {v.is_verified && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-purple-600 px-1.5 py-0.5 rounded-full">
                      <Check size={9} strokeWidth={3} />
                      <span className="text-[8.5px] font-bold text-white">VERIFIED</span>
                    </div>
                  )}

                  {v.view_count > 1 && (
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-pink-500 text-white text-[9px] font-bold">
                      ×{v.view_count}
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-2.5">
                    <p className="text-white text-[14px] font-extrabold leading-tight drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
                      {v.display_name || v.username || 'Someone'}
                      {v.age ? `, ${v.age}` : ''}
                    </p>
                    {v.city && (
                      <p className="text-white/85 text-[10.5px] font-medium flex items-center gap-1 mt-0.5">
                        <MapPin size={9} />
                        {v.city}
                      </p>
                    )}
                    <p className="text-white/70 text-[10px] mt-0.5">
                      {relTime(v.viewed_at)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PremiumGate({ onUpgrade }) {
  return (
    <div className="pt-8 text-center">
      <div className="relative rounded-3xl overflow-hidden border border-purple-500/30 mb-5"
        style={{ background: 'linear-gradient(160deg, rgba(124,58,237,0.25) 0%, rgba(236,72,153,0.15) 100%)' }}
      >
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)'
        }} />
        <div className="relative p-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center mx-auto mb-4 shadow-[0_10px_30px_rgba(124,58,237,0.55)]">
            <Lock size={24} strokeWidth={2.4} className="text-white" />
          </div>
          <h2 className="text-cream text-[20px] font-extrabold tracking-tight mb-2">
            See who viewed you
          </h2>
          <p className="text-muted text-[13.5px] leading-relaxed mb-5 px-3">
            Premium shows you everyone who opened your profile — and how many times. Turn browsers into matches.
          </p>
          <button
            onClick={onUpgrade}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white font-bold text-[14px] shadow-[0_10px_28px_rgba(124,58,237,0.5)]"
          >
            <Eye size={16} strokeWidth={2.4} />
            See who viewed you
          </button>
        </div>
      </div>
      <p className="text-subtle text-[11.5px] leading-relaxed">
        Your profile still shows up in Discover for free users — Premium just shows you who visited.
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="pt-16 text-center">
      <div className="w-16 h-16 rounded-3xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
        <Eye size={26} strokeWidth={1.8} className="text-muted" />
      </div>
      <p className="text-cream font-semibold text-[15px] mb-1">No views yet</p>
      <p className="text-muted text-[13px]">When someone opens your profile, you'll see them here.</p>
    </div>
  )
}

function relTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
