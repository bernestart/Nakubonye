import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MessageCircle, RefreshCw } from 'lucide-react'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl } from '../lib/photo'
import { tap } from '../lib/haptic'
import BottomNav from '../components/BottomNav'
import NotificationBell from '../components/NotificationBell'
import BrandGlow from '../components/BrandGlow'

export default function Messages() {
  const nav = useNavigate()
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true); setError('')
    const userId = session.user.id

    const { data: matches, error: mErr } = await supabase
      .from('matches')
      .select('id, user_one_id, user_two_id, created_at')
      .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (mErr) { setError(friendlyError(mErr)); setLoading(false); return }

    const matchList = matches || []
    // NOTE: do not early-return here. Direct conversations must still be loaded
    // even when the user has zero matches.

    const matchIds = matchList.map((m) => m.id)
    const otherByMatch = new Map(
      matchList.map((m) => [m.id, m.user_one_id === userId ? m.user_two_id : m.user_one_id])
    )

    const { data: convs } = await supabase
      .from('conversations')
      .select('id, match_id, created_at, last_message_at, last_message_preview')
      .in('match_id', matchIds)

    const convByMatch = new Map((convs || []).map((c) => [c.match_id, c]))
    const convIds = (convs || []).map((c) => c.id)

    const readsMap = new Map()
    if (convIds.length) {
      const { data: reads } = await supabase
        .from('conversation_reads')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId)
        .in('conversation_id', convIds)
      ;(reads || []).forEach((r) => readsMap.set(r.conversation_id, r.last_read_at))
    }

    const otherIds = [...new Set([...otherByMatch.values()])]
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, display_name, username, is_verified')
      .in('id', otherIds)

    const { data: photos } = await supabase
      .from('profile_photos')
      .select('user_id, storage_path, is_primary, display_order')
      .in('user_id', otherIds)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true })

    const pmap = new Map()
    ;(photos || []).forEach((p) => { if (!pmap.has(p.user_id)) pmap.set(p.user_id, p.storage_path) })
    const profMap = new Map((profs || []).map((p) => [p.id, p]))

    const list = matchList.map((m) => {
      const otherId = otherByMatch.get(m.id)
      const conv = convByMatch.get(m.id)
      const p = profMap.get(otherId)
      if (!p) return null
      const readAt = conv ? readsMap.get(conv.id) : null
      const unread = conv?.last_message_at && (!readAt || new Date(conv.last_message_at) > new Date(readAt))
      return {
        matchId: m.id,
        conversationId: conv?.id || null,
        userId: otherId,
        display_name: p.display_name,
        username: p.username,
        is_verified: p.is_verified,
        photo_url: publicPhotoUrl(pmap.get(otherId)),
        preview: conv?.last_message_preview || null,
        lastMessageAt: conv?.last_message_at || m.created_at,
        unread: !!unread,
      }
    }).filter(Boolean).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))

    // ---------- Also include DIRECT conversations ----------
    const { data: directConvs } = await supabase
      .from('conversations')
      .select('id, initiator_id, recipient_id, last_message_at, last_message_preview, is_direct')
      .eq('is_direct', true)
      .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('last_message_at', { ascending: false, nullsLast: true })

    if (directConvs?.length) {
      const directOtherIds = directConvs
        .map((c) => c.initiator_id === userId ? c.recipient_id : c.initiator_id)
        .filter(Boolean)
      const freshIds = directOtherIds.filter((id) => !list.some((x) => x.userId === id))

      let dcProfMap = new Map()
      let dcPhotoMap = new Map()
      if (freshIds.length) {
        const { data: profs } = await supabase
          .from('profiles').select('id, display_name, username, is_verified').in('id', freshIds)
        ;(profs || []).forEach((p) => dcProfMap.set(p.id, p))
        const { data: photos } = await supabase
          .from('profile_photos')
          .select('user_id, storage_path, is_primary, display_order')
          .in('user_id', freshIds)
          .order('is_primary', { ascending: false })
          .order('display_order', { ascending: true })
        ;(photos || []).forEach((p) => {
          if (!dcPhotoMap.has(p.user_id)) dcPhotoMap.set(p.user_id, p.storage_path)
        })
      }

      const dcReadMap = new Map()
      if (directConvs.length) {
        const { data: reads } = await supabase
          .from('conversation_reads')
          .select('conversation_id, last_read_at')
          .eq('user_id', userId)
          .in('conversation_id', directConvs.map((c) => c.id))
        ;(reads || []).forEach((r) => dcReadMap.set(r.conversation_id, r.last_read_at))
      }

      directConvs.forEach((c) => {
        const other = c.initiator_id === userId ? c.recipient_id : c.initiator_id
        if (!other) return
        if (list.some((x) => x.userId === other)) return // already in list from match path
        const p = dcProfMap.get(other)
        if (!p) return
        const readAt = dcReadMap.get(c.id)
        const unread = c.last_message_at && (!readAt || new Date(c.last_message_at) > new Date(readAt))
        list.push({
          matchId: null,
          conversationId: c.id,
          userId: other,
          display_name: p.display_name,
          username: p.username,
          is_verified: p.is_verified,
          photo_url: publicPhotoUrl(dcPhotoMap.get(other)),
          preview: c.last_message_preview || null,
          lastMessageAt: c.last_message_at || c.id,
          unread: !!unread,
          isDirect: true,
        })
      })
    }

    list.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))

    setItems(list)
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

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
      <header
        style={{ height: 52, flexShrink: 0 }}
        className="px-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-600 grid place-items-center shadow-[0_4px_12px_rgba(124,58,237,0.45)]">
            <span className="text-white font-black text-sm">N</span>
          </div>
          <span className="text-cream font-bold text-[14px]">Messages</span>
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

      {error && (
        <div className="mx-4 mb-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4">
        {loading ? (
          <div className="flex flex-col gap-2 pt-2">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="h-16 rounded-2xl bg-surface animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty onGo={() => nav('/discover')} />
        ) : (
          <div className="flex flex-col gap-1 pt-1">
            {items.map((item) => (
              <motion.button
                key={item.userId}
                whileTap={{ scale: 0.98 }}
                onClick={() => { tap('light'); nav('/messages/' + item.userId) }}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.03] transition-colors text-left"
              >
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-elevated border border-white/8">
                    {item.photo_url ? (
                      <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-xl font-black text-purple-400">
                        {(item.display_name || '?')[0]}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <strong className="text-cream text-[14.5px] font-semibold truncate">
                      {item.display_name || item.username || 'Someone'}
                    </strong>
                    {item.is_verified && (
                      <span className="text-purple-400 text-[11px]">✓</span>
                    )}
                  </div>
                  <p className={`text-[13px] truncate ${item.unread ? 'text-cream font-medium' : 'text-muted'}`}>
                    {item.preview || 'Say hello 👋'}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-[10.5px] text-subtle font-medium">
                    {relTime(item.lastMessageAt)}
                  </span>
                  {item.unread && (
                    <span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 72, flexShrink: 0 }} />
      <BottomNav />
    </div>
  )
}

function relTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return Math.floor(diff / 60) + 'm'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h'
  if (diff < 604800) return Math.floor(diff / 86400) + 'd'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function Empty({ onGo }) {
  return (
    <div className="pt-16 text-center px-6">
      <div className="w-16 h-16 rounded-3xl bg-purple-500/12 border border-purple-500/25 grid place-items-center mx-auto mb-5">
        <MessageCircle size={26} strokeWidth={1.8} className="text-purple-300" />
      </div>
      <h2 className="text-cream text-[18px] font-extrabold mb-1.5">No messages yet</h2>
      <p className="text-muted text-[13px] mb-6 max-w-[260px] mx-auto">
        When you match with someone, your conversation will appear here.
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
