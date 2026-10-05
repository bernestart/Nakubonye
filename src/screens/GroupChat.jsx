import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Search, ArrowLeft, Send, Paperclip, X, MoreVertical, Users, Camera, Trash2, Flag, LogOut, UserPlus , Pencil , Link2 , Bell , Mic, Square , Pin , Eraser } from "lucide-react"
import { motion } from "framer-motion"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import PollMessage from "../components/PollMessage"
import InviteLinkSheet from "../components/InviteLinkSheet"
import ReportModal from "../components/ReportModal"
import MessageActionsSheet from "../components/MessageActionsSheet"
import ChatSearchSheet from "../components/ChatSearchSheet"
import PollComposer from "../components/PollComposer"
import ForwardPicker from "../components/ForwardPicker"
import Linkify from "../components/chat/Linkify"
import AudioBubble from "../components/chat/AudioBubble"
import EmojiPicker from "../components/chat/EmojiPicker"
import ImageLightbox from "../components/chat/ImageLightbox"
import { useVoiceRecorder } from "../components/chat/useVoiceRecorder"

const UNSEND_WINDOW_MS = 3600000

function isWithinUnsendWindow(createdAt) {
  if (!createdAt) return false
  return Date.now() - new Date(createdAt).getTime() < UNSEND_WINDOW_MS
}

