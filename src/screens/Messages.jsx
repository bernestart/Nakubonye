import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MessageCircle, RefreshCw, PenSquare, BellOff, Search, X, Users, MoreVertical, Archive, Inbox, CheckCheck, Flag, Ban, Pin, Trash2, Settings, Check, Bell } from 'lucide-react'
import { friendlyError } from '../lib/errors'
import { API_BASE_URL } from '../lib/api';
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl } from '../lib/photo'
import { isOnline } from '../lib/usePresence'
import { tap } from '../lib/haptic'
import BottomNav from '../components/BottomNav'
import AppHeader from '../components/AppHeader'
import ReportModal from "../components/ReportModal"
import NewMessageSheet from '../components/NewMessageSheet'
import StoryComposer from '../components/StoryComposer'
import StoryViewer from '../components/StoryViewer'
import NotificationBell from '../components/NotificationBell'
import BrandGlow from '../components/BrandGlow'

export default function Messages() {
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const nav = useNavigate()
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [groupItems, setGroupItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newMsgOpen, setNewMsgOpen] = useState(false)
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [searchParams] = useSearchParams()
  const [tabFilter, setTabFilter] = useState(() => {
    const t = searchParams.get("tab")
    return t === "unread" || t === "groups" ? t : "all"
  })
  const [rowMenuFor, setRowMenuFor] = useState(null)
  const [lockedChats, setLockedChats] = useState(() => JSON.parse(localStorage.getItem('lockedChats') || '[]'))
  const [showLockedFolder, setShowLockedFolder] = useState(false)
  const [unlockFolderPrompt, setUnlockFolderPrompt] = useState(false)
  const [folderPinInput, setFolderPinInput] = useState("")
  const [savedPin, setSavedPin] = useState(() => localStorage.getItem('chatPin') || null)
  const [pinModalFor, setPinModalFor] = useState(null)
  const [pinInput, setPinInput] = useState("")
  const [pinnedKeys, setPinnedKeys] = useState(new Set())
  const [archivedKeys, setArchivedKeys] = useState(new Set())
  const [deletedKeys, setDeletedKeys] = useState(new Set())
  const [onlineUsers, setOnlineUsers] = useState([])
  const [storyOwners, setStoryOwners] = useState(new Set())
  const [composerOpen, setComposerOpen] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(null)
  const [myStoryGroup, setMyStoryGroup] = useState(null)
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
      fetch(`${API_BASE_URL}/api/inbox/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'dm', rows: dmRows }) }).catch(() => {})
    }

    // Groups
    const groupRows = groupItems
      .filter((x) => x.groupId)
      .map((x) => ({ group_id: x.groupId, user_id: uid, last_read_at: new Date().toISOString() }))
    if (groupRows.length > 0) {
      fetch(`${API_BASE_URL}/api/inbox/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'group', rows: groupRows }) }).catch(() => {})
    }

    setHeaderMenuOpen(false)
    load()
  }

  const load = useCallback(async () => {
    if (!session?.user?.id) { setLoading(false); return }
    setLoading(true); setError('')
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(API_BASE_URL + '/api/inbox', { headers: { Authorization: 'Bearer ' + token } })
      const json = await res.json()
      if (!json || !json.success) throw new Error((json && json.error) || 'Could not load messages')
      const d = json.data
      setItems((d.items || []).map((x) => ({ ...x, photo_url: publicPhotoUrl(x.photo_path) })))
      setGroupItems(d.groupItems || [])
      setPinnedKeys(new Set(d.pinned || []))
      setArchivedKeys(new Set(d.archived || []))
      setDeletedKeys(new Set(d.deleted || []))
      setOnlineUsers((d.online || []).map((u) => ({ ...u, photo_url: u.photo_path ? publicPhotoUrl(u.photo_path) : null })))
      setStoryOwners(new Set(d.storyOwners || []))
      setViewedStoryOwners(new Set(d.viewedStoryOwners || []))
      setPendingRequests(d.pendingRequests || 0)
      setLoading(false)
    } catch (e) {
      console.error('Messages load error:', e)
      setError(friendlyError(e))
      setLoading(false)
    }
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
    return () => { if (debounce) clearTimeout(debounce); }
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

  async function dismissNewMatch(item) {
    if (!confirm("Dismiss this new match? They'll stay in Matches but disappear from Messages.")) return
    tap("light")
    const uid = session?.user?.id
    if (!uid || !item.conversationId) return
    await fetch(`${API_BASE_URL}/api/inbox/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", type: "dm", id: item.conversationId, userId: uid }) })
    load()
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
        await fetch(`${API_BASE_URL}/api/inbox/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unmute", type: "group", id: item.groupId, userId: uid }) })
      } else {
        await fetch(`${API_BASE_URL}/api/inbox/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mute", type: "group", id: item.groupId, userId: uid }) })
      }
    } else if (item.conversationId) {
      if (item.muted) {
        await fetch(`${API_BASE_URL}/api/inbox/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unmute", type: "dm", id: item.conversationId, userId: uid }) })
      } else {
        await fetch(`${API_BASE_URL}/api/inbox/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mute", type: "dm", id: item.conversationId, userId: uid }) })
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

  const getItemId = (item) => item.isGroup ? item.groupId : item.userId;
  const securedCombined = showLockedFolder 
    ? combined.filter(item => lockedChats.includes(getItemId(item)))
    : combined.filter(item => !lockedChats.includes(getItemId(item)));

  const tabFiltered = tabFilter === "all"
    ? securedCombined
    : tabFilter === "unread"
      ? securedCombined.filter((item) => item.unread)
      : tabFilter === "groups"
        ? securedCombined.filter((item) => item.isGroup)
        : securedCombined

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
      

      {/* Messages list header */}
      <div className="px-4 pb-3 shrink-0 flex items-center justify-between" style={{ paddingTop: 'var(--safe-top, 32px)' }}>
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
        <div className="flex items-center gap-2 rounded-full bg-white/[0.05] border border-white/8 px-3.5 h-10">
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

        {searchQuery.trim().length >= 2 && (
          <button
            onClick={() => { tap("light"); nav("/messages/search?q=" + encodeURIComponent(searchQuery.trim())) }}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-left active:bg-purple-500/15"
          >
            <Search size={14} className="text-purple-300 shrink-0" />
            <span className="text-purple-200 text-[12.5px] font-semibold flex-1 min-w-0 truncate">
              Search inside all messages for "{searchQuery.trim()}"
            </span>
            <span className="text-purple-300 text-[14px]">→</span>
          </button>
        )}

        {/* Active filter chip — only when a filter is applied */}
        {tabFilter !== "all" && (
          <div className="flex mt-2.5">
            <button
              onClick={() => { tap("light"); setTabFilter("all") }}
              className="h-8 px-3.5 rounded-full text-[12.5px] font-bold inline-flex items-center gap-1.5"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)", color: "#fff" }}
            >
              {tabFilter === "unread" ? "Unread" : "Groups"}
              <X size={12} strokeWidth={3} />
            </button>
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 pb-4"
           onTouchStart={onTouchStart}
           onTouchMove={onTouchMove}
           onTouchEnd={onTouchEnd}>
        {/* Story row — Messenger-style */}
        {!loading && tabFilter === "all" && !searchQuery.trim() && (
          <div className="mb-3 -mx-3 px-3">
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {/* Your story tile — opens composer, or viewer if you have a story */}
              <button
                onClick={() => {
                  tap("light")
                  if (myStoryGroup) setViewerOpen({ groups: [myStoryGroup], startIndex: 0 })
                  else setComposerOpen(true)
                }}
                className="shrink-0 flex flex-col items-center gap-1.5 active:opacity-80"
                style={{ width: 68 }}
              >
                <div className="relative">
                  {myStoryGroup ? (
                    <div className="w-16 h-16 rounded-full p-[2px]"
                         style={{ background: "linear-gradient(#0B0B14,#0B0B14) padding-box, linear-gradient(135deg,#C084FC,#EC4899) border-box", border: "2px solid transparent" }}>
                      <div className="w-full h-full rounded-full overflow-hidden bg-elevated grid place-items-center text-purple-400 font-black text-lg">
                        {(myStoryGroup.display_name || "Y")[0]}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="w-16 h-16 rounded-full grid place-items-center"
                      style={{
                        background: "linear-gradient(135deg, rgba(192,132,252,0.25) 0%, rgba(236,72,153,0.25) 100%)",
                        border: "2px dashed rgba(192,132,252,0.6)",
                      }}
                    >
                      <span className="text-purple-300 text-[26px] font-thin leading-none">+</span>
                    </div>
                  )}
                  {/* small + badge for adding another story */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); tap("light"); setComposerOpen(true) }}
                    className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-purple-600 border-2 border-[#0B0B14] grid place-items-center"
                    aria-label="Add story"
                  >
                    <span className="text-white text-[12px] font-bold leading-none">+</span>
                  </button>
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
                      onClick={async () => {
                        tap("light")
                        const { data: stories } = await supabase
                          .from("stories")
                          .select("id, user_id, media_url, media_type, created_at")
                          .eq("user_id", u.userId)
                          .gt("expires_at", new Date().toISOString())
                          .order("created_at", { ascending: true })
                        if (!stories || stories.length === 0) return
                        setViewerOpen({
                          groups: [{
                            user_id: u.userId,
                            display_name: u.display_name,
                            avatar_path: null,
                            stories,
                          }],
                          startIndex: 0,
                        })
                      }}
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
          <div className="flex flex-col gap-1 pt-2">
            {[0,1,2,3,4,5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/6">
                <div className="w-12 h-12 rounded-full shimmer shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-3 w-1/3 shimmer-sm mb-2" />
                  <div className="h-2.5 w-2/3 shimmer-sm" />
                </div>
                <div className="h-2.5 w-8 shimmer-sm shrink-0" />
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
                className="flex items-center gap-3 px-4 py-3 border-b border-white/6 text-left active:bg-white/[0.03] cursor-pointer"
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
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0B0B14]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {item.isNewMatch && (
                    <p className="text-purple-300 text-[11.5px] font-semibold mb-0.5">
                      New match
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <strong className="text-cream text-[14.5px] font-semibold truncate">
                      {item.display_name || item.username || 'Someone'}
                    </strong>
                    {item.is_verified && (
                      <span className="text-purple-400 text-[11px]">✓</span>
                    )}
                    {item.muted && <BellOff size={12} className="text-subtle shrink-0" />}
                  </div>
                  <p className={`text-[13px] truncate ${item.unread ? 'text-cream font-medium' : item.isNewMatch ? 'text-purple-300 font-medium' : 'text-muted'}`}>
                    {item.isNewMatch ? 'Say hello 👋' : (item.preview || 'Say hello 👋')}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {pinnedKeys.has(item.isGroup ? ("g:" + item.groupId) : ("c:" + item.conversationId)) && (
                    <Pin size={11} className="text-purple-400" />
                  )}
                  <span className="text-[10.5px] text-subtle font-medium">
                    {relTime(item.lastMessageAt)}
                  </span>
                  {item.unread ? (
                    <span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
                  ) : item.isNewMatch ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); tap("light"); dismissNewMatch(item) }}
                      className="w-6 h-6 rounded-full grid place-items-center bg-white/[0.06] border border-white/10 text-muted active:opacity-60"
                      aria-label="Dismiss"
                    >
                      <X size={12} strokeWidth={2.6} />
                    </button>
                  ) : (
                    <Check size={13} strokeWidth={2.6} className="text-sky-400" />
                  )}
                </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {composerOpen && (
        <StoryComposer
          onClose={() => setComposerOpen(false)}
          onDone={() => { setComposerOpen(false); load() }}
        />
      )}

      {viewerOpen && (
        <StoryViewer
          groups={viewerOpen.groups}
          startIndex={viewerOpen.startIndex}
          onClose={() => { setViewerOpen(null); load() }}
          onViewed={() => {}}
        />
      )}

      {rowMenuFor && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setRowMenuFor(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, var(--safe-bottom, 8px))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />

            <button
              onClick={() => rowMenuFor.unread ? markRowRead(rowMenuFor) : markRowUnread(rowMenuFor)}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]"
            >
              <CheckCheck size={18} />
              <span className="font-semibold text-[14px]">
                {rowMenuFor.unread ? "Mark as read" : "Mark as unread"}
              </span>
            </button>

            <button
              onClick={() => toggleRowMute(rowMenuFor)}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]"
            >
              {rowMenuFor.muted ? <Bell size={18} /> : <BellOff size={18} />}
              <span className="font-semibold text-[14px]">
                {rowMenuFor.muted ? "Unmute" : "Mute"}
              </span>
            </button>

            <button
              onClick={() => toggleRowPin(rowMenuFor)}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]"
            >
              <Pin size={18} className={rowMenuFor.isPinned ? "text-purple-400" : ""} />
              <span className="font-semibold text-[14px]">
                {rowMenuFor.isPinned ? "Unpin from top" : "Pin to top"}
              </span>
            </button>

            <button
              onClick={() => { setPinModalFor(rowMenuFor); setRowMenuFor(null); }}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]"
            >
              {rowMenuFor.isLocked ? <Unlock size={18} className="text-orange-400" /> : <Lock size={18} />}
              <span className="font-semibold text-[14px]">
                {rowMenuFor.isLocked ? "Remove Lock" : "Lock Chat"}
              </span>
            </button>

            <button
              onClick={() => toggleRowArchive(rowMenuFor)}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]"
            >
              <Archive size={18} />
              <span className="font-semibold text-[14px]">Archive</span>
            </button>

            <button
              onClick={() => deleteRow(rowMenuFor)}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-danger/20 text-left text-danger active:bg-red-500/[0.06]"
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

      {!showLockedFolder && lockedChats.length > 0 && (
        <div className="px-4 py-2">
          <button onClick={() => { if (savedPin) setUnlockFolderPrompt(true); else setShowLockedFolder(true); }} className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/10 active:bg-white/[0.06]">
            <div className="flex items-center gap-3">
              <Lock size={18} className="text-purple-400" />
              <span className="text-cream font-bold text-[14px]">Locked Chats</span>
            </div>
            <span className="text-muted text-[12px]">{lockedChats.length}</span>
          </button>
        </div>
      )}
      {showLockedFolder && (
        <div className="px-4 py-2">
           <button onClick={() => setShowLockedFolder(false)} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10 active:bg-white/[0.06]">
             <Unlock size={18} className="text-muted" />
             <span className="text-muted font-bold text-[14px]">Back to Main Inbox</span>
           </button>
        </div>
      )}

      {/* FOLDER UNLOCK PROMPT */}
      {unlockFolderPrompt && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 px-6">
          <div className="w-full max-w-[320px] bg-[#18191A] rounded-2xl p-6 flex flex-col gap-4 text-center">
            <h3 className="text-white font-bold text-[18px]">Enter PIN</h3>
            <p className="text-gray-400 text-[13px]">Enter your 4-digit PIN to view locked chats.</p>
            <input type="password" maxLength={4} value={folderPinInput} onChange={(e) => setFolderPinInput(e.target.value.replace(/[^0-9]/g, ''))} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:border-purple-500" placeholder="••••" autoFocus />
            <div className="flex gap-2 mt-2">
              <button onClick={() => { setUnlockFolderPrompt(false); setFolderPinInput(""); }} className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold active:bg-white/20">Cancel</button>
              <button onClick={() => {
                if (folderPinInput === savedPin) { setShowLockedFolder(true); setUnlockFolderPrompt(false); setFolderPinInput(""); }
                else alert("Incorrect PIN");
              }} disabled={folderPinInput.length !== 4} className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold disabled:opacity-50">Unlock</button>
            </div>
          </div>
        </div>
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
