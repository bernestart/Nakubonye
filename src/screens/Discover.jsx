import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { X, Heart, MapPin, Check, Undo2, MessageCircle, SlidersHorizontal } from 'lucide-react'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { isOnline } from '../lib/usePresence'
import { publicPhotoUrl, calcAge } from '../lib/photo'
import { tap } from '../lib/haptic'
import BottomNav from '../components/BottomNav'
import AppHeader from '../components/AppHeader'
import MatchModal from '../components/MatchModal'
import BrandGlow from '../components/BrandGlow'
import NotificationBell from '../components/NotificationBell'

const SWIPE_THRESHOLD = 130

async function decorateLocationVisibility(cards, myId) {
  if (!cards.length || !myId) return cards
  const ids = cards.map((c) => c.id).filter((id) => id !== myId)
  if (!ids.length) return cards
  const [settingsRes, blocksRes, matchesRes] = await Promise.all([
    supabase.from('user_settings').select('user_id, who_can_see_location, show_location_on_profile').in('user_id', ids),
    supabase.from('blocks').select('blocker_id, blocked_id').or(`blocker_id.eq.${myId},blocked_id.eq.${myId}`),
    supabase.from('matches').select('user_one_id, user_two_id').or(`user_one_id.eq.${myId},user_two_id.eq.${myId}`),
  ])
  const sMap = new Map((settingsRes.data || []).map((r) => [r.user_id, r]))
  const blockSet = new Set()
  ;(blocksRes.data || []).forEach((b) => {
    if (b.blocker_id === myId) blockSet.add(b.blocked_id)
    if (b.blocked_id === myId) blockSet.add(b.blocker_id)
  })
  const matchSet = new Set()
  ;(matchesRes.data || []).forEach((m) => {
    if (m.user_one_id === myId) matchSet.add(m.user_two_id)
    if (m.user_two_id === myId) matchSet.add(m.user_one_id)
  })

  return cards.map((c) => {
    if (c.id === myId) return { ...c, _canSeeLocation: true }
    if (blockSet.has(c.id)) return { ...c, _canSeeLocation: false }
    const row = sMap.get(c.id)
    if (!row) return { ...c, _canSeeLocation: true }
    if (row.show_location_on_profile === false) return { ...c, _canSeeLocation: false }
    const v = row.who_can_see_location || 'matches'
    if (v === 'nobody') return { ...c, _canSeeLocation: false }
    if (v === 'everyone') return { ...c, _canSeeLocation: true }
    if (v === 'matches') return { ...c, _canSeeLocation: matchSet.has(c.id) }
    return { ...c, _canSeeLocation: true }
  })
}

async function decorateOnlineVisibility(cards, myId) {
  if (!cards.length || !myId) return cards
  const ownerIds = cards.map((c) => c.id).filter((id) => id !== myId)
  if (!ownerIds.length) return cards
  const [settingsRes, blocksRes, matchesRes, followsRes] = await Promise.all([
    supabase.from('user_settings').select('user_id, who_can_see_online, show_activity_status').in('user_id', ownerIds),
    supabase.from('blocks').select('blocker_id, blocked_id').or(`blocker_id.eq.${myId},blocked_id.eq.${myId}`),
    supabase.from('matches').select('user_one_id, user_two_id').or(`user_one_id.eq.${myId},user_two_id.eq.${myId}`),
    supabase.from('follows').select('following_id').eq('follower_id', myId),
  ])
  const sMap = new Map((settingsRes.data || []).map((r) => [r.user_id, r]))
  const blockSet = new Set()
  ;(blocksRes.data || []).forEach((b) => {
    if (b.blocker_id === myId) blockSet.add(b.blocked_id)
    if (b.blocked_id === myId) blockSet.add(b.blocker_id)
  })
  const matchSet = new Set()
  ;(matchesRes.data || []).forEach((m) => {
    if (m.user_one_id === myId) matchSet.add(m.user_two_id)
    if (m.user_two_id === myId) matchSet.add(m.user_one_id)
  })
  const followSet = new Set((followsRes.data || []).map((f) => f.following_id))

  return cards.map((c) => {
    if (c.id === myId) return { ...c, _canSeeOnline: true }
    if (blockSet.has(c.id)) return { ...c, _canSeeOnline: false }
    const row = sMap.get(c.id)
    if (!row) return { ...c, _canSeeOnline: true }
    if (row.show_activity_status === false) return { ...c, _canSeeOnline: false }
    const v = row.who_can_see_online || 'everyone'
    if (v === 'nobody') return { ...c, _canSeeOnline: false }
    if (v === 'everyone') return { ...c, _canSeeOnline: true }
    if (v === 'matches') return { ...c, _canSeeOnline: matchSet.has(c.id) }
    if (v === 'following') return { ...c, _canSeeOnline: followSet.has(c.id) }
    return { ...c, _canSeeOnline: true }
  })
}

