import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, MapPin, Check, X, MessageCircle, ChevronRight, Inbox, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'
import { publicPhotoUrl } from '../lib/photo'
import BrandGlow from '../components/BrandGlow'
import BottomNav from '../components/BottomNav'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmtDate(iso) {
  const d = new Date(iso)
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}
function fmtTime(iso) {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function MyBookings() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState([])
  const [peopleMap, setPeopleMap] = useState(new Map())
  const [servicesMap, setServicesMap] = useState(new Map())
  const [tab, setTab] = useState('upcoming') // upcoming | past | requests
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true)
    const { data: rows } = await supabase
      .from('service_bookings')
      .select('id, service_id, client_id, provider_id, scheduled_at, duration_minutes, status, notes, cancelled_by, cancel_reason, created_at')
      .or(`client_id.eq.${myId},provider_id.eq.${myId}`)
      .order('scheduled_at', { ascending: true })
    const list = rows || []
    setBookings(list)

    const peopleIds = [...new Set(list.flatMap((b) => [b.client_id, b.provider_id]))]
    const serviceIds = [...new Set(list.map((b) => b.service_id))]

    const pm = new Map()
    if (peopleIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, username, photo_url')
        .in('id', peopleIds)
      ;(profs || []).forEach((p) => pm.set(p.id, p))
    }
    setPeopleMap(pm)

    const sm = new Map()
    if (serviceIds.length) {
      const { data: svcs } = await supabase
        .from('services')
        .select('id, title, price, currency, duration_minutes, location')
        .in('id', serviceIds)
      ;(svcs || []).forEach((s) => sm.set(s.id, s))
    }
    setServicesMap(sm)

    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  async function updateStatus(bookingId, newStatus, extra = {}) {
    setBusyId(bookingId); tap('light')
    const patch = { status: newStatus, updated_at: new Date().toISOString(), ...extra }
    const { error } = await supabase.from('service_bookings').update(patch).eq('id', bookingId)
    setBusyId(null)
    if (error) { alert(error.message); return }
    load()
  }

  async function cancelBooking(b) {
    const reason = prompt('Why are you cancelling? (optional)') || ''
    await updateStatus(b.id, 'cancelled', { cancelled_by: myId, cancel_reason: reason || null })
  }

  const now = new Date()
  const upcoming = useMemo(() => bookings.filter((b) =>
    (b.status === 'confirmed' || b.status === 'pending') && new Date(b.scheduled_at) >= now
  ), [bookings])
  const requests = useMemo(() => bookings.filter((b) =>
    b.provider_id === myId && b.status === 'pending' && new Date(b.scheduled_at) >= now
  ), [bookings, myId])
  const past = useMemo(() => bookings.filter((b) =>
    b.status === 'completed' || b.status === 'cancelled' || new Date(b.scheduled_at) < now
  ).sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at)), [bookings])

  const displayed = tab === 'upcoming' ? upcoming : tab === 'requests' ? requests : past

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />

      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted"><ArrowLeft size={20} /></button>
        <span className="text-cream font-bold text-[15px] flex-1">My bookings</span>
      </header>

      {/* Tabs */}
      <div className="flex px-4 pb-2 shrink-0 gap-1">
        {[
          { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { id: 'requests', label: 'Requests', count: requests.length },
          { id: 'past',     label: 'Past',     count: past.length },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => { tap('light'); setTab(t.id) }}
            className="flex-1 h-9 rounded-xl text-[12.5px] font-bold flex items-center justify-center gap-1.5"
            style={{
              background: tab === t.id ? 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' : 'rgba(255,255,255,0.04)',
              border: tab === t.id ? 'none' : '1px solid rgba(255,255,255,0.08)',
              color: tab === t.id ? '#fff' : '#888',
            }}>
            {t.label}
            {t.count > 0 && (
              <span className="px-1.5 rounded-full text-[10px] font-black"
                    style={{ background: tab === t.id ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', color: '#fff' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border-b border-white/6 bg-white/[0.02] animate-pulse" style={{ height: 140 }} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 rounded-full bg-white/[0.04] grid place-items-center mx-auto mb-4">
              {tab === 'requests' ? <Inbox size={26} className="text-muted" /> : <Calendar size={26} className="text-muted" />}
            </div>
            <p className="text-cream font-bold text-[15px] mb-1">
              {tab === 'upcoming' ? 'No upcoming bookings'
               : tab === 'requests' ? 'No pending requests'
               : 'No past bookings'}
            </p>
            <p className="text-muted text-[12.5px]">
              {tab === 'upcoming' ? 'Book a service to see it here.'
               : tab === 'requests' ? 'When someone requests your service, it lands here.'
               : 'Completed and cancelled bookings appear here.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayed.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                myId={myId}
                peopleMap={peopleMap}
                servicesMap={servicesMap}
                busy={busyId === b.id}
                onOpen={() => nav(`/bookings/${b.id}`)}
                onOpenChat={(otherId) => nav(`/messages/${otherId}`)}
                onConfirm={() => updateStatus(b.id, 'confirmed')}
                onDecline={() => updateStatus(b.id, 'cancelled', { cancelled_by: myId, cancel_reason: 'Declined by provider' })}
                onComplete={() => updateStatus(b.id, 'completed')}
                onCancel={() => cancelBooking(b)}
              />
            ))}
          </div>
        )}
        <div style={{ height: 80 }} />
      </div>

      <BottomNav />
    </div>
  )
}

