import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Send, MessageCircle, Paperclip, X, Smile, Mic, Square, Play, Pause, MoreVertical, Trash2, Eye, Flag, Ban, Check, CheckCheck , Phone, Video, Pin, Bell, BellOff, Eraser , Camera, Image } from 'lucide-react'
import VerifiedBadge from "../components/VerifiedBadge"
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl } from '../lib/photo'
import { tap } from '../lib/haptic'
import { useVoiceCall } from '../lib/voiceCall'
import { isOnline } from '../lib/usePresence'
import ReportModal from '../components/ReportModal'
import BrandGlow from '../components/BrandGlow'
import BlockConfirm from '../components/BlockConfirm'
import Linkify from '../components/chat/Linkify'
import AudioBubble from '../components/chat/AudioBubble'
import EmojiPicker from '../components/chat/EmojiPicker'
import ImageLightbox from '../components/chat/ImageLightbox'
import ForwardPicker from '../components/ForwardPicker'
import MessageActionsSheet from '../components/MessageActionsSheet'
import MessagePopover from '../components/MessagePopover'

const REACTIONS = ['❤️', '😂', '😍', '👍', '🔥', '😮']


function formatLastSeen(ts) {
  if (!ts) return ''
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return m + 'm ago'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'h ago'
  const d = Math.floor(h / 24)
  if (d < 7) return d + 'd ago'
  return new Date(ts).toLocaleDateString()
}

const UNSEND_WINDOW_MS = 60 * 60 * 1000

function isWithinUnsendWindow(createdAt) {
  if (!createdAt) return false
  return Date.now() - new Date(createdAt).getTime() < UNSEND_WINDOW_MS
}

