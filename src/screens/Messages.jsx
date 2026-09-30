import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MessageCircle, RefreshCw, PenSquare, BellOff, Search, X , Users , MoreVertical , Archive, Inbox, CheckCheck , Flag, Ban , Pin } from 'lucide-react'
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
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [tabFilter, setTabFilter] = useState("all")
  const [rowMenuFor, setRowMenuFor] = useState(null)
  const [swipeRow, setSwipeRow] = useState({ key: null, dx: 0 })
  const swipeRowRef = useRef({ key: null, startX: 0, startY: 0, dx: 0, active: false })
  const openRowKeyRef = useRef(null)
  const [pinnedKeys, setPinnedKeys] = useState(new Set())
  const [archivedKeys, setArchivedKeys] = useState(new Set())
  const [onlineUsers, setOnlineUsers] = useState([])
  const [reportRowFor, setReportRowFor] = useState(null)
  const rowPressTimer = useRef(null)
  const rowPressTriggered = useRef(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [error, setError] = useState('')
  const [pullDistance, setPullDistance] = useState(0)
  const pullingRef = useRef(false)
  const pullStartY = useRef(0)
  const [refreshing, setRefreshing] = useState(false)
  const scrollRef = useRef(null)

  async function markAllRead() {
    const uid = session?.user?.id
    if (!uid) return
    tap("light")
    const convIds = [
      ...items.map((x) => x.conversationId),
      ...groupItems.map((x) => x.groupId),
    ].filter(Boolean)
    if (convIds.length === 0) { setHeaderMenuOpen(false); return }

    // DM conversations
    const dmRows = items
      .filter((x) => x.conversationId)
      .map((x) => ({ conversation_id: x.conversationId, user_id: uid, last_read_at: new Date().toISOString() }))
    if (dmRows.length > 0) {
      await supabase.from("conversation_reads").upsert(dmRows, { onConflict: "conversation_id,user_id" })
    }

    // Groups
    const groupRows = groupItems
      .filter((x) => x.groupId)
      .map((x) => ({ group_id: x.groupId, user_id: uid, last_read_at: new Date().toISOString() }))
    if (groupRows.length > 0) {
      await supabase.from("group_reads").upsert(groupRows, { onConflict: "group_id,user_id" })
    }

    setHeaderMenuOpen(false)
    load()
  }

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

    // Compute unread for groups
    if (groupList.length > 0) {
      const gids2 = groupList.map((g) => g.groupId)
      const { data: reads } = await supabase
        .from('group_reads')
        .select('group_id, last_read_at')
        .eq('user_id', userId)
        .in('group_id', gids2)
      const readMap = new Map((reads || []).map((r) => [r.group_id, r.last_read_at]))
      groupList.forEach((g) => {
        const readAt = readMap.get(g.groupId)
        g.unread = g.lastMessageAt && (!readAt || new Date(g.lastMessageAt) > new Date(readAt))
      })
    }

    setGroupItems(groupList)

    // Load pinned conversations + groups
    const [convPins, grpPins] = await Promise.all([
      supabase.from("conversation_pins").select("conversation_id").eq("user_id", userId),
      supabase.from("group_pins").select("group_id").eq("user_id", userId),
    ])
    const pinSet = new Set()
    ;(convPins.data || []).forEach((r) => pinSet.add("c:" + r.conversation_id))
    ;(grpPins.data || []).forEach((r) => pinSet.add("g:" + r.group_id))
    setPinnedKeys(pinSet)

    // Load archived conversations + groups
    const [convArch, grpArch] = await Promise.all([
      supabase.from("conversation_archives").select("conversation_id").eq("user_id", userId),
      supabase.from("group_archives").select("group_id").eq("user_id", userId),
    ])
    const archSet = new Set()
    ;(convArch.data || []).forEach((r) => archSet.add("c:" + r.conversation_id))
    ;(grpArch.data || []).forEach((r) => archSet.add("g:" + r.group_id))
    setArchivedKeys(archSet)

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

  async function markRowRead(item) {
    tap("light")
    const uid = session?.user?.id
    if (!uid) return
    const now = new Date().toISOString()
    if (item.isGroup) {
      await supabase.from("group_reads").upsert(
        { group_id: item.groupId, user_id: uid, last_read_at: now },
        { onConflict: "group_id,user_id" }
      )
    } else if (item.conversationId) {
      await supabase.from("conversation_reads").upsert(
        { conversation_id: item.conversationId, user_id: uid, last_read_at: now },
        { onConflict: "conversation_id,user_id" }
      )
    }
    setRowMenuFor(null)
    load()
  }

  async function toggleRowMute(item) {
    tap("light")
    const uid = session?.user?.id
    if (!uid) return
    if (item.isGroup) {
      if (item.muted) {
        await supabase.from("group_mutes").delete().eq("group_id", item.groupId).eq("user_id", uid)
      } else {
        await supabase.from("group_mutes").insert({ group_id: item.groupId, user_id: uid })
      }
    } else if (item.conversationId) {
      if (item.muted) {
        await supabase.from("conversation_mutes").delete().eq("conversation_id", item.conversationId).eq("user_id", uid)
      } else {
        await supabase.from("conversation_mutes").insert({ conversation_id: item.conversationId, user_id: uid })
      }
    }
    setRowMenuFor(null)
    load()
  }

  async function toggleRowPin(item) {
    tap("light")
    const uid = session?.user?.id
    if (!uid) return
    const key = item.isGroup ? ("g:" + item.groupId) : ("c:" + item.conversationId)
    const table = item.isGroup ? "group_pins" : "conversation_pins"
    const column = item.isGroup ? "group_id" : "conversation_id"
    const value = item.isGroup ? item.groupId : item.conversationId
    const isPinned = pinnedKeys.has(key)

    if (isPinned) {
      await supabase.from(table).delete().eq(column, value).eq("user_id", uid)
      setPinnedKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    } else {
      await supabase.from(table).insert({ [column]: value, user_id: uid })
      setPinnedKeys((prev) => new Set([...prev, key]))
    }
    setRowMenuFor(null)
  }

  async function toggleRowArchive(item) {
    tap("light")
    const uid = session?.user?.id
    if (!uid) return
    const key = item.isGroup ? ("g:" + item.groupId) : ("c:" + item.conversationId)
    const table = item.isGroup ? "group_archives" : "conversation_archives"
    const column = item.isGroup ? "group_id" : "conversation_id"
    const value = item.isGroup ? item.groupId : item.conversationId
    const isArchived = archivedKeys.has(key)

    if (isArchived) {
      await supabase.from(table).delete().eq(column, value).eq("user_id", uid)
    } else {
      await supabase.from(table).insert({ [column]: value, user_id: uid })
    }
    setRowMenuFor(null)
    load()
  }

  async function blockRow(item) {
    if (item.isGroup) return
    if (!confirm("Block " + (item.display_name || "this user") + "? They won't be able to message you.")) return
    tap("medium")
    const uid = session?.user?.id
    if (!uid) return
    await supabase.from("blocks").insert({ blocker_id: uid, blocked_id: item.userId })
    setRowMenuFor(null)
    load()
  }

  const combined = [...groupItems, ...items]
    .filter((item) => {
      const key = item.isGroup ? ("g:" + item.groupId) : ("c:" + item.conversationId)
      return !archivedKeys.has(key)
    })
    .sort((a, b) => {
    const aPin = pinnedKeys.has(a.isGroup ? ("g:" + a.groupId) : ("c:" + a.conversationId))
    const bPin = pinnedKeys.has(b.isGroup ? ("g:" + b.groupId) : ("c:" + b.conversationId))
    if (aPin !== bPin) return aPin ? -1 : 1
    return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
  })

  const tabFiltered = tabFilter === "all"
    ? combined
    : tabFilter === "unread"
      ? combined.filter((item) => item.unread)
      : tabFilter === "groups"
        ? combined.filter((item) => item.isGroup)
        : combined

  const visibleItems = searchQuery.trim()
    ? tabFiltered.filter((item) => {
        const q = searchQuery.toLowerCase()
        return (item.display_name || "").toLowerCase().includes(q)
          || (item.username || "").toLowerCase().includes(q)
          || (item.preview || "").toLowerCase().includes(q)
      })
    : tabFiltered

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
          <button
            onClick={() => { tap("light"); setHeaderMenuOpen(true) }}
            className="w-10 h-10 rounded-full grid place-items-center active:scale-95 transition-transform bg-white/[0.06] border border-white/10"
            aria-label="Chats menu"
          >
            <MoreVertical size={18} className="text-cream" />
          </button>
        </div>
      </div>

      {headerMenuOpen && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setHeaderMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />

            <button
              onClick={markAllRead}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              <CheckCheck size={18} />
              <span className="font-semibold text-[14px]">Mark all as read</span>
            </button>

            <button
              onClick={() => { setHeaderMenuOpen(false); nav("/messages/archived") }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              <Archive size={18} />
              <span className="font-semibold text-[14px]">Archived</span>
            </button>

            <button
              onClick={() => { setHeaderMenuOpen(false); nav("/messages/requests") }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              <Inbox size={18} />
              <span className="font-semibold text-[14px]">Message requests</span>
            </button>

            <button
              onClick={() => { setHeaderMenuOpen(false); nav("/notifications") }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              <span className="w-5 h-5 grid place-items-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </span>
              <span className="font-semibold text-[14px]">Notification settings</span>
            </button>

            <button
              onClick={() => { setHeaderMenuOpen(false); nav("/me") }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              <span className="w-5 h-5 grid place-items-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </span>
              <span className="font-semibold text-[14px]">Settings</span>
            </button>

            <button onClick={() => setHeaderMenuOpen(false)} className="w-full h-11 mt-1 text-muted font-semibold text-[13.5px]">Cancel</button>
          </div>
        </div>
      )}

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

        {/* Filter tabs */}
        <div className="flex gap-1.5 mt-2.5">
          {[
            { id: "all",    label: "All" },
            { id: "unread", label: "Unread" },
            { id: "groups", label: "Groups" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { tap("light"); setTabFilter(t.id) }}
              className="h-8 px-3.5 rounded-full text-[12.5px] font-bold transition-colors"
              style={{
                background: tabFilter === t.id
                  ? "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)"
                  : "rgba(255,255,255,0.05)",
                border: tabFilter === t.id ? "none" : "1px solid rgba(255,255,255,0.08)",
                color: tabFilter === t.id ? "#fff" : "#aaa",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 pb-4"
           onTouchStart={onTouchStart}
           onTouchMove={onTouchMove}
           onTouchEnd={onTouchEnd}>
        {/* Active now — horizontal strip */}
        {!loading && tabFilter === "all" && !searchQuery.trim() && onlineUsers.length > 0 && (
          <div className="mb-3">
            <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2 px-1">
              Active now
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {onlineUsers.slice(0, 15).map((u) => (
                <button
                  key={u.id}
                  onClick={() => { tap("light"); nav("/messages/" + u.id) }}
                  className="shrink-0 flex flex-col items-center gap-1.5 active:opacity-80"
                  style={{ width: 64 }}
                >
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-elevated border-2 border-emerald-400/70">
                      {u.photo_url ? (
                        <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-purple-400 font-black text-lg">
                          {(u.display_name || u.username || "?")[0]}
                        </div>
                      )}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0B0B14]" />
                  </div>
                  <span className="text-cream text-[11px] font-semibold truncate w-full text-center">
                    {(u.display_name || u.username || "User").split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

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
          ) : tabFilter === "unread" ? (
            <div className="pt-16 text-center px-6">
              <p className="text-cream font-bold text-[15px] mb-1">No unread chats</p>
              <p className="text-muted text-[13px]">You're all caught up.</p>
            </div>
          ) : tabFilter === "groups" ? (
            <div className="pt-16 text-center px-6">
              <p className="text-cream font-bold text-[15px] mb-1">No groups yet</p>
              <p className="text-muted text-[13px]">Create one with the group button above.</p>
            </div>
          ) : (
            <Empty onGo={() => nav('/discover')} />
          )
        ) : (
          <div className="flex flex-col gap-1 pt-1">
            {visibleItems.map((item) => (
              <div
                key={item.userId}
                className="relative overflow-hidden rounded-2xl"
              >
                {/* Reveal actions behind */}
                <div className="absolute inset-y-0 right-0 flex">
                  <button
                    onClick={() => { toggleRowMute(item); openRowKeyRef.current = null; setSwipeRow({ key: null, dx: 0 }) }}
                    className="w-[90px] h-full flex flex-col items-center justify-center gap-1 text-cream"
                    style={{ background: "rgba(168,85,247,0.25)" }}
                  >
                    {item.muted ? <Bell size={18} /> : <BellOff size={18} />}
                    <span className="text-[11px] font-bold">{item.muted ? "Unmute" : "Mute"}</span>
                  </button>
                  <button
                    onClick={() => { toggleRowArchive(item); openRowKeyRef.current = null; setSwipeRow({ key: null, dx: 0 }) }}
                    className="w-[90px] h-full flex flex-col items-center justify-center gap-1 text-cream"
                    style={{ background: "rgba(236,72,153,0.35)" }}
                  >
                    <Archive size={18} />
                    <span className="text-[11px] font-bold">Archive</span>
                  </button>
                </div>

                {/* Front content */}
                <div
                  onTouchStart={(e) => {
                    rowPressTriggered.current = false
                    openRowKeyRef.current = null
                    setSwipeRow({ key: null, dx: 0 })
                    const t = e.touches[0]
                    swipeRowRef.current = { key: item.userId, startX: t.clientX, startY: t.clientY, dx: 0, active: false }
                    rowPressTimer.current = setTimeout(() => {
                      rowPressTriggered.current = true
                      tap("medium")
                      setRowMenuFor(item)
                    }, 500)
                  }}
                  onTouchMove={(e) => {
                    const sw = swipeRowRef.current
                    if (!sw.key) return
                    const t = e.touches[0]
                    const dx = t.clientX - sw.startX
                    const dy = t.clientY - sw.startY
                    // Horizontal swipe detection — vertical scroll wins if mostly vertical
                    if (!sw.active && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
                      sw.active = true
                      clearTimeout(rowPressTimer.current)
                    }
                    if (sw.active) {
                      // Only allow leftward swipe
                      sw.dx = Math.max(-180, Math.min(0, dx))
                      setSwipeRow({ key: sw.key, dx: sw.dx })
                    }
                  }}
                  onTouchEnd={() => {
                    clearTimeout(rowPressTimer.current)
                    const sw = swipeRowRef.current
                    if (sw.active) {
                      // Snap open if past 60px, else close
                      const open = sw.dx <= -60
                      setSwipeRow({ key: open ? sw.key : null, dx: open ? -180 : 0 })
                      openRowKeyRef.current = open ? sw.key : null
                      swipeRowRef.current = { key: null, startX: 0, startY: 0, dx: 0, active: false }
                      return
                    }
                    swipeRowRef.current = { key: null, startX: 0, startY: 0, dx: 0, active: false }
                    if (!rowPressTriggered.current) {
                      tap('light')
                      if (item.isGroup) nav('/groups/' + item.groupId)
                      else nav('/messages/' + item.userId)
                    }
                  }}
                  onContextMenu={(e) => { e.preventDefault(); setRowMenuFor(item) }}
                  className="flex items-center gap-3 p-3 hover:bg-white/[0.03] transition-colors text-left active:opacity-90 cursor-pointer bg-transparent"
                  style={{
                    transform: swipeRow.key === item.userId ? `translateX(${swipeRow.dx}px)` : undefined,
                    transition: swipeRow.key === item.userId ? "none" : "transform 220ms ease-out",
                    position: "relative",
                    zIndex: 1,
                  }}
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
                  {pinnedKeys.has(item.isGroup ? ("g:" + item.groupId) : ("c:" + item.conversationId)) && (
                    <Pin size={11} className="text-purple-400" />
                  )}
                  <span className="text-[10.5px] text-subtle font-medium">
                    {relTime(item.lastMessageAt)}
                  </span>
                  {item.unread && (
                    <span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
                  )}
                </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {rowMenuFor && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setRowMenuFor(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <p className="text-cream font-bold text-[15px] mb-2 truncate">
              {rowMenuFor.display_name || rowMenuFor.username || "Chat"}
            </p>

            <button
              onClick={() => toggleRowPin(rowMenuFor)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              <Pin size={18} />
              <span className="font-semibold text-[14px]">
                {pinnedKeys.has(rowMenuFor.isGroup ? ("g:" + rowMenuFor.groupId) : ("c:" + rowMenuFor.conversationId))
                  ? "Unpin"
                  : "Pin to top"}
              </span>
            </button>

            <button
              onClick={() => markRowRead(rowMenuFor)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              <CheckCheck size={18} />
              <span className="font-semibold text-[14px]">Mark as read</span>
            </button>

            <button
              onClick={() => toggleRowMute(rowMenuFor)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              {rowMenuFor.muted ? <Bell size={18} /> : <BellOff size={18} />}
              <span className="font-semibold text-[14px]">{rowMenuFor.muted ? "Unmute" : "Mute notifications"}</span>
            </button>

            <button
              onClick={() => { setReportRowFor(rowMenuFor); setRowMenuFor(null) }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              <Flag size={18} />
              <span className="font-semibold text-[14px]">Report</span>
            </button>

            {!rowMenuFor.isGroup && (
              <button
                onClick={() => blockRow(rowMenuFor)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-danger/10 border border-danger/30 text-left text-danger"
              >
                <Ban size={18} />
                <span className="font-semibold text-[14px]">Block</span>
              </button>
            )}

            <button
              onClick={() => toggleRowArchive(rowMenuFor)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              <Archive size={18} />
              <span className="font-semibold text-[14px]">Archive chat</span>
            </button>

            <button onClick={() => setRowMenuFor(null)} className="w-full h-11 mt-1 text-muted font-semibold text-[13.5px]">Cancel</button>
          </div>
        </div>
      )}

      {reportRowFor && (
        <ReportModal
          open={!!reportRowFor}
          onClose={() => setReportRowFor(null)}
          target={reportRowFor.isGroup
            ? { id: reportRowFor.groupId, name: reportRowFor.display_name, isGroup: true }
            : { id: reportRowFor.userId, display_name: reportRowFor.display_name, username: reportRowFor.username }}
        />
      )}

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