export default function GroupChat() {
  const nav = useNavigate()
  const { id: groupId } = useParams()
  const { session } = useAuth()
  const myId = session?.user?.id
  const scrollRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [profiles, setProfiles] = useState(new Map())
  const [photos, setPhotos] = useState(new Map())
  const [messages, setMessages] = useState([])
  const [text, setText] = useState("")
  const [attachment, setAttachment] = useState(null)
  const [attachmentPreview, setAttachmentPreview] = useState("")
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [pollComposerOpen, setPollComposerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [replyingTo, setReplyingTo] = useState(null)
  const [editingMsg, setEditingMsg] = useState(null)
  const [reactions, setReactions] = useState({})
  const [actionsForMsg, setActionsForMsg] = useState(null)
  const [reactionPickerFor, setReactionPickerFor] = useState(null)
  const [heartBurstId, setHeartBurstId] = useState(null)
  const [pinnedMsg, setPinnedMsg] = useState(null)
  const [forwardingMsg, setForwardingMsg] = useState(null)
  const [typers, setTypers] = useState({})  // userId -> timestamp
  const typingChannelRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const [clearedAt, setClearedAt] = useState(null)
  const longPressTimer = useRef(null)
  const swipeRef = useRef({ id: null, startX: 0, dx: 0, active: false })
  const [swipeState, setSwipeState] = useState({ id: null, dx: 0 })
  const lastTapRef = useRef({ id: null, time: 0 })
  const voice = useVoiceRecorder({ maxSeconds: 300 })
  const [isMuted, setIsMuted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const boot = useCallback(async () => {
    if (!groupId || !myId) return
    setLoading(true); setError("")

    // Verify membership + load group
    const { data: g } = await supabase
      .from("groups")
      .select("id, name, avatar_url, created_by, created_at, invite_code, invite_enabled")
      .eq("id", groupId)
      .maybeSingle()
    if (!g) { setError("Group not found"); setLoading(false); return }
    setGroup(g)

    const { data: clearRow } = await supabase
      .from("group_clears")
      .select("cleared_at")
      .eq("group_id", groupId)
      .eq("user_id", myId)
      .maybeSingle()
    setClearedAt(clearRow?.cleared_at || null)

    const { data: muteRow } = await supabase
      .from('group_mutes')
      .select('group_id')
      .eq('group_id', groupId)
      .eq('user_id', myId)
      .maybeSingle()
    setIsMuted(!!muteRow)

    const { data: mem } = await supabase
      .from("group_members")
      .select("user_id, role, joined_at")
      .eq("group_id", groupId)
    const memberList = mem || []
    setMembers(memberList)

    const userIds = memberList.map((m) => m.user_id)
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, username, is_verified")
        .in("id", userIds)
      setProfiles(new Map((profs || []).map((p) => [p.id, p])))

      const { data: ph } = await supabase
        .from("profile_photos")
        .select("user_id, storage_path, is_primary, display_order")
        .in("user_id", userIds)
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
      const pm = new Map()
      ;(ph || []).forEach((p) => { if (!pm.has(p.user_id)) pm.set(p.user_id, p.storage_path) })
      setPhotos(pm)
    }

    // Load messages
    const { data: msgs } = await supabase
      .from("group_messages")
      .select("id, sender_id, content, media_url, media_type, media_name, reply_to_id, deleted_at, edited_at, created_at, is_system")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(300)
    setMessages(msgs || [])
    setLoading(false)
  }, [groupId, myId])

  useEffect(() => { boot() }, [boot])

  // Mark this group as read for me
  useEffect(() => {
    if (!groupId || !myId) return
    supabase.from("group_reads").upsert(
      { group_id: groupId, user_id: myId, last_read_at: new Date().toISOString() },
      { onConflict: "group_id,user_id" }
    ).then(() => {})
  }, [groupId, myId, messages.length])

  // Realtime
  useEffect(() => {
    if (!groupId) return
    const ch = supabase
      .channel("group-" + groupId)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: "group_id=eq." + groupId },
        (payload) => {
          const m = payload.new
          setMessages((cur) => cur.some((x) => x.id === m.id) ? cur : [...cur, m])
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "group_messages", filter: "group_id=eq." + groupId },
        (payload) => {
          const m = payload.new
          setMessages((cur) => cur.map((x) => x.id === m.id ? { ...x, ...m } : x))
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [groupId])

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  // Load reactions for visible messages
  useEffect(() => {
    if (!messages.length) return
    const ids = messages.filter((m) => !m.is_system).map((m) => m.id)
    if (!ids.length) return
    ;(async () => {
      const { data } = await supabase
        .from("group_message_reactions")
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
    if (!groupId) return
    let cancelled = false
    const fetchPinned = async () => {
      const { data: pin } = await supabase
        .from("group_pinned_messages")
        .select("message_id, pinned_by")
        .eq("group_id", groupId)
        .maybeSingle()
      if (cancelled) return
      if (!pin) { setPinnedMsg(null); return }
      const { data: msg } = await supabase
        .from("group_messages")
        .select("id, sender_id, content, media_url, media_type, deleted_at, edited_at")
        .eq("id", pin.message_id)
        .maybeSingle()
      if (cancelled) return
      setPinnedMsg(msg ? { ...msg, pinned_by: pin.pinned_by } : null)
    }
    fetchPinned()
    const ch = supabase
      .channel("gpinned-" + groupId)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_pinned_messages", filter: "group_id=eq." + groupId }, fetchPinned)
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [groupId])

  // Typing broadcast channel
  useEffect(() => {
    if (!groupId || !myId) return
    const ch = supabase.channel("gtyping-" + groupId)
    ch.on("broadcast", { event: "typing" }, (payload) => {
      const data = payload?.payload
      if (!data || data.user_id === myId) return
      setTypers((prev) => {
        const next = { ...prev }
        if (data.typing) next[data.user_id] = Date.now()
        else delete next[data.user_id]
        return next
      })
    }).subscribe()
    typingChannelRef.current = ch
    return () => { supabase.removeChannel(ch); typingChannelRef.current = null }
  }, [groupId, myId])

  // Auto-expire typers after 3s of silence
  useEffect(() => {
    const int = setInterval(() => {
      setTypers((prev) => {
        const now = Date.now()
        const next = {}
        let changed = false
        for (const [uid, ts] of Object.entries(prev)) {
          if (now - ts < 3000) next[uid] = ts
          else changed = true
        }
        return changed ? next : prev
      })
    }, 1500)
    return () => clearInterval(int)
  }, [])

  function notifyTyping(value) {
    const ch = typingChannelRef.current
    if (!ch) return
    ch.send({ type: "broadcast", event: "typing", payload: { user_id: myId, typing: value.trim().length > 0 } })
    clearTimeout(typingTimeoutRef.current)
    if (value.trim().length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        ch.send({ type: "broadcast", event: "typing", payload: { user_id: myId, typing: false } })
      }, 1500)
    }
  }

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

    setBusy(true)
    const path = "group-media/" + groupId + "/" + crypto.randomUUID() + ".webm"
    const { error: upErr } = await supabase.storage
      .from("chat-media")
      .upload(path, result.blob, { upsert: false, contentType: "audio/webm" })
    if (upErr) { setBusy(false); setError(upErr.message); return }
    const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path)

    const { data: inserted, error: sendErr } = await supabase
      .from("group_messages")
      .insert({
        group_id: groupId,
        sender_id: myId,
        content: "",
        media_url: pub?.publicUrl || null,
        media_type: "audio/webm",
        media_name: "Voice · " + result.seconds + "s",
      })
      .select("id, sender_id, content, media_url, media_type, media_name, reply_to_id, deleted_at, edited_at, created_at, is_system")
      .single()

    setBusy(false)
    if (sendErr) { setError(sendErr.message); return }
    if (inserted) setMessages((cur) => cur.some((x) => x.id === inserted.id) ? cur : [...cur, inserted])
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

  async function saveEdit() {
    if (!editingMsg || !myId) return
    const body = text.trim()
    if (!body) return
    tap("light"); setSending(true)
    const nowIso = new Date().toISOString()
    const { error: err } = await supabase
      .from("group_messages")
      .update({ content: body.slice(0, 2000), edited_at: nowIso })
      .eq("id", editingMsg.id)
      .eq("sender_id", myId)
    setSending(false)
    if (err) { setError(err.message); return }
    setMessages((cur) => cur.map((m) => m.id === editingMsg.id ? { ...m, content: body.slice(0, 2000), edited_at: nowIso } : m))
    setEditingMsg(null); setText("")
  }

  async function sendPoll(poll) {
    if (!myId || !groupId) return
    tap("light")
    const payload = {
      group_id: groupId,
      sender_id: myId,
      content: poll.question || "",
      metadata: { poll },
    }
    const { data: inserted, error: err } = await supabase
      .from("group_messages")
      .insert(payload)
      .select("id, sender_id, content, media_url, media_type, media_name, reply_to_id, deleted_at, edited_at, created_at, is_system, metadata")
      .single()
    if (!err && inserted) {
      setMessages((cur) => cur.some((x) => x.id === inserted.id) ? cur : [...cur, inserted])
    }
  }

  async function send() {
    if (editingMsg) return saveEdit()
    const body = text.trim()
    if ((!body && !attachment) || !myId) return
    setBusy(true); tap("light")

    let mediaUrl = null, mediaType = null, mediaName = null
    if (attachment) {
      const ext = (attachment.name.split(".").pop() || "jpg").toLowerCase()
      const path = `group-media/${groupId}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from("chat-media")
        .upload(path, attachment, { upsert: false, contentType: attachment.type })
      if (upErr) { setBusy(false); setError(upErr.message); return }
      const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path)
      mediaUrl = pub?.publicUrl || null
      mediaType = attachment.type
      mediaName = attachment.name
    }

    const payload = {
      group_id: groupId,
      sender_id: myId,
      content: body || "",
    }
    if (mediaUrl) { payload.media_url = mediaUrl; payload.media_type = mediaType; payload.media_name = mediaName }
    if (replyingTo?.id) payload.reply_to_id = replyingTo.id
    setReplyingTo(null)

    setText(""); clearAttachment()

    const { data: inserted, error: sendErr } = await supabase
      .from("group_messages")
      .insert(payload)
      .select("id, sender_id, content, media_url, media_type, media_name, reply_to_id, deleted_at, edited_at, created_at, is_system")
      .single()

    if (sendErr) { setError(sendErr.message); setText(body) }
    else if (inserted) {
      setMessages((cur) => cur.some((x) => x.id === inserted.id) ? cur : [...cur, inserted])
    }
    setBusy(false)
  }

  async function deleteMessage(id) {
    const target = messages.find((m) => m.id === id)
    if (!target || !isWithinUnsendWindow(target.created_at)) {
      setError("This message is too old to unsend")
      return
    }
    if (!confirm("Unsend this message for everyone? This cannot be undone.")) return
    tap("light")
    await supabase.from("group_messages").update({ deleted_at: new Date().toISOString(), content: "", media_url: null }).eq("id", id).eq("sender_id", myId)
  }

  async function toggleMute() {
    if (!groupId || !myId) return
    tap("light")
    if (isMuted) {
      await supabase.from("group_mutes").delete().eq("group_id", groupId).eq("user_id", myId)
      setIsMuted(false)
    } else {
      await supabase.from("group_mutes").insert({ group_id: groupId, user_id: myId })
      setIsMuted(true)
    }
  }

  async function toggleReaction(messageId, emoji) {
    if (!myId) return
    tap("light")
    const current = (reactions[messageId] || []).find((r) => r.user_id === myId)
    if (current?.reaction === emoji) {
      await supabase.from("group_message_reactions").delete().eq("message_id", messageId).eq("user_id", myId)
    } else if (current) {
      await supabase.from("group_message_reactions").update({ reaction: emoji }).eq("message_id", messageId).eq("user_id", myId)
    } else {
      await supabase.from("group_message_reactions").insert({ message_id: messageId, user_id: myId, reaction: emoji })
    }
    setReactionPickerFor(null)
    const { data } = await supabase.from("group_message_reactions").select("message_id, user_id, reaction").eq("message_id", messageId)
    setReactions((prev) => {
      const next = { ...prev }
      next[messageId] = (data || []).map((r) => ({ user_id: r.user_id, reaction: r.reaction }))
      return next
    })
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
    if (!groupId || !myId) return
    tap("light")
    if (pinnedMsg?.id === message.id) {
      await supabase.from("group_pinned_messages").delete().eq("group_id", groupId)
      setPinnedMsg(null)
    } else {
      await supabase.from("group_pinned_messages").upsert({
        group_id: groupId,
        message_id: message.id,
        pinned_by: myId,
      }, { onConflict: "group_id" })
      setPinnedMsg({ ...message, pinned_by: myId })
    }
  }

  async function clearChat() {
    if (!groupId || !myId) return
    if (!confirm("Clear this chat? Messages will be hidden for you only.")) return
    tap("light")
    const now = new Date().toISOString()
    await supabase.from("group_clears").upsert(
      { group_id: groupId, user_id: myId, cleared_at: now },
      { onConflict: "group_id,user_id" }
    )
    setClearedAt(now)
  }

  async function leaveGroup() {
    if (!confirm("Leave this group?")) return
    tap("light")
    const me = profiles.get(myId)
    const myName = me?.display_name || me?.username || "Someone"
    await supabase.from("group_messages").insert({
      group_id: groupId,
      sender_id: myId,
      content: myName + " left the group",
      is_system: true,
    })
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", myId)
    nav("/messages", { replace: true })
  }

  const memberName = (uid) => {
    const p = profiles.get(uid)
    return p?.display_name || p?.username || "Someone"
  }
  const memberAvatar = (uid) => {
    const path = photos.get(uid)
    return path ? publicPhotoUrl(path) : null
  }

  const visibleMessages = clearedAt
    ? messages.filter((m) => new Date(m.created_at) > new Date(clearedAt))
    : messages

  return (
    <div style={{
      position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480,
      display: "flex", flexDirection: "column",
      background: "#0B0B14", overflow: "hidden",
    }}>
      <BrandGlow />

      <header style={{ height: 60, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav("/messages")} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0">
            {group?.avatar_url ? (
              <img src={group.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Users size={18} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-cream text-[14.5px] font-semibold truncate">{group?.name || "Group"}</p>
            <p className="text-subtle text-[11.5px] truncate">
              {(() => {
                const list = Object.keys(typers)
                if (list.length === 0) return members.length + " members"
                const names = list.map((uid) => {
                  const p = profiles.get(uid)
                  return p?.display_name || p?.username || "Someone"
                }).slice(0, 2)
                if (names.length === 1) return names[0] + " is typing…"
                return names.join(", ") + " are typing…"
              })()}
            </p>
          </div>
        </button>
        <button onClick={() => { tap("light"); setSearchOpen(true) }} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Search in chat">
          <Search size={19} strokeWidth={2.3} />
        </button>

        <button onClick={() => setMenuOpen(true)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Menu">
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
          <div className="grid place-items-center h-32 text-muted text-[13px]">Loading…</div>
        ) : visibleMessages.length === 0 ? (
          <div className="grid place-items-center h-full text-center px-6">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-purple-500/12 border border-purple-500/25 grid place-items-center mx-auto mb-3">
                <Users size={22} className="text-purple-300" />
              </div>
              <p className="text-cream font-semibold text-[14.5px] mb-1">
                You created {group?.name}
              </p>
              <p className="text-muted text-[13px]">Say hi to the group 👋</p>
            </div>
          </div>
        ) : (
          visibleMessages.map((m, i) => {
            if (m.is_system) {
              return (
                <div key={m.id} className="flex justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/8 text-subtle text-[11px] font-medium max-w-[80%] text-center">
                    {m.content}
                  </span>
                </div>
              )
            }
            const mine = m.sender_id === myId
            const showDay = i === 0 || new Date(m.created_at).toDateString() !== new Date(visibleMessages[i-1].created_at).toDateString()
            const deleted = !!m.deleted_at
            const senderName = memberName(m.sender_id)
            const senderAvatar = memberAvatar(m.sender_id)
            const showSenderHeader = !mine && (i === 0 || visibleMessages[i-1].sender_id !== m.sender_id || showDay)
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="flex justify-center py-3">
                    <span className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/8 text-subtle text-[10.5px] font-bold tracking-wider uppercase">
                      {new Date(m.created_at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  </div>
                )}
                <div
                  onTouchStart={(e) => onMsgPressStart(m, e)}
                  onTouchEnd={() => onRowSwipeEnd(m)}
                  onTouchMove={onRowTouchMove}
                  onContextMenu={(e) => { e.preventDefault(); setActionsForMsg(m) }}
                  onClick={() => onRowTap(m)}
                  className={`flex gap-2 ${mine ? "justify-end" : "justify-start"} relative`}
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
                    <div className="w-8 shrink-0 flex flex-col justify-end">
                      {showSenderHeader && (
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-elevated border border-white/8">
                          {senderAvatar ? (
                            <img src={senderAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full grid place-items-center text-purple-400 font-black text-[11px]">
                              {senderName[0]}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="max-w-[78%]">
                    {showSenderHeader && !mine && (
                      <p className="text-[11px] text-muted font-semibold mb-0.5 px-1 truncate">{senderName}</p>
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

                    {m.metadata?.poll && !deleted && (
                      <div className={`mb-1 ${mine ? "flex justify-end" : "flex justify-start"}`}>
                        <PollMessage
                          messageSource="group"
                          messageId={m.id}
                          poll={m.metadata.poll}
                          isMine={mine}
                        />
                      </div>
                    )}

                    <div
                      className={`relative group ${
                        deleted
                          ? "px-3.5 py-2.5 text-[13px] italic bg-white/[0.04] border border-white/8 text-subtle rounded-2xl"
                          : mine
                            ? "bg-gradient-to-br from-purple-600 to-purple-500 text-white rounded-2xl rounded-br-md"
                            : "bg-elevated text-cream border border-white/8 rounded-2xl rounded-bl-md"
                      }`}
                    >
                      {deleted ? (
                        "Message deleted"
                      ) : (
                        <>
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
                          {m.content && (
                            <div className={m.media_url ? "mt-1.5 px-3 pb-2 pt-1 text-[14.5px] leading-[1.4] break-words" : "px-3.5 py-2 text-[14.5px] leading-[1.4] break-words"}>
                              <Linkify text={m.content} mine={mine} />
                            </div>
                          )}
                        </>
                      )}
                      {mine && !deleted && (
                        <button
                          onClick={() => deleteMessage(m.id)}
                          className="absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full grid place-items-center bg-obsidian/85 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Delete"
                        >
                          <Trash2 size={11} className="text-danger" />
                        </button>
                      )}
                    </div>

                    {(reactions[m.id] || []).length > 0 && (
                      <div className={`flex gap-0.5 mt-1 ${mine ? "justify-end" : "justify-start"} flex-wrap`}>
                        {Object.entries(
                          (reactions[m.id] || []).reduce((acc, r) => { acc[r.reaction] = (acc[r.reaction] || 0) + 1; return acc }, {})
                        ).map(([emoji, count]) => {
                          const myReact = (reactions[m.id] || []).find((r) => r.user_id === myId)
                          const isMineReaction = myReact?.reaction === emoji
                          return (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(m.id, emoji)}
                              className={`text-[11px] px-1.5 py-0.5 rounded-full border ${isMineReaction ? "bg-purple-500/20 border-purple-400/40" : "bg-white/[0.04] border-white/10"}`}
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
              </div>
            )
          })
        )}
      </div>

      {attachment && (
        <div className="shrink-0 mx-3 mb-2 relative w-fit">
          <img src={attachmentPreview} alt="" className="rounded-xl max-h-32" />
          <button onClick={clearAttachment} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-obsidian border border-white/20 grid place-items-center" aria-label="Remove">
            <X size={13} strokeWidth={2.6} className="text-cream" />
          </button>
        </div>
      )}

      {editingMsg && (
        <div className="shrink-0 mx-3 mb-2 px-3 py-2 rounded-xl bg-elevated border border-amber-500/30 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-amber-300 text-[10.5px] font-bold tracking-wide uppercase mb-0.5">Editing message</p>
            <p className="text-muted text-[12.5px] truncate">{editingMsg.content || "Media"}</p>
          </div>
          <button onClick={() => { setEditingMsg(null); setText("") }} className="w-6 h-6 rounded-full grid place-items-center text-muted shrink-0" aria-label="Cancel edit">
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>
      )}

      {replyingTo && (
        <div className="shrink-0 mx-3 mb-2 px-3 py-2 rounded-xl bg-elevated border border-purple-500/30 flex items-start gap-2">
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
          onEdit={(m) => { setEditingMsg(m); setText(m.content || ""); setReplyingTo(null) }}
          onCopy={async () => { try { await navigator.clipboard.writeText(actionsForMsg.content || ""); setActionsForMsg(null) } catch {} }}
          onForward={(m) => { setActionsForMsg(null); setForwardingMsg(m) }}
          onDelete={deleteMessage}
          onReact={(emoji) => toggleReaction(actionsForMsg.id, emoji)}
          canUnsend={isWithinUnsendWindow(actionsForMsg.created_at)}
          isPinned={pinnedMsg?.id === actionsForMsg.id}
          onPin={togglePin}
        />
      )}

      {voice.recording && (
        <div className="shrink-0 mx-3 mb-2 px-4 py-3 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-cream text-[14px] font-semibold flex-1">
            Recording · {String(Math.floor(voice.seconds / 60)).padStart(2, "0")}:{String(voice.seconds % 60).padStart(2, "0")}
          </span>
        </div>
      )}

      <div
        className="shrink-0 px-3 pt-3 pb-3 flex items-end gap-2 relative"
        style={{ background: "linear-gradient(to top, #0B0B14 70%, rgba(11,11,20,0) 100%)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickAttachment} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={pickAttachment} />
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
          onChange={(e) => { setText(e.target.value); notifyTyping(e.target.value) }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
          disabled={voice.recording}
          rows={1}
          placeholder={voice.recording ? "Recording voice…" : "Message group…"}
          className="flex-1 bg-elevated border border-white/8 rounded-[22px] px-4 py-2.5 text-cream text-[14.5px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none max-h-32 leading-[1.4]"
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
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={send}
            disabled={busy}
            className="w-11 h-11 rounded-full grid place-items-center bg-gradient-to-br from-purple-500 to-pink-500 text-white disabled:opacity-40 shrink-0"
            aria-label="Send"
          >
            <Send size={18} strokeWidth={2.4} />
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={startVoice}
            className="w-11 h-11 rounded-full grid place-items-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shrink-0"
            aria-label="Record voice"
          >
            <Mic size={19} strokeWidth={2.4} />
          </motion.button>
        )}
      </div>

      {emojiOpen && (
        <EmojiPicker
          className="shrink-0 mx-3 mb-1"
          onPick={(e) => { setText((t) => (t + e).slice(0, 2000)); tap("light") }}
        />
      )}

      <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

      {/* Attach menu */}
      {attachMenuOpen && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setAttachMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <button onClick={() => { setAttachMenuOpen(false); setTimeout(() => cameraInputRef.current?.click(), 100) }}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]">
              <Camera size={18} className="text-purple-300" />
              <span className="font-semibold text-[14px]">Take photo</span>
            </button>
            <button onClick={() => { setAttachMenuOpen(false); setTimeout(() => fileInputRef.current?.click(), 100) }}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]">
              <Paperclip size={18} className="text-purple-300" />
              <span className="font-semibold text-[14px]">Choose from gallery</span>
            </button>
            <button onClick={() => { setAttachMenuOpen(false); setTimeout(() => setPollComposerOpen(true), 120) }}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]">
              <span className="text-purple-300 text-[18px]">📊</span>
              <span className="font-semibold text-[14px]">Create a poll</span>
            </button>
            <button onClick={() => setAttachMenuOpen(false)} className="w-full h-11 mt-1 text-muted font-semibold text-[13.5px]">Cancel</button>
          </div>
        </div>
      )}

      {pollComposerOpen && (
        <PollComposer
          onClose={() => setPollComposerOpen(false)}
          onSend={sendPoll}
        />
      )}

      {/* Group menu */}
      {searchOpen && (
        <ChatSearchSheet
          source="group"
          targetId={groupId}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} className="fixed inset-0 z-[500] bg-black/60">
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-16 right-3 w-56 bg-surface rounded-xl border border-white/10 overflow-hidden"
          >
            <MenuItem icon={<Users size={16} />} label={`${members.length} members`} onClick={() => { setMenuOpen(false); nav(`/groups/${groupId}/members`) }} />
            <MenuItem icon={<Pencil size={16} />} label="Edit group" onClick={() => { setMenuOpen(false); nav(`/groups/${groupId}/edit`) }} />
            <MenuItem icon={<Link2 size={16} />} label="Invite via link" onClick={() => { setMenuOpen(false); setInviteOpen(true) }} />
                        <MenuItem icon={<UserPlus size={16} />} label="Add members" onClick={() => { setMenuOpen(false); nav(`/groups/${groupId}/add`) }} />
            <MenuItem icon={<Bell size={16} />} label={isMuted ? "Unmute notifications" : "Mute notifications"} onClick={() => { setMenuOpen(false); toggleMute() }} />
            <MenuItem icon={<Eraser size={16} />} label="Clear chat" onClick={() => { setMenuOpen(false); clearChat() }} />
            <MenuItem icon={<Flag size={16} />} label="Report group" danger onClick={() => { setMenuOpen(false); setReportOpen(true) }} />
            <MenuItem icon={<LogOut size={16} />} label="Leave group" danger onClick={() => { setMenuOpen(false); leaveGroup() }} />
          </div>
        </div>
      )}

      {inviteOpen && group && (
        <InviteLinkSheet group={group} onClose={() => setInviteOpen(false)} />
      )}

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        target={group ? { ...group, isGroup: true } : null}
      />

      {forwardingMsg && (
        <ForwardPicker
          message={forwardingMsg}
          onClose={() => setForwardingMsg(null)}
          onForwarded={() => {}}
        />
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-[14px] font-medium ${danger ? "text-danger" : "text-cream"} hover:bg-white/[0.04]`}
    >
      {icon}
      {label}
    </button>
  )
}