export default function Discover() {
  const nav = useNavigate()
  const { session, profile } = useAuth()
  const { communityId } = useParams()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sameCity, setSameCity] = useState(false)
  const [sharedInterests, setSharedInterests] = useState(false)
  const [sameCountry, setSameCountry] = useState(false)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [matchModal, setMatchModal] = useState(null)
  const [undoStack, setUndoStack] = useState([])

  // Read filter state from storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('discover_filters')
    if (saved) {
      try {
        const f = JSON.parse(saved)
        setSameCity(!!f.sameCity)
        setSameCountry(!!f.sameCountry)
        setSharedInterests(!!f.sharedInterests)
        setVerifiedOnly(!!f.verifiedOnly)
        setOnlineOnly(!!f.onlineOnly)
      } catch {}
    }
  }, [])

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true); setError('')
    const { data, error: rpcError } = await supabase.rpc('get_discover_profiles', {
      p_limit: 20,
      p_same_city: sameCity,
      p_shared_interests: sharedInterests,
      p_same_country: sameCountry,
      p_verified_only: verifiedOnly,
      p_online_only: onlineOnly,
      p_community_id: communityId ? Number(communityId) : null,
    })
    if (rpcError) { setError(friendlyError(rpcError)); setLoading(false); return }

    const list = (data || []).map((r) => ({
      id: r.id,
      display_name: r.display_name,
      username: r.username,
      age: r.age ?? calcAge(r.date_of_birth),
      city: r.city,
      country: r.country,
      bio: r.bio,
      is_verified: r.is_verified,
      photo_url: publicPhotoUrl(r.primary_photo),
      last_seen_at: r.last_seen_at || null,
      is_boosted: !!r.is_boosted,
      hasStory: false,
    }))

    // Attach hasStory flag from active stories
    const ids = list.map((c) => c.id).filter(Boolean)
    if (ids.length > 0) {
      const { data: storyRows } = await supabase
        .from("stories")
        .select("user_id")
        .gt("expires_at", new Date().toISOString())
        .in("user_id", ids)
      const storySet = new Set((storyRows || []).map((r) => r.user_id))
      list.forEach((c) => { c.hasStory = storySet.has(c.id) })
    }

    const onlineDecorated = await decorateOnlineVisibility(list, session?.user?.id)
    setCards(await decorateLocationVisibility(onlineDecorated, session?.user?.id))
    setLoading(false)
  }, [session?.user?.id, sameCity, sharedInterests, sameCountry, verifiedOnly, onlineOnly, communityId])

  useEffect(() => { load() }, [load])

  // Realtime: celebrate any new match involving me — swipe, DM-reply, or anything else.
  const celebratedRef = useRef(new Set())
  useEffect(() => {
    const myId = session?.user?.id
    if (!myId) return
    const ch = supabase
      .channel("match-celebration-" + myId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches" },
        async (payload) => {
          const m = payload.new
          if (!m) return
          if (m.user_one_id !== myId && m.user_two_id !== myId) return
          const otherId = m.user_one_id === myId ? m.user_two_id : m.user_one_id
          // skip if we already celebrated this user very recently (swipe path fires first)
          if (celebratedRef.current.has(otherId)) return
          celebratedRef.current.add(otherId)
          setTimeout(() => celebratedRef.current.delete(otherId), 5000)
          const { data: card } = await supabase
            .from("profiles")
            .select("id, display_name, username, photo_url, photos, is_verified, city, country")
            .eq("id", otherId)
            .maybeSingle()
          if (!card) return
          tap("match")
          setMatchModal(card)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session?.user?.id])

  async function recordSwipe(targetId, action) {
    if (!session?.user?.id) return
    await supabase.from('swipes').upsert(
      { swiper_id: session.user.id, target_id: targetId, action },
      { onConflict: 'swiper_id,target_id', ignoreDuplicates: true }
    )
  }

  async function handlePass() {
    if (busy) return
    const card = cards[0]; if (!card) return
    tap('light'); setBusy(true)
    setCards((c) => c.slice(1))
    setUndoStack((s) => [...s, { card, action: 'pass' }])
    await recordSwipe(card.id, 'pass')
    setBusy(false)
  }

  async function handleLike() {
    if (busy) return
    const card = cards[0]; if (!card) return
    tap('medium'); setBusy(true)
    setCards((c) => c.slice(1))
    setUndoStack((s) => [...s, { card, action: 'like' }])

    const { data, error: likeErr } = await supabase.rpc('like_user', {
      target_user_id: card.id,
    })
    if (likeErr) { setError(likeErr.message); setBusy(false); setCards((c) => [card, ...c]); setUndoStack((st) => st.slice(0, -1)); return }
    if (data?.denied) {
      // User not accepting requests — put card back silently
      setCards((c) => [card, ...c])
      setUndoStack((st) => st.slice(0, -1))
      setError(data.reason || "This user isn't accepting new requests")
      setBusy(false)
      return
    }
    await recordSwipe(card.id, 'like')
    if (data?.matched) { tap('match'); setMatchModal(card) }
    setBusy(false)
  }

  async function handleUndo() {
    if (busy) return
    const top = undoStack[undoStack.length - 1]
    if (!top) return
    tap('light'); setBusy(true)
    setUndoStack((s) => s.slice(0, -1))
    setCards((c) => [top.card, ...c])
    await supabase.from('swipes').delete()
      .eq('swiper_id', session.user.id).eq('target_id', top.card.id)
    setBusy(false)
  }

  const current = cards[0]
  const canUndo = undoStack.length > 0

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

      {/* Floating filter button */}
      <button
        onClick={() => { tap('light'); nav('/filters') }}
        className="fixed top-16 right-4 z-30 w-10 h-10 rounded-full grid place-items-center"
        style={{
          background: 'rgba(20,20,31,0.85)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        }}
        aria-label="Filters"
      >
        <SlidersHorizontal size={18} strokeWidth={2.2} className="text-cream" />
        {(sameCity || sharedInterests || sameCountry || verifiedOnly || onlineOnly) && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-purple-500" />
        )}
      </button>

      {error && (
        <div className="mx-3 mb-2 text-danger text-[12px] bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 shrink-0">
          {error}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, padding: '0 10px' }}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {loading ? (
            <div className="absolute inset-0 rounded-[18px] bg-surface border border-line animate-pulse" />
          ) : current ? (
            <SwipeCard
              key={current.id}
              card={current}
              onPass={handlePass}
              onLike={handleLike}
              onWatchStory={() => { tap('light'); nav('/stories') }}
              disabled={busy}
            />
          ) : (
            <EmptyState onRefresh={load} />
          )}
        </div>
      </div>

      {current && !loading && (
        <div
          style={{ position: 'absolute', bottom: 84, left: 0, right: 0, zIndex: 30 }}
          className="flex items-center justify-center gap-3.5"
        >
          <ActionBtn onClick={handleUndo} disabled={busy || !canUndo} label="Undo" size={48} variant="undo" iconColor="text-white/80">
            <Undo2 size={20} strokeWidth={2.4} />
          </ActionBtn>
          <ActionBtn onClick={handlePass} disabled={busy} label="Pass" size={54} variant="pass" iconColor="text-red-400">
            <X size={26} strokeWidth={2.8} />
          </ActionBtn>
          <ActionBtn
            onClick={() => {
              if (!cards[0]) return
              tap('light')
              nav('/profile/' + cards[0].id)
            }}
            disabled={busy || !cards[0]}
            label="View profile"
            size={54}
            variant="message"
            iconColor="text-sky-400"
          >
            <MessageCircle size={24} strokeWidth={2.5} />
          </ActionBtn>
          <ActionBtn onClick={handleLike} disabled={busy} label="Like" size={54} variant="like" iconColor="text-pink-400">
            <Heart size={26} strokeWidth={2.6} />
          </ActionBtn>
        </div>
      )}

      <div style={{ height: 72, flexShrink: 0 }} />
      <BottomNav />

      {matchModal && (
        <MatchModal
          me={profile}
          them={matchModal}
          onClose={() => setMatchModal(null)}
          onMessage={() => { setMatchModal(null); nav('/messages/' + matchModal.id) }}
        />
      )}
    </div>
  )
}

function SwipeCard({ card, onPass, onLike, onWatchStory, disabled }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-250, 250], [-9, 9])
  const likeOpacity = useTransform(x, [40, 140], [0, 1])
  const nopeOpacity = useTransform(x, [-140, -40], [1, 0])

  function onDragEnd(_, info) {
    if (disabled) return

    const xOffset = info.offset.x || 0
    const yOffset = info.offset.y || 0
    const xVel = info.velocity.x || 0
    const yVel = info.velocity.y || 0

    const absX = Math.abs(xOffset)
    const absY = Math.abs(yOffset)

    // PASS / LIKE: only when horizontal is the dominant axis.
    // Either 130px distance OR 800+ velocity (fast flick).
    if (absX >= absY) {
      if (xOffset > 130 || xVel > 800) onLike()
      else if (xOffset < -130 || xVel < -800) onPass()
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
      drag
      dragConstraints={{ left: 0, right: 0, top: -180, bottom: 30 }}
      dragElastic={0.18}
      dragMomentum={false}
      dragTransition={{ bounceStiffness: 700, bounceDamping: 35, power: 0.5, timeConstant: 150 }}
      style={{ x, y, rotate, position: 'absolute', inset: 0, borderRadius: 18 }}
      onDragEnd={onDragEnd}
      className="overflow-hidden bg-[#14141F] shadow-[0_24px_60px_rgba(0,0,0,0.65)] select-none touch-none will-change-transform"
    >
      {card.photo_url ? (
        <img
          src={card.photo_url}
          alt={card.display_name || 'profile'}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          className="pointer-events-none"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-7xl opacity-25">👤</div>
      )}

      {/* Story indicator — top-left corner */}
      {card.hasStory && (
        <button
          onClick={(e) => { e.stopPropagation(); onWatchStory?.() }}
          aria-label="Watch story"
          className="absolute z-20"
          style={{ top: 12, left: 12 }}
        >
          <span
            className="story-indicator-ring block"
            style={{
              width: 42,
              height: 42,
              borderRadius: 999,
              padding: 3,
              background: "linear-gradient(135deg, #C084FC 0%, #EC4899 100%)",
              boxShadow: "0 4px 14px rgba(236,72,153,0.55)",
            }}
          >
            <span
              className="block w-full h-full rounded-full overflow-hidden"
              style={{ border: "2px solid #0B0B14", background: "#14141F" }}
            >
              {card.photo_url ? (
                <img src={card.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full grid place-items-center text-purple-400 font-black text-sm">
                  {(card.display_name || "?")[0]}
                </span>
              )}
            </span>
          </span>
        </button>
      )}

      {/* BOOSTED badge — only if this profile is boosted */}
      {card.is_boosted && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1 rounded-full pointer-events-none shadow-[0_4px_18px_rgba(245,158,11,0.65)] z-20">
          <span className="text-[10.5px] font-black tracking-wide text-white">⚡ BOOSTED</span>
        </div>
      )}

      <motion.div
        style={{ opacity: likeOpacity }}
        className="absolute top-6 left-5 px-3.5 py-1.5 rounded-xl border-[3px] border-success text-success font-black text-xl tracking-[0.18em] -rotate-12 pointer-events-none bg-obsidian/50 backdrop-blur z-10"
      >
        LIKE
      </motion.div>
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="absolute top-6 right-5 px-3.5 py-1.5 rounded-xl border-[3px] border-danger text-danger font-black text-xl tracking-[0.18em] rotate-12 pointer-events-none bg-obsidian/50 backdrop-blur z-10"
      >
        NOPE
      </motion.div>

      {/* Name + age + verified check, Jaumo style: name then blue badge inline */}
      <div
        style={{ position: 'absolute', left: 0, right: 0, bottom: 78 }}
        className="px-5 pointer-events-none z-10"
      >
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-white text-[30px] leading-[1.02] font-extrabold tracking-tight"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 4px 20px rgba(0,0,0,0.75), 0 0 30px rgba(0,0,0,0.5)' }}>
            {card.display_name || card.username || 'Someone'}
            {card.age ? `, ${card.age}` : ''}
          </h2>
          {card.is_verified && (
            <span className="w-[22px] h-[22px] rounded-full bg-[#1DA1F2] grid place-items-center shadow-[0_2px_8px_rgba(29,161,242,0.5)] shrink-0">
              <Check size={13} strokeWidth={3.5} className="text-white" />
            </span>
          )}
        </div>
        <p className="text-white text-[13.5px] font-medium flex items-center gap-1.5" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.7)' }}>
          <MapPin size={12} />
          {card._canSeeLocation === false ? 'Unknown' : (card.city || 'Unknown')}
          {card._canSeeLocation === false ? '' : (card.country ? `, ${card.country}` : '')}
          {card._canSeeOnline !== false && isOnline(card.last_seen_at) && (
            <span className="inline-flex items-center gap-1 ml-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
              <span className="text-emerald-300 text-[11px] font-semibold">Online</span>
            </span>
          )}
        </p>
      </div>
    </motion.article>
  )
}

