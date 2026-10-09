import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, RefreshCw, MapPin, MessageCircle, Check, X, MoreHorizontal } from 'lucide-react'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl, calcAge } from '../lib/photo'
import { tap } from '../lib/haptic'
import BottomNav from '../components/BottomNav'
import AppHeader from '../components/AppHeader'
import BrandGlow from '../components/BrandGlow'

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return Math.floor(diff / 60) + "m";
  if (diff < 86400) return Math.floor(diff / 3600) + "h";
  if (diff < 604800) return Math.floor(diff / 86400) + "d";
  if (diff < 2592000) return Math.floor(diff / 604800) + "w";
  if (diff < 31536000) return Math.floor(diff / 2592000) + "mo";
  return Math.floor(diff / 31536000) + "y";
}

export default function Matches() {
  const nav = useNavigate()
  const { session } = useAuth()
  const [activeTab, setActiveTab] = useState('matches')
  const [likes, setLikes] = useState([])
  const [sentLikes, setSentLikes] = useState([])
  const [mutuals, setMutuals] = useState({})
  const [suggested, setSuggested] = useState([])
  const [menuFor, setMenuFor] = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState({})

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
    const matchOtherSet = new Set(otherIds)

    let profMap = new Map()
    let photoMap = new Map()
    if (otherIds.length) {
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

      ;(photos || []).forEach((ph) => { if (!photoMap.has(ph.user_id)) photoMap.set(ph.user_id, ph.storage_path) })
      profMap = new Map((profs || []).map((p) => [p.id, p]))
    }

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
        photo_url: publicPhotoUrl(photoMap.get(p.id)),
        matched_at: m.created_at,
      }
    }).filter(Boolean))

    const { data: likesData } = await supabase.rpc('get_likes_received', { p_limit: 60 })
    setLikes((likesData || []).filter((r) => !matchOtherSet.has(r.id)).map((r) => ({
      user_id: r.id,
      display_name: r.display_name,
      username: r.username,
      is_verified: r.is_verified,
      photo_url: publicPhotoUrl(r.primary_photo),
      city: r.city,
      country: r.country,
      age: r.age ?? calcAge(r.date_of_birth),
      liked_at: r.liked_at,
    })))

    const { data: sentRows } = await supabase
      .from('likes')
      .select('liked_user_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60)

    let sentList = []
    if (sentRows?.length) {
      const sentIds = sentRows.map((r) => r.liked_user_id)
      const { data: sentProfs } = await supabase
        .from('profiles')
        .select('id, display_name, username, is_verified, city, country, date_of_birth')
        .in('id', sentIds)

      const { data: sentPhotos } = await supabase
        .from('profile_photos')
        .select('user_id, storage_path, is_primary, display_order')
        .in('user_id', sentIds)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true })

      const spMap = new Map()
      ;(sentPhotos || []).forEach((ph) => { if (!spMap.has(ph.user_id)) spMap.set(ph.user_id, ph.storage_path) })
      const sprofMap = new Map((sentProfs || []).map((p) => [p.id, p]))

      sentList = sentRows.filter((r) => !matchOtherSet.has(r.liked_user_id)).map((r) => {
        const p2 = sprofMap.get(r.liked_user_id)
        if (!p2) return null
        return {
          user_id: p2.id,
          display_name: p2.display_name,
          username: p2.username,
          is_verified: p2.is_verified,
          photo_url: publicPhotoUrl(spMap.get(p2.id)),
          city: p2.city,
          country: p2.country,
          age: p2.date_of_birth ? calcAge(p2.date_of_birth) : null,
          sent_at: r.created_at,
        }
      }).filter(Boolean)
    }
    setSentLikes(sentList)
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.rpc('get_suggested_people', { p_limit: 40 })
      if (cancelled || error) return
      const rows = data || []
      if (rows.length === 0) { setSuggested([]); return }
      const ids = rows.map(r => r.id)
      const { data: ph } = await supabase
        .from('profile_photos')
        .select('user_id, storage_path, is_primary, display_order')
        .in('user_id', ids)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true })
      if (cancelled) return
      const pm = new Map()
      ;(ph || []).forEach(x => { if (!pm.has(x.user_id)) pm.set(x.user_id, x.storage_path) })
      setSuggested(rows.map(r => ({
        user_id: r.id,
        display_name: r.display_name,
        username: r.username,
        is_verified: r.is_verified,
        city: r.city,
        mutuals: r.mutual_count,
        photo_url: pm.get(r.id) ? publicPhotoUrl(pm.get(r.id)) : null,
      })))
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return
    const ids = [...new Set([...likes.map(l => l.user_id), ...sentLikes.map(x => x.user_id)])]
    if (ids.length === 0) return
    let cancelled = false
    ;(async () => {
      const { data: myRows } = await supabase
        .from('follows').select('following_id').eq('follower_id', userId).limit(500)
      const mySet = (myRows || []).map(r => r.following_id)
      if (mySet.length === 0) return
      const { data: mutualRows } = await supabase
        .from('follows')
        .select('following_id')
        .in('following_id', ids)
        .in('follower_id', mySet)
      if (cancelled) return
      const counts = {}
      ;(mutualRows || []).forEach(r => { counts[r.following_id] = (counts[r.following_id] || 0) + 1 })
      setMutuals(counts)
    })()
    return () => { cancelled = true }
  }, [likes, sentLikes, session?.user?.id])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return
    supabase
      .from('matches')
      .update({ seen_at: new Date().toISOString() })
      .is('seen_at', null)
      .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`)
      .then(() => {})
  }, [session?.user?.id])

  // ---- Realtime: reload when likes / matches / follows change for me ----
  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    let timer = null
    const debouncedLoad = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { load() }, 400)
    }

    const ch = supabase
      .channel('matches-rt-' + userId)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'likes', filter: `liked_user_id=eq.${userId}` },
        debouncedLoad)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'likes', filter: `user_id=eq.${userId}` },
        debouncedLoad)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `user_one_id=eq.${userId}` },
        debouncedLoad)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `user_two_id=eq.${userId}` },
        debouncedLoad)
      .subscribe((status) => {
        console.log('[Matches] realtime status:', status)
      })

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(ch)
    }
  }, [session?.user?.id, load])

  async function handleLikeBack(userId) {
    if (busy[userId]) return
    setBusy((b) => ({ ...b, [userId]: true }))
    tap('medium')
    const { data, error: err } = await supabase.rpc('like_user', { target_user_id: userId })
    setBusy((b) => ({ ...b, [userId]: false }))
    if (err) { setError(friendlyError(err)); return }
    await load()
    if (data?.matched) setActiveTab('matches')
  }

  async function handleDecline(userId) {
    if (busy[userId]) return
    setBusy((b) => ({ ...b, [userId]: true }))
    tap('light')
    const { error: err } = await supabase.rpc('decline_like', { target_user_id: userId })
    setBusy((b) => ({ ...b, [userId]: false }))
    if (err) { setError(friendlyError(err)); return }
    setLikes((prev) => prev.filter((x) => x.user_id !== userId))
  }

  async function handleCancelSent(userId) {
    if (busy[userId]) return
    setBusy((b) => ({ ...b, [userId]: true }))
    tap('light')
    const { error: err } = await supabase.rpc('delete_sent_like', { target_user_id: userId })
    setBusy((b) => ({ ...b, [userId]: false }))
    if (err) { setError(friendlyError(err)); return }
    setSentLikes((prev) => prev.filter((x) => x.user_id !== userId))
  }

  const currentList = activeTab === 'matches' ? matches : activeTab === 'likes' ? likes : activeTab === 'sent' ? sentLikes : suggested

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
        <h1 className="text-cream text-[22px] font-extrabold tracking-tight mb-3">
          It's a match <Heart size={18} fill="currentColor" className="inline text-pink-500" />
        </h1>

        <div className="flex px-2 border-b border-white/6">
          {[
            { id: 'matches', label: 'Matches', count: matches.length },
            { id: 'likes',   label: 'Requests', count: likes.length },
            { id: 'sent',    label: 'Sent',    count: sentLikes.length },
            { id: 'suggested', label: 'Suggested', count: suggested.length },
          ].map((t) => {
            const on = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => { tap('light'); setActiveTab(t.id) }}
                className="flex-1 h-11 flex items-center justify-center gap-1.5 text-[13px] font-semibold transition-all relative"
                style={{
                  background: on
                    ? 'linear-gradient(135deg, rgba(236,72,153,0.22) 0%, rgba(168,85,247,0.22) 100%)'
                    : 'transparent',
                  color: on ? '#fff' : '#888',
                  boxShadow: on ? '0 2px 8px rgba(168,85,247,0.3), inset 0 0 0 1px rgba(196,181,253,0.35)' : 'none',
                }}
              >
                {t.label}
                {t.count > 0 && (
                  <span
                    className="px-1.5 rounded-full text-[10.5px] font-black"
                    style={{
                      background: on ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                      color: on ? '#fff' : '#999',
                    }}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-2xl px-3 py-2.5 shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex flex-col animate-pulse">
            {[0,1,2,3,4].map((i) => (
              <div key={i} className="flex items-start gap-3 py-3 border-b border-white/6">
                <div className="w-12 h-12 rounded-full bg-white/[0.06] shrink-0" />
                <div className="flex-1">
                  <div className="h-3 w-1/3 rounded bg-white/[0.08] mb-2" />
                  <div className="h-2.5 w-1/4 rounded bg-white/[0.05] mb-3" />
                  <div className="h-8 w-24 rounded-full bg-white/[0.06]" />
                </div>
              </div>
            ))}
          </div>
        ) : currentList.length === 0 ? (
          <Empty onGo={() => nav('/discover')} tab={activeTab} />
        ) : (
          activeTab === 'suggested' ? (
            <div className="flex flex-col">
              {currentList.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-cream font-bold text-[15px]">No suggestions yet</p>
                  <p className="text-muted text-[12.5px] mt-1">Follow more people to see suggestions here.</p>
                </div>
              ) : currentList.map((u) => (
                <div key={u.user_id} className="flex items-start gap-3 py-3 border-b border-white/6">
                  <button onClick={() => { tap('light'); nav('/profile/' + u.user_id) }} className="shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black">
                      {u.photo_url ? <img src={u.photo_url} alt="" className="w-full h-full object-cover" /> : (u.display_name || u.username || '?')[0].toUpperCase()}
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => { tap('light'); nav('/profile/' + u.user_id) }} className="text-left w-full">
                      <p className="text-cream font-semibold text-[14px] truncate flex items-center gap-1.5">
                        {u.display_name || u.username || 'User'}
                        {u.is_verified && (
                          <span className="w-[14px] h-[14px] rounded-full bg-[#1DA1F2] grid place-items-center shrink-0">
                            <span className="text-white text-[9px] font-black">✓</span>
                          </span>
                        )}
                      </p>
                      <p className="text-muted text-[11.5px] mt-0.5 truncate">
                        {u.mutuals > 0 ? `${u.mutuals} mutual connection${u.mutuals === 1 ? '' : 's'}` : (u.city || 'Suggested for you')}
                      </p>
                    </button>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={async () => {
                          tap('medium')
                          const { error: rpcErr } = await supabase.rpc('like_user', { target_user_id: u.user_id })
                          if (rpcErr) { setError(rpcErr.message); return }
                          setSuggested(prev => prev.filter(x => x.user_id !== u.user_id))
                        }}
                        className="h-8 px-4 rounded-full text-white font-bold text-[12.5px]"
                        style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
                      >
                        Request Match
                      </button>
                      <button
                        onClick={() => { tap('light'); setSuggested(prev => prev.filter(x => x.user_id !== u.user_id)) }}
                        className="h-8 px-4 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[12.5px]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === 'matches' ? (

            <div className="flex flex-col">
              {currentList.map((m) => {
                const ts = m.matched_at
                const mc = mutuals[m.user_id] || 0
                return (
                  <div key={m.user_id} className="flex items-start gap-3 py-3 border-b border-white/6">
                    <button onClick={() => { tap('light'); nav('/profile/' + m.user_id) }} className="shrink-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black">
                        {m.photo_url ? (
                          <img src={m.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (m.display_name || m.username || '?')[0].toUpperCase()
                        )}
                      </div>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <button onClick={() => { tap('light'); nav('/profile/' + m.user_id) }} className="text-left flex-1 min-w-0">
                          <p className="text-cream font-semibold text-[14px] truncate">
                            {m.display_name || m.username || 'User'}
                            {m.age ? `, ${m.age}` : ''}
                          </p>
                          <p className="text-muted text-[11.5px] mt-0.5 truncate">
                            {mc > 0 ? `${mc} mutual connection${mc === 1 ? '' : 's'}` : (m.city ? `📍 ${m.city}` : 'Matched')}
                          </p>
                        </button>
                        {ts && <span className="text-muted text-[11px] shrink-0 mt-1">{timeAgo(ts)}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => { tap('medium'); nav('/messages/' + m.user_id) }}
                          className="h-8 px-4 rounded-full text-white font-bold text-[12.5px]"
                          style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
                        >
                          Message
                        </button>
                        <button
                          onClick={() => { tap('light'); setMenuFor(m.user_id) }}
                          className="w-8 h-8 rounded-full grid place-items-center bg-white/[0.06] border border-white/10 text-cream"
                          aria-label="More"
                        >
                          <MoreHorizontal size={15} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col">
              {currentList.map((m) => {
                const ts = activeTab === 'likes' ? m.liked_at : m.sent_at
                const mc = mutuals[m.user_id] || 0
                return (
                  <div
                    key={m.user_id}
                    className="flex items-start gap-3 py-3 border-b border-white/6"
                  >
                    <button
                      onClick={() => { tap('light'); nav('/profile/' + m.user_id) }}
                      className="shrink-0"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black">
                        {m.photo_url ? (
                          <img src={m.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (m.display_name || m.username || '?')[0].toUpperCase()
                        )}
                      </div>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => { tap('light'); nav('/profile/' + m.user_id) }}
                          className="text-left flex-1 min-w-0"
                        >
                          <p className="text-cream font-semibold text-[14px] truncate">
                            {m.display_name || m.username || 'User'}
                          </p>
                          {mc > 0 && (
                            <p className="text-muted text-[11.5px] mt-0.5">
                              {mc} mutual connection{mc === 1 ? '' : 's'}
                            </p>
                          )}
                        </button>
                        {ts && (
                          <span className="text-muted text-[11px] shrink-0 mt-1">{timeAgo(ts)}</span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        {activeTab === 'likes' ? (
                          <>
                            <button
                              onClick={() => handleDecline(m.user_id)}
                              disabled={busy[m.user_id]}
                              className="flex-1 h-8 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[12.5px] disabled:opacity-50"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => handleLikeBack(m.user_id)}
                              disabled={busy[m.user_id]}
                              className="flex-1 h-8 rounded-full text-white font-bold text-[12.5px] disabled:opacity-50"
                              style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
                            >
                              Confirm
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleCancelSent(m.user_id)}
                            disabled={busy[m.user_id]}
                            className="h-8 px-4 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[12.5px] disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

      </div>

      <div style={{ height: 72, flexShrink: 0 }} />
      <BottomNav />

      {menuFor && (
        <div
          className="fixed inset-0 z-50 grid place-items-end"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setMenuFor(null)}
        >
          <div
            className="w-full max-w-[480px] rounded-t-3xl bg-surface border-t border-white/10 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-2" />
            <button
              onClick={() => { setMenuFor(null); tap("light"); nav("/profile/" + menuFor) }}
              className="w-full text-left px-5 py-3 text-cream text-[14.5px] font-semibold active:bg-white/[0.04]"
            >View profile</button>
            <button
              onClick={() => { setMenuFor(null); tap("light"); nav("/messages/" + menuFor) }}
              className="w-full text-left px-5 py-3 text-cream text-[14.5px] font-semibold active:bg-white/[0.04]"
            >Message</button>
            <button
              onClick={() => { setMenuFor(null); tap("light"); setError("Block coming soon") }}
              className="w-full text-left px-5 py-3 text-cream text-[14.5px] font-semibold active:bg-white/[0.04]"
            >Block</button>
            <button
              onClick={() => { setMenuFor(null); tap("light"); setError("Report coming soon") }}
              className="w-full text-left px-5 py-3 text-cream text-[14.5px] font-semibold active:bg-white/[0.04]"
            >Report</button>
            <button
              onClick={() => { setMenuFor(null); tap("light"); setError("Unmatch coming soon") }}
              className="w-full text-left px-5 py-3 text-danger text-[14.5px] font-semibold active:bg-white/[0.04]"
            >Unmatch</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Empty({ onGo, tab }) {
  const copy = tab === 'likes'
    ? { title: 'No requests yet', body: "When someone requests to match, they'll appear here. Confirm to match." }
    : tab === 'sent'
      ? { title: 'No requests sent', body: 'People you request will appear here while you wait for them to confirm.' }
      : { title: 'No matches yet', body: 'When someone you request confirms, your match will appear here.' }
  return (
    <div className="pt-16 text-center">
      <div className="w-16 h-16 rounded-3xl bg-purple-500/12 border border-purple-500/25 grid place-items-center mx-auto mb-5">
        <Heart size={26} strokeWidth={1.8} className="text-purple-300" />
      </div>
      <h2 className="text-cream text-[18px] font-extrabold mb-1.5">{copy.title}</h2>
      <p className="text-muted text-[13px] mb-6 max-w-[260px] mx-auto">{copy.body}</p>
      <button
        onClick={onGo}
        className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold text-[13px] shadow-[0_8px_20px_rgba(124,58,237,0.45)] mx-auto"
      >
        Discover people
      </button>
    </div>
  )
}
