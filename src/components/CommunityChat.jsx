import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Sparkles, Paperclip, Camera, X , Mic, Square } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl } from '../lib/photo'
import { tap } from '../lib/haptic'
import Linkify from './chat/Linkify'
import EmojiPicker from './chat/EmojiPicker'
import ImageLightbox from './chat/ImageLightbox'
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
            return (
              <Fragment key={m.id}>
              {i === firstUnreadIdx && (
                <div className="flex items-center gap-3 py-3 px-2">
                  <div className="flex-1 h-px bg-purple-500/30" />
                  <span className="text-purple-300 text-[10.5px] font-bold tracking-wider uppercase">New messages</span>
                  <div className="flex-1 h-px bg-purple-500/30" />
                </div>
              )}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'} gap-2`}>
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
