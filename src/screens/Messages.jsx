import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MessageCircle, RefreshCw, PenSquare, BellOff, Search, X , Users , MoreVertical , Archive, Inbox, CheckCheck , Flag, Ban , Pin , Trash2 , Settings } from 'lucide-react'
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
  const [tabFilter, setTabFilter] = useState("all")
  const [rowMenuFor, setRowMenuFor] = useState(null)
  const [pinnedKeys, setPinnedKeys] = useState(new Set())
  const [archivedKeys, setArchivedKeys] = useState(new Set())
  const [deletedKeys, setDeletedKeys] = useState(new Set())
  const [onlineUsers, setOnlineUsers] = useState([])
  const [storyOwners, setStoryOwners] = useState(new Set())
  const [pendingRequests, setPendingRequests] = useState(0)
  const [viewedStoryOwners, setViewedStoryOwners] = useState(new Set())
  const [reportRowFor, setReportRowFor] = useState(null)
  const rowPressTimer = useRef(null)
  const tapStartRef = useRef({ x: 0, y: 0 })
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

    // Load deleted conversations + groups
    const [convDel, grpDel] = await Promise.all([
      supabase.from("conversation_deletes").select("conversation_id").eq("user_id", userId),
      supabase.from("group_deletes").select("group_id").eq("user_id", userId),
    ])
    const delSet = new Set()
    ;(convDel.data || []).forEach((r) => delSet.add("c:" + r.conversation_id))
    ;(grpDel.data || []).forEach((r) => delSet.add("g:" + r.group_id))
    setDeletedKeys(delSet)

    // Online users — recent last_seen_at, excluding me
    const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    const { data: onlineRows } = await supabase
      .from("profiles")
      .select("id, display_name, username, last_seen_at")
      .gt("last_seen_at", cutoff)
      .neq("id", userId)
      .eq("is_active", true)
      .order("last_seen_at", { ascending: false })
      .limit(30)

    let visibleOnline = []
    if (onlineRows && onlineRows.length > 0) {
      const ids = onlineRows.map((r) => r.id)
      const [settingsRes, blocksRes, matchesRes, followsRes] = await Promise.all([
        supabase.from("user_settings").select("user_id, who_can_see_online, show_activity_status").in("user_id", ids),
        supabase.from("blocks").select("blocker_id, blocked_id").or("blocker_id.eq." + userId + ",blocked_id.eq." + userId),
        supabase.from("matches").select("user_one_id, user_two_id").or("user_one_id.eq." + userId + ",user_two_id.eq." + userId),
        supabase.from("follows").select("following_id").eq("follower_id", userId),
      ])
      const sMap = new Map((settingsRes.data || []).map((r) => [r.user_id, r]))
      const blockSet = new Set()
      ;(blocksRes.data || []).forEach((b) => {
        if (b.blocker_id === userId) blockSet.add(b.blocked_id)
        if (b.blocked_id === userId) blockSet.add(b.blocker_id)
      })
      const matchSet2 = new Set()
      ;(matchesRes.data || []).forEach((m) => {
        if (m.user_one_id === userId) matchSet2.add(m.user_two_id)
        if (m.user_two_id === userId) matchSet2.add(m.user_one_id)
      })
      const followSet = new Set((followsRes.data || []).map((f) => f.following_id))

      visibleOnline = onlineRows.filter((u) => {
        if (blockSet.has(u.id)) return false
        const row = sMap.get(u.id)
        if (!row) return true
        if (row.show_activity_status === false) return false
        const v = row.who_can_see_online || "everyone"
        if (v === "nobody") return false
        if (v === "everyone") return true
        if (v === "matches") return matchSet2.has(u.id)
        if (v === "following") return followSet.has(u.id)
        return true
      })

      if (visibleOnline.length > 0) {
        const vids = visibleOnline.map((u) => u.id)
        const { data: ph } = await supabase
          .from("profile_photos")
          .select("user_id, storage_path, is_primary, display_order")
          .in("user_id", vids)
          .order("is_primary", { ascending: false })
          .order("display_order", { ascending: true })
        const pm = new Map()
        ;(ph || []).forEach((p) => { if (!pm.has(p.user_id)) pm.set(p.user_id, p.storage_path) })
        visibleOnline = visibleOnline.map((u) => ({
          ...u,
          photo_url: pm.get(u.id) ? publicPhotoUrl(pm.get(u.id)) : null,
        }))
      }
    }
    setOnlineUsers(visibleOnline)

    // Active stories for people in my inbox
    const dmUserIds = [...new Set(list.map((x) => x.userId).filter(Boolean))]
    let owners = new Set()
    let viewedOwners = new Set()
    if (dmUserIds.length > 0) {
      const { data: storyRows } = await supabase
        .from("stories")
        .select("id, user_id")
        .in("user_id", dmUserIds)
        .gt("expires_at", new Date().toISOString())
      ;(storyRows || []).forEach((r) => owners.add(r.user_id))

      const storyIds = (storyRows || []).map((r) => r.id)
      if (storyIds.length > 0) {
        const { data: viewRows } = await supabase
          .from("story_views")
          .select("story_id")
          .eq("user_id", userId)
          .in("story_id", storyIds)
        const viewedIds = new Set((viewRows || []).map((v) => v.story_id))
        const byOwner = new Map()
        ;(storyRows || []).forEach((r) => {
          if (!byOwner.has(r.user_id)) byOwner.set(r.user_id, [])
          byOwner.get(r.user_id).push(r.id)
        })
        byOwner.forEach((ids, owner) => {
          if (ids.every((id) => viewedIds.has(id))) viewedOwners.add(owner)
        })
      }
    }
    setStoryOwners(owners)
    setViewedStoryOwners(viewedOwners)

    // Pending message request count
    const { count: reqCount } = await supabase
      .from("message_requests")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("status", "pending")
    setPendingRequests(reqCount || 0)

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

  async function markRowUnread(item) {
    tap("light")
    const uid = session?.user?.id
    if (!uid) return
    // Set last_read_at to a time BEFORE the last message → row appears unread
    const t = item.lastMessageAt || new Date().toISOString()
    const before = new Date(new Date(t).getTime() - 60000).toISOString()
    if (item.isGroup) {
      await supabase.from("group_reads").upsert(
        { group_id: item.groupId, user_id: uid, last_read_at: before },
        { onConflict: "group_id,user_id" }
      )
    } else if (item.conversationId) {
      await supabase.from("conversation_reads").upsert(
        { conversation_id: item.conversationId, user_id: uid, last_read_at: before },
        { onConflict: "conversation_id,user_id" }
      )
    }
    setRowMenuFor(null)
    load()
  }

  async function deleteRow(item) {
    if (!confirm("Delete this conversation? It will be removed from your inbox. The other person will still see it.")) return
    tap("medium")
    const uid = session?.user?.id
    if (!uid) return
    if (item.isGroup) {
      await supabase.from("group_deletes").insert({ group_id: item.groupId, user_id: uid })
    } else if (item.conversationId) {
      await supabase.from("conversation_deletes").insert({ conversation_id: item.conversationId, user_id: uid })
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
      if (deletedKeys.has(key)) return false
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

  const displayItems = visibleItems

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
            onClick={() => { tap("light"); nav("/messages/settings") }}
            className="relative w-10 h-10 rounded-full grid place-items-center active:scale-95 transition-transform bg-white/[0.06] border border-white/10"
            aria-label="Messaging settings"
          >
            <Settings size={18} className="text-cream" />
            {pendingRequests > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center text-white text-[10.5px] font-black"
                    style={{ background: "#EC4899", boxShadow: "0 0 6px rgba(236,72,153,0.8)" }}>
                {pendingRequests > 99 ? "99+" : pendingRequests}
              </span>
            )}
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
        {/* Story row — Messenger-style */}
        {!loading && tabFilter === "all" && !searchQuery.trim() && (
          <div className="mb-3 -mx-3 px-3">
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {/* Create story */}
              <button
                onClick={() => { tap("light"); nav("/stories") }}
                className="shrink-0 flex flex-col items-center gap-1.5 active:opacity-80"
                style={{ width: 68 }}
              >
                <div className="relative">
                  <div
                    className="w-16 h-16 rounded-full grid place-items-center"
                    style={{
                      background: "linear-gradient(135deg, rgba(192,132,252,0.25) 0%, rgba(236,72,153,0.25) 100%)",
                      border: "2px dashed rgba(192,132,252,0.6)",
                    }}
                  >
                    <span className="text-purple-300 text-[26px] font-thin leading-none">+</span>
                  </div>
                </div>
                <span className="text-cream text-[11.5px] font-semibold truncate w-full text-center">
                  Your story
                </span>
              </button>

              {/* Story bubbles from DM contacts */}
              {(() => {
                const owners = [...storyOwners].slice(0, 20)
                const people = owners
                  .map((uid) => items.find((x) => x.userId === uid))
                  .filter(Boolean)
                return people.map((u) => {
                  const seen = viewedStoryOwners.has(u.userId)
                  const ringStyle = seen
                    ? { border: "2px solid rgba(255,255,255,0.18)" }
                    : { background: "linear-gradient(#0B0B14,#0B0B14) padding-box, linear-gradient(135deg,#C084FC,#EC4899) border-box", border: "2px solid transparent" }
                  return (
                    <button
                      key={u.userId}
                      onClick={() => { tap("light"); nav("/stories") }}
                      className="shrink-0 flex flex-col items-center gap-1.5 active:opacity-80"
                      style={{ width: 68 }}
                    >
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full p-[2px]" style={ringStyle}>
                          <div className="w-full h-full rounded-full overflow-hidden bg-elevated">
                            {u.photo_url ? (
                              <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full grid place-items-center text-purple-400 font-black text-lg">
                                {(u.display_name || "?")[0]}
                              </div>
                            )}
                          </div>
                        </div>
                        {!u.isGroup && u.last_seen_at && isOnline(u.last_seen_at, 3) && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0B0B14]" />
                        )}
                      </div>
                      <span className="text-cream text-[11.5px] font-semibold truncate w-full text-center">
                        {(u.display_name || u.username || "User").split(" ")[0]}
                      </span>
                    </button>
                  )
                })
              })()}
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
            {displayItems.map((item) => {
              return (
              <div
                key={item.userId}
                onTouchStart={(e) => {
                  rowPressTriggered.current = false
                  const t = e.touches[0]
                  tapStartRef.current = { x: t.clientX, y: t.clientY }
                  rowPressTimer.current = setTimeout(() => {
                    rowPressTriggered.current = true
                    tap("medium")
                    setRowMenuFor(item)
                  }, 700)
                }}
                onTouchMove={(e) => {
                  const t = e.touches[0]
                  const dx = Math.abs(t.clientX - tapStartRef.current.x)
                  const dy = Math.abs(t.clientY - tapStartRef.current.y)
                  // Kill long-press the moment the finger moves — scroll wins
                  if (dx > 12 || dy > 12) {
                    clearTimeout(rowPressTimer.current)
                  }
                }}
                onTouchEnd={(e) => {
                  clearTimeout(rowPressTimer.current)
                  const t = e.changedTouches[0]
                  const dx = Math.abs(t.clientX - tapStartRef.current.x)
                  const dy = Math.abs(t.clientY - tapStartRef.current.y)
                  // Only open if it was a genuine tap (barely moved)
                  if (!rowPressTriggered.current && dx < 12 && dy < 12) {
                    tap('light')
                    if (item.isGroup) nav('/groups/' + item.groupId)
                    else nav('/messages/' + item.userId)
                  }
                }}
                onContextMenu={(e) => { e.preventDefault(); setRowMenuFor(item) }}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.03] transition-colors text-left active:opacity-90 cursor-pointer"
              >
                <div className="relative shrink-0">
                  {(() => {
                    const hasStory = !item.isGroup && storyOwners.has(item.userId)
                    const storyViewed = hasStory && viewedStoryOwners.has(item.userId)
                    const ringStyle = hasStory
                      ? storyViewed
                        ? { border: "2px solid rgba(255,255,255,0.15)" }
                        : { background: "linear-gradient(#0B0B14,#0B0B14) padding-box, linear-gradient(135deg,#C084FC,#EC4899) border-box", border: "2px solid transparent" }
                      : null
                    return (
                      <div
                        className="w-14 h-14 rounded-full p-[2px]"
                        style={ringStyle || {}}
                      >
                        <div
                          className="w-full h-full rounded-full overflow-hidden bg-elevated"
                          style={!hasStory ? { border: "1px solid rgba(255,255,255,0.08)" } : {}}
                        >
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
                      </div>
                    )
                  })()}
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
              )
            })}
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

            <button
              onClick={() => rowMenuFor.unread ? markRowRead(rowMenuFor) : markRowUnread(rowMenuFor)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              <CheckCheck size={18} />
              <span className="font-semibold text-[14px]">
                {rowMenuFor.unread ? "Mark as read" : "Mark as unread"}
              </span>
            </button>

            <button
              onClick={() => toggleRowMute(rowMenuFor)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              {rowMenuFor.muted ? <Bell size={18} /> : <BellOff size={18} />}
              <span className="font-semibold text-[14px]">
                {rowMenuFor.muted ? "Unmute" : "Mute"}
              </span>
            </button>

            <button
              onClick={() => toggleRowArchive(rowMenuFor)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              <Archive size={18} />
              <span className="font-semibold text-[14px]">Archive</span>
            </button>

            <button
              onClick={() => deleteRow(rowMenuFor)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-danger/10 border border-danger/30 text-left text-danger"
            >
              <Trash2 size={18} />
              <span className="font-semibold text-[14px]">
                {rowMenuFor.isGroup ? "Delete group" : "Delete conversation"}
              </span>
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
