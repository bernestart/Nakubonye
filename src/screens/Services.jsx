import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, Plus, MapPin, Clock, Briefcase, Calendar, MessageCircle,
  Check, X, Inbox, MoreVertical, Edit3, Trash2, Eye
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'
import { publicPhotoUrl } from '../lib/photo'
import BrandGlow from '../components/BrandGlow'
import BottomNav from '../components/BottomNav'

const CATEGORIES = [
  { id: 'all',         label: 'All' },
  { id: 'hair',        label: 'Hair' },
  { id: 'nails',       label: 'Nails' },
  { id: 'beauty',      label: 'Beauty' },
  { id: 'tutoring',    label: 'Tutoring' },
  { id: 'repairs',     label: 'Repairs' },
  { id: 'photography', label: 'Photography' },
  { id: 'cleaning',    label: 'Cleaning' },
  { id: 'fitness',     label: 'Fitness' },
  { id: 'tech',        label: 'Tech' },
  { id: 'other',       label: 'Other' },
]

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

export default function Services() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [tab, setTab] = useState('browse') // browse | services | bookings

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />

      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted"><ArrowLeft size={20} strokeWidth={2.3} /></button>
        <span className="text-cream font-bold text-[15px] flex-1">Services</span>
        <button
          onClick={() => { tap('light'); nav('/services/new') }}
          className="h-9 px-3 rounded-full text-white font-bold text-[13px] inline-flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
        >
          <Plus size={15} strokeWidth={3} /> Offer
        </button>
      </header>

      <div className="flex px-4 pb-2 shrink-0 gap-1">
        {[
          { id: 'browse',   label: 'Browse' },
          { id: 'services', label: 'My services' },
          { id: 'bookings', label: 'Bookings' },
        ].map((t) => (
          <button key={t.id} onClick={() => { tap('light'); setTab(t.id) }}
            className="flex-1 h-9 rounded-xl text-[12.5px] font-bold"
            style={{
              background: tab === t.id ? 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' : 'rgba(255,255,255,0.04)',
              border: tab === t.id ? 'none' : '1px solid rgba(255,255,255,0.08)',
              color: tab === t.id ? '#fff' : '#888',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'browse' && <BrowseTab nav={nav} />}
      {tab === 'services' && <MyServicesTab nav={nav} myId={myId} />}
      {tab === 'bookings' && <BookingsTab nav={nav} myId={myId} />}

      <BottomNav />
    </div>
  )
}

/* ======================= BROWSE ======================= */
function BrowseTab({ nav }) {
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState([])
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('services')
      .select('id, provider_id, title, description, category, price, currency, duration_minutes, location, in_person, image_paths, status, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(60)
    if (category !== 'all') q = q.eq('category', category)

    const { data, error } = await q
    if (error) { setServices([]); setLoading(false); return }

    const ids = [...new Set((data || []).map((s) => s.provider_id))]
    let providerMap = new Map()
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, username, photo_url, is_verified')
        .in('id', ids)
      ;(profs || []).forEach((p) => providerMap.set(p.id, p))
    }
    setServices((data || []).map((s) => ({ ...s, provider: providerMap.get(s.provider_id) })))
    setLoading(false)
  }, [category])

  useEffect(() => { load() }, [load])

  const filtered = search.trim()
    ? services.filter((s) =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        (s.location || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.provider?.display_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : services

  return (
    <>
      <div className="px-4 pb-2 shrink-0">
        <div className="flex items-center gap-2 rounded-full bg-white/[0.05] border border-white/8 px-3.5 h-11">
          <Search size={16} className="text-muted shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services..."
            className="flex-1 bg-transparent border-0 text-cream text-[14px] placeholder:text-subtle focus:outline-none" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pb-2 shrink-0" style={{ scrollbarWidth: 'none' }}>
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => { tap('light'); setCategory(c.id) }}
            className="shrink-0 h-8 px-3 rounded-full text-[12.5px] font-bold"
            style={{
              background: category === c.id ? 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' : 'rgba(255,255,255,0.05)',
              border: category === c.id ? 'none' : '1px solid rgba(255,255,255,0.08)',
              color: category === c.id ? '#fff' : '#aaa',
            }}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border-b border-white/6 bg-white/[0.02] shimmer" style={{ height: 110 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Empty icon={<Briefcase size={26} className="text-muted" />}
            title={search ? 'No results' : 'No services yet'}
            sub={search ? 'Try a different search.' : 'Offer your skill — haircuts, tutoring, repairs, more.'}
            cta="Offer a service" onCta={() => nav('/services/new')} />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((s) => (
              <ServiceCard key={s.id} service={s} onClick={() => nav(`/services/${s.id}`)} />
            ))}
          </div>
        )}
        <div style={{ height: 80 }} />
      </div>
    </>
  )
}

