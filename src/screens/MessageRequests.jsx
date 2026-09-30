import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Inbox, Check, X } from "lucide-react"
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

export default function MessageRequests() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [profiles, setProfiles] = useState(new Map())
  const [photos, setPhotos] = useState(new Map())
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true)
    const { data: reqs } = await supabase
      .from("message_requests")
      .select("id, sender_id, content, media_url, media_type, media_name, status, created_at")
      .eq("recipient_id", myId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
    const list = reqs || []
    setItems(list)

    const ids = [...new Set(list.map((r) => r.sender_id))]
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, username, is_verified")
        .in("id", ids)
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

  async function accept(req) {
    if (busyId || !myId) return
    setBusyId(req.id); tap("light")

    // 1. Mark request accepted
    await supabase.from("message_requests")
      .update({ status: "accepted", handled_at: new Date().toISOString() })
      .eq("id", req.id)

    // 2. Find or create a direct conversation between us
    const lo = myId < req.sender_id ? myId : req.sender_id
    const hi = myId < req.sender_id ? req.sender_id : myId
    // Look for existing direct convo
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("is_direct", true)
      .or("and(initiator_id.eq." + myId + ",recipient_id.eq." + req.sender_id + "),and(initiator_id.eq." + req.sender_id + ",recipient_id.eq." + myId + ")")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    let convId = existing?.id
    if (!convId) {
      const { data: created, error: cErr } = await supabase
        .from("conversations")
        .insert({ initiator_id: req.sender_id, recipient_id: myId, is_direct: true })
        .select("id")
        .single()
      if (cErr) { setBusyId(null); alert(cErr.message); return }
      convId = created.id
    }

    // 3. Move the request message into the conversation
    const payload = {
      conversation_id: convId,
      sender_id: req.sender_id,
      content: req.content || "",
    }
    if (req.media_url) { payload.media_url = req.media_url; payload.media_type = req.media_type; payload.media_name = req.media_name }
    await supabase.from("messages").insert(payload)

    setBusyId(null)
    nav("/messages/" + req.sender_id, { replace: true })
  }

  async function decline(req) {
    if (busyId || !myId) return
    if (!confirm("Decline this request? The sender won't be able to message you this way again.")) return
    setBusyId(req.id); tap("light")
    await supabase.from("message_requests")
      .update({ status: "declined", handled_at: new Date().toISOString() })
      .eq("id", req.id)
    setBusyId(null)
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
        <span className="text-cream font-bold text-[15px] flex-1">Message requests</span>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex flex-col gap-2">
            {[0,1,2].map((i) => <div key={i} className="rounded-2xl bg-white/[0.03] animate-pulse" style={{ height: 100 }} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="pt-16 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
              <Inbox size={26} className="text-muted" />
            </div>
            <p className="text-cream font-bold text-[15px] mb-1">No message requests</p>
            <p className="text-muted text-[13px]">Messages from people you don't know will show up here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((r) => {
              const p = profiles.get(r.sender_id)
              const photoPath = photos.get(r.sender_id)
              const name = p?.display_name || p?.username || "Someone"
              const busy = busyId === r.id
              return (
                <div key={r.id} className="rounded-2xl bg-surface border border-white/8 overflow-hidden">
                  <button
                    onClick={() => { tap("light"); nav("/profile/" + r.sender_id) }}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0">
                      {photoPath ? <img src={publicPhotoUrl(photoPath)} alt="" className="w-full h-full object-cover" /> : name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-cream font-bold text-[13.5px] truncate">{name}</p>
                      <p className="text-subtle text-[11px]">{relTime(r.created_at)}</p>
                    </div>
                  </button>

                  {(r.content || r.media_url) && (
                    <div className="px-3 pb-3">
                      {r.media_url && r.media_type?.startsWith("image/") && (
                        <img src={r.media_url} alt="" className="rounded-lg max-h-40 mb-2" />
                      )}
                      {r.content && (
                        <p className="text-cream text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">{r.content}</p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 p-3 pt-0">
                    <button
                      onClick={() => decline(r)}
                      disabled={busy}
                      className="h-10 rounded-xl bg-danger/10 border border-danger/30 text-danger font-bold text-[13px] inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <X size={15} /> Decline
                    </button>
                    <button
                      onClick={() => accept(r)}
                      disabled={busy}
                      className="h-10 rounded-xl text-white font-bold text-[13px] inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
                    >
                      <Check size={15} /> Accept
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
