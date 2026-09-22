import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, RefreshCw, MapPin, MessageCircle, Check } from 'lucide-react'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl, calcAge } from '../lib/photo'
import { tap } from '../lib/haptic'
import BottomNav from '../components/BottomNav'
import NotificationBell from '../components/NotificationBell'
import AppHeader from '../components/AppHeader'
import BrandGlow from '../components/BrandGlow'

export default function Matches() {
  const nav = useNavigate()
  const { session } = useAuth()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true); setError('')
    const userId = session.user.id

    const { data: rows, error: matchErr } = await supabase
      .from('matches')
      .select('id, user_one_id, user_two_id, created_at')
      .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (matchErr) { setError(friendlyError(matchErr)); setLoading(false); return }

    const list = rows || []
    const otherIds = list.map((m) => m.user_one_id === userId ? m.user_two_id : m.user_one_id)
    if (!otherIds.length) { setMatches([]); setLoading(false); return }

    const { data: profs } = await supabase
      .from('profiles')
      .select('id, display_name, username, date_of_birth, city, country, is_verified')
      .in('id', otherIds)

    const { data: photos } = await supabase
      .from('profile_photos')
      .select('user_id, storage_path, is_primary, display_order')
      .in('user_id', otherIds)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true })

    const pmap = new Map()
    ;(photos || []).forEach((ph) => { if (!pmap.has(ph.user_id)) pmap.set(ph.user_id, ph.storage_path) })
    const profMap = new Map((profs || []).map((p) => [p.id, p]))

    setMatches(list.map((m) => {
      const otherId = m.user_one_id === userId ? m.user_two_id : m.user_one_id
      const p = profMap.get(otherId)
      if (!p) return null
      return {
        match_id: m.id,
        user_id: p.id,
        display_name: p.display_name,
        username: p.username,
        age: calcAge(p.date_of_birth),
        city: p.city,
        country: p.country,
        is_verified: p.is_verified,
        photo_url: publicPhotoUrl(pmap.get(p.id)),
        matched_at: m.created_at,
      }
    }).filter(Boolean))
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  // Mark all my matches as seen so the nav badge clears.
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return
    supabase
      .from("matches")
      .update({ seen_at: new Date().toISOString() })
      .is("seen_at", null)
      .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`)
      .then(() => {})
  }, [session?.user?.id])

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        margin: '0 auto', maxWidth: 480,
        display: 'flex', flexDirection: 'column',
        background: '#0B0B14', overflow: 'hidden',
      }}
    >
      <BrandGlow />
      <AppHeader />

      {/* Floating refresh */}
      <button
        onClick={() => { tap('light'); load() }}
        className="fixed top-16 right-4 z-30 w-10 h-10 rounded-full grid place-items-center"
        style={{
          background: 'rgba(20,20,31,0.85)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        }}
        aria-label="Refresh"
      >
        <RefreshCw size={16} strokeWidth={2.3} className="text-cream" />
      </button>

      <div className="px-4 pb-3 shrink-0">
        <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-1">
          Your connections
        </p>
        <h1 className="text-cream text-[22px] font-extrabold tracking-tight">
          It's a match <Heart size={18} fill="currentColor" className="inline text-pink-500" />
        </h1>
        <p className="text-muted text-[13px] mt-0.5">
          People who liked you back.
        </p>
      </div>

      {error && (
        <div className="mx-4 mb-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 animate-pulse">
            {[0,1,2,3].map((i) => (
              <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden">
                <div className="aspect-[3/4] bg-white/[0.04]" />
                <div className="p-3">
                  <div className="h-3 w-2/3 rounded bg-white/[0.08] mb-1.5" />
                  <div className="h-2.5 w-1/2 rounded bg-white/[0.05]" />
                </div>
              </div>
            ))}
          </div>
        ) : matches.length === 0 ? (
          <Empty onGo={() => nav('/discover')} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {matches.map((m) => (
              <motion.div
                key={m.match_id}
                whileTap={{ scale: 0.97 }}
                className="relative rounded-2xl overflow-hidden bg-surface border border-white/8 aspect-[3/4]"
              >
                <button
                  onClick={() => { tap('light'); nav('/profile/' + m.user_id) }}
                  className="absolute inset-0 text-left"
                  aria-label={`View ${m.display_name || 'profile'}`}
                >
                  {m.photo_url ? (
                    <img src={m.photo_url} alt={m.display_name || 'match'} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-4xl opacity-25">👤</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-obsidian via-obsidian/55 to-transparent" />

                  {m.is_verified && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-purple-600 px-1.5 py-0.5 rounded-full">
                      <Check size={9} strokeWidth={3} />
                      <span className="text-[8.5px] font-bold text-white tracking-wide">VERIFIED</span>
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-2.5">
                    <p className="text-white text-[14px] font-extrabold leading-tight drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
                      {m.display_name || m.username || 'Someone'}
                      {m.age ? `, ${m.age}` : ''}
                    </p>
                    <p className="text-white/85 text-[10.5px] font-medium flex items-center gap-1 mt-0.5">
                      <MapPin size={9} />
                      {m.city || 'Unknown'}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => { tap('medium'); nav('/messages/' + m.user_id) }}
                  className="absolute bottom-2 right-2 w-9 h-9 rounded-full grid place-items-center bg-gradient-to-br from-purple-500 to-pink-500 shadow-[0_6px_18px_rgba(124,58,237,0.55)]"
                  aria-label="Message"
                >
                  <MessageCircle size={15} strokeWidth={2.5} className="text-white" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 72, flexShrink: 0 }} />
      <BottomNav />
    </div>
  )
}

function Empty({ onGo }) {
  return (
    <div className="pt-16 text-center">
      <div className="w-16 h-16 rounded-3xl bg-purple-500/12 border border-purple-500/25 grid place-items-center mx-auto mb-5">
        <Heart size={26} strokeWidth={1.8} className="text-purple-300" />
      </div>
      <h2 className="text-cream text-[18px] font-extrabold mb-1.5">No matches yet</h2>
      <p className="text-muted text-[13px] mb-6 max-w-[260px] mx-auto">
        When someone you like likes you back, your match will appear here.
      </p>
      <button
        onClick={onGo}
        className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold text-[13px] shadow-[0_8px_20px_rgba(124,58,237,0.45)] mx-auto"
      >
        Discover people
      </button>
    </div>
  )
}
