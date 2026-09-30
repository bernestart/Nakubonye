import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, ChevronRight, User as UserIcon, Image as ImageIcon, Pin,
  Bell, BellOff, Eraser, Eye, MessageSquare, Ban, Flag, Trash2, CheckCheck,
} from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import ReportModal from "../components/ReportModal"
import BlockConfirm from "../components/BlockConfirm"

export default function ChatInfo() {
  const nav = useNavigate()
  const { userId: otherId } = useParams()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [other, setOther] = useState(null)
  const [conversationId, setConversationId] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [readReceipts, setReadReceipts] = useState(true)
  const [mediaCount, setMediaCount] = useState(0)
  const [pinnedCount, setPinnedCount] = useState(0)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [media, setMedia] = useState([])
  const [reportOpen, setReportOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!otherId || !myId) return
    setLoading(true)

    // Load profile
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

    // Find conversation
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .or("and(initiator_id.eq." + myId + ",recipient_id.eq." + otherId + "),and(initiator_id.eq." + otherId + ",recipient_id.eq." + myId + ")")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (conv) {
      setConversationId(conv.id)

      const [muteRes, mediaRes, pinRes] = await Promise.all([
        supabase.from("conversation_mutes").select("conversation_id").eq("conversation_id", conv.id).eq("user_id", myId).maybeSingle(),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id).not("media_url", "is", null),
        supabase.from("pinned_messages").select("message_id").eq("conversation_id", conv.id).maybeSingle(),
      ])
      setIsMuted(!!muteRes.data)
      setMediaCount(mediaRes.count || 0)
      setPinnedCount(pinRes.data ? 1 : 0)
    }

    // Read receipts setting
    const { data: settings } = await supabase
      .from("user_settings")
      .select("show_read_receipts")
      .eq("user_id", myId)
      .maybeSingle()
    setReadReceipts(settings?.show_read_receipts !== false)

    setLoading(false)
  }, [otherId, myId])

  useEffect(() => { load() }, [load])

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

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-10">
        {/* Profile card */}
        <div className="flex flex-col items-center py-4 mb-4">
          <button
            onClick={() => { tap("light"); nav("/profile/" + otherId) }}
            className="active:opacity-80"
          >
            <div className="w-24 h-24 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white text-2xl font-black">
              {other?.photo_url ? (
                <img src={other.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                (other?.display_name || other?.username || "?")[0].toUpperCase()
              )}
            </div>
          </button>
          <p className="text-cream font-bold text-[18px] mt-3">
            {other?.display_name || other?.username || "User"}
          </p>
          {other?.username && (
            <p className="text-muted text-[12.5px] mt-0.5">@{other.username}</p>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <QuickAction
            icon={<UserIcon size={18} />}
            label="View profile"
            onClick={() => { tap("light"); nav("/profile/" + otherId) }}
          />
          <QuickAction
            icon={<ImageIcon size={18} />}
            label="Media & files"
            onClick={openMedia}
          />
        </div>

        {/* Chat info */}
        <SectionLabel>Chat info</SectionLabel>
        <Row
          icon={<ImageIcon size={18} />}
          label="Media, files & links"
          value={mediaCount > 0 ? String(mediaCount) : null}
          onClick={openMedia}
        />
        <Row
          icon={<Pin size={18} />}
          label="Pinned messages"
          value={pinnedCount > 0 ? String(pinnedCount) : null}
          onClick={() => { tap("light"); nav("/messages/" + otherId) }}
        />

        {/* Actions */}
        <SectionLabel>Actions</SectionLabel>
        <Row
          icon={isMuted ? <BellOff size={18} /> : <Bell size={18} />}
          label={isMuted ? "Unmute notifications" : "Mute notifications"}
          onClick={toggleMute}
        />
        <Row
          icon={<Bell size={18} />}
          label="Notification settings"
          onClick={() => { tap("light"); nav("/notifications") }}
        />
        <Row
          icon={<Eraser size={18} />}
          label="Clear chat"
          onClick={clearChat}
        />

        {/* Privacy & support */}
        <SectionLabel>Privacy & support</SectionLabel>
        <Row
          icon={<CheckCheck size={18} />}
          label="Read receipts"
          value={readReceipts ? "On" : "Off"}
          onClick={toggleReadReceipts}
        />
        <Row
          icon={<Ban size={18} />}
          label="Block"
          onClick={() => { tap("light"); setBlockOpen(true) }}
        />
        <Row
          icon={<Flag size={18} />}
          label="Report"
          onClick={() => { tap("light"); setReportOpen(true) }}
        />
        <Row
          icon={<Trash2 size={18} />}
          label="Delete chat"
          danger
          onClick={deleteChat}
        />
      </div>

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

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        target={other}
      />
      <BlockConfirm
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        target={other}
        onBlocked={() => nav("/messages", { replace: true })}
      />
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2 mt-5">
      {children}
    </p>
  )
}

function Row({ icon, label, value, danger, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-white/8 text-left mb-1.5 ${danger ? "text-danger" : "text-cream"}`}
    >
      <span className="w-9 h-9 rounded-xl bg-white/[0.05] grid place-items-center shrink-0">{icon}</span>
      <span className="flex-1 font-semibold text-[14px] min-w-0 truncate">{label}</span>
      {value && <span className="text-[13px] text-muted shrink-0">{value}</span>}
      <ChevronRight size={16} className="text-subtle shrink-0" />
    </button>
  )
}

function QuickAction({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl bg-surface border border-white/8 p-3.5 flex flex-col items-start gap-2 active:opacity-80"
    >
      <span className="w-9 h-9 rounded-xl bg-purple-500/15 grid place-items-center text-purple-300">
        {icon}
      </span>
      <span className="text-cream font-semibold text-[13px]">{label}</span>
    </button>
  )
}
