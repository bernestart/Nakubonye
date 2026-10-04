import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, MapPin, Calendar, Users, Share2, MoreVertical, Edit3, Trash2 } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import VerifiedBadge from "../components/VerifiedBadge"
import EventComposer from "../components/EventComposer"

function fmtRange(starts_at, ends_at) {
  const s = new Date(starts_at)
  const e = ends_at ? new Date(ends_at) : null
  const day = s.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
  const t1 = s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  if (e) {
    const t2 = e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    return `${day} · ${t1} – ${t2}`
  }
  return `${day} · ${t1}`
}

export default function EventDetail() {
  const { communityId, eventId } = useParams()
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState(null)
  const [host, setHost] = useState(null)
  const [hostPhoto, setHostPhoto] = useState("")
  const [attendees, setAttendees] = useState([])
  const [myStatus, setMyStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const isHost = event && myId && event.host_id === myId

  async function load() {
    if (!eventId || !myId) return
    setLoading(true); setError("")
    const { data: e } = await supabase
      .from("events")
      .select("id, host_id, community_id, title, description, cover_url, location, starts_at, ends_at, is_online, online_url, status, privacy, created_at")
      .eq("id", eventId)
      .maybeSingle()
    if (!e) { setLoading(false); setError("Event not found"); return }
    setEvent(e)

    const [hostRes, photoRes, attRes] = await Promise.all([
      supabase.from("profiles").select("id, display_name, username, is_verified").eq("id", e.host_id).maybeSingle(),
      supabase.from("profile_photos").select("storage_path").eq("user_id", e.host_id).order("is_primary", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("event_attendees").select("user_id, status, created_at").eq("event_id", e.id).order("created_at", { ascending: false }).limit(100),
    ])
    setHost(hostRes.data || null)
    setHostPhoto(photoRes.data?.storage_path ? publicPhotoUrl(photoRes.data.storage_path) : "")

    const attList = attRes.data || []
    const ids = [...new Set(attList.map((a) => a.user_id))]
    let profMap = new Map(), phMap = new Map()
    if (ids.length > 0) {
      const [profs, phs] = await Promise.all([
        supabase.from("profiles").select("id, display_name, username, is_verified").in("id", ids),
        supabase.from("profile_photos").select("user_id, storage_path, is_primary, display_order").in("user_id", ids).order("is_primary", { ascending: false }).order("display_order", { ascending: true }),
      ])
      ;(profs.data || []).forEach((p) => profMap.set(p.id, p))
      ;(phs.data || []).forEach((x) => { if (!phMap.has(x.user_id)) phMap.set(x.user_id, x.storage_path) })
    }
    setAttendees(attList.map((a) => ({
      ...a,
      _profile: profMap.get(a.user_id),
      _photo: phMap.get(a.user_id) ? publicPhotoUrl(phMap.get(a.user_id)) : null,
    })))
    const mine = attList.find((a) => a.user_id === myId)
    setMyStatus(mine?.status || null)
    setLoading(false)
  }

  useEffect(() => { load() }, [eventId, myId])

  async function rsvp(next) {
    if (!event || !myId || busy) return
    setBusy(true); tap("light")
    try {
      if (myStatus === next) {
        await supabase.from("event_attendees").delete().eq("event_id", event.id).eq("user_id", myId)
        setMyStatus(null)
      } else if (myStatus) {
        await supabase.from("event_attendees").update({ status: next, updated_at: new Date().toISOString() }).eq("event_id", event.id).eq("user_id", myId)
        setMyStatus(next)
      } else {
        await supabase.from("event_attendees").insert({ event_id: event.id, user_id: myId, status: next })
        setMyStatus(next)
      }
      load()
    } catch (e) { console.warn(e) }
    setBusy(false)
  }

  async function cancelEvent() {
    if (!isHost || busy) return
    if (!confirm("Cancel this event?")) return
    setBusy(true)
    await supabase.from("events").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", event.id)
    setBusy(false); setMenuOpen(false); load()
  }

  async function deleteEvent() {
    if (!isHost || busy) return
    if (!confirm("Delete this event permanently?")) return
    setBusy(true)
    await supabase.from("events").delete().eq("id", event.id)
    setBusy(false); setMenuOpen(false)
    nav(-1)
  }

  async function shareEvent() {
    tap("light")
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: event.title, url })
      else { await navigator.clipboard.writeText(url); alert("Link copied") }
    } catch {}
  }

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, display: "flex", flexDirection: "column", background: "#0B0B14", overflow: "hidden" }}>
      <BrandGlow />

      <header className="shrink-0 h-12 px-3 flex items-center justify-between" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Event</span>
        <button onClick={() => setMenuOpen(true)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="More">
          <MoreVertical size={18} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pb-28">
        {loading ? (
          <div className="p-4">
            <div className="rounded-2xl bg-white/[0.03] h-48 shimmer" />
          </div>
        ) : error || !event ? (
          <div className="py-16 text-center px-6">
            <p className="text-danger text-[14px]">{error || "Event not found"}</p>
          </div>
        ) : (
          <>
            {event.cover_url ? (
              <img src={event.cover_url} alt="" className="w-full max-h-[280px] object-cover" />
            ) : (
              <div className="w-full h-40 grid place-items-center text-[60px]" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.35) 0%, rgba(236,72,153,0.35) 100%)" }}>
                📅
              </div>
            )}

            <div className="px-4 py-4">
              {event.status === "cancelled" && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/40">
                  <span className="text-red-200 font-bold text-[12.5px]">This event was cancelled</span>
                </div>
              )}
              <h1 className="text-cream font-black text-[20px] mb-3">{event.title}</h1>

              <div className="flex items-start gap-3 mb-2">
                <span className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 grid place-items-center shrink-0">
                  <Calendar size={15} className="text-purple-300" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-cream text-[13.5px] font-semibold">{fmtRange(event.starts_at, event.ends_at)}</p>
                </div>
              </div>

              {event.is_online ? (
                <div className="flex items-start gap-3 mb-2">
                  <span className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 grid place-items-center shrink-0">
                    <span className="text-blue-300 text-[13px]">🌐</span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream text-[13.5px] font-semibold">Online event</p>
                    {event.online_url && isHost && (
                      <a href={event.online_url} target="_blank" rel="noreferrer" className="text-blue-300 text-[12px] underline break-all">{event.online_url}</a>
                    )}
                  </div>
                </div>
              ) : event.location && (
                <div className="flex items-start gap-3 mb-2">
                  <span className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 grid place-items-center shrink-0">
                    <MapPin size={15} className="text-purple-300" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream text-[13.5px] font-semibold">{event.location}</p>
                  </div>
                </div>
              )}

              {/* Host */}
              <button
                onClick={() => { tap("light"); nav("/profile/" + event.host_id) }}
                className="w-full flex items-center gap-2.5 mt-3 p-3 rounded-2xl bg-white/[0.03] border border-white/8 text-left"
              >
                <span className="w-9 h-9 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0">
                  {hostPhoto ? <img src={hostPhoto} alt="" className="w-full h-full object-cover" /> : (host?.display_name || "?")[0].toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-cream font-bold text-[13px] truncate flex items-center gap-1">
                    {host?.display_name || host?.username || "Host"}
                    {host?.is_verified && <VerifiedBadge size={12} />}
                  </p>
                  <p className="text-muted text-[11px]">Hosted by</p>
                </div>
              </button>

              {event.description && (
                <div className="mt-4">
                  <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">About</p>
                  <p className="text-cream text-[13.5px] leading-relaxed whitespace-pre-wrap">{event.description}</p>
                </div>
              )}

              {/* Attendees */}
              <div className="mt-4">
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
                  Attendees · {attendees.filter((a) => a.status === "going").length} going
                </p>
                {attendees.length === 0 ? (
                  <p className="text-muted text-[12.5px]">No RSVPs yet</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {attendees.slice(0, 20).map((a) => (
                      <button
                        key={a.user_id}
                        onClick={() => { tap("light"); nav("/profile/" + a.user_id) }}
                        className="flex items-center gap-1.5 px-2 h-8 rounded-full bg-white/[0.04] border border-white/8"
                      >
                        <span className="w-5 h-5 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white text-[10px] font-black">
                          {a._photo ? <img src={a._photo} alt="" className="w-full h-full object-cover" /> : (a._profile?.display_name || "?")[0].toUpperCase()}
                        </span>
                        <span className="text-cream text-[11.5px] font-semibold max-w-[100px] truncate">
                          {a._profile?.display_name || a._profile?.username || "User"}
                        </span>
                        {a.status === "interested" && <span className="text-[10px]">⭐</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={shareEvent}
                  className="flex-1 h-11 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[13.5px] inline-flex items-center justify-center gap-1.5"
                >
                  <Share2 size={15} /> Share
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {!loading && event && event.status !== "cancelled" && (
        <div className="shrink-0 px-4 py-3 border-t border-white/8 flex gap-2"
             style={{ background: "rgba(11,11,20,0.95)", backdropFilter: "blur(12px)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <button
            onClick={() => rsvp("interested")}
            disabled={busy}
            className="flex-1 h-12 rounded-full font-bold text-[13.5px] disabled:opacity-50"
            style={{
              background: myStatus === "interested" ? "rgba(168,85,247,0.25)" : "rgba(255,255,255,0.06)",
              border: myStatus === "interested" ? "1px solid rgba(168,85,247,0.6)" : "1px solid rgba(255,255,255,0.1)",
              color: myStatus === "interested" ? "#DDD6FE" : "#fff",
            }}
          >
            {myStatus === "interested" ? "★ Interested" : "Interested"}
          </button>
          <button
            onClick={() => rsvp("going")}
            disabled={busy}
            className="flex-1 h-12 rounded-full text-white font-bold text-[13.5px] disabled:opacity-50"
            style={{
              background: myStatus === "going"
                ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                : "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)",
            }}
          >
            {myStatus === "going" ? "✓ Going" : "Going"}
          </button>
        </div>
      )}

      {menuOpen && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            {isHost ? (
              <>
                <button
                  onClick={() => { setMenuOpen(false); setEditOpen(true) }}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
                >
                  <span className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                    <Edit3 size={17} className="text-purple-300" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">Edit event</span>
                </button>
                {event.status !== "cancelled" && (
                  <button
                    onClick={cancelEvent}
                    disabled={busy}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left disabled:opacity-50"
                  >
                    <span className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                      <span className="text-purple-300 text-[15px]">✕</span>
                    </span>
                    <span className="text-cream font-semibold text-[14.5px]">Cancel event</span>
                  </button>
                )}
                <button
                  onClick={deleteEvent}
                  disabled={busy}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/8 border border-red-500/25 text-left disabled:opacity-50"
                >
                  <span className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 grid place-items-center">
                    <Trash2 size={17} color="#F87171" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">Delete event</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => { setMenuOpen(false); alert("Report submitted.") }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
              >
                <span className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 grid place-items-center">
                  <span className="text-red-300 text-[15px]">!</span>
                </span>
                <span className="text-cream font-semibold text-[14.5px]">Report event</span>
              </button>
            )}
            <button
              onClick={() => setMenuOpen(false)}
              className="w-full h-11 mt-2 text-muted font-semibold text-[13.5px]"
            >Cancel</button>
          </div>
        </div>
      )}

      {editOpen && event && (
        <EventComposer
          communityId={event.community_id}
          existing={event}
          onClose={() => setEditOpen(false)}
          onCreated={() => { setEditOpen(false); load() }}
        />
      )}
    </div>
  )
}
