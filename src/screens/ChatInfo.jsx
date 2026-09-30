import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, ChevronRight, User as UserIcon, Image as ImageIcon, Pin,
  Bell, BellOff, Eraser, CheckCheck, Ban, Flag, Trash2,
  Phone, Video, Mail, Share2, Users, Smile, Type,
} from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import { useVoiceCall } from "../lib/voiceCall"
import BrandGlow from "../components/BrandGlow"
import ReportModal from "../components/ReportModal"
import BlockConfirm from "../components/BlockConfirm"
import EmojiPicker from "../components/chat/EmojiPicker"

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"]

export default function ChatInfo() {
  const nav = useNavigate()
  const { userId: otherId } = useParams()
  const { session } = useAuth()
  const myId = session?.user?.id
  const voiceCall = useVoiceCall()

  const [loading, setLoading] = useState(true)
  const [other, setOther] = useState(null)
  const [conversationId, setConversationId] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [readReceipts, setReadReceipts] = useState(true)
  const [mediaCount, setMediaCount] = useState(0)
  const [pinnedCount, setPinnedCount] = useState(0)
  const [relationship, setRelationship] = useState("")
  const [nickname, setNickname] = useState("")
  const [quickReaction, setQuickReaction] = useState("")
  const [mediaOpen, setMediaOpen] = useState(false)
  const [media, setMedia] = useState([])
  const [reportOpen, setReportOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [nickOpen, setNickOpen] = useState(false)
  const [nickDraft, setNickDraft] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!otherId || !myId) return
    setLoading(true)

    // 1. Profile
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, display_name, username, is_verified, last_seen_at")
      .eq("id", otherId)
      .maybeSingle()
    if (prof) {
      const { data: ph } = await supabase
        .from("profile_photos")
        .select("storage_path")
        .eq("user_id", otherId)
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
        .limit(1)
        .maybeSingle()
      setOther({ ...prof, photo_url: ph?.storage_path ? publicPhotoUrl(ph.storage_path) : null })
    }

    // 2. Relationship
    const lo = myId < otherId ? myId : otherId
    const hi = myId < otherId ? otherId : myId
    const [matchRes, mineFollowRes, themFollowRes] = await Promise.all([
      supabase.from("matches").select("id").eq("user_one_id", lo).eq("user_two_id", hi).maybeSingle(),
      supabase.from("follows").select("following_id").eq("follower_id", myId).eq("following_id", otherId).maybeSingle(),
      supabase.from("follows").select("follower_id").eq("follower_id", otherId).eq("following_id", myId).maybeSingle(),
    ])
    const isMatched = !!matchRes.data
    const iFollow = !!mineFollowRes.data
    const theyFollow = !!themFollowRes.data
    if (isMatched) setRelationship("You're matched")
    else if (iFollow && theyFollow) setRelationship("You follow each other")
    else if (iFollow) setRelationship("You follow them")
    else if (theyFollow) setRelationship("They follow you")
    else setRelationship("New on Nakubonye")

    // 3. Conversation
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .or("and(initiator_id.eq." + myId + ",recipient_id.eq." + otherId + "),and(initiator_id.eq." + otherId + ",recipient_id.eq." + myId + ")")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (conv) {
      setConversationId(conv.id)
      const [muteRes, mediaRes, pinRes, nickRes, qrRes] = await Promise.all([
        supabase.from("conversation_mutes").select("conversation_id").eq("conversation_id", conv.id).eq("user_id", myId).maybeSingle(),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id).not("media_url", "is", null),
        supabase.from("pinned_messages").select("message_id").eq("conversation_id", conv.id).maybeSingle(),
        supabase.from("conversation_nicknames").select("nickname").eq("conversation_id", conv.id).eq("user_id", myId).maybeSingle(),
        supabase.from("conversation_quick_reactions").select("reaction").eq("conversation_id", conv.id).eq("user_id", myId).maybeSingle(),
      ])
      setIsMuted(!!muteRes.data)
      setMediaCount(mediaRes.count || 0)
      setPinnedCount(pinRes.data ? 1 : 0)
      setNickname(nickRes.data?.nickname || "")
      setQuickReaction(qrRes.data?.reaction || "")
    }

    // 4. User settings
    const { data: settings } = await supabase
      .from("user_settings")
      .select("show_read_receipts")
      .eq("user_id", myId)
      .maybeSingle()
    setReadReceipts(settings?.show_read_receipts !== false)
    setLoading(false)
  }, [otherId, myId])

  useEffect(() => { load() }, [load])

  async function markUnread() {
    if (!conversationId || !myId) return
    tap("light")
    const before = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    await supabase.from("conversation_reads").upsert(
      { conversation_id: conversationId, user_id: myId, last_read_at: before },
      { onConflict: "conversation_id,user_id" }
    )
    nav("/messages", { replace: true })
  }

  async function shareContact() {
    tap("light")
    const url = window.location.origin + "/profile/" + otherId
    const text = (other?.display_name || other?.username || "Check out") + " on Nakubonye"
    try {
      if (navigator.share) await navigator.share({ title: other?.display_name, text, url })
      else { await navigator.clipboard.writeText(url); alert("Link copied!") }
    } catch {}
  }

  function createGroupWith() {
    tap("light")
    nav("/groups/new?with=" + otherId)
  }

  async function toggleMute() {
    if (!conversationId || !myId || busy) return
    setBusy(true); tap("light")
    if (isMuted) {
      await supabase.from("conversation_mutes").delete().eq("conversation_id", conversationId).eq("user_id", myId)
      setIsMuted(false)
    } else {
      await supabase.from("conversation_mutes").insert({ conversation_id: conversationId, user_id: myId })
      setIsMuted(true)
    }
    setBusy(false)
  }

  async function toggleReadReceipts() {
    if (!myId || busy) return
    setBusy(true); tap("light")
    const next = !readReceipts
    setReadReceipts(next)
    await supabase.from("user_settings").update({ show_read_receipts: next }).eq("user_id", myId)
    setBusy(false)
  }

  async function saveQuickReaction(emoji) {
    if (!conversationId || !myId) return
    tap("light")
    await supabase.from("conversation_quick_reactions").upsert(
      { conversation_id: conversationId, user_id: myId, reaction: emoji, updated_at: new Date().toISOString() },
      { onConflict: "conversation_id,user_id" }
    )
    setQuickReaction(emoji)
    setEmojiOpen(false)
  }

  async function saveNickname() {
    if (!conversationId || !myId) return
    const n = nickDraft.trim()
    tap("light")
    if (!n) {
      await supabase.from("conversation_nicknames").delete().eq("conversation_id", conversationId).eq("user_id", myId)
      setNickname("")
    } else {
      await supabase.from("conversation_nicknames").upsert(
        { conversation_id: conversationId, user_id: myId, nickname: n, updated_at: new Date().toISOString() },
        { onConflict: "conversation_id,user_id" }
      )
      setNickname(n)
    }
    setNickOpen(false)
  }

  async function openMedia() {
    if (!conversationId) return
    tap("light")
    const { data } = await supabase
      .from("messages")
      .select("id, media_url, media_type, created_at")
      .eq("conversation_id", conversationId)
      .not("media_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(60)
    setMedia(data || [])
    setMediaOpen(true)
  }

  async function clearChat() {
    if (!conversationId || !myId) return
    if (!confirm("Clear this chat? Messages will be hidden for you only.")) return
    tap("light")
    const now = new Date().toISOString()
    await supabase.from("conversation_clears").upsert(
      { conversation_id: conversationId, user_id: myId, cleared_at: now },
      { onConflict: "conversation_id,user_id" }
    )
    nav(-1)
  }

  async function deleteChat() {
    if (!conversationId || !myId) return
    if (!confirm("Delete this conversation? It'll be removed from your inbox.")) return
    tap("medium")
    await supabase.from("conversation_deletes").insert({ conversation_id: conversationId, user_id: myId })
    nav("/messages", { replace: true })
  }

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, background: "#0B0B14", display: "flex" }}>
        <div className="flex-1 grid place-items-center">
          <span className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  const displayName = nickname || other?.display_name || other?.username || "User"

  return (
    <div style={{
      position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480,
      display: "flex", flexDirection: "column",
      background: "#0B0B14", overflow: "hidden",
    }}>
      <BrandGlow />
      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Chat info</span>
      </header>

      <div className="flex-1 overflow-y-auto pb-10">
        {/* Profile block */}
        <div className="flex flex-col items-center pt-4 pb-3">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white text-2xl font-black">
            {other?.photo_url ? (
              <img src={other.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              (other?.display_name || other?.username || "?")[0].toUpperCase()
            )}
          </div>
          <p className="text-cream font-bold text-[20px] mt-3 leading-tight">{displayName}</p>
          {nickname && other?.display_name && (
            <p className="text-muted text-[12px] mt-0.5">@{other.username}</p>
          )}
          <p className="text-muted text-[13px] mt-1">{relationship}</p>
        </div>

        {/* View profile button */}
        <div className="px-5 pb-5">
          <button
            onClick={() => { tap("light"); nav("/profile/" + otherId) }}
            className="w-full h-11 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[14px] active:opacity-80"
          >
            View profile
          </button>
        </div>

        {/* Quick circles */}
        <div className="grid grid-cols-4 gap-2 px-4 pb-5">
          <CircleAction icon={<Phone size={20} />} label="Call"
            onClick={() => { tap("light"); voiceCall.startCall(other.id, { display_name: other.display_name, photo_url: other.photo_url }) }} />
          <CircleAction icon={<Video size={20} />} label="Video"
            onClick={() => { tap("light"); voiceCall.startCall(other.id, { display_name: other.display_name, photo_url: other.photo_url }, { mode: "video" }) }} />
          <CircleAction icon={<UserIcon size={20} />} label="Profile"
            onClick={() => { tap("light"); nav("/profile/" + otherId) }} />
          <CircleAction
            icon={isMuted ? <BellOff size={20} /> : <Bell size={20} />}
            label={isMuted ? "Unmute" : "Mute"}
            onClick={toggleMute}
          />
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* Actions */}
        <SectionLabel>Actions</SectionLabel>
        <PlainRow icon={<Mail size={20} />} label="Mark as unread" onClick={markUnread} />
        <PlainRow icon={<Share2 size={20} />} label="Share contact" onClick={shareContact} />
        <PlainRow icon={<Users size={20} />} label={"Create group with " + displayName} onClick={createGroupWith} />
        <PlainRow
          icon={<ImageIcon size={20} />}
          label="Media, files & links"
          value={mediaCount > 0 ? String(mediaCount) : null}
          onClick={openMedia}
        />
        <PlainRow
          icon={<Pin size={20} />}
          label="Pinned messages"
          value={pinnedCount > 0 ? String(pinnedCount) : null}
          onClick={() => { tap("light"); nav("/messages/" + otherId) }}
        />
        <PlainRow icon={<Eraser size={20} />} label="Clear chat" onClick={clearChat} />

        {/* Customisation */}
        <SectionLabel>Customisation</SectionLabel>
        <PlainRow
          icon={<Smile size={20} />}
          label="Quick reaction"
          value={quickReaction || null}
          onClick={() => { tap("light"); setEmojiOpen(true) }}
        />
        <PlainRow
          icon={<Type size={20} />}
          label="Nicknames"
          value={nickname || null}
          onClick={() => { tap("light"); setNickDraft(nickname); setNickOpen(true) }}
        />

        {/* Privacy & support */}
        <SectionLabel>Privacy & support</SectionLabel>
        <PlainRow
          icon={<CheckCheck size={20} />}
          label="Read receipts"
          value={readReceipts ? "On" : "Off"}
          onClick={toggleReadReceipts}
        />
        <PlainRow
          icon={<Ban size={20} />}
          label={"Block " + displayName}
          onClick={() => { tap("light"); setBlockOpen(true) }}
        />
        <PlainRow
          icon={<Flag size={20} />}
          label="Report"
          onClick={() => { tap("light"); setReportOpen(true) }}
        />
        <PlainRow icon={<Trash2 size={20} />} label="Delete chat" danger onClick={deleteChat} />
      </div>

      {/* Quick reaction picker */}
      {emojiOpen && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setEmojiOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-4"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
            <p className="text-cream font-bold text-[15px] mb-3">Quick reaction</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {QUICK_REACTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => saveQuickReaction(e)}
                  className="w-12 h-12 rounded-full grid place-items-center text-[24px] active:scale-90 transition-transform"
                  style={{ background: quickReaction === e ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.04)", border: quickReaction === e ? "1.5px solid #A855F7" : "1px solid rgba(255,255,255,0.08)" }}
                >
                  {e}
                </button>
              ))}
            </div>
            <EmojiPicker onPick={saveQuickReaction} />
          </div>
        </div>
      )}

      {/* Nickname sheet */}
      {nickOpen && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setNickOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
            <p className="text-cream font-bold text-[15px] mb-3">Nickname</p>
            <input
              value={nickDraft}
              onChange={(e) => setNickDraft(e.target.value.slice(0, 40))}
              placeholder={other?.display_name || "Nickname"}
              autoFocus
              className="w-full h-11 rounded-xl bg-white/[0.06] border border-white/10 px-4 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setNickOpen(false)}
                className="flex-1 h-11 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[13.5px]"
              >
                Cancel
              </button>
              <button
                onClick={saveNickname}
                className="flex-1 h-11 rounded-full text-white font-bold text-[13.5px]"
                style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media viewer */}
      {mediaOpen && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setMediaOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 flex flex-col"
            style={{ maxHeight: "85dvh", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="p-4 shrink-0 border-b border-white/8">
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
              <p className="text-cream font-extrabold text-[16px]">Media & files</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {media.length === 0 ? (
                <p className="text-muted text-[13px] text-center py-8">No media yet</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {media.map((m) => (
                    <div key={m.id} className="aspect-square rounded-xl overflow-hidden bg-black/40">
                      {m.media_type?.startsWith("image/") ? (
                        <img src={m.media_url} alt="" className="w-full h-full object-cover" />
                      ) : m.media_type?.startsWith("audio/") ? (
                        <div className="w-full h-full grid place-items-center text-purple-300 text-2xl">🎤</div>
                      ) : (
                        <div className="w-full h-full grid place-items-center text-purple-300 text-2xl">📎</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} target={other} />
      <BlockConfirm open={blockOpen} onClose={() => setBlockOpen(false)} target={other} onBlocked={() => nav("/messages", { replace: true })} />
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-subtle text-[11.5px] font-bold tracking-wider uppercase px-5 pt-5 pb-2">{children}</p>
  )
}

function PlainRow({ icon, label, value, danger, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-3.5 active:bg-white/[0.04] transition-colors text-left ${danger ? "text-red-400" : "text-cream"}`}
    >
      <span className={`w-6 h-6 grid place-items-center shrink-0 ${danger ? "" : "text-muted"}`}>{icon}</span>
      <span className="flex-1 font-semibold text-[15px] truncate">{label}</span>
      {value && <span className="text-[13.5px] text-muted shrink-0">{value}</span>}
      <ChevronRight size={18} className="text-subtle shrink-0" />
    </button>
  )
}

function CircleAction({ icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 active:opacity-80">
      <span className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/8 grid place-items-center text-cream">
        {icon}
      </span>
      <span className="text-cream text-[11.5px] font-semibold">{label}</span>
    </button>
  )
}
