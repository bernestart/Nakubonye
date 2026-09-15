import { useCallback, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, RefreshCw, MapPin, Check, Lock, Sparkles } from 'lucide-react'
import BrandGlow from '../components/BrandGlow'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl, calcAge } from '../lib/photo'
import { tap } from '../lib/haptic'
import BottomNav from '../components/BottomNav'
import NotificationBell from '../components/NotificationBell'

export default function Likes() {
  const nav = useNavigate()
  const { session } = useAuth()
  const [tab, setTab] = useState('received')
  const [received, setReceived] = useState([])
  const [sent, setSent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isPremium, setIsPremium] = useState(false)
  const [premiumLoading, setPremiumLoading] = useState(true)

  const loadReceived = useCallback(async () => {
    const { data, error: rpcErr } = await supabase.rpc('get_likes_received', { p_limit: 30 })
    if (rpcErr) { setError(rpcErr.message); return }
    setReceived((data || []).map((r) => ({
      user_id: r.id,
      display_name: r.display_name,
      username: r.username,
      age: r.age ?? calcAge(r.date_of_birth),
      city: r.city,
      country: r.country,
      is_verified: r.is_verified,
      photo_url: publicPhotoUrl(r.primary_photo),
      liked_at: r.liked_at,
    })))
  }, [])

  const loadSent = useCallback(async () => {
    if (!session?.user?.id) return
    const { data: likes, error: likeErr } = await supabase
      .from('likes')
      .select('liked_user_id, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (likeErr) { setError(friendlyError(likeErr)); return }
    const ids = (likes || []).map((l) => l.liked_user_id)
    if (!ids.length) { setSent([]); return }

    const { data: profs } = await supabase
      .from('profiles')
      .select('id, display_name, username, date_of_birth, city, country, is_verified')
      .in('id', ids)

    const { data: photos } = await supabase
      .from('profile_photos')
      .select('user_id, storage_path, is_primary, display_order')
      .in('user_id', ids)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true })

    const pmap = new Map()
    const profMap = new Map((profs || []).map((p) => [p.id, p]))
    ;(photos || []).forEach((ph) => { if (!pmap.has(ph.user_id)) pmap.set(ph.user_id, ph.storage_path) })

    // Which of these are matched?
    // NOTE: cannot query 'likes' for the other side — RLS hides them.
    // Use 'matches' table instead (RLS allows both participants to read).
    const { data: matchRows } = await supabase
      .from('matches')
      .select('user_one_id, user_two_id')
      .or(`user_one_id.eq.${session.user.id},user_two_id.eq.${session.user.id}`)

    const mutualSet = new Set()
    ;(matchRows || []).forEach((m) => {
      const other = m.user_one_id === session.user.id ? m.user_two_id : m.user_one_id
      if (ids.includes(other)) mutualSet.add(other)
    })

    setSent((likes || []).map((l) => {
      const p = profMap.get(l.liked_user_id)
      if (!p) return null
      return {
        user_id: p.id,
        display_name: p.display_name,
        username: p.username,
        age: calcAge(p.date_of_birth),
        city: p.city,
        country: p.country,
        is_verified: p.is_verified,
        photo_url: publicPhotoUrl(pmap.get(p.id)),
        liked_at: l.created_at,
        isMatch: mutualSet.has(p.id),
      }
    }).filter(Boolean))
  }, [session?.user?.id])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    await Promise.all([loadReceived(), loadSent()])
    setLoading(false)
  }, [loadReceived, loadSent])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!session?.user?.id) { setPremiumLoading(false); return }
    let cancelled = false
    ;(async () => {
      const { data, error: err } = await supabase.rpc('is_premium')
      if (cancelled) return
      setIsPremium(!!data)
      setPremiumLoading(false)
    })()
    return () => { cancelled = true }
  }, [session?.user?.id])

  const list = tab === 'received' ? received : sent

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        margin: '0 auto', maxWidth: 480,
        display: 'flex', flexDirection: 'column',
        background: '#0B0B14', overflow: 'hidden',
      }}
    >
      <header
        style={{ height: 52, flexShrink: 0 }}
        className="px-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-600 grid place-items-center shadow-[0_4px_12px_rgba(124,58,237,0.45)]">
            <span className="text-white font-black text-sm">N</span>
          </div>
          <span className="text-cream font-bold text-[14px]">Likes</span>
        </div>
        <NotificationBell />
        <button
          onClick={load}
          className="w-9 h-9 rounded-full grid place-items-center bg-white/[0.05] border border-white/8 text-muted"
          aria-label="Refresh"
        >
          <RefreshCw size={16} strokeWidth={2.3} />
        </button>
      </header>

      {/* Tabs */}
      <div className="px-4 pt-1 pb-3 shrink-0">
        <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/8">
          <TabBtn active={tab === 'received'} onClick={() => { tap('light'); setTab('received') }}>
      <BrandGlow />
            Likes you
            {received.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-pink-500 text-white text-[10px] font-bold">
                {received.length}
              </span>
            )}
          </TabBtn>
          <TabBtn active={tab === 'sent'} onClick={() => { tap('light'); setTab('sent') }}>
            Sent
          </TabBtn>
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {loading || premiumLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0,1,2,3].map(i => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-surface animate-pulse" />
            ))}
          </div>
        ) : tab === 'received' && !isPremium ? (
          <LockedReceived count={received.length} />
        ) : list.length === 0 ? (
          <Empty tab={tab} onGo={nav} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {list.map((item) => (
              <LikeCard key={item.user_id} item={item} tab={tab} onOpen={() => nav('/profile/' + item.user_id)} />
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 72, flexShrink: 0 }} />
      <BottomNav />
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 h-9 rounded-xl text-[13px] font-semibold transition-colors flex items-center justify-center ${
        active ? 'bg-purple-600 text-white shadow-[0_4px_14px_rgba(124,58,237,0.4)]' : 'text-muted'
      }`}
    >
      {children}
    </button>
  )
}

function LikeCard({ item, tab, onOpen }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      className="relative rounded-2xl overflow-hidden bg-surface border border-white/8 aspect-[3/4] text-left"
    >
      {item.photo_url ? (
        <img src={item.photo_url} alt={item.display_name || 'profile'} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-4xl opacity-25">👤</div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-obsidian via-obsidian/55 to-transparent" />

      {item.is_verified && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-purple-600 px-1.5 py-0.5 rounded-full">
          <Check size={9} strokeWidth={3} />
          <span className="text-[8.5px] font-bold text-white tracking-wide">VERIFIED</span>
        </div>
      )}

      {tab === 'received' && (
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-pink-500 text-white text-[9.5px] font-bold tracking-wide">
          LIKED YOU
        </span>
      )}
      {tab === 'sent' && item.isMatch && (
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-success text-white text-[9.5px] font-bold tracking-wide">
          MATCHED
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="text-white text-[14px] font-extrabold leading-tight drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
          {item.display_name || item.username || 'Someone'}
          {item.age ? `, ${item.age}` : ''}
        </p>
        <p className="text-white/85 text-[10.5px] font-medium flex items-center gap-1 mt-0.5">
          <MapPin size={9} />
          {item.city || 'Unknown'}
        </p>
      </div>
    </motion.button>
  )
}

function Empty({ tab, onGo }) {
  const copy = tab === 'received'
    ? { title: 'No likes yet', body: "When someone likes you, they'll appear here." }
    : { title: 'No likes sent', body: 'People you like will appear here.' }
  return (
    <div className="pt-16 text-center">
      <div className="w-16 h-16 rounded-3xl bg-purple-500/12 border border-purple-500/25 grid place-items-center mx-auto mb-5">
        <Heart size={26} strokeWidth={1.8} className="text-purple-300" />
      </div>
      <h2 className="text-cream text-[18px] font-extrabold mb-1.5">{copy.title}</h2>
      <p className="text-muted text-[13px] mb-6 max-w-[260px] mx-auto">{copy.body}</p>
      <button
        onClick={() => onGo('/discover')}
        className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold text-[13px] shadow-[0_8px_20px_rgba(124,58,237,0.45)] mx-auto"
      >
        Discover people
      </button>
    </div>
  )
}


function LockedReceived({ count }) {
  return (
    <div className="pt-6 text-center px-2">
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
            {count > 0
              ? `${count} ${count === 1 ? 'person likes' : 'people like'} you`
              : 'See who likes you'}
          </h2>
          <p className="text-muted text-[13.5px] leading-relaxed mb-5 px-3">
            Premium shows you everyone who liked you — so you can decide who to match with, instead of waiting to be discovered.
          </p>

          {/* Blurred preview grid */}
          <div className="grid grid-cols-3 gap-2 mb-5 opacity-60">
            {[0,1,2,3,4,5].map((i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-xl overflow-hidden border border-white/10"
                style={{
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(236,72,153,0.35))',
                  filter: 'blur(6px)',
                }}
              />
            ))}
          </div>

          <Link
            to="/premium"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white font-bold text-[14px] shadow-[0_10px_28px_rgba(124,58,237,0.5)]"
          >
            <Sparkles size={16} strokeWidth={2.4} />
            See who likes you
          </Link>
        </div>
      </div>

      <p className="text-subtle text-[11.5px] leading-relaxed">
        You can still match for free — when someone you like likes you back, you'll see it in Matches.
      </p>
    </div>
  )
}
