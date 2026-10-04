import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, MapPin, Calendar, Users } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import EventComposer from "./EventComposer"

function fmtWhen(starts_at, ends_at) {
  const s = new Date(starts_at)
  const e = ends_at ? new Date(ends_at) : null
  const day = s.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
  const time = s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  if (e) {
    const endTime = e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    return `${day} · ${time} – ${endTime}`
  }
  return `${day} · ${time}`
}

export default function CommunityEvents({ communityId, isMember }) {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [attendeeCounts, setAttendeeCounts] = useState(new Map())
  const [myRsvps, setMyRsvps] = useState(new Map())
  const [composerOpen, setComposerOpen] = useState(false)

  async function load() {
    if (!communityId) return
    setLoading(true)
    const { data: rows } = await supabase
      .from("events")
      .select("id, host_id, community_id, title, description, cover_url, location, starts_at, ends_at, is_online, online_url, status, created_at")
      .eq("community_id", communityId)
      .order("starts_at", { ascending: true })

    const list = rows || []
    const ids = list.map((e) => e.id)

    let counts = new Map()
    let mine = new Map()
    if (ids.length > 0) {
      const { data: attendees } = await supabase
        .from("event_attendees")
        .select("event_id, user_id, status")
        .in("event_id", ids)
      ;(attendees || []).forEach((a) => {
        if (a.status === "going" || a.status === "interested") {
          counts.set(a.event_id, (counts.get(a.event_id) || 0) + 1)
        }
        if (a.user_id === myId) mine.set(a.event_id, a.status)
      })
    }

    setEvents(list)
    setAttendeeCounts(counts)
    setMyRsvps(mine)
    setLoading(false)
  }

  useEffect(() => { load() }, [communityId, myId])

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/8 h-24 shimmer" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {isMember && (
        <button
          onClick={() => { tap("light"); setComposerOpen(true) }}
          className="w-full mb-4 h-12 rounded-2xl text-white font-bold text-[14px] inline-flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
        >
          <Plus size={17} /> Create event
        </button>
      )}

      {events.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
            <Calendar size={22} strokeWidth={1.8} className="text-muted" />
          </div>
          <p className="text-cream font-semibold text-[14.5px] mb-1">No events yet</p>
          <p className="text-muted text-[12.5px]">Be the first to plan something.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((e) => {
            const going = attendeeCounts.get(e.id) || 0
            const myStatus = myRsvps.get(e.id)
            const isPast = new Date(e.starts_at) < new Date()
            return (
              <button
                key={e.id}
                onClick={() => { tap("light"); nav(`/community/${communityId}/event/${e.id}`) }}
                className="rounded-2xl overflow-hidden bg-surface border border-white/8 text-left active:opacity-90"
              >
                {e.cover_url && (
                  <div className="w-full h-32 bg-black">
                    <img src={e.cover_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-cream font-bold text-[14.5px] mb-1">{e.title}</p>
                  <p className="text-purple-300 text-[12px] font-semibold mb-2 flex items-center gap-1.5">
                    <Calendar size={13} /> {fmtWhen(e.starts_at, e.ends_at)}
                  </p>
                  {e.location && (
                    <p className="text-muted text-[12px] mb-2 flex items-center gap-1.5">
                      <MapPin size={13} /> {e.location}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted text-[11.5px] flex items-center gap-1.5">
                      <Users size={12} /> {going} {going === 1 ? "going" : "going"}
                    </span>
                    {myStatus ? (
                      <span
                        className="px-2 h-6 rounded-full text-[10.5px] font-black uppercase tracking-wide flex items-center"
                        style={{
                          background: myStatus === "going" ? "rgba(16,185,129,0.2)" : "rgba(168,85,247,0.2)",
                          border: myStatus === "going" ? "1px solid rgba(16,185,129,0.5)" : "1px solid rgba(168,85,247,0.5)",
                          color: myStatus === "going" ? "#6EE7B7" : "#DDD6FE",
                        }}
                      >
                        {myStatus === "going" ? "Going" : "Interested"}
                      </span>
                    ) : isPast ? (
                      <span className="text-muted text-[10.5px] font-bold">Ended</span>
                    ) : (
                      <span className="text-purple-300 text-[11.5px] font-bold">RSVP →</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {composerOpen && (
        <EventComposer
          communityId={communityId}
          onClose={() => setComposerOpen(false)}
          onCreated={() => { setComposerOpen(false); load() }}
        />
      )}
    </div>
  )
}