/* ======================= MY SERVICES ======================= */
function MyServicesTab({ nav, myId }) {
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState([])
  const [menuFor, setMenuFor] = useState(null)

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true)
    const { data } = await supabase
      .from('services')
      .select('id, title, price, currency, category, duration_minutes, location, image_paths, status, created_at')
      .eq('provider_id', myId)
      .order('created_at', { ascending: false })
    setServices(data || [])
    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  async function toggleStatus(id, currentStatus) {
    tap('light')
    const next = currentStatus === 'active' ? 'paused' : 'active'
    await supabase.from('services').update({ status: next }).eq('id', id)
    setMenuFor(null)
    load()
  }

  async function deleteService(id) {
    if (!confirm('Delete this service permanently? Its bookings will also be removed.')) return
    tap('light')
    await supabase.from('services').delete().eq('id', id)
    setMenuFor(null)
    load()
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border-b border-white/6 bg-white/[0.02] shimmer" style={{ height: 100 }} />
          ))}
        </div>
      ) : services.length === 0 ? (
        <Empty icon={<Briefcase size={26} className="text-muted" />}
          title="No services yet" sub="Offer your first service."
          cta="Offer a service" onCta={() => nav('/services/new')} />
      ) : (
        <div className="flex flex-col gap-3">
          {services.map((s) => (
            <MyServiceRow key={s.id} service={s} onOpen={() => nav(`/services/${s.id}`)} onMenu={() => setMenuFor(s)} />
          ))}
        </div>
      )}
      <div style={{ height: 80 }} />

      {menuFor && (
        <div className="fixed inset-0 z-[400] flex items-end" onClick={() => setMenuFor(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <p className="text-cream font-bold text-[15px] mb-2 truncate">{menuFor.title}</p>
            <button onClick={() => { tap('light'); setMenuFor(null); nav(`/services/${menuFor.id}`) }}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]">
              <Eye size={18} /> <span className="font-semibold text-[14px]">View service</span>
            </button>
            <button onClick={() => { tap('light'); setMenuFor(null); nav(`/services/${menuFor.id}/edit`) }}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]">
              <Edit3 size={18} /> <span className="font-semibold text-[14px]">Edit service</span>
            </button>
            <button onClick={() => toggleStatus(menuFor.id, menuFor.status)}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]">
              <Check size={18} /> <span className="font-semibold text-[14px]">{menuFor.status === 'active' ? 'Pause service' : 'Activate service'}</span>
            </button>
            <button onClick={() => deleteService(menuFor.id)}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-danger/20 text-left text-danger active:bg-red-500/[0.06]">
              <Trash2 size={18} /> <span className="font-semibold text-[14px]">Delete service</span>
            </button>
            <button onClick={() => setMenuFor(null)} className="w-full h-11 mt-1 text-muted font-semibold text-[13.5px]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function MyServiceRow({ service, onOpen, onMenu }) {
  const img = service.image_paths?.[0]
    ? supabase.storage.from('service-media').getPublicUrl(service.image_paths[0]).data?.publicUrl
    : null
  const paused = service.status !== 'active'
  return (
    <div className="rounded-2xl bg-surface border border-white/8 flex overflow-hidden">
      <button onClick={onOpen} className="flex-1 flex gap-3 p-3 text-left active:opacity-80">
        <div className="shrink-0 rounded-xl overflow-hidden bg-black/40" style={{ width: 80, height: 80 }}>
          {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-subtle text-[10px]">No photo</div>}
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <p className="text-cream font-bold text-[13.5px] leading-tight line-clamp-2 mb-1">{service.title}</p>
          <p className="text-muted text-[11.5px] mb-1">{service.duration_minutes} min</p>
          <p className="text-cream font-black text-[14px] mb-1">
            {service.price ? `${service.price.toLocaleString()} ${service.currency || 'BIF'}` : 'Free'}
          </p>
          {paused && <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase">Paused</span>}
        </div>
      </button>
      <button onClick={onMenu} className="px-3 grid place-items-center text-muted active:bg-white/[0.03]">
        <MoreVertical size={18} />
      </button>
    </div>
  )
}

/* ======================= BOOKINGS ======================= */
function BookingsTab({ nav, myId }) {
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState([])
  const [peopleMap, setPeopleMap] = useState(new Map())
  const [servicesMap, setServicesMap] = useState(new Map())
  const [tab, setTab] = useState('upcoming') // upcoming | requests | past
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
      const { data: profs } = await supabase.from('profiles').select('id, display_name, username, photo_url').in('id', peopleIds)
      ;(profs || []).forEach((p) => pm.set(p.id, p))
    }
    setPeopleMap(pm)
    const sm = new Map()
    if (serviceIds.length) {
      const { data: svcs } = await supabase.from('services').select('id, title, price, currency, duration_minutes, location').in('id', serviceIds)
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
  const upcoming = useMemo(() => bookings.filter((b) => (b.status === 'confirmed' || b.status === 'pending') && new Date(b.scheduled_at) >= now), [bookings])
  const requests = useMemo(() => bookings.filter((b) => b.provider_id === myId && b.status === 'pending' && new Date(b.scheduled_at) >= now), [bookings, myId])
  const past = useMemo(() => bookings.filter((b) => b.status === 'completed' || b.status === 'cancelled' || new Date(b.scheduled_at) < now).sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at)), [bookings])

  const displayed = tab === 'upcoming' ? upcoming : tab === 'requests' ? requests : past

  return (
    <>
      <div className="flex px-4 pb-2 shrink-0 gap-1">
        {[
          { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { id: 'requests', label: 'Requests', count: requests.length },
          { id: 'past',     label: 'Past',     count: past.length },
        ].map((t) => (
          <button key={t.id} onClick={() => { tap('light'); setTab(t.id) }}
            className="flex-1 h-9 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5"
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
              <div key={i} className="border-b border-white/6 bg-white/[0.02] shimmer" style={{ height: 140 }} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <Empty icon={tab === 'requests' ? <Inbox size={26} className="text-muted" /> : <Calendar size={26} className="text-muted" />}
            title={tab === 'upcoming' ? 'No upcoming bookings' : tab === 'requests' ? 'No pending requests' : 'No past bookings'}
            sub={tab === 'upcoming' ? 'Book a service to see it here.' : tab === 'requests' ? 'When someone requests your service, it lands here.' : 'Completed and cancelled bookings appear here.'} />
        ) : (
          <div className="flex flex-col gap-3">
            {displayed.map((b) => (
              <BookingCard key={b.id} booking={b} myId={myId}
                peopleMap={peopleMap} servicesMap={servicesMap} busy={busyId === b.id}
                onOpenChat={(otherId) => nav(`/messages/${otherId}`)}
                onConfirm={() => updateStatus(b.id, 'confirmed')}
                onDecline={() => updateStatus(b.id, 'cancelled', { cancelled_by: myId, cancel_reason: 'Declined by provider' })}
                onComplete={() => updateStatus(b.id, 'completed')}
                onCancel={() => cancelBooking(b)} />
            ))}
          </div>
        )}
        <div style={{ height: 80 }} />
      </div>
    </>
  )
}

function BookingCard({ booking, myId, peopleMap, servicesMap, busy, onOpenChat, onConfirm, onDecline, onComplete, onCancel }) {
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
  const isPast = new Date(booking.scheduled_at) < new Date()

  return (
    <div className="rounded-2xl bg-surface border border-white/8 overflow-hidden">
      <div className="flex items-center gap-3 p-3">
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
      </div>
      <div className="px-3 pb-3 flex flex-wrap items-center gap-3 text-[12px]">
        <span className="flex items-center gap-1 text-cream font-semibold"><Calendar size={12} /> {fmtDate(booking.scheduled_at)}</span>
        <span className="flex items-center gap-1 text-muted"><Clock size={12} /> {fmtTime(booking.scheduled_at)} · {booking.duration_minutes}min</span>
        {svc?.location && <span className="flex items-center gap-1 text-muted truncate"><MapPin size={12} /> {svc.location}</span>}
      </div>
      {booking.notes && (
        <div className="px-3 pb-3">
          <p className="text-[12px] text-muted italic border-l-2 border-white/15 pl-3">"{booking.notes}"</p>
        </div>
      )}
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
          {isProvider ? (
            <button onClick={onComplete} disabled={busy}
              className="h-10 px-3 rounded-xl text-white font-bold text-[13px] disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}>
              Mark done
            </button>
          ) : (
            <button onClick={onCancel} disabled={busy}
              className="h-10 px-3 rounded-xl bg-danger/10 border border-danger/30 text-danger font-bold text-[13px] disabled:opacity-40">
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ======================= SHARED ======================= */
function ServiceCard({ service, onClick }) {
  const img = service.image_paths?.[0]
    ? supabase.storage.from('service-media').getPublicUrl(service.image_paths[0]).data?.publicUrl
    : null
  const providerName = service.provider?.display_name || service.provider?.username || 'Provider'
  const avatar = service.provider?.photo_url ? publicPhotoUrl(service.provider.photo_url) : null
  return (
    <button onClick={() => { tap('light'); onClick() }}
      className="rounded-2xl bg-surface border border-white/8 overflow-hidden text-left active:opacity-80 transition-opacity flex">
      <div className="shrink-0 bg-black/40" style={{ width: 110, height: 110 }}>
        {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-subtle text-[10.5px]">No photo</div>}
      </div>
      <div className="flex-1 min-w-0 p-3">
        <p className="text-cream font-bold text-[14px] leading-tight line-clamp-2 mb-1">{service.title}</p>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-4 h-4 rounded-full overflow-hidden bg-purple-600 grid place-items-center shrink-0">
            {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-white text-[8px] font-black">{providerName[0]?.toUpperCase()}</span>}
          </span>
          <span className="text-muted text-[11px] truncate">{providerName}</span>
        </div>
        <div className="flex items-center gap-2 mb-1.5 text-subtle text-[11px]">
          <span className="flex items-center gap-0.5"><Clock size={10} /> {service.duration_minutes} min</span>
          {service.location && <span className="flex items-center gap-0.5 truncate"><MapPin size={10} /> {service.location}</span>}
        </div>
        <p className="text-cream font-black text-[13.5px]">
          {service.price ? `${service.price.toLocaleString()} ${service.currency || 'BIF'}` : 'Free'}
        </p>
      </div>
    </button>
  )
}

function Empty({ title, sub, cta, onCta, icon }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="w-16 h-16 rounded-full bg-white/[0.04] grid place-items-center mx-auto mb-4">
        {icon || <Briefcase size={26} className="text-muted" />}
      </div>
      <p className="text-cream font-bold text-[15px] mb-1">{title}</p>
      <p className="text-muted text-[12.5px] mb-5">{sub}</p>
      {cta && onCta && (
        <button onClick={() => { tap('light'); onCta() }}
          className="h-11 px-5 rounded-full text-white font-bold text-[13.5px] inline-flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}>
          <Plus size={15} strokeWidth={3} /> {cta}
        </button>
      )}
    </div>
  )
}
