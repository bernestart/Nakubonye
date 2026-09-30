import { useCallback, useEffect, useState } from "react"
import { X, Search, Send } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

export default function ForwardPicker({ message, onClose, onForwarded }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [query, setQuery] = useState("")
  const [chats, setChats] = useState([])
  const [profiles, setProfiles] = useState(new Map())
  const [photos, setPhotos] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true)
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, initiator_id, recipient_id, last_message_at")
      .or("initiator_id.eq." + myId + ",recipient_id.eq." + myId)
      .order("last_message_at", { ascending: false })
      .limit(60)

    const list = (convs || []).map((c) => ({
      id: c.id,
      otherId: c.initiator_id === myId ? c.recipient_id : c.initiator_id,
    }))
    setChats(list)

    const ids = [...new Set(list.map((c) => c.otherId))]
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

  async function forwardTo(conv) {
    if (!myId || busyId) return
    setBusyId(conv.id)
    tap("light")
    const payload = {
      conversation_id: conv.id,
      sender_id: myId,
      content: message.content || "",
    }
    if (message.media_url) {
      payload.media_url = message.media_url
      payload.media_type = message.media_type
      payload.media_name = message.media_name
    }
    const { error } = await supabase.from("messages").insert(payload)
    setBusyId(null)
    if (error) { alert(error.message); return }
    onForwarded?.(conv)
    onClose?.()
  }

  const filtered = query.trim()
    ? chats.filter((c) => {
        const p = profiles.get(c.otherId)
        const q = query.toLowerCase()
        return (p?.display_name || "").toLowerCase().includes(q) || (p?.username || "").toLowerCase().includes(q)
      })
    : chats

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
              placeholder="Search conversations…"
              autoFocus
              className="flex-1 bg-transparent border-0 text-cream text-[13.5px] placeholder:text-subtle focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <p className="text-muted text-[13px] text-center py-6">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted text-[13px] text-center py-6">No conversations found</p>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map((c) => {
                const p = profiles.get(c.otherId)
                const photoPath = photos.get(c.otherId)
                const name = p?.display_name || p?.username || "User"
                const busy = busyId === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => forwardTo(c)}
                    disabled={busy}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/8 text-left active:opacity-80 disabled:opacity-50"
                  >
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0">
                      {photoPath ? (
                        <img src={publicPhotoUrl(photoPath)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        name[0].toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-cream font-semibold text-[14px] truncate">{name}</p>
                      {p?.username && <p className="text-muted text-[11.5px] truncate">@{p.username}</p>}
                    </div>
                    {busy ? (
                      <span className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                    ) : (
                      <Send size={16} className="text-purple-400" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
