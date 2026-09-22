import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Send, MessageCircle, Paperclip, X, Smile, Mic, Square, Play, Pause, MoreVertical, Trash2, Eye, Flag, Ban, Check, CheckCheck , Phone, Video } from 'lucide-react'
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
  const [theirLastRead, setTheirLastRead] = useState(null)
  const [myPreviousReadAt, setMyPreviousReadAt] = useState(null)
  const [text, setText] = useState('')

  useEffect(() => {
    const prefill = location.state?.prefill
    if (prefill && !text) setText(prefill)
  }, [location.state?.prefill])
  const [sending, setSending] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [reactionPickerFor, setReactionPickerFor] = useState(null)
  const [attachment, setAttachment] = useState(null)
  const [attachmentPreview, setAttachmentPreview] = useState('')
  const [otherTyping, setOtherTyping] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)

  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const recorderRef = useRef(null)
  const recordChunksRef = useRef([])
  const recordTimerRef = useRef(null)

  const scrollRef = useRef(null)
  const fileInputRef = useRef(null)
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
      .select('id, sender_id, content, created_at, media_url, media_type, media_name, reply_to_id, deleted_at')
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

    // Capture MY previous read mark BEFORE overwriting it — used for the "new messages" divider
    const { data: myPrevRead } = await supabase
      .from('conversation_reads').select('last_read_at')
      .eq('conversation_id', convId).eq('user_id', myId).maybeSingle()
    setMyPreviousReadAt(myPrevRead?.last_read_at || null)

    await supabase.from('conversation_reads').upsert(
      { conversation_id: convId, user_id: myId, last_read_at: new Date().toISOString() },
      { onConflict: 'conversation_id,user_id' }
    )
    setLoading(false)
  }, [myId, otherId])

  useEffect(() => { boot() }, [boot])

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
      .select('id, sender_id, content, created_at, media_url, media_type, media_name, reply_to_id, deleted_at')
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
    if (sending || !conversationId) return
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
    if (mediaUrl) { payload.media_url = mediaUrl; payload.media_type = mediaType; payload.media_name = mediaName }
    if (replyingTo?.id) payload.reply_to_id = replyingTo.id
    setText(''); clearAttachment(); setReplyingTo(null)
    const { data: inserted, error: sendErr } = await supabase
      .from('messages')
      .insert(payload)
      .select('id, sender_id, content, created_at, media_url, media_type, media_name, reply_to_id, deleted_at')
      .single()

    if (sendErr) {
      setError(sendErr.message)
      setText(body)
    } else if (inserted) {
      setMessages((cur) => cur.some((x) => x.id === inserted.id) ? cur : [...cur, inserted])
    }
    setSending(false)
  }

  async function deleteMessage(messageId) {
    if (!confirm('Delete this message? It will be removed for both of you.')) return
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

  const firstUnreadIdx = messages.findIndex(
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
            <p className="text-subtle text-[11px] font-medium">{otherTyping ? 'typing…' : isOnline(other?.last_seen_at, 2) ? (<><span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: '#22C55E', boxShadow: '0 0 6px rgba(34,197,94,0.55)' }} />Online</>) : other?.last_seen_at ? 'Last seen ' + formatLastSeen(other.last_seen_at) : other?.isDirect === true ? 'Direct message' : other?.isDirect === false ? 'Matched' : ''}</p>
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
        ) : messages.length === 0 ? (
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
          messages.map((m, i) => {
            const mine = m.sender_id === myId
            const showGap = i === 0 || (new Date(m.created_at) - new Date(messages[i-1].created_at)) > 5 * 60 * 1000
            const replyToMsg = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null
            const reacts = reactions[m.id] || []
            const myReact = reacts.find((r) => r.user_id === myId)
            const readByThem = theirLastRead && new Date(theirLastRead) >= new Date(m.created_at)
            const deleted = !!m.deleted_at

            return (
              <div key={m.id}>
                {i === firstUnreadIdx && (
                  <div className="flex items-center gap-3 py-3 px-2">
                    <div className="flex-1 h-px bg-purple-500/30" />
                    <span className="text-purple-300 text-[10.5px] font-bold tracking-wider uppercase">New messages</span>
                    <div className="flex-1 h-px bg-purple-500/30" />
                  </div>
                )}
                {showGap && (
                  <p className="text-center text-subtle text-[10.5px] font-medium py-1.5">{timeLabel(m.created_at)}</p>
                )}
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[82%] relative group">
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
                            className="block max-w-[200px] w-auto h-auto"
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
                              className="block w-full h-auto"
                              style={{ borderRadius: 12, maxHeight: 240, objectFit: 'cover' }}
                              loading="lazy"
                            />
                            <div className={`px-3.5 py-2 text-[14.5px] leading-[1.4] break-words ${
                              mine
                                ? 'bg-gradient-to-br from-purple-600 to-purple-500 text-white rounded-2xl rounded-br-md'
                                : 'bg-elevated text-cream border border-white/8 rounded-2xl rounded-bl-md'
                            }`}>
                              {m.content}
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
                          {hasText && <div>{m.content}</div>}
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
                    {mine && !deleted && i === messages.length - 1 && (
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

      {recording && (
        <div className="shrink-0 mx-3 mb-2 px-4 py-3 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-cream text-[14px] font-semibold">
            Recording · {String(Math.floor(recordSeconds / 60)).padStart(2,'0')}:{String(recordSeconds % 60).padStart(2,'0')}
          </span>
        </div>
      )}

      <div
        className="shrink-0 px-3 pt-3 pb-3 flex items-end gap-2 relative"
        style={{ background: 'linear-gradient(to top, #0B0B14 70%, rgba(11,11,20,0) 100%)' }}
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickAttachment} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={recording}
          className="w-10 h-10 rounded-full grid place-items-center text-muted shrink-0 disabled:opacity-40"
          aria-label="Attach photo"
        >
          <Paperclip size={19} strokeWidth={2.3} />
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
              placeholder="Write a message…"
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

function AudioBubble({ src, mine }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) } else { a.play(); setPlaying(true) }
  }

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => { if (a.duration) setProgress(a.currentTime / a.duration) }
    const onEnd = () => { setPlaying(false); setProgress(0) }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    return () => { a.removeEventListener('timeupdate', onTime); a.removeEventListener('ended', onEnd) }
  }, [])

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[180px]">
      <button
        onClick={toggle}
        className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${mine ? 'bg-white/20 text-white' : 'bg-purple-600 text-white'}`}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause size={15} strokeWidth={2.6} fill="currentColor" /> : <Play size={15} strokeWidth={2.6} fill="currentColor" />}
      </button>
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: mine ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)' }}>
        <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${Math.round(progress * 100)}%`, background: mine ? '#fff' : '#A78BFA' }} />
      </div>
      <Mic size={13} strokeWidth={2.4} className={mine ? 'text-white/70' : 'text-muted'} />
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  )
}

function timeLabel(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'Yesterday ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
