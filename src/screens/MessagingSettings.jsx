import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft, PenSquare, Users, CircleDot, Bell, Inbox, Archive,
  Mail, Shield, CheckCheck, ChevronRight,
} from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import NewMessageSheet from "../components/NewMessageSheet"

export default function MessagingSettings() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [loading, setLoading] = useState(true)
  const [pendingRequests, setPendingRequests] = useState(0)
  const [archiveCount, setArchiveCount] = useState(0)
  const [activeStatus, setActiveStatus] = useState(true)
  const [newMsgOpen, setNewMsgOpen] = useState(false)

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true)
    const [reqRes, convArch, grpArch, settingsRes] = await Promise.all([
      supabase.from("message_requests").select("id", { count: "exact", head: true }).eq("recipient_id", myId).eq("status", "pending"),
      supabase.from("conversation_archives").select("conversation_id", { count: "exact" }).eq("user_id", myId),
      supabase.from("group_archives").select("group_id", { count: "exact" }).eq("user_id", myId),
      supabase.from("user_settings").select("show_activity_status").eq("user_id", myId).maybeSingle(),
    ])
    setPendingRequests(reqRes.count || 0)
    setArchiveCount((convArch.data?.length || 0) + (grpArch.data?.length || 0))
    setActiveStatus(settingsRes.data?.show_activity_status !== false)
    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  async function markAllRead() {
    if (!myId) return
    tap("light")
    const now = new Date().toISOString()
    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .or("initiator_id.eq." + myId + ",recipient_id.eq." + myId)
    if (convs?.length) {
      await supabase.from("conversation_reads").upsert(
        convs.map((c) => ({ conversation_id: c.id, user_id: myId, last_read_at: now })),
        { onConflict: "conversation_id,user_id" }
      )
    }
    const { data: groups } = await supabase.from("group_members").select("group_id").eq("user_id", myId)
    if (groups?.length) {
      await supabase.from("group_reads").upsert(
        groups.map((g) => ({ group_id: g.group_id, user_id: myId, last_read_at: now })),
        { onConflict: "group_id,user_id" }
      )
    }
    tap("success")
  }

  async function toggleActiveStatus() {
    if (!myId) return
    tap("light")
    const next = !activeStatus
    setActiveStatus(next)
    await supabase.from("user_settings").update({ show_activity_status: next }).eq("user_id", myId)
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
        <span className="text-cream font-bold text-[15px]">Messaging settings</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-10">
        {/* START A CHAT */}
        <SectionLabel>Start a chat</SectionLabel>
        <Row icon={<PenSquare size={18} />} label="New message" onClick={() => { tap("light"); setNewMsgOpen(true) }} />
        <Row icon={<Users size={18} />} label="New group" onClick={() => { tap("light"); nav("/groups/new") }} />

        {/* SETTINGS */}
        <SectionLabel>Settings</SectionLabel>
        <Row
          icon={<CircleDot size={18} />}
          label="Active status"
          value={activeStatus ? "On" : "Off"}
          onClick={toggleActiveStatus}
        />
        <Row
          icon={<Bell size={18} />}
          label="Messaging notifications"
          onClick={() => { tap("light"); nav("/notifications") }}
        />
        <Row
          icon={<Inbox size={18} />}
          label="Message requests"
          value={pendingRequests > 0 ? String(pendingRequests) : null}
          badge={pendingRequests > 0}
          onClick={() => { tap("light"); nav("/messages/requests") }}
        />
        <Row
          icon={<Archive size={18} />}
          label="Archive"
          value={archiveCount > 0 ? String(archiveCount) : null}
          onClick={() => { tap("light"); nav("/messages/archived") }}
        />
        <Row
          icon={<Inbox size={18} />}
          label="Unread chats"
          onClick={() => { tap("light"); nav("/messages?tab=unread") }}
        />
        <Row
          icon={<Users size={18} />}
          label="Group chats"
          onClick={() => { tap("light"); nav("/messages?tab=groups") }}
        />
        <Row
          icon={<Shield size={18} />}
          label="Privacy & safety"
          onClick={() => { tap("light"); nav("/settings/privacy") }}
        />

        {/* QUICK ACTIONS */}
        <SectionLabel>Quick actions</SectionLabel>
        <Row
          icon={<CheckCheck size={18} />}
          label="Mark all as read"
          onClick={markAllRead}
        />

        {loading && <p className="text-subtle text-[11.5px] text-center mt-4">Loading…</p>}
      </div>

      {newMsgOpen && <NewMessageSheet onClose={() => setNewMsgOpen(false)} />}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2 mt-4">
      {children}
    </p>
  )
}

function Row({ icon, label, value, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-white/[0.03]"
    >
      <span className="shrink-0 text-cream">{icon}</span>
      <span className="flex-1 font-semibold text-[14px] min-w-0 truncate">{label}</span>
      {value && (
        <span className={`text-[13px] shrink-0 ${badge ? "font-black text-white px-2 py-0.5 rounded-full" : "text-muted"}`}
              style={badge ? { background: "#EC4899" } : undefined}>
          {value}
        </span>
      )}
      <ChevronRight size={16} className="text-subtle shrink-0" />
    </button>
  )
}
