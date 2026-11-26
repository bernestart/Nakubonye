import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, RefreshCw, MapPin, MessageCircle, Check, X, MoreHorizontal } from 'lucide-react'
import { friendlyError } from '../lib/errors'
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
    try {
      const res = await fetch('/api/matches/data?markSeen=1')
      const j = await res.json()
      if (!j.success) { setError(j.error || 'Failed to load'); setLoading(false); return }
      const d = j.data || {}
      setMatches((d.matches || []).map(x => ({ ...x, photo_url: x.photo_url ? publicPhotoUrl(x.photo_url) : null })))
      setLikes((d.likes || []).map(x => ({ ...x, photo_url: x.photo_url ? publicPhotoUrl(x.photo_url) : null })))
      setSentLikes((d.sent || []).map(x => ({ ...x, photo_url: x.photo_url ? publicPhotoUrl(x.photo_url) : null })))
      setSuggested((d.suggested || []).map(x => ({ ...x, photo_url: x.photo_url ? publicPhotoUrl(x.photo_url) : null })))
      setMutuals(d.mutuals || {})
    } catch (e) {
      setError(e.message || 'Network error')
    }
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  // ---- Realtime: reload when likes / matches / follows change for me ----

  async function handleLikeBack(userId) {
    if (busy[userId]) return
    setBusy((b) => ({ ...b, [userId]: true }))
    tap('medium')
    try {
      const res = await fetch('/api/profile/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', targetUserId: userId }),
      })
      const j = await res.json()
      setBusy((b) => ({ ...b, [userId]: false }))
      if (!j.success) { setError(j.error || 'Failed'); return }
      await load()
      if (j.data?.matched) setActiveTab('matches')
    } catch (e) {
      setBusy((b) => ({ ...b, [userId]: false }))
      setError(e.message || 'Network error')
    }
  }

  async function handleDecline(userId) {
    if (busy[userId]) return
    setBusy((b) => ({ ...b, [userId]: true }))
    tap('light')
    try {
      const res = await fetch('/api/profile/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', targetUserId: userId }),
      })
      const j = await res.json()
      setBusy((b) => ({ ...b, [userId]: false }))
      if (!j.success) { setError(j.error || 'Failed'); return }
      setLikes((prev) => prev.filter((x) => x.user_id !== userId))
    } catch (e) {
      setBusy((b) => ({ ...b, [userId]: false }))
      setError(e.message || 'Network error')
    }
  }

  async function handleCancelSent(userId) {
    if (busy[userId]) return
    setBusy((b) => ({ ...b, [userId]: true }))
    tap('light')
    try {
      const res = await fetch('/api/matches/like/' + userId, { method: 'DELETE' })
      const j = await res.json()
      setBusy((b) => ({ ...b, [userId]: false }))
      if (!j.success) { setError(j.error || 'Failed'); return }
      setSentLikes((prev) => prev.filter((x) => x.user_id !== userId))
    } catch (e) {
      setBusy((b) => ({ ...b, [userId]: false }))
      setError(e.message || 'Network error')
    }
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
                        {u.mutuals > 0 ? `${u.mutuals} mutual ${u.account_type === 'creator' ? 'follower' : 'match'}${u.mutuals === 1 ? '' : 's'}` : (u.city || 'Suggested for you')}
                      </p>
                    </button>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={async () => {
                          tap('medium')
                          const { error: rpcErr } = await fetch('/api/profile/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'like', targetUserId: u.user_id }) }).then(r => r.json()).then(j => ({ error: j.success ? null : { message: j.error || 'Failed' } }))
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
                            {mc > 0 ? `${mc} mutual ${m.account_type === 'creator' ? 'follower' : 'match'}${mc === 1 ? '' : 's'}` : (m.city ? `📍 ${m.city}` : 'Matched')}
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