export default function Chat() {
  const nav = useNavigate()
  const { userId: otherId } = useParams()
  const location = useLocation()
  const { session } = useAuth()
  const voiceCall = useVoiceCall()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [conversationId, setConversationId] = useState(null)
  const [other, setOther] = useState(null)
  const [messages, setMessages] = useState([])
  const [reactions, setReactions] = useState({})
  const swipeRef = useRef({ id: null, startX: 0, dx: 0, active: false })
  const lastTapRef = useRef({ id: null, time: 0 })
  const [heartBurst, setHeartBurst] = useState(null)
  const [swipeState, setSwipeState] = useState({ id: null, dx: 0 })
  const [theirLastRead, setTheirLastRead] = useState(null)
  const [myPreviousReadAt, setMyPreviousReadAt] = useState(null)
  const [text, setText] = useState('')

  useEffect(() => {
    const prefill = location.state?.prefill
    if (prefill && !text) setText(prefill)
    const sr = location.state?.storyReply
    if (sr) setStoryReply(sr)
  }, [location.state?.prefill, location.state?.storyReply])

  useEffect(() => {
    if (!otherId || !session?.user?.id) return
    ;(async () => {
      const uid = session.user.id
      const [directRes, reqRes] = await Promise.all([
        supabase.rpc('can_send_message_direct', { sender: uid, recipient: otherId }),
        supabase.rpc('can_send_message_request', { sender: uid, recipient: otherId }),
      ])
      const direct = directRes.data === true
      const request = reqRes.data === true
      setCanMsg(direct)
      setCanMsgRequest(request)
      if (direct) setCanMsgReason('')
      else if (request) setCanMsgReason("You don't know each other yet — send as a request")
      else setCanMsgReason("You can't message this user")
    })()
  }, [otherId, session?.user?.id])

  useEffect(() => {
    if (!otherId || !session?.user?.id) return
    ;(async () => {
      const { data } = await supabase.rpc('can_see_online', {
        viewer: session.user.id,
        owner: otherId,
      })
      setCanSeeOnline(data !== false)
    })()
  }, [otherId, session?.user?.id])
  const [sending, setSending] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [storyReply, setStoryReply] = useState(null)
  const [reactionPickerFor, setReactionPickerFor] = useState(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [actionsForMsg, setActionsForMsg] = useState(null)
  const [popoverAnchor, setPopoverAnchor] = useState({ x: 0, y: 0 })
  const [forwardingMsg, setForwardingMsg] = useState(null)
  const [pinnedMsg, setPinnedMsg] = useState(null)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [clearedAt, setClearedAt] = useState(null)
  const [attachment, setAttachment] = useState(null)
  const [attachmentPreview, setAttachmentPreview] = useState('')
  const [otherTyping, setOtherTyping] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)

  const [recording, setRecording] = useState(false)
  const [canMsg, setCanMsg] = useState(true)
  const [canMsgReason, setCanMsgReason] = useState('')
  const [canMsgRequest, setCanMsgRequest] = useState(false)
  const [canSeeOnline, setCanSeeOnline] = useState(true)
  const [canSeeReadReceipts, setCanSeeReadReceipts] = useState(true)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const recorderRef = useRef(null)
  const recordChunksRef = useRef([])
  const recordTimerRef = useRef(null)

  const scrollRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const messagesRef = useRef([])
  const typingChannelRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const myId = session?.user?.id

  const boot = useCallback(async () => {
    if (!myId || !otherId) return
    setLoading(true); setError('')

    const { data: prof } = await supabase
      .from('profiles').select('id, display_name, username, is_verified, last_seen_at').eq('id', otherId).single()
    const { data: photo } = await supabase
      .from('profile_photos').select('storage_path').eq('user_id', otherId)
      .order('is_primary', { ascending: false }).order('display_order', { ascending: true }).limit(1)
    if (prof) setOther({ ...prof, photo_url: publicPhotoUrl(photo?.[0]?.storage_path) })

    const lo = myId < otherId ? myId : otherId
    const hi = myId < otherId ? otherId : myId

    // Try match first
    const { data: match } = await supabase
      .from('matches').select('id').eq('user_one_id', lo).eq('user_two_id', hi).maybeSingle()

    let convId = null
    let isDirect = null  // null = unknown, true = direct, false = matched

    if (match) {
      isDirect = false
      // 1. Existing match conversation?
      const { data: existingConv } = await supabase
        .from('conversations').select('id').eq('match_id', match.id).maybeSingle()
      if (existingConv) {
        convId = existingConv.id
      } else {
        // 2. Before creating a new one, adopt a direct conversation if it exists.
        //    This prevents losing the paid-DM chat history when you match.
        const { data: directToAdopt } = await supabase
          .from('conversations')
          .select('id')
          .eq('is_direct', true)
          .or(`and(initiator_id.eq.${myId},recipient_id.eq.${otherId}),and(initiator_id.eq.${otherId},recipient_id.eq.${myId})`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (directToAdopt) {
          await supabase.from('conversations').update({ match_id: match.id }).eq('id', directToAdopt.id)
          convId = directToAdopt.id
        } else {
        const { data: created, error: createErr } = await supabase
          .from('conversations').insert({ match_id: match.id }).select('id').single()
        if (createErr) {
          const { data: retry } = await supabase
            .from('conversations').select('id').eq('match_id', match.id).maybeSingle()
          if (retry) {
            convId = retry.id
          } else {
            setError(createErr.message)
            setLoading(false)
            return
          }
        } else {
          convId = created.id
        }
        }
      }
    } else {
      // No match — look for a direct conversation between us
      // Look for a direct conversation between us.
      // Retry once in case the paid-DM RPC is still creating the row.
      let directConv = null
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data: directConvs } = await supabase
          .from('conversations')
          .select('id, is_direct, match_id')
          .eq('is_direct', true)
          .or(`and(initiator_id.eq.${myId},recipient_id.eq.${otherId}),and(initiator_id.eq.${otherId},recipient_id.eq.${myId})`)
          .order('created_at', { ascending: false })
          .limit(1)
        if (directConvs && directConvs.length > 0) {
          directConv = directConvs[0]
          break
        }
        if (attempt === 0) await new Promise((r) => setTimeout(r, 600))
      }

      if (directConv) {
        convId = directConv.id
        isDirect = true
      } else {
        setError("You're not matched with this person yet.")
        setLoading(false)
        return
      }
    }
    setConversationId(convId)
    setOther((cur) => cur ? { ...cur, isDirect } : cur)

    const { data: msgs, error: msgErr } = await supabase
      .from('messages')
      .select('id, sender_id, content, created_at, media_url, media_type, media_name, reply_to_id, deleted_at, metadata')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true }).limit(200)
    if (msgErr) { setError(msgErr.message); setLoading(false); return }
    setMessages(msgs || [])

    if (msgs?.length) {
      const ids = msgs.map((m) => m.id)
      const { data: reacts } = await supabase
        .from('message_reactions').select('message_id, user_id, reaction').in('message_id', ids)
      const byMsg = {}
      ;(reacts || []).forEach((r) => {
        byMsg[r.message_id] = byMsg[r.message_id] || []
        byMsg[r.message_id].push({ user_id: r.user_id, reaction: r.reaction })
      })
      setReactions(byMsg)
    }

    const { data: theirRead } = await supabase
      .from('conversation_reads').select('last_read_at')
      .eq('conversation_id', convId).eq('user_id', otherId).maybeSingle()
    setTheirLastRead(theirRead?.last_read_at || null)

    // Read receipts: symmetric — off if either side turned them off
    const [mineRes, theirsRes] = await Promise.all([
      supabase.from('user_settings').select('show_read_receipts').eq('user_id', myId).maybeSingle(),
      supabase.from('user_settings').select('show_read_receipts').eq('user_id', otherId).maybeSingle(),
    ])
    const mineOn = mineRes.data?.show_read_receipts !== false
    const theirsOn = theirsRes.data?.show_read_receipts !== false
    setCanSeeReadReceipts(mineOn && theirsOn)

    // Capture MY previous read mark BEFORE overwriting it — used for the "new messages" divider
    const { data: myPrevRead } = await supabase
      .from('conversation_reads').select('last_read_at')
      .eq('conversation_id', convId).eq('user_id', myId).maybeSingle()
    setMyPreviousReadAt(myPrevRead?.last_read_at || null)

    // Load mute + clear state
    const [muteRes, clearRes] = await Promise.all([
      supabase.from('conversation_mutes').select('conversation_id').eq('conversation_id', convId).eq('user_id', myId).maybeSingle(),
      supabase.from('conversation_clears').select('cleared_at').eq('conversation_id', convId).eq('user_id', myId).maybeSingle(),
    ])
    setIsMuted(!!muteRes.data)
    setClearedAt(clearRes.data?.cleared_at || null)

    await supabase.from('conversation_reads').upsert(
      { conversation_id: convId, user_id: myId, last_read_at: new Date().toISOString() },
      { onConflict: 'conversation_id,user_id' }
    )
    setLoading(false)
  }, [myId, otherId])

  useEffect(() => { boot() }, [boot])

  // Load pinned message for this conversation
  useEffect(() => {
    if (!conversationId) return
    let cancelled = false
    const fetchPinned = async () => {
      const { data: pin } = await supabase
        .from('pinned_messages')
        .select('message_id, pinned_by')
        .eq('conversation_id', conversationId)
        .maybeSingle()
      if (cancelled) return
      if (!pin) { setPinnedMsg(null); return }
      const { data: msg } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at, media_url, media_type, deleted_at')
        .eq('id', pin.message_id)
        .maybeSingle()
      if (cancelled) return
      setPinnedMsg(msg ? { ...msg, pinned_by: pin.pinned_by } : null)
    }
    fetchPinned()
    const ch = supabase
      .channel('pin-' + conversationId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pinned_messages', filter: 'conversation_id=eq.' + conversationId }, () => fetchPinned())
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [conversationId])

  // Toggle pin
  async function togglePin(message) {
    if (!conversationId || !myId) return
    tap('light')
    if (pinnedMsg?.id === message.id) {
      await supabase.from('pinned_messages').delete().eq('conversation_id', conversationId)
      setPinnedMsg(null)
    } else {
      await supabase.from('pinned_messages').upsert({
        conversation_id: conversationId,
        message_id: message.id,
        pinned_by: myId,
      }, { onConflict: 'conversation_id' })
      setPinnedMsg({ ...message, pinned_by: myId })
    }
  }

  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel('chat-' + conversationId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conversationId },
        (payload) => {
          const m = payload.new
          setMessages((cur) => cur.some((x) => x.id === m.id) ? cur : [...cur, m])
          if (m.sender_id !== myId) {
            supabase.from('conversation_reads').upsert(
              { conversation_id: conversationId, user_id: myId, last_read_at: new Date().toISOString() },
              { onConflict: 'conversation_id,user_id' }
            )
          }
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conversationId },
        (payload) => {
          const m = payload.new
          setMessages((cur) => cur.map((x) => x.id === m.id ? { ...x, ...m } : x))
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        async () => {
          const ids = messagesRef.current.map((m) => m.id)
          if (!ids.length) return
          const { data: reacts } = await supabase
            .from('message_reactions').select('message_id, user_id, reaction').in('message_id', ids)
          const byMsg = {}
          ;(reacts || []).forEach((r) => {
            byMsg[r.message_id] = byMsg[r.message_id] || []
            byMsg[r.message_id].push({ user_id: r.user_id, reaction: r.reaction })
          })
          setReactions(byMsg)
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_reads', filter: 'conversation_id=eq.' + conversationId },
        async () => {
          const { data: theirRead } = await supabase
            .from('conversation_reads').select('last_read_at')
            .eq('conversation_id', conversationId).eq('user_id', otherId).maybeSingle()
          setTheirLastRead(theirRead?.last_read_at || null)
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'id=eq.' + otherId },
        (payload) => {
          const next = payload.new?.last_seen_at
          if (next) setOther((cur) => cur ? { ...cur, last_seen_at: next } : cur)
        })
      .subscribe()
  return () => { supabase.removeChannel(channel) }
  }, [conversationId, myId, otherId])

  function onMsgPressStart(m, e) {
  const t = e?.touches?.[0]
  const x = t?.clientX ?? window.innerWidth / 2
  const y = t?.clientY ?? window.innerHeight / 2
  longPressTimer.current = setTimeout(() => {
    tap("medium")
    setPopoverAnchor({ x, y })
    setActionsForMsg(m)
  }, 550)
  }
  function onMsgPressEnd() {
  if (longPressTimer.current) {
    clearTimeout(longPressTimer.current)
    longPressTimer.current = null
  }
  }

  function onRowTouchStart(m, e) {
  swipeRef.current = { id: m.id, startX: e.touches[0].clientX, startY: e.touches[0].clientY, dx: 0, active: false }
  onMsgPressStart(m, e)
  }

  function onRowTouchMove(e) {
  const sw = swipeRef.current
  if (!sw.id) return
  const dx = e.touches[0].clientX - sw.startX
  const dy = Math.abs(e.touches[0].clientY - (sw.startY || 0))
  // Swipe only kicks in on a rightward drag of > 15px, with strong horizontal bias
  if (!sw.active && dx > 15 && dx > dy * 1.2) {
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

  function onRowTouchEnd(m) {
  const sw = swipeRef.current
  const triggered = sw.active && sw.dx >= 70
  const wasSwipe = sw.active
  swipeRef.current = { id: null, startX: 0, dx: 0, active: false }
  setSwipeState({ id: null, dx: 0 })

  if (triggered) {
    tap("light")
    setReplyingTo(m)
    return
  }

  if (!wasSwipe) {
    const now = Date.now()
    const last = lastTapRef.current
    const isDoubleTap = last.id === m.id && (now - last.time) < 300
    if (isDoubleTap) {
      // Double tap — react with heart
      lastTapRef.current = { id: null, time: 0 }
      tap("medium")
      toggleReaction(m.id, "❤️")
      setHeartBurst({ id: m.id, key: now })
      setTimeout(() => setHeartBurst((cur) => cur && cur.id === m.id ? null : cur), 900)
      // Cancel long-press
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
      return
    }
    lastTapRef.current = { id: m.id, time: now }
    onMsgPressEnd()
  }
  }



  useEffect(() => {
    if (!conversationId || !myId) return
    const ch = supabase.channel('typing-' + conversationId)
    ch.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload?.payload?.user_id === myId) return
      setOtherTyping(!!payload?.payload?.typing)
    }).subscribe()
    typingChannelRef.current = ch
    return () => { supabase.removeChannel(ch); typingChannelRef.current = null }
  }, [conversationId, myId])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  useEffect(() => { messagesRef.current = messages }, [messages])

  function notifyTyping(value) {
    const ch = typingChannelRef.current
    if (!ch) return
    ch.send({ type: 'broadcast', event: 'typing', payload: { user_id: myId, typing: value.trim().length > 0 } })
    clearTimeout(typingTimeoutRef.current)
    if (value.trim().length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        ch.send({ type: 'broadcast', event: 'typing', payload: { user_id: myId, typing: false } })
      }, 1500)
    }
  }

  function pickAttachment(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Only images supported here.'); e.target.value = ''; return }
    if (f.size > 8 * 1024 * 1024) { setError('Image must be under 8 MB.'); e.target.value = ''; return }
    setAttachment(f); setAttachmentPreview(URL.createObjectURL(f)); setError('')
  }

  function clearAttachment() {
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview)
    setAttachment(null); setAttachmentPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function startRecording() {
    if (recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm'
      const mr = new MediaRecorder(stream, { mimeType: mime })
      recordChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data) }
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); clearInterval(recordTimerRef.current) }
      mr.start()
      recorderRef.current = mr
      setRecording(true); setRecordSeconds(0)
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
      tap('medium')
    } catch (err) { setError('Microphone access denied. ' + (err?.message || '')) }
  }

  async function stopRecording(send_it) {
    if (send_it && !canMsg) { setError(canMsgReason || "You can't message this user"); return }
    const mr = recorderRef.current
    if (!mr) return
    clearInterval(recordTimerRef.current)
    const seconds = recordSeconds
    await new Promise((resolve) => { mr.addEventListener('stop', resolve, { once: true }); mr.stop() })
    recorderRef.current = null
    setRecording(false); setRecordSeconds(0)
    if (!send_it) return
    if (seconds < 1) { setError('Recording too short.'); return }
    const blob = new Blob(recordChunksRef.current, { type: 'audio/webm' })
    recordChunksRef.current = []
    if (blob.size > 10 * 1024 * 1024) { setError('Voice note too long.'); return }
    setSending(true)
    const path = `${conversationId}/${crypto.randomUUID()}.webm`
    const { error: upErr } = await supabase.storage.from('chat-media').upload(path, blob, { upsert: false, contentType: 'audio/webm' })
    if (upErr) { setError(upErr.message); setSending(false); return }
    const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path)
    const payload = { conversation_id: conversationId, sender_id: myId, content: '', media_url: pub?.publicUrl || null, media_type: 'audio/webm', media_name: `Voice · ${seconds}s` }
    if (replyingTo?.id) payload.reply_to_id = replyingTo.id
    setReplyingTo(null)

    const { data: inserted, error: sendErr } = await supabase
      .from('messages')
      .insert(payload)
      .select('id, sender_id, content, created_at, media_url, media_type, media_name, reply_to_id, deleted_at, metadata')
      .single()

    if (sendErr) {
      setError(friendlyError(sendErr))
    } else if (inserted) {
      setMessages((cur) => cur.some((x) => x.id === inserted.id) ? cur : [...cur, inserted])
    }
    setSending(false)
  }

  async function send() {
    const body = text.trim()
    if (!body && !attachment) return
    if (sending) return

    // canMsg=false + canMsgRequest=false → hard block
    // canMsg=false + canMsgRequest=true  → send as request
    if (!canMsg) {
      if (!canMsgRequest) {
        setError(canMsgReason || "You can't message this user")
        return
      }
      if (!myId || !otherId) return
      setSending(true); tap('light')
      let mediaUrl = null, mediaType = null, mediaName = null
      if (attachment) {
        const ext = attachment.name.split(".").pop()?.toLowerCase() || "jpg"
        const path = "request-media/" + crypto.randomUUID() + "." + ext
        const { error: upErr } = await supabase.storage.from("chat-media").upload(path, attachment, { upsert: false, contentType: attachment.type })
        if (upErr) { setSending(false); setError(upErr.message); return }
        const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path)
        mediaUrl = pub?.publicUrl || null
        mediaType = attachment.type
        mediaName = attachment.name
      }
      const { error: reqErr } = await supabase.from("message_requests").insert({
        sender_id: myId,
        recipient_id: otherId,
        content: body || "",
        media_url: mediaUrl,
        media_type: mediaType,
        media_name: mediaName,
      })
      setSending(false)
      if (reqErr) {
        if (reqErr.code === "23505") setError("You already sent a request. Please wait for a response.")
        else setError(reqErr.message)
        return
      }
      setText(""); clearAttachment()
      setError("Request sent. They'll see it in their message requests.")
      return
    }

    if (!conversationId) return
    setSending(true); tap('light')
    let mediaUrl = null, mediaType = null, mediaName = null
    if (attachment) {
      const ext = attachment.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${conversationId}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('chat-media').upload(path, attachment, { upsert: false, contentType: attachment.type })
      if (upErr) { setSending(false); setError(friendlyError(upErr)); return }
      const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path)
      mediaUrl = pub?.publicUrl || null
      mediaType = attachment.type
      mediaName = attachment.name
    }
    const payload = { conversation_id: conversationId, sender_id: myId, content: body || '' }
    if (storyReply) {
      payload.metadata = { story_reply: { story_id: storyReply.story_id, media_url: storyReply.media_url, media_type: storyReply.media_type } }
    }
    if (mediaUrl) { payload.media_url = mediaUrl; payload.media_type = mediaType; payload.media_name = mediaName }
    if (replyingTo?.id) payload.reply_to_id = replyingTo.id
    setText(''); clearAttachment(); setReplyingTo(null); setStoryReply(null)
    const { data: inserted, error: sendErr } = await supabase
      .from('messages')
      .insert(payload)
      .select('id, sender_id, content, created_at, media_url, media_type, media_name, reply_to_id, deleted_at, metadata')
      .single()

    if (sendErr) {
      setError(sendErr.message)
      setText(body)
    } else if (inserted) {
      setMessages((cur) => cur.some((x) => x.id === inserted.id) ? cur : [...cur, inserted])
    }
    setSending(false)
  }

  async function toggleMute() {
    if (!conversationId || !myId) return
    tap('light')
    if (isMuted) {
      await supabase.from('conversation_mutes').delete().eq('conversation_id', conversationId).eq('user_id', myId)
      setIsMuted(false)
    } else {
      await supabase.from('conversation_mutes').insert({ conversation_id: conversationId, user_id: myId })
      setIsMuted(true)
    }
  }

  async function clearChat() {
    if (!conversationId || !myId) return
    if (!confirm('Clear this chat? Messages will be hidden for you only.')) return
    tap('light')
    const now = new Date().toISOString()
    await supabase.from('conversation_clears').upsert(
      { conversation_id: conversationId, user_id: myId, cleared_at: now },
      { onConflict: 'conversation_id,user_id' }
    )
    setClearedAt(now)
  }

  async function deleteMessage(messageId) {
    const target = messages.find((m) => m.id === messageId)
    if (!target || !isWithinUnsendWindow(target.created_at)) {
      setError('This message is too old to unsend')
      return
    }
    if (!confirm('Unsend this message for everyone? This cannot be undone.')) return
    tap('light')
    const { error: err } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString(), content: '', media_url: null })
      .eq('id', messageId).eq('sender_id', myId)
    if (err) { setError(friendlyError(err)); return }
    setMessages((cur) => cur.map((m) => m.id === messageId ? { ...m, deleted_at: new Date().toISOString(), content: '', media_url: null } : m))
  }

  async function toggleReaction(messageId, emoji) {
    if (!myId) return
    tap('light')
    const current = (reactions[messageId] || []).find((r) => r.user_id === myId)
    if (current?.reaction === emoji) {
      await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', myId)
    } else if (current) {
      await supabase.from('message_reactions').update({ reaction: emoji }).eq('message_id', messageId).eq('user_id', myId)
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: myId, reaction: emoji })
    }
    setReactionPickerFor(null)
  }

  const visibleMessages = clearedAt
    ? messages.filter((m) => new Date(m.created_at) > new Date(clearedAt))
    : messages

  const firstUnreadIdx = visibleMessages.findIndex(
    (m) => m.sender_id !== myId && myPreviousReadAt && new Date(m.created_at) > new Date(myPreviousReadAt)
  )

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />
      <header style={{ height: 60, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav('/messages')} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <button
          type="button"
          onClick={() => { if (other?.id) { tap('light'); nav('/profile/' + other.id) } }}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
          aria-label="View profile"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0">
            {other?.photo_url ? (
              <img src={other.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-base font-black text-purple-400">
                {(other?.display_name || '?')[0]}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-cream text-[14.5px] font-semibold truncate flex items-center gap-1.5">
              {other?.display_name || other?.username || 'Someone'}
              {other?.is_verified && <VerifiedBadge size={14} className="ml-1" />}
            </p>
            <p className="text-subtle text-[11px] font-medium">{otherTyping ? 'typing…' : !canSeeOnline ? (other?.isDirect === true ? 'Direct message' : other?.isDirect === false ? 'Matched' : '') : isOnline(other?.last_seen_at, 2) ? (<><span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: '#22C55E', boxShadow: '0 0 6px rgba(34,197,94,0.55)' }} />Online</>) : other?.last_seen_at ? 'Last seen ' + formatLastSeen(other.last_seen_at) : other?.isDirect === true ? 'Direct message' : other?.isDirect === false ? 'Matched' : ''}</p>
          </div>
        </button>
        <button
          onClick={() => {
            if (!other) return
            tap('light')
            voiceCall.startCall(other.id, {
              display_name: other.display_name,
              photo_url: other.photo_url,
            }, { mode: 'video' })
          }}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Video call"
        >
          <Video size={19} strokeWidth={2.3} />
        </button>

        <button
          onClick={() => {
            if (!other) return
            tap('light')
            voiceCall.startCall(other.id, {
              display_name: other.display_name,
              photo_url: other.photo_url,
            })
          }}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Voice call"
        >
          <Phone size={19} strokeWidth={2.3} />
        </button>

        <button
          onClick={() => setMenuOpen(true)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="More"
        >
          <MoreVertical size={20} strokeWidth={2.2} />
        </button>
      </header>

      {error && (
        <div className="mx-3 mt-2 text-danger text-[12px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 shrink-0">
          {error}
        </div>
      )}

      {pinnedMsg && !pinnedMsg.deleted_at && (
        <div className="shrink-0 mx-3 mt-2 mb-1 rounded-2xl bg-purple-500/10 border border-purple-500/30 px-3 py-2 flex items-center gap-2.5">
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

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 pt-2 pb-4 flex flex-col gap-1.5">
        {loading ? (
          <div className="flex flex-col gap-2.5 pt-2">
            <div className="flex justify-start">
              <div className="h-11 w-[58%] rounded-2xl rounded-bl-md bg-white/[0.04] animate-pulse" />
            </div>
            <div className="flex justify-end">
              <div className="h-11 w-[42%] rounded-2xl rounded-br-md bg-white/[0.06] animate-pulse" />
            </div>
            <div className="flex justify-start">
              <div className="h-16 w-[64%] rounded-2xl rounded-bl-md bg-white/[0.04] animate-pulse" />
            </div>
            <div className="flex justify-end">
              <div className="h-11 w-[46%] rounded-2xl rounded-br-md bg-white/[0.06] animate-pulse" />
            </div>
            <div className="flex justify-start">
              <div className="h-11 w-[52%] rounded-2xl rounded-bl-md bg-white/[0.04] animate-pulse" />
            </div>
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="grid place-items-center h-full text-center px-6">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-purple-500/12 border border-purple-500/25 grid place-items-center mx-auto mb-3">
                <MessageCircle size={22} strokeWidth={1.8} className="text-purple-300" />
              </div>
              <p className="text-cream font-semibold text-[14.5px] mb-1">
                You matched with {other?.display_name || 'them'}
              </p>
              <p className="text-muted text-[13px]">Say something real.</p>
            </div>
          </div>
        ) : (
          visibleMessages.map((m, i) => {
            const mine = m.sender_id === myId
            const showGap = i === 0 || (new Date(m.created_at) - new Date(visibleMessages[i-1].created_at)) > 5 * 60 * 1000
            const showDay = i === 0 || new Date(m.created_at).toDateString() !== new Date(visibleMessages[i-1].created_at).toDateString()
            const replyToMsg = m.reply_to_id ? visibleMessages.find((x) => x.id === m.reply_to_id) : null
            const reacts = reactions[m.id] || []
            const myReact = reacts.find((r) => r.user_id === myId)
            const readByThem = canSeeReadReceipts && theirLastRead && new Date(theirLastRead) >= new Date(m.created_at)
            const deleted = !!m.deleted_at

            return (
              <div
                key={m.id}
                onTouchStart={(e) => onRowTouchStart(m, e)}
                onTouchEnd={() => onRowTouchEnd(m)}
                onTouchMove={onRowTouchMove}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setPopoverAnchor({ x: e.clientX, y: e.clientY })
                  setActionsForMsg(m)
                }}
                style={{
                  transform: swipeState.id === m.id ? `translateX(${swipeState.dx}px)` : undefined,
                  transition: swipeState.id === m.id ? "none" : "transform 180ms ease-out",
                  touchAction: "pan-y",
                }}
              >
                {i === firstUnreadIdx && (
                  <div className="flex items-center gap-3 py-3 px-2">
                    <div className="flex-1 h-px bg-purple-500/30" />
                    <span className="text-purple-300 text-[10.5px] font-bold tracking-wider uppercase">New messages</span>
                    <div className="flex-1 h-px bg-purple-500/30" />
                  </div>
                )}
                {showDay && (
                  <div className="flex justify-center py-3">
                    <span className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/8 text-subtle text-[10.5px] font-bold tracking-wider uppercase">
                      {dayLabel(m.created_at)}
                    </span>
                  </div>
                )}
                {showGap && !showDay && (
                  <p className="text-center text-subtle text-[10.5px] font-medium py-1.5">{timeLabel(m.created_at)}</p>
                )}
                {swipeState.id === m.id && swipeState.dx > 10 && (
                  <div className="flex justify-start pl-2 pb-1" style={{ opacity: Math.min(1, swipeState.dx / 50) }}>
                    <div className="w-7 h-7 rounded-full grid place-items-center bg-purple-500/30 border border-purple-500/50">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C084FC" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 17 4 12 9 7" />
                        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                      </svg>
                    </div>
                  </div>
                )}
                {heartBurst?.id === m.id && (
                  <motion.div
                    key={heartBurst.key}
                    initial={{ scale: 0.3, opacity: 0, y: 0 }}
                    animate={{ scale: [0.3, 1.2, 1.4, 1], opacity: [0, 1, 1, 0], y: [0, -6, -14, -22] }}
                    transition={{ duration: 0.85, times: [0, 0.2, 0.6, 1] }}
                    className="pointer-events-none flex"
                    style={{ justifyContent: mine ? "flex-end" : "flex-start", paddingRight: mine ? 12 : 0, paddingLeft: mine ? 0 : 12 }}
                  >
                    <div className="text-[44px] leading-none" style={{ filter: "drop-shadow(0 4px 12px rgba(236,72,153,0.6))" }}>❤️</div>
                  </motion.div>
                )}
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[82%] relative group">
                    {m.metadata?.story_reply && !deleted && !replyToMsg && (
                      <div className={`mb-1 px-2 py-2 rounded-xl flex items-center gap-2 ${mine ? 'bg-purple-500/15 border border-purple-500/30' : 'bg-white/5 border border-white/8'}`}>
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-black/40 shrink-0">
                          {m.metadata.story_reply.media_type === "video" ? (
                            <video src={m.metadata.story_reply.media_url} muted playsInline className="w-full h-full object-cover" />
                          ) : (
                            <img src={m.metadata.story_reply.media_url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[10px] font-bold tracking-wide text-purple-300">
                            {mine ? "You replied to their story" : "Replied to your story"}
                          </span>
                          <span className="block text-[11.5px] text-muted truncate">Story</span>
                        </div>
                      </div>
                    )}

                    {replyToMsg && !deleted && (
                      <div className={`mb-1 px-3 py-1.5 rounded-xl text-[12px] border-l-2 ${
                        mine ? 'bg-purple-500/15 border-purple-400 text-purple-100' : 'bg-white/5 border-white/30 text-muted'
                      }`}>
                        <span className="font-bold block text-[10.5px] tracking-wide">
                          {replyToMsg.sender_id === myId ? 'You' : (other?.display_name || 'Them')}
                        </span>
                        <span className="truncate block">{replyToMsg.content || 'Media'}</span>
                      </div>
                    )}

                    {(() => {
                      const hasImage = m.media_url && m.media_type?.startsWith('image/')
                      const hasAudio = m.media_url && m.media_type?.startsWith('audio/')
                      const hasText = m.content && m.content.trim().length > 0

                      if (deleted) {
                        return (
                          <div className="px-3.5 py-2.5 text-[13px] italic bg-white/[0.04] border border-white/8 text-subtle rounded-2xl">
                            Message deleted
                          </div>
                        )
                      }

                      // IMAGE ONLY — no bubble, just the image
                      if (hasImage && !hasAudio && !hasText) {
                        return (
                          <img
                            src={m.media_url}
                            alt={m.media_name || 'photo'}
                            onClick={() => setLightboxUrl(m.media_url)}
                            className="block max-w-[200px] w-auto h-auto cursor-pointer active:opacity-90"
                            style={{ borderRadius: 12, maxHeight: 260, objectFit: 'cover' }}
                            loading="lazy"
                          />
                        )
                      }

                      // IMAGE + TEXT — image on top, text bubble below
                      if (hasImage && hasText) {
                        return (
                          <div className="flex flex-col gap-1 max-w-[220px]">
                            <img
                              src={m.media_url}
                              alt={m.media_name || 'photo'}
                              onClick={() => setLightboxUrl(m.media_url)}
                              className="block w-full h-auto cursor-pointer active:opacity-90"
                              style={{ borderRadius: 12, maxHeight: 240, objectFit: 'cover' }}
                              loading="lazy"
                            />
                            <div className={`px-3.5 py-2 text-[14.5px] leading-[1.4] break-words ${
                              mine
                                ? 'bg-gradient-to-br from-purple-600 to-purple-500 text-white rounded-2xl rounded-br-md'
                                : 'bg-elevated text-cream border border-white/8 rounded-2xl rounded-bl-md'
                            }`}>
                              <Linkify text={m.content} mine={mine} />
                            </div>
                          </div>
                        )
                      }

                      // VOICE / VOICE+TEXT / anything else — soft bubble
                      return (
                        <div className={`px-3 py-2 text-[14.5px] leading-[1.4] break-words max-w-[260px] ${
                          mine
                            ? 'bg-gradient-to-br from-purple-600 to-purple-500 text-white rounded-2xl rounded-br-md'
                            : 'bg-elevated text-cream border border-white/8 rounded-2xl rounded-bl-md'
                        }`}>
                          {hasAudio && <AudioBubble src={m.media_url} mine={mine} />}
                          {hasText && <div><Linkify text={m.content} mine={mine} /></div>}
                        </div>
                      )
                    })()}

                    {!deleted && (
                      <div className={`absolute -bottom-2 ${mine ? 'right-0' : 'left-0'} flex gap-1 z-10`}>
                        <button
                          onClick={() => setReplyingTo(m)}
                          aria-label="Reply"
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-[10px] px-1.5 py-0.5 rounded-full bg-obsidian/85 border border-white/10 text-muted"
                        >
                          Reply
                        </button>
                        <button
                          onClick={() => setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)}
                          aria-label="React"
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity w-5 h-5 rounded-full grid place-items-center bg-obsidian/85 border border-white/10"
                        >
                          <Smile size={11} strokeWidth={2.4} className="text-muted" />
                        </button>
                        {mine && (
                          <button
                            onClick={() => deleteMessage(m.id)}
                            aria-label="Delete"
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity w-5 h-5 rounded-full grid place-items-center bg-obsidian/85 border border-white/10"
                          >
                            <Trash2 size={10} strokeWidth={2.4} className="text-danger" />
                          </button>
                        )}
                      </div>
                    )}

                    {reacts.length > 0 && !deleted && (
                      <div className={`flex gap-0.5 mt-1.5 ${mine ? 'justify-end' : 'justify-start'} flex-wrap`}>
                        {Object.entries(reacts.reduce((acc, r) => { acc[r.reaction] = (acc[r.reaction] || 0) + 1; return acc }, {})).map(([emoji, count]) => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(m.id, emoji)}
                            className={`text-[11.5px] px-1.5 py-0.5 rounded-full border transition-colors ${
                              myReact?.reaction === emoji ? 'bg-purple-500/20 border-purple-400/40' : 'bg-white/[0.04] border-white/10'
                            }`}
                          >
                            {emoji} {count > 1 ? count : ''}
                          </button>
                        ))}
                      </div>
                    )}

                    {reactionPickerFor === m.id && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-1 mt-1.5 p-1.5 rounded-full bg-elevated border border-white/10 ${mine ? 'justify-end ml-auto' : ''} w-fit`}
                      >
                        {REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(m.id, emoji)}
                            className="w-7 h-7 rounded-full grid place-items-center text-base hover:bg-white/10"
                          >
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    )}

                    {/* Read receipt for my messages */}
                    {mine && !deleted && i === visibleMessages.length - 1 && (
                      <div className={`flex justify-end mt-1 pr-0.5`}>
                        {readByThem ? (
                          <CheckCheck size={13} strokeWidth={2.4} className="text-purple-400" />
                        ) : (
                          <Check size={13} strokeWidth={2.4} className="text-subtle" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {storyReply && (
        <div className="shrink-0 mx-3 mb-2 p-2 rounded-xl bg-elevated border border-purple-500/30 flex items-center gap-3">
          <div className="w-10 h-14 rounded-lg overflow-hidden bg-black shrink-0">
            {storyReply.media_type === "video" ? (
              <video src={storyReply.media_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
            ) : (
              <img src={storyReply.media_url} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-purple-300 text-[10.5px] font-bold tracking-wider uppercase">Replying to story</p>
            <p className="text-muted text-[12px] mt-0.5">Sent with the story</p>
          </div>
          <button
            onClick={() => setStoryReply(null)}
            className="w-7 h-7 rounded-full grid place-items-center text-muted shrink-0"
            aria-label="Cancel story reply"
          >
            <X size={15} strokeWidth={2.4} />
          </button>
        </div>
      )}

      {replyingTo && (
        <div className="shrink-0 mx-3 mb-2 px-3 py-2 rounded-xl bg-elevated border border-purple-500/30 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-purple-300 text-[10.5px] font-bold tracking-wide uppercase mb-0.5">
              Replying to {replyingTo.sender_id === myId ? 'yourself' : (other?.display_name || 'them')}
            </p>
            <p className="text-muted text-[12.5px] truncate">{replyingTo.content || 'Media'}</p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="w-6 h-6 rounded-full grid place-items-center text-muted shrink-0" aria-label="Cancel reply">
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>
      )}

      {attachment && (
        <div className="shrink-0 mx-3 mb-2 relative w-fit">
          <img src={attachmentPreview} alt="" className="rounded-xl max-h-32" />
          <button onClick={clearAttachment} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-obsidian border border-white/20 grid place-items-center" aria-label="Remove">
            <X size={13} strokeWidth={2.6} className="text-cream" />
          </button>
        </div>
      )}

      {!canMsg && !canMsgRequest && (
        <div className="shrink-0 mx-3 mb-2 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-2">
          <span className="text-red-300 text-[13px] font-semibold leading-tight">{canMsgReason || "You can't message this user"}</span>
        </div>
      )}

      {!canMsg && canMsgRequest && (
        <div className="shrink-0 mx-3 mb-2 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
          <span className="text-amber-300 text-[13px] font-semibold leading-tight">{canMsgReason}</span>
        </div>
      )}

      {recording && (
        <div className="shrink-0 mx-3 mb-2 px-4 py-3 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-cream text-[14px] font-semibold">
            Recording · {String(Math.floor(recordSeconds / 60)).padStart(2,'0')}:{String(recordSeconds % 60).padStart(2,'0')}
          </span>
        </div>
      )}

      {emojiOpen && (
        <EmojiPicker
          className="shrink-0 mx-3 mb-1"
          onPick={(e) => { setText((t) => (t + e).slice(0, 2000)); tap("light") }}
        />
      )}

      <div
        className="shrink-0 px-3 pt-3 pb-3 flex items-end gap-2 relative"
        style={{ background: 'linear-gradient(to top, #0B0B14 70%, rgba(11,11,20,0) 100%)' }}
        style={{
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          pointerEvents: (canMsg || canMsgRequest) ? 'auto' : 'none',
          opacity: (canMsg || canMsgRequest) ? 1 : 0.4,
        }}
      >
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickAttachment} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={pickAttachment} />
        <button
          onClick={() => setAttachMenuOpen(true)}
          disabled={recording}
          className="w-10 h-10 rounded-full grid place-items-center text-muted shrink-0 disabled:opacity-40"
          aria-label="Attach photo"
        >
          <Paperclip size={19} strokeWidth={2.3} />
        </button>
        <button
          onClick={() => { setEmojiOpen((v) => !v); tap("light") }}
          className="w-10 h-10 rounded-full grid place-items-center text-muted shrink-0"
          aria-label="Emoji"
        >
          <Smile size={20} strokeWidth={2.3} className={emojiOpen ? "text-purple-400" : ""} />
        </button>

        {recording ? (
          <>
            <button
              onClick={() => stopRecording(false)}
              className="flex-1 h-11 rounded-[22px] bg-white/[0.06] text-cream font-semibold text-[13.5px] flex items-center justify-center gap-2"
            >
              <X size={16} strokeWidth={2.4} /> Cancel
            </button>
            <button
              onClick={() => stopRecording(true)}
              className="flex-1 h-11 rounded-[22px] bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold text-[13.5px] flex items-center justify-center gap-2"
            >
              <Square size={14} strokeWidth={2.6} fill="currentColor" /> Send
            </button>
          </>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); notifyTyping(e.target.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              rows={1}
              placeholder={canMsg ? "Write a message…" : canMsgRequest ? "Write a request…" : "Messaging is not allowed"}
              className="flex-1 bg-elevated border border-white/8 rounded-[22px] px-4 py-2.5 text-cream text-[14.5px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none max-h-32 leading-[1.4]"
              style={{ minHeight: 44 }}
            />
            {text.trim() || attachment ? (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={send}
                disabled={sending}
                className="w-11 h-11 rounded-full grid place-items-center bg-gradient-to-br from-purple-500 to-pink-500 text-white disabled:opacity-40 shrink-0"
                aria-label="Send"
              >
                <Send size={18} strokeWidth={2.4} />
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={startRecording}
                className="w-11 h-11 rounded-full grid place-items-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shrink-0"
                aria-label="Record voice"
              >
                <Mic size={19} strokeWidth={2.4} />
              </motion.button>
            )}
          </>
        )}
      </div>

      {/* Overflow menu */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-[100] bg-obsidian/70 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-16 right-3 w-56 bg-surface rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          >
            <MenuItem icon={<Eye size={16} />} label="View profile" onClick={() => { setMenuOpen(false); nav('/profile/' + otherId) }} />
            <MenuItem
              icon={isMuted ? <BellOff size={16} /> : <Bell size={16} />}
              label={isMuted ? "Unmute" : "Mute notifications"}
              onClick={() => { setMenuOpen(false); toggleMute() }}
            />
            <MenuItem icon={<Eraser size={16} />} label="Clear chat" onClick={() => { setMenuOpen(false); clearChat() }} />
            <MenuItem icon={<Flag size={16} />} label="Report" onClick={() => { setMenuOpen(false); setReportOpen(true) }} />
            <MenuItem icon={<Ban size={16} />} label="Block" danger onClick={() => { setMenuOpen(false); setBlockOpen(true) }} />
          </div>
        </div>
      )}

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        target={other}
      />
      <BlockConfirm
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        target={other}
        onBlocked={() => nav('/messages', { replace: true })}
      />

      {actionsForMsg && (
        <MessagePopover
          message={actionsForMsg}
          anchor={popoverAnchor}
          isMine={actionsForMsg.sender_id === myId}
          isPinned={pinnedMsg?.id === actionsForMsg.id}
          canUnsend={isWithinUnsendWindow(actionsForMsg.created_at)}
          onClose={() => setActionsForMsg(null)}
          onReply={(m) => setReplyingTo(m)}
          onForward={(m) => { setActionsForMsg(null); setForwardingMsg(m) }}
          onDelete={deleteMessage}
          onReact={(emoji) => toggleReaction(actionsForMsg.id, emoji)}
          onPin={togglePin}
        />
      )}

      {forwardingMsg && (
        <ForwardPicker
          message={forwardingMsg}
          onClose={() => setForwardingMsg(null)}
          onForwarded={() => {}}
        />
      )}

      <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

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
              <span className="w-10 h-10 rounded-xl bg-purple-500/20 grid place-items-center shrink-0">
                <Camera size={18} className="text-purple-300" />
              </span>
              <div className="flex-1">
                <p className="font-bold text-[14.5px]">Take photo</p>
                <p className="text-muted text-[11.5px] mt-0.5">Open camera</p>
              </div>
            </button>
            <button
              onClick={() => { setAttachMenuOpen(false); setTimeout(() => fileInputRef.current?.click(), 100) }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream"
            >
              <span className="w-10 h-10 rounded-xl bg-purple-500/20 grid place-items-center shrink-0">
                <Image size={18} className="text-purple-300" />
              </span>
              <div className="flex-1">
                <p className="font-bold text-[14.5px]">Choose from gallery</p>
                <p className="text-muted text-[11.5px] mt-0.5">Pick an existing photo</p>
              </div>
            </button>
            <button onClick={() => setAttachMenuOpen(false)} className="w-full h-11 mt-1 text-muted font-semibold text-[13.5px]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-[14px] font-medium ${
        danger ? 'text-danger' : 'text-cream'
      } hover:bg-white/[0.04]`}
    >
      {icon}
      {label}
    </button>
  )
}

function dayLabel(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  const days = (now - d) / (1000 * 60 * 60 * 24)
  if (days < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

function timeLabel(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'Yesterday ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
