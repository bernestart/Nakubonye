import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Sparkles, Paperclip, Camera, X , Mic, Square , Pin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl } from '../lib/photo'
import { tap } from '../lib/haptic'
import Linkify from './chat/Linkify'
import EmojiPicker from './chat/EmojiPicker'
import ImageLightbox from './chat/ImageLightbox'
import MessageActionsSheet from './MessageActionsSheet'
import AudioBubble from './chat/AudioBubble'
import { useVoiceRecorder } from './chat/useVoiceRecorder'

export default function CommunityChat({ communityId, isMember, isPremium }) {
  const nav = useNavigate()
  const { session } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [lastSeenId, setLastSeenId] = useState(null)
  const [profiles, setProfiles] = useState(new Map())
  const [photos, setPhotos] = useState(new Map())
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [attachmentPreview, setAttachmentPreview] = useState("")
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const voice = useVoiceRecorder({ maxSeconds: 300 })
  const [replyingTo, setReplyingTo] = useState(null)
  const [reactions, setReactions] = useState({})
  const [actionsForMsg, setActionsForMsg] = useState(null)
  const [reactionPickerFor, setReactionPickerFor] = useState(null)
  const [heartBurstId, setHeartBurstId] = useState(null)
  const [pinnedMsg, setPinnedMsg] = useState(null)
  const longPressTimer = useRef(null)
  const swipeRef = useRef({ id: null, startX: 0, dx: 0, active: false })
  const [swipeState, setSwipeState] = useState({ id: null, dx: 0 })
  const lastTapRef = useRef({ id: null, time: 0 })

  const scrollRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const myId = session?.user?.id

  const load = useCallback(async () => {
    if (!myId || !communityId) return
    setLoading(true); setError('')

    const { data: rows, error: err } = await supabase
      .from('community_messages')
      .select('id, sender_id, content, media_url, media_type, media_name, reply_to_id, deleted_at, created_at, highlighted_until')
      .eq('community_id', communityId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (err) { setError(err.message); setLoading(false); return }

    const list = rows || []
    setMessages(list)

    const ids = [...new Set(list.map((r) => r.sender_id))]
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, username, is_verified')
        .in('id', ids)
      const pMap = new Map()
      ;(profs || []).forEach((p) => pMap.set(p.id, p))
      setProfiles(pMap)

      const { data: photoRows } = await supabase
        .from('profile_photos')
        .select('user_id, storage_path, is_primary, display_order')
        .in('user_id', ids)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true })
      const phMap = new Map()
      ;(photoRows || []).forEach((p) => {
        if (!phMap.has(p.user_id)) phMap.set(p.user_id, p.storage_path)
      })
      setPhotos(phMap)
    }

    setLoading(false)
  }, [myId, communityId])

  useEffect(() => { load() }, [load])

  // Read last-seen id for this community from localStorage
  useEffect(() => {
    if (!communityId) return
    const stored = localStorage.getItem('cc_last_seen_' + communityId)
    setLastSeenId(stored ? Number(stored) : null)
  }, [communityId])

  // Persist newest message id after load so next visit does not show divider
  useEffect(() => {
    if (!communityId || messages.length === 0) return
    const newest = messages[messages.length - 1]
    if (newest?.id) localStorage.setItem('cc_last_seen_' + communityId, String(newest.id))
  }, [messages, communityId])

  // Realtime
  useEffect(() => {
    if (!communityId) return
    const ch = supabase
      .channel('community-chat-' + communityId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_messages',
          filter: 'community_id=eq.' + communityId },
        (payload) => {
          const m = payload.new
          setMessages((cur) => cur.some((x) => x.id === m.id) ? cur : [...cur, m])
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [communityId])

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  // Load reactions for the loaded messages
  useEffect(() => {
    if (!messages.length) return
    const ids = messages.map((m) => m.id)
    ;(async () => {
      const { data } = await supabase
        .from("community_message_reactions")
        .select("message_id, user_id, reaction")
        .in("message_id", ids)
      const byMsg = {}
      ;(data || []).forEach((r) => {
        byMsg[r.message_id] = byMsg[r.message_id] || []
        byMsg[r.message_id].push({ user_id: r.user_id, reaction: r.reaction })
      })
      setReactions(byMsg)
    })()
  }, [messages])

  // Load + realtime pinned message
  useEffect(() => {
    if (!communityId) return
    let cancelled = false
    const fetchPinned = async () => {
      const { data: pin } = await supabase
        .from("community_pinned_messages")
        .select("message_id, pinned_by")
        .eq("community_id", communityId)
        .maybeSingle()
      if (cancelled) return
      if (!pin) { setPinnedMsg(null); return }
      const { data: msg } = await supabase
        .from("community_messages")
        .select("id, sender_id, content, media_url, media_type, deleted_at")
        .eq("id", pin.message_id)
        .maybeSingle()
      if (cancelled) return
      setPinnedMsg(msg ? { ...msg, pinned_by: pin.pinned_by } : null)
    }
    fetchPinned()
    const ch = supabase
      .channel("cpinned-" + communityId)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_pinned_messages", filter: "community_id=eq." + communityId }, fetchPinned)
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [communityId])

  function pickAttachment(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith("image/")) { setError("Only images supported"); e.target.value = ""; return }
    if (f.size > 8 * 1024 * 1024) { setError("Image must be under 8 MB"); e.target.value = ""; return }
    setAttachment(f); setAttachmentPreview(URL.createObjectURL(f)); setError("")
  }

  function clearAttachment() {
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview)
    setAttachment(null); setAttachmentPreview("")
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (cameraInputRef.current) cameraInputRef.current.value = ""
  }

  async function sendVoice() {
    if (!myId || !voice.recording) return
    const result = await voice.stop(true)
    if (!result?.blob) return
    if (result.seconds < 1) { setError("Recording too short"); return }
    if (result.blob.size > 10 * 1024 * 1024) { setError("Voice note too long"); return }

    setSending(true)
    const path = "community-media/" + communityId + "/" + crypto.randomUUID() + ".webm"
    const { error: upErr } = await supabase.storage
      .from("chat-media")
      .upload(path, result.blob, { upsert: false, contentType: "audio/webm" })
    if (upErr) { setSending(false); setError(upErr.message); return }
    const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path)

    const { error: err } = await supabase.from("community_messages").insert({
      community_id: communityId,
      sender_id: myId,
      content: "",
      media_url: pub?.publicUrl || null,
      media_type: "audio/webm",
      media_name: "Voice · " + result.seconds + "s",
    })
    setSending(false)
    if (err) { setError(err.message); return }
    load()
  }

  async function startVoice() {
    tap("medium")
    const ok = await voice.start()
    if (!ok) setError("Microphone access denied")
  }

  async function cancelVoice() {
    tap("light")
    await voice.stop(false)
  }

  async function send() {
    const body = text.trim()
    if ((!body && !attachment) || sending || !myId) return
    setSending(true); tap('light')

    let mediaUrl = null, mediaType = null, mediaName = null
    if (attachment) {
      const ext = (attachment.name.split(".").pop() || "jpg").toLowerCase()
      const path = "community-media/" + communityId + "/" + crypto.randomUUID() + "." + ext
      const { error: upErr } = await supabase.storage
        .from("chat-media")
        .upload(path, attachment, { upsert: false, contentType: attachment.type })
      if (upErr) { setSending(false); setError(upErr.message); return }
      const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path)
      mediaUrl = pub?.publicUrl || null
      mediaType = attachment.type
      mediaName = attachment.name
    }

    setText(""); const bodyToSend = body; clearAttachment()

    const payload = {
      community_id: communityId,
      sender_id: myId,
      content: bodyToSend || "",
    }
    if (mediaUrl) { payload.media_url = mediaUrl; payload.media_type = mediaType; payload.media_name = mediaName }
    if (replyingTo?.id) payload.reply_to_id = replyingTo.id
    setReplyingTo(null)

    const { error: err } = await supabase
      .from('community_messages')
      .insert(payload)

    if (err) {
      setError(err.message)
      setText(bodyToSend)
    } else {
      load()
    }
    setSending(false)
  }

  async function highlightMessage(messageId) {
    if (!confirm('Highlight this message for 24 hours? Costs 25 coins.')) return
    tap('medium')
    setError('')
    const { data, error: err } = await supabase.rpc('highlight_community_message', { p_message_id: messageId })
    if (err) {
      if (/insufficient/i.test(err.message)) setError('Not enough coins. Get more in Wallet.')
      else if (/already highlighted/i.test(err.message)) setError('This message is already highlighted.')
      else if (/sender/i.test(err.message)) setError('Only you can highlight your own messages.')
      else setError(err.message)
      return
    }
    load()
  }

  async function toggleReaction(messageId, emoji) {
    if (!myId) return
    tap("light")
    const current = (reactions[messageId] || []).find((r) => r.user_id === myId)
    if (current?.reaction === emoji) {
      await supabase.from("community_message_reactions").delete().eq("message_id", messageId).eq("user_id", myId)
    } else if (current) {
      await supabase.from("community_message_reactions").update({ reaction: emoji }).eq("message_id", messageId).eq("user_id", myId)
    } else {
      await supabase.from("community_message_reactions").insert({ message_id: messageId, user_id: myId, reaction: emoji })
    }
    setReactionPickerFor(null)
    // Refetch reactions for this message
    const { data } = await supabase.from("community_message_reactions").select("message_id, user_id, reaction").eq("message_id", messageId)
    setReactions((prev) => {
      const next = { ...prev }
      next[messageId] = (data || []).map((r) => ({ user_id: r.user_id, reaction: r.reaction }))
      return next
    })
  }

  async function deleteMessage(messageId) {
    const target = messages.find((m) => m.id === messageId)
    if (!target) return
    if (target.sender_id !== myId) return
    if (!confirm("Delete this message?")) return
    tap("light")
    const { error } = await supabase
      .from("community_messages")
      .update({ deleted_at: new Date().toISOString(), content: "", media_url: null })
      .eq("id", messageId)
      .eq("sender_id", myId)
    if (error) { setError(error.message); return }
    setMessages((cur) => cur.map((m) => m.id === messageId ? { ...m, deleted_at: new Date().toISOString(), content: "", media_url: null } : m))
  }

  function onMsgPressStart(m, e) {
    if (e?.touches?.[0]) {
      swipeRef.current = { id: m.id, startX: e.touches[0].clientX, dx: 0, active: false }
    }
    longPressTimer.current = setTimeout(() => {
      tap("medium")
      setActionsForMsg(m)
    }, 450)
  }

  function onMsgPressEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function onRowTouchMove(e) {
    const sw = swipeRef.current
    if (!sw.id) return
    const dx = e.touches[0].clientX - sw.startX
    if (!sw.active && dx > 8) {
      sw.active = true
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
    }
    if (sw.active) {
      sw.dx = Math.min(dx, 80)
      setSwipeState({ id: sw.id, dx: sw.dx })
    }
  }

  function onRowSwipeEnd(m) {
    const sw = swipeRef.current
    const triggered = sw.active && sw.dx >= 50
    const wasSwipe = sw.active
    swipeRef.current = { id: null, startX: 0, dx: 0, active: false }
    setSwipeState({ id: null, dx: 0 })
    if (triggered) {
      tap("light")
      setReplyingTo(m)
    } else if (!wasSwipe) {
      onMsgPressEnd()
    }
  }

  function onRowTap(m) {
    const now = Date.now()
    const last = lastTapRef.current
    const isDouble = last.id === m.id && (now - last.time) < 300
    if (isDouble) {
      lastTapRef.current = { id: null, time: 0 }
      tap("medium")
      toggleReaction(m.id, "❤️")
      setHeartBurstId(m.id)
      setTimeout(() => setHeartBurstId((cur) => cur === m.id ? null : cur), 900)
      return
    }
    lastTapRef.current = { id: m.id, time: now }
  }

  async function togglePin(message) {
    if (!communityId || !myId) return
    tap("light")
    if (pinnedMsg?.id === message.id) {
      await supabase.from("community_pinned_messages").delete().eq("community_id", communityId)
      setPinnedMsg(null)
    } else {
      await supabase.from("community_pinned_messages").upsert({
        community_id: communityId,
        message_id: message.id,
        pinned_by: myId,
      }, { onConflict: "community_id" })
      setPinnedMsg({ ...message, pinned_by: myId })
    }
  }

  if (!isMember) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
          <Send size={22} strokeWidth={1.8} className="text-muted" />
        </div>
        <p className="text-cream font-semibold text-[14.5px] mb-1">Join to chat</p>
        <p className="text-muted text-[12.5px]">Only members can send messages here.</p>
      </div>
    )
  }


  const firstUnreadIdx = (() => {
    if (lastSeenId == null) return -1
    for (let k = 0; k < messages.length; k++) {
      const m = messages[k]
      if (m.id > lastSeenId && m.sender_id !== myId) return k
    }
    return -1
  })()

  return (
    <div className="flex flex-col" style={{ minHeight: '400px' }}>
      {error && (
        <div className="text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 mb-3">
          {error}
        </div>
      )}

      {pinnedMsg && !pinnedMsg.deleted_at && (
        <div className="mx-1 mb-2 rounded-2xl bg-purple-500/10 border border-purple-500/30 px-3 py-2 flex items-center gap-2.5">
          <Pin size={14} className="text-purple-300 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-purple-300 text-[10.5px] font-black tracking-wider uppercase">Pinned</p>
            <p className="text-cream text-[13px] truncate">
              {pinnedMsg.media_url && !pinnedMsg.content
                ? "📎 Attachment"
                : (pinnedMsg.content || "").slice(0, 120)}
            </p>
          </div>
          <button
            onClick={() => togglePin(pinnedMsg)}
            className="shrink-0 text-muted text-[11.5px] font-semibold px-2 py-1"
            aria-label="Unpin"
          >
            Unpin
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto flex flex-col gap-2 mb-3"
        style={{ maxHeight: '420px', minHeight: '260px' }}
      >
        {loading ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">
            Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-cream font-semibold text-[14.5px] mb-1">No messages yet</p>
            <p className="text-muted text-[12.5px]">Say hello to the community.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === myId
            const p = profiles.get(m.sender_id)
            const photo = photos.get(m.sender_id)
            const name = p?.display_name || p?.username || 'Someone'
            const showDay = i === 0 || new Date(m.created_at).toDateString() !== new Date(messages[i-1].created_at).toDateString()
            return (
              <Fragment key={m.id}>
              {showDay && (
                <div className="flex justify-center py-3">
                  <span className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/8 text-subtle text-[10.5px] font-bold tracking-wider uppercase">
                    {dayLabel(m.created_at)}
                  </span>
                </div>
              )}
              {i === firstUnreadIdx && (
                <div className="flex items-center gap-3 py-3 px-2">
                  <div className="flex-1 h-px bg-purple-500/30" />
                  <span className="text-purple-300 text-[10.5px] font-bold tracking-wider uppercase">New messages</span>
                  <div className="flex-1 h-px bg-purple-500/30" />
                </div>
              )}
              <div
                onTouchStart={(e) => onMsgPressStart(m, e)}
                onTouchEnd={() => onRowSwipeEnd(m)}
                onTouchMove={onRowTouchMove}
                onContextMenu={(e) => { e.preventDefault(); setActionsForMsg(m) }}
                onClick={() => onRowTap(m)}
                className={`flex ${mine ? 'justify-end' : 'justify-start'} gap-2 relative`}
                style={{
                  transform: swipeState.id === m.id ? `translateX(${swipeState.dx}px)` : undefined,
                  transition: swipeState.id === m.id ? "none" : "transform 180ms ease-out",
                }}
              >
                {swipeState.id === m.id && swipeState.dx > 10 && (
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none"
                       style={{ opacity: Math.min(1, swipeState.dx / 50) }}>
                    <div className="w-7 h-7 rounded-full grid place-items-center bg-purple-500/30 border border-purple-500/50">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C084FC" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 17 4 12 9 7" />
                        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                      </svg>
                    </div>
                  </div>
                )}
                {!mine && (
                  <button
                    onClick={() => { tap('light'); nav('/profile/' + m.sender_id) }}
                    className="shrink-0"
                  >
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-elevated border border-white/8">
                      {photo ? (
                        <img src={publicPhotoUrl(photo)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-[10px] font-black text-purple-400">
                          {name[0]}
                        </div>
                      )}
                    </div>
                  </button>
                )}

                <div className={`max-w-[78%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!mine && (
                    <p className="text-[10.5px] text-subtle font-medium mb-0.5 px-1">
                      {name}
                    </p>
                  )}
                  {m.reply_to_id && (() => {
                    const parent = messages.find((x) => x.id === m.reply_to_id)
                    if (!parent) return null
                    const pName = parent.sender_id === myId ? "You" : (profiles.get(parent.sender_id)?.display_name || "Someone")
                    return (
                      <div className={`mb-1 px-3 py-1.5 rounded-xl text-[11.5px] border-l-2 ${mine ? "bg-purple-500/15 border-purple-300 text-purple-100" : "bg-white/5 border-white/30 text-muted"}`}>
                        <span className="font-bold block text-[10px] tracking-wide">{pName}</span>
                        <span className="truncate block">{parent.content || "📎 Attachment"}</span>
                      </div>
                    )
                  })()}

                  {heartBurstId === m.id && (
                    <div className="absolute inset-0 grid place-items-center pointer-events-none" style={{ zIndex: 20 }}>
                      <span className="text-[44px] leading-none animate-ping">❤️</span>
                    </div>
                  )}

                  <div
                    className={`px-3.5 py-2 text-[14px] leading-[1.4] break-words rounded-2xl ${
                      mine
                        ? 'bg-gradient-to-br from-purple-600 to-purple-500 text-white rounded-br-md shadow-[0_4px_14px_rgba(124,58,237,0.35)]'
                        : 'bg-elevated text-cream border border-white/8 rounded-bl-md'
                    }${
                      m.highlighted_until && new Date(m.highlighted_until) > new Date()
                        ? ' ring-2 ring-amber-400/70 shadow-[0_0_18px_rgba(245,158,11,0.5)]'
                        : ''
                    }`}
                  >
                    {m.media_url && m.media_type?.startsWith("image/") && (
                      <img
                        src={m.media_url}
                        alt=""
                        onClick={() => setLightboxUrl(m.media_url)}
                        className="block max-w-[220px] rounded-xl cursor-pointer active:opacity-90"
                        style={{ maxHeight: 260, objectFit: "cover" }}
                        loading="lazy"
                      />
                    )}
                    {m.media_url && m.media_type?.startsWith("audio/") && (
                      <AudioBubble src={m.media_url} mine={mine} />
                    )}
                    {m.content && <Linkify text={m.content} mine={mine} />}
                  </div>
                  <div className="flex items-center gap-1 px-1 mt-0.5">
                    <p className="text-[10px] text-subtle">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </p>
                    {mine && !(m.highlighted_until && new Date(m.highlighted_until) > new Date()) && (
                      <button
                        onClick={() => highlightMessage(m.id)}
                        className="text-amber-400 hover:text-amber-300"
                        aria-label="Highlight message"
                        title="Highlight for 25 coins"
                      >
                        <Sparkles size={11} strokeWidth={2.3} />
                      </button>
                    )}
                    {m.highlighted_until && new Date(m.highlighted_until) > new Date() && (
                      <Sparkles size={11} strokeWidth={2.4} className="text-amber-400" />
                    )}
                  </div>

                  {(reactions[m.id] || []).length > 0 && (
                    <div className={`flex gap-0.5 mt-1 ${mine ? 'justify-end' : 'justify-start'} flex-wrap`}>
                      {Object.entries(
                        (reactions[m.id] || []).reduce((acc, r) => { acc[r.reaction] = (acc[r.reaction] || 0) + 1; return acc }, {})
                      ).map(([emoji, count]) => {
                        const myReact = (reactions[m.id] || []).find((r) => r.user_id === myId)
                        const mineReaction = myReact?.reaction === emoji
                        return (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(m.id, emoji)}
                            className={`text-[11px] px-1.5 py-0.5 rounded-full border ${mineReaction ? "bg-purple-500/20 border-purple-400/40" : "bg-white/[0.04] border-white/10"}`}
                          >
                            {emoji} {count > 1 ? count : ""}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {reactionPickerFor === m.id && (
                    <div className={`flex gap-1 mt-1 p-1.5 rounded-full bg-elevated border border-white/10 ${mine ? "justify-end ml-auto" : ""} w-fit`}>
                      {["❤️","😂","😍","👍","🔥","😮"].map((e) => (
                        <button
                          key={e}
                          onClick={() => toggleReaction(m.id, e)}
                          className="w-7 h-7 rounded-full grid place-items-center text-base hover:bg-white/10"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              </Fragment>
            )
          })
        )}
      </div>

      {attachment && (
        <div className="mx-1 mb-2 relative w-fit">
          <img src={attachmentPreview} alt="" className="rounded-xl max-h-32" />
          <button onClick={clearAttachment} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-obsidian border border-white/20 grid place-items-center" aria-label="Remove">
            <X size={13} strokeWidth={2.6} className="text-cream" />
          </button>
        </div>
      )}

      {emojiOpen && (
        <EmojiPicker
          className="mx-1 mb-2"
          onPick={(e) => { setText((t) => (t + e).slice(0, 1000)); tap("light") }}
        />
      )}

      {replyingTo && (
        <div className="mx-1 mb-2 px-3 py-2 rounded-xl bg-elevated border border-purple-500/30 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-purple-300 text-[10.5px] font-bold tracking-wide uppercase mb-0.5">
              Replying to {replyingTo.sender_id === myId ? "yourself" : (profiles.get(replyingTo.sender_id)?.display_name || "Someone")}
            </p>
            <p className="text-muted text-[12px] truncate">{replyingTo.content || "📎 Attachment"}</p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="w-6 h-6 rounded-full grid place-items-center text-muted shrink-0" aria-label="Cancel">
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>
      )}

      {actionsForMsg && (
        <MessageActionsSheet
          message={actionsForMsg}
          isMine={actionsForMsg.sender_id === myId}
          onClose={() => setActionsForMsg(null)}
          onReply={(m) => setReplyingTo(m)}
          onCopy={async () => { try { await navigator.clipboard.writeText(actionsForMsg.content || ""); setActionsForMsg(null) } catch {} }}
          onForward={(m) => { setActionsForMsg(null); alert("Forward coming soon") }}
          onDelete={deleteMessage}
          onReact={(emoji) => toggleReaction(actionsForMsg.id, emoji)}
          isPinned={pinnedMsg?.id === actionsForMsg.id}
          onPin={togglePin}
        />
      )}

      {/* Composer */}
      <div className="flex items-end gap-2 pt-2 border-t border-white/8">
        <button
          onClick={() => setAttachMenuOpen(true)}
          className="w-10 h-10 rounded-full grid place-items-center text-muted shrink-0"
          aria-label="Attach"
        >
          <Paperclip size={19} strokeWidth={2.3} />
        </button>
        <button
          onClick={() => { setEmojiOpen((v) => !v); tap("light") }}
          className="w-10 h-10 rounded-full grid place-items-center text-muted shrink-0"
          aria-label="Emoji"
        >
          <span className={`text-[18px] ${emojiOpen ? "opacity-100" : "opacity-70"}`}>😊</span>
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={1}
          disabled={voice.recording}
          placeholder={voice.recording ? "Recording voice…" : "Write a message…"}
          className="flex-1 bg-elevated border border-white/8 rounded-[22px] px-4 py-2.5 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none max-h-28"
          style={{ minHeight: 44 }}
        />
        {voice.recording ? (
          <>
            <button
              onClick={cancelVoice}
              className="flex-1 h-11 rounded-[22px] bg-white/[0.06] text-cream font-semibold text-[13.5px] flex items-center justify-center gap-2 shrink-0"
            >
              <X size={16} strokeWidth={2.4} /> Cancel
            </button>
            <button
              onClick={sendVoice}
              className="flex-1 h-11 rounded-[22px] bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold text-[13.5px] flex items-center justify-center gap-2 shrink-0"
            >
              <Square size={14} strokeWidth={2.6} fill="currentColor" /> Send
            </button>
          </>
        ) : text.trim() || attachment ? (
          <button
            onClick={send}
            disabled={sending}
            className="w-11 h-11 rounded-full grid place-items-center bg-gradient-to-br from-purple-500 to-pink-500 text-white disabled:opacity-40 shrink-0"
            aria-label="Send"
          >
            <Send size={18} strokeWidth={2.4} />
          </button>
        ) : (
          <button
            onClick={startVoice}
            className="w-11 h-11 rounded-full grid place-items-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shrink-0"
            aria-label="Record voice"
          >
            <Mic size={19} strokeWidth={2.4} />
          </button>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickAttachment} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={pickAttachment} />

      {attachMenuOpen && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setAttachMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <button
              onClick={() => { setAttachMenuOpen(false); setTimeout(() => cameraInputRef.current?.click(), 100) }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              <Camera size={18} className="text-purple-300" />
              <span className="font-semibold text-[14px]">Take photo</span>
            </button>
            <button
              onClick={() => { setAttachMenuOpen(false); setTimeout(() => fileInputRef.current?.click(), 100) }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              <Paperclip size={18} className="text-purple-300" />
              <span className="font-semibold text-[14px]">Choose from gallery</span>
            </button>
            <button onClick={() => setAttachMenuOpen(false)} className="w-full h-11 mt-1 text-muted font-semibold text-[13.5px]">Cancel</button>
          </div>
        </div>
      )}

      <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  )
}

function dayLabel(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return "Today"
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return "Yesterday"
  const days = (now - d) / (1000 * 60 * 60 * 24)
  if (days < 7) return d.toLocaleDateString([], { weekday: "long" })
  return d.toLocaleDateString([], { month: "long", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined })
}
