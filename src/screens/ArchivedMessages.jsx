import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Archive, Users } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"

function relTime(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return "now"
  if (diff < 3600) return Math.floor(diff / 60) + "m"
  if (diff < 86400) return Math.floor(diff / 3600) + "h"
  if (diff < 604800) return Math.floor(diff / 86400) + "d"
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

export default function ArchivedMessages() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true)
    const [convArch, grpArch] = await Promise.all([
      supabase.from("conversation_archives").select("conversation_id").eq("user_id", myId),
      supabase.from("group_archives").select("group_id").eq("user_id", myId),
    ])

    const convIds = (convArch.data || []).map((r) => r.conversation_id)
    const grpIds = (grpArch.data || []).map((r) => r.group_id)

    const out = []

    // DM rows
    if (convIds.length > 0) {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, initiator_id, recipient_id, last_message_at, last_message_preview")
        .in("id", convIds)
      const otherIds = (convs || []).map((c) => c.initiator_id === myId ? c.recipient_id : c.initiator_id)
      const { data: profs } = await supabase.from("profiles").select("id, display_name, username").in("id", otherIds)
      const pMap = new Map((profs || []).map((p) => [p.id, p]))
      const { data: ph } = await supabase
        .from("profile_photos")
        .select("user_id, storage_path, is_primary, display_order")
        .in("user_id", otherIds)
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
      const phMap = new Map()
      ;(ph || []).forEach((p) => { if (!phMap.has(p.user_id)) phMap.set(p.user_id, p.storage_path) })
      ;(convs || []).forEach((c) => {
        const otherId = c.initiator_id === myId ? c.recipient_id : c.initiator_id
        const p = pMap.get(otherId)
        out.push({
          kind: "dm",
          key: "c:" + c.id,
          conversationId: c.id,
          userId: otherId,
          display_name: p?.display_name || p?.username || "User",
          username: p?.username,
          photo_url: phMap.get(otherId) ? publicPhotoUrl(phMap.get(otherId)) : null,
          preview: c.last_message_preview,
          lastMessageAt: c.last_message_at,
        })
      })
    }

    // Group rows
    if (grpIds.length > 0) {
      const { data: gs } = await supabase.from("groups").select("id, name, avatar_url").in("id", grpIds)
      const { data: lastMsgs } = await supabase
        .from("group_messages")
        .select("group_id, content, created_at, deleted_at")
        .in("group_id", grpIds)
        .order("created_at", { ascending: false })
      const lastByGroup = new Map()
      ;(lastMsgs || []).forEach((m) => { if (!lastByGroup.has(m.group_id)) lastByGroup.set(m.group_id, m) })
      ;(gs || []).forEach((g) => {
        const last = lastByGroup.get(g.id)
        out.push({
          kind: "group",
          key: "g:" + g.id,
          groupId: g.id,
          display_name: g.name,
          photo_url: g.avatar_url,
          preview: last?.deleted_at ? null : last?.content,
          lastMessageAt: last?.created_at,
        })
      })
    }

    out.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0))
    setItems(out)
    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  async function unarchive(item) {
    tap("light")
    if (item.kind === "group") {
      await supabase.from("group_archives").delete().eq("group_id", item.groupId).eq("user_id", myId)
    } else {
      await supabase.from("conversation_archives").delete().eq("conversation_id", item.conversationId).eq("user_id", myId)
    }
    load()
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
        <span className="text-cream font-bold text-[15px] flex-1">Archived</span>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex flex-col gap-2">
            {[0,1,2].map((i) => <div key={i} className="rounded-2xl bg-white/[0.03] animate-pulse" style={{ height: 64 }} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="pt-16 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
              <Archive size={26} className="text-muted" />
            </div>
            <p className="text-cream font-bold text-[15px] mb-1">Nothing archived</p>
            <p className="text-muted text-[13px]">Long-press a chat and archive it to hide it here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <div key={item.key} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/[0.03]">
                <button
                  onClick={() => { tap("light"); if (item.kind === "group") nav("/groups/" + item.groupId); else nav("/messages/" + item.userId) }}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0">
                    {item.photo_url ? (
                      <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : item.kind === "group" ? (
                      <div className="w-full h-full grid place-items-center text-purple-400"><Users size={20} /></div>
                    ) : (
                      <div className="w-full h-full grid place-items-center text-purple-400 font-black text-base">
                        {(item.display_name || "?")[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-semibold text-[14px] truncate">{item.display_name}</p>
                    <p className="text-muted text-[12.5px] truncate">{item.preview || "No messages"}</p>
                  </div>
                  <span className="text-[10.5px] text-subtle shrink-0">{relTime(item.lastMessageAt)}</span>
                </button>
                <button
                  onClick={() => unarchive(item)}
                  className="shrink-0 h-8 px-3 rounded-full text-[12px] font-bold bg-purple-500/15 border border-purple-500/40 text-purple-200"
                >
                  Unarchive
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