function BookingCard({ booking, myId, peopleMap, servicesMap, busy, onOpen, onOpenChat, onConfirm, onDecline, onComplete, onCancel }) {
  const isProvider = booking.provider_id === myId
  const otherId = isProvider ? booking.client_id : booking.provider_id
  const other = peopleMap.get(otherId)
  const svc = servicesMap.get(booking.service_id)
  const otherName = other?.display_name || other?.username || (isProvider ? 'Client' : 'Provider')
  const avatar = other?.photo_url ? publicPhotoUrl(other.photo_url) : null

  const status = booking.status
  const statusColor =
    status === 'confirmed' ? { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', text: '#86efac' }
    : status === 'pending' ? { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', text: '#fcd34d' }
    : status === 'completed' ? { bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.4)', text: '#d8b4fe' }
    : { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#fca5a5' }

  const scheduled = new Date(booking.scheduled_at)
  const isPast = scheduled < new Date()

  return (
    <div className="rounded-2xl bg-surface border border-white/8 overflow-hidden">
      {/* Header — who + status */}
      <button onClick={onOpen} className="w-full flex items-center gap-3 p-3 text-left active:bg-white/[0.02]">
        <span className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center shrink-0 text-white font-black">
          {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : otherName[0]?.toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-cream font-bold text-[13.5px] truncate">
            {otherName} <span className="text-muted font-normal text-[11.5px]">· {isProvider ? 'client' : 'provider'}</span>
          </p>
          <p className="text-muted text-[11.5px] truncate">{svc?.title || 'Service'}</p>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
              style={{ background: statusColor.bg, border: `1px solid ${statusColor.border}`, color: statusColor.text }}>
          {status}
        </span>
      </button>

      {/* When / where */}
      <div className="px-3 pb-3 flex flex-wrap items-center gap-3 text-[12px]">
        <span className="flex items-center gap-1 text-cream font-semibold">
          <Calendar size={12} /> {fmtDate(booking.scheduled_at)}
        </span>
        <span className="flex items-center gap-1 text-muted">
          <Clock size={12} /> {fmtTime(booking.scheduled_at)} · {booking.duration_minutes}min
        </span>
        {svc?.location && (
          <span className="flex items-center gap-1 text-muted truncate">
            <MapPin size={12} /> {svc.location}
          </span>
        )}
      </div>

      {/* Notes */}
      {booking.notes && (
        <div className="px-3 pb-3">
          <p className="text-[12px] text-muted italic border-l-2 border-white/15 pl-3">
            "{booking.notes}"
          </p>
        </div>
      )}

      {/* Actions */}
      {status === 'pending' && isProvider && !isPast && (
        <div className="grid grid-cols-2 gap-2 p-3 pt-0">
          <button onClick={onDecline} disabled={busy}
            className="h-10 rounded-xl bg-danger/10 border border-danger/30 text-danger font-bold text-[13px] inline-flex items-center justify-center gap-1.5 disabled:opacity-40">
            <X size={15} /> Decline
          </button>
          <button onClick={onConfirm} disabled={busy}
            className="h-10 rounded-xl text-white font-bold text-[13px] inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}>
            <Check size={15} /> Confirm
          </button>
        </div>
      )}

      {status === 'pending' && !isProvider && !isPast && (
        <div className="p-3 pt-0 flex gap-2">
          <button onClick={() => onOpenChat(booking.provider_id)}
            className="flex-1 h-10 rounded-xl bg-white/[0.05] border border-white/8 text-cream font-bold text-[13px] inline-flex items-center justify-center gap-1.5">
            <MessageCircle size={15} /> Message
          </button>
          <button onClick={onCancel} disabled={busy}
            className="h-10 px-3 rounded-xl bg-danger/10 border border-danger/30 text-danger font-bold text-[13px] disabled:opacity-40">
            Cancel
          </button>
        </div>
      )}

      {status === 'confirmed' && !isPast && (
        <div className="p-3 pt-0 flex gap-2">
          <button onClick={() => onOpenChat(isProvider ? booking.client_id : booking.provider_id)}
            className="flex-1 h-10 rounded-xl bg-white/[0.05] border border-white/8 text-cream font-bold text-[13px] inline-flex items-center justify-center gap-1.5">
            <MessageCircle size={15} /> Message
          </button>
          {isProvider && (
            <button onClick={onComplete} disabled={busy}
              className="h-10 px-3 rounded-xl text-white font-bold text-[13px] disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}>
              Mark done
            </button>
          )}
          {!isProvider && (
            <button onClick={onCancel} disabled={busy}
              className="h-10 px-3 rounded-xl bg-danger/10 border border-danger/30 text-danger font-bold text-[13px] disabled:opacity-40">
              Cancel
            </button>
          )}
        </div>
      )}

      {status === 'cancelled' && booking.cancel_reason && (
        <div className="px-3 pb-3">
          <p className="text-[11.5px] text-danger/80">Reason: {booking.cancel_reason}</p>
        </div>
      )}
    </div>
  )
}
