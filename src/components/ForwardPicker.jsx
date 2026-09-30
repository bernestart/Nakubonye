import { useCallback, useEffect, useState } from "react"
import { X, Search, Send, Users, MessageCircle } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

export default function ForwardPicker({ message, onClose, onForwarded }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [query, setQuery] = useState("")
  const [dms, setDms] = useState([])
  const [groups, setGroups] = useState([])
  const [communities, setCommunities] = useState([])
  const [profiles, setProfiles] = useState(new Map())
  const [photos, setPhotos] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true)

    // 1. DMs
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, initiator_id, recipient_id, is_direct, last_message_at")
      .or("initiator_id.eq." + myId + ",recipient_id.eq." + myId)
      .order("last_message_at", { ascending: false })
      .limit(60)

    const dmList = (convs || []).map((c) => ({
      kind: "dm",
      id: c.id,
      otherId: c.initiator_id === myId ? c.recipient_id : c.initiator_id,
    }))
    setDms(dmList)

    // 2. Groups
    const { data: gm } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", myId)
    const groupIds = (gm || []).map((g) => g.group_id)
    let groupList = []
    if (groupIds.length > 0) {
      const { data: gs } = await supabase
        .from("groups")
        .select("id, name, avatar_url")
        .in("id", groupIds)
      groupList = (gs || []).map((g) => ({ kind: "group", id: g.id, name: g.name, avatar: g.avatar_url }))
    }
    setGroups(groupList)

    // 3. Communities
    const { data: cm } = await supabase
      .from("community_memberships")
      .select("community_id")
      .eq("user_id", myId)
    const commIds = (cm || []).map((c) => c.community_id)
    let commList = []
    if (commIds.length > 0) {
      const { data: cs } = await supabase
        .from("communities")
        .select("id, name, emoji, cover_color")
        .in("id", commIds)
      commList = (cs || []).map((c) => ({ kind: "community", id: c.id, name: c.name, emoji: c.emoji, color: c.cover_color }))
    }
    setCommunities(commList)

    // 4. Profiles for DMs
    const ids = [...new Set(dmList.map((c) => c.otherId))]
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name, username").in("id", ids)
      setProfiles(new Map((profs || []).map((p) => [p.id, p])))
      const { data: ph } = await supabase
        .from("profile_photos")
        .select("user_id, storage_path, is_primary, display_order")
        .in("user_id", ids)
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
      const pm = new Map()
      ;(ph || []).forEach((p) => { if (!pm.has(p.user_id)) pm.set(p.user_id, p.storage_path) })
      setPhotos(pm)
    }
    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  async function forwardTo(target) {
    if (!myId || busyId) return
    setBusyId(target.kind + "-" + target.id)
    tap("light")

    let payload, table
    if (target.kind === "dm") {
      table = "messages"
      payload = { conversation_id: target.id, sender_id: myId, content: message.content || "" }
    } else if (target.kind === "group") {
      table = "group_messages"
      payload = { group_id: target.id, sender_id: myId, content: message.content || "" }
    } else if (target.kind === "community") {
      table = "community_messages"
      payload = { community_id: target.id, sender_id: myId, content: message.content || "" }
    } else {
      setBusyId(null)
      return
    }

    if (message.media_url) {
      payload.media_url = message.media_url
      payload.media_type = message.media_type
      payload.media_name = message.media_name
    }

    const { error } = await supabase.from(table).insert(payload)
    setBusyId(null)
    if (error) { alert(error.message); return }
    onForwarded?.(target)
    onClose?.()
  }

  const q = query.trim().toLowerCase()
  const matchText = (t) => !q || (t || "").toLowerCase().includes(q)

  const filteredDms = dms.filter((c) => {
    const p = profiles.get(c.otherId)
    return matchText(p?.display_name) || matchText(p?.username)
  })
  const filteredGroups = groups.filter((g) => matchText(g.name))
  const filteredCommunities = communities.filter((c) => matchText(c.name))

  const hasResults = filteredDms.length + filteredGroups.length + filteredCommunities.length > 0

  return (
    <div className="fixed inset-0 z-[500] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 flex flex-col"
        style={{ maxHeight: "85dvh", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="p-4 border-b border-white/8 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-cream font-extrabold text-[16px]">Forward to</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center text-muted">
              <X size={18} />
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.06] border border-white/10 px-3 h-10">
            <Search size={15} className="text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats, groups, communities…"
              autoFocus
              className="flex-1 bg-transparent border-0 text-cream text-[13.5px] placeholder:text-subtle focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <p className="text-muted text-[13px] text-center py-6">Loading…</p>
          ) : !hasResults ? (
            <p className="text-muted text-[13px] text-center py-6">No results</p>
          ) : (
            <>
              {filteredDms.length > 0 && (
                <section className="mb-4">
                  <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2 px-1">Direct messages</p>
                  {filteredDms.map((c) => {
                    const p = profiles.get(c.otherId)
                    const photoPath = photos.get(c.otherId)
                    const name = p?.display_name || p?.username || "User"
                    const busy = busyId === "dm-" + c.id
                    return (
                      <button
                        key={"dm-" + c.id}
                        onClick={() => forwardTo(c)}
                        disabled={busy}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/8 text-left active:opacity-80 disabled:opacity-50 mb-1"
                      >
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0">
                          {photoPath ? <img src={publicPhotoUrl(photoPath)} alt="" className="w-full h-full object-cover" /> : name[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-cream font-semibold text-[14px] truncate">{name}</p>
                          {p?.username && <p className="text-muted text-[11.5px] truncate">@{p.username}</p>}
                        </div>
                        {busy ? <span className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" /> : <Send size={16} className="text-purple-400" />}
                      </button>
                    )
                  })}
                </section>
              )}

              {filteredGroups.length > 0 && (
                <section className="mb-4">
                  <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2 px-1">Groups</p>
                  {filteredGroups.map((g) => {
                    const busy = busyId === "group-" + g.id
                    return (
                      <button
                        key={"group-" + g.id}
                        onClick={() => forwardTo(g)}
                        disabled={busy}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/8 text-left active:opacity-80 disabled:opacity-50 mb-1"
                      >
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white shrink-0">
                          {g.avatar ? <img src={g.avatar} alt="" className="w-full h-full object-cover" /> : <Users size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-cream font-semibold text-[14px] truncate">{g.name}</p>
                          <p className="text-muted text-[11.5px]">Group chat</p>
                        </div>
                        {busy ? <span className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" /> : <Send size={16} className="text-purple-400" />}
                      </button>
                    )
                  })}
                </section>
              )}

              {filteredCommunities.length > 0 && (
                <section className="mb-4">
                  <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2 px-1">Communities</p>
                  {filteredCommunities.map((c) => {
                    const busy = busyId === "community-" + c.id
                    return (
                      <button
                        key={"community-" + c.id}
                        onClick={() => forwardTo(c)}
                        disabled={busy}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/8 text-left active:opacity-80 disabled:opacity-50 mb-1"
                      >
                        <div className="w-11 h-11 rounded-full grid place-items-center text-white text-lg shrink-0" style={{ background: c.color || "#7C3AED" }}>
                          {c.emoji || "•"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-cream font-semibold text-[14px] truncate">{c.name}</p>
                          <p className="text-muted text-[11.5px]">Community chat</p>
                        </div>
                        {busy ? <span className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" /> : <Send size={16} className="text-purple-400" />}
                      </button>
                    )
                  })}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