const VARIANT_STYLE = {
  pass:    { bg: 'rgba(60,15,25,0.85)',    border: 'rgba(244,63,94,0.9)'   },
  like:    { bg: 'rgba(60,15,40,0.85)',    border: 'rgba(236,72,153,0.95)' },
  super:   { bg: 'rgba(60,40,10,0.85)',    border: 'rgba(245,158,11,0.95)' },
  undo:    { bg: 'rgba(50,35,10,0.85)',    border: 'rgba(245,158,11,0.8)'  },
  message: { bg: 'rgba(15,35,60,0.85)',    border: 'rgba(56,189,248,0.9)'  },
  neutral: { bg: 'rgba(20,20,30,0.85)',    border: 'rgba(255,255,255,0.35)' },
}

function ActionBtn({ children, onClick, disabled, label, size = 54, variant = 'neutral', title, iconColor = 'text-white' }) {
  return (
    <motion.button
      whileTap={!disabled ? { scale: 0.82 } : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
      style={{
        width: size,
        height: size,
        background: (VARIANT_STYLE[variant] || VARIANT_STYLE.neutral).bg,
        borderColor: (VARIANT_STYLE[variant] || VARIANT_STYLE.neutral).border,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
      className={`rounded-full grid place-items-center shrink-0 transition-all border-2 shadow-[0_8px_22px_rgba(0,0,0,0.55)] ${disabled ? 'opacity-50' : 'hover:brightness-125'}`}
    >
      <span
        className={iconColor}
        style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.85)) drop-shadow(0 0 12px rgba(0,0,0,0.6))' }}
      >
        {children}
      </span>
    </motion.button>
  )
}

function EmptyState({ onRefresh }) {
  return (
    <div className="absolute inset-0 rounded-[18px] bg-surface border border-white/8 p-6 grid place-content-center text-center">
      <div className="w-14 h-14 rounded-full bg-purple-500/15 grid place-items-center mx-auto mb-4">
        <span className="text-2xl">✨</span>
      </div>
      <h2 className="text-cream text-[18px] font-extrabold mb-1.5">
        You've seen everyone nearby
      </h2>
      <p className="text-muted text-[13px] mb-5">New people join every day.</p>
      <button
        onClick={onRefresh}
        className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold text-[13px] shadow-[0_8px_20px_rgba(124,58,237,0.45)] mx-auto"
      >
        Refresh
      </button>
    </div>
  )
}


function FilterToggle({ label, desc, on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03]"
    >
      <div className="flex-1 min-w-0">
        <p className="text-cream font-semibold text-[14.5px] mb-0.5">{label}</p>
        <p className="text-muted text-[12px] leading-snug">{desc}</p>
      </div>
      <span
        className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
          on ? 'bg-purple-600' : 'bg-white/15'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
            on ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}
