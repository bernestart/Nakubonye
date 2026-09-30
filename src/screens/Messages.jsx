import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MessageCircle, RefreshCw, PenSquare, BellOff, Search, X , Users } from 'lucide-react'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl } from '../lib/photo'
import { isOnline } from '../lib/usePresence'
import { tap } from '../lib/haptic'
import BottomNav from '../components/BottomNav'
import AppHeader from '../components/AppHeader'
import NewMessageSheet from '../components/NewMessageSheet'
import NotificationBell from '../components/NotificationBell'
import BrandGlow from '../components/BrandGlow'

export default function Messages() {
  const nav = useNavigate()
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [groupItems, setGroupItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newMsgOpen, setNewMsgOpen] = useState(false)
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [error, setError] = useState('')
  const [pullDistance, setPullDistance] = useState(0)
  const pullingRef = useRef(false)
  const pullStartY = useRef(0)
  const [refreshing, setRefreshing] = useState(false)
  const scrollRef = useRef(null)

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
      .select('id, display_name, username, is_verified, last_seen_at')
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
        last_seen_at: p.last_seen_at || null,
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
          .from('profiles').select('id, display_name, username, is_verified, last_seen_at').in('id', freshIds)
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
          last_seen_at: p.last_seen_at || null,
          preview: c.last_message_preview || null,
          lastMessageAt: c.last_message_at || c.created_at,
          unread: !!unread,
          isDirect: true,
        })
      })
    }

    list.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))

    // Load mute states
    const convIdsForMute = list.map((x) => x.conversationId).filter(Boolean)
    if (convIdsForMute.length > 0) {
      const { data: mutes } = await supabase
        .from('conversation_mutes')
        .select('conversation_id')
        .eq('user_id', userId)
        .in('conversation_id', convIdsForMute)
      const mutedSet = new Set((mutes || []).map((m) => m.conversation_id))
      list.forEach((x) => { x.muted = x.conversationId ? mutedSet.has(x.conversationId) : false })
    }

    // ---------- Groups ----------
    const { data: memRows } = await supabase
      .from('group_members')
      .select('group_id, role, joined_at')
      .eq('user_id', userId)

    let groupList = []
    if (memRows && memRows.length > 0) {
      const gids = memRows.map((m) => m.group_id)
      const { data: groupsData } = await supabase
        .from('groups')
        .select('id, name, avatar_url, updated_at')
        .in('id', gids)
      const { data: lastMsgs } = await supabase
        .from('group_messages')
        .select('group_id, sender_id, content, media_type, created_at, deleted_at')
        .in('group_id', gids)
        .order('created_at', { ascending: false })

      // pick the latest per group
      const lastByGroup = new Map()
      ;(lastMsgs || []).forEach((m) => {
        if (!lastByGroup.has(m.group_id)) lastByGroup.set(m.group_id, m)
      })

      groupList = (groupsData || []).map((g) => {
        const last = lastByGroup.get(g.id)
        let preview = null
        if (last) {
          if (last.deleted_at) preview = null
          else if (last.media_type?.startsWith('image/')) preview = '📷 Photo'
          else preview = last.content || null
        }
        return {
          isGroup: true,
          groupId: g.id,
          conversationId: null,
          display_name: g.name,
          photo_url: g.avatar_url || null,
          preview,
          lastMessageAt: last?.created_at || g.updated_at,
        }
      })
    }

    setGroupItems(groupList)

    setItems(list)
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) return
    let debounce = null
    const schedule = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => load(), 400)
    }
    const ch = supabase
      .channel('messages-list-' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, schedule)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, schedule)
      .subscribe()
    const combined = [...groupItems, ...items].sort((a, b) =>
    new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
  )

  const visibleItems = searchQuery.trim()
    ? combined.filter((item) => {
        const q = searchQuery.toLowerCase()
        return (item.display_name || "").toLowerCase().includes(q)
          || (item.username || "").toLowerCase().includes(q)
          || (item.preview || "").toLowerCase().includes(q)
      })
    : combined

  return () => { if (debounce) clearTimeout(debounce); supabase.removeChannel(ch) }
  }, [session?.user?.id, load])

  function onTouchStart(e) {
    const el = scrollRef.current
    if (!el || el.scrollTop > 0 || refreshing) return
    pullStartY.current = e.touches[0].clientY
    pullingRef.current = true
  }
  function onTouchMove(e) {
    if (!pullingRef.current) return
    const dy = e.touches[0].clientY - pullStartY.current
    if (dy > 0) setPullDistance(Math.min(dy * 0.5, 100))
  }
  async function onTouchEnd() {
    if (!pullingRef.current) return
    pullingRef.current = false
    const d = pullDistance
    setPullDistance(0)
    if (d < 60) return
    setRefreshing(true)
    try { await load() } catch {}
    setRefreshing(false)
  }

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

      {/* Messages list header */}
      <div className="px-4 pt-2 pb-3 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-cream text-[22px] font-extrabold tracking-tight">
            Messages
          </h1>
          <p className="text-muted text-[12.5px] mt-0.5">
            {items.length === 0 ? "No conversations yet" : items.length + (items.length === 1 ? " conversation" : " conversations")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { tap("light"); nav("/groups/new") }}
            className="w-10 h-10 rounded-full grid place-items-center active:scale-95 transition-transform bg-white/[0.06] border border-white/10"
            aria-label="New group"
          >
            <Users size={18} className="text-cream" />
          </button>
          <button
            onClick={() => { tap("light"); setNewMsgOpen(true) }}
            className="w-10 h-10 rounded-full grid place-items-center active:scale-95 transition-transform"
            style={{
              background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)",
              boxShadow: "0 6px 18px rgba(236,72,153,0.45)",
            }}
            aria-label="New message"
          >
            <PenSquare size={18} color="#fff" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 shrink-0">
          {error}
        </div>
      )}

      {pullDistance > 0 && (
        <div className="grid place-items-center py-2 text-purple-300 text-[11.5px] font-semibold" style={{ opacity: Math.min(1, pullDistance / 60) }}>
          {pullDistance >= 60 ? "Release to refresh" : "Pull to refresh"}
        </div>
      )}
      <div className="px-4 pb-3 shrink-0">
        <div className="flex items-center gap-2 rounded-2xl bg-surface border border-white/8 px-3.5 h-10">
          <Search size={15} className="text-muted shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations…"
            className="flex-1 bg-transparent border-0 text-cream text-[13.5px] placeholder:text-subtle focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-muted shrink-0" aria-label="Clear">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 pb-4"
           onTouchStart={onTouchStart}
           onTouchMove={onTouchMove}
           onTouchEnd={onTouchEnd}>
        {loading ? (
          <div className="flex flex-col gap-1 pt-2 animate-pulse">
            {[0,1,2,3,4,5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-2xl">
                <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/8 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-3 w-1/3 rounded bg-white/[0.08] mb-2" />
                  <div className="h-2.5 w-2/3 rounded bg-white/[0.05]" />
                </div>
                <div className="h-2.5 w-8 rounded bg-white/[0.05] shrink-0" />
              </div>
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          searchQuery.trim() ? (
            <div className="pt-16 text-center px-6">
              <p className="text-cream font-bold text-[15px] mb-1">No matches</p>
              <p className="text-muted text-[13px]">Try a different search.</p>
            </div>
          ) : (
            <Empty onGo={() => nav('/discover')} />
          )
        ) : (
          <div className="flex flex-col gap-1 pt-1">
            {visibleItems.map((item) => (
              <motion.button
                key={item.userId}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  tap('light')
                  if (item.isGroup) nav('/groups/' + item.groupId)
                  else nav('/messages/' + item.userId)
                }}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.03] transition-colors text-left"
              >
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-elevated border border-white/8">
                    {item.photo_url ? (
                      <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : item.isGroup ? (
                      <div className="w-full h-full grid place-items-center text-purple-400">
                        <Users size={22} />
                      </div>
                    ) : (
                      <div className="w-full h-full grid place-items-center text-xl font-black text-purple-400">
                        {(item.display_name || '?')[0]}
                      </div>
                    )}
                  </div>
                  {!item.isGroup && item.last_seen_at && isOnline(item.last_seen_at, 3) && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0B0B14]" style={{ boxShadow: "0 0 8px rgba(52,211,153,0.9)" }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <strong className="text-cream text-[14.5px] font-semibold truncate">
                      {item.display_name || item.username || 'Someone'}
                    </strong>
                    {item.is_verified && (
                      <span className="text-purple-400 text-[11px]">✓</span>
                    )}
                    {item.muted && <BellOff size={12} className="text-subtle shrink-0" />}
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
      {newMsgOpen && (
        <NewMessageSheet onClose={() => setNewMsgOpen(false)} />
      )}

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
        onClick={() => { tap('light'); onGo() }}
        className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold text-[13px] shadow-[0_8px_20px_rgba(124,58,237,0.45)] mx-auto"
      >
        Discover people
      </button>
    </div>
  )
}
