import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, Check, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'
import BrandGlow from '../components/BrandGlow'

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS_AHEAD = 14

// Build "YYYY-MM-DD" from a Date in local time
function localDateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Build a Date from local date string + "HH:MM"
function localDateTime(dateKey, timeStr) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0)
}

function minutesFromHHMM(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function hhmmFromMinutes(total) {
  const h = Math.floor(total / 60)
  const m = total % 60
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
}

export default function BookService() {
  const nav = useNavigate()
  const { id } = useParams()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [service, setService] = useState(null)
  const [provider, setProvider] = useState(null)
  const [availability, setAvailability] = useState([])
  const [bookedSlots, setBookedSlots] = useState(new Set()) // ISO strings of taken times
  const [selectedDateKey, setSelectedDateKey] = useState(null)
  const [selectedTime, setSelectedTime] = useState(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const { data: srv, error: sErr } = await supabase
      .from('services')
      .select('id, provider_id, title, price, currency, duration_minutes, location, in_person')
      .eq('id', id)
      .maybeSingle()
    if (sErr || !srv) { setError('Service not found'); setLoading(false); return }
    setService(srv)

    const { data: prof } = await supabase
      .from('profiles')
      .select('id, display_name, username, photo_url')
      .eq('id', srv.provider_id)
      .maybeSingle()
    setProvider(prof)

    const { data: av } = await supabase
      .from('service_availability')
      .select('day_of_week, start_time, end_time')
      .eq('service_id', id)
      .order('day_of_week', { ascending: true })
    setAvailability(av || [])

    // Fetch existing bookings in next 14 days to mark slots taken
    const now = new Date()
    const from = now.toISOString()
    const until = new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000).toISOString()
    const { data: bks } = await supabase
      .from('service_bookings')
      .select('scheduled_at, status')
      .eq('provider_id', srv.provider_id)
      .in('status', ['pending', 'confirmed'])
      .gte('scheduled_at', from)
      .lte('scheduled_at', until)
    setBookedSlots(new Set((bks || []).map((b) => new Date(b.scheduled_at).toISOString())))

    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Which days in next 14 are available (based on provider's weekday availability)
  const availableDays = useMemo(() => {
    const activeWeekdays = new Set(availability.map((a) => a.day_of_week))
    const out = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      if (activeWeekdays.has(d.getDay())) out.push(d)
    }
    return out
  }, [availability])

  // Build slots for the selected day
  const slots = useMemo(() => {
    if (!selectedDateKey || !service || availability.length === 0) return []
    const [y, m, d] = selectedDateKey.split('-').map(Number)
    const dayOfWeek = new Date(y, m - 1, d).getDay()
    const windows = availability.filter((a) => a.day_of_week === dayOfWeek)
    if (windows.length === 0) return []

    const dur = service.duration_minutes || 30
    const now = new Date()
    const out = []
    for (const w of windows) {
      const startMin = minutesFromHHMM(w.start_time)
      const endMin = minutesFromHHMM(w.end_time)
      for (let t = startMin; t + dur <= endMin; t += dur) {
        const hhmm = hhmmFromMinutes(t)
        const dt = localDateTime(selectedDateKey, hhmm)
        const iso = dt.toISOString()
        const past = dt < now
        const taken = bookedSlots.has(iso)
        out.push({ time: hhmm, iso, past, taken })
      }
    }
    return out.sort((a, b) => a.time.localeCompare(b.time))
  }, [selectedDateKey, service, availability, bookedSlots])

  async function confirm() {
    if (!selectedTime || !selectedDateKey || !service || !myId) return
    setBusy(true); setError(''); tap('light')

    const dt = localDateTime(selectedDateKey, selectedTime)

    const { error: insErr } = await supabase.from('service_bookings').insert({
      service_id: service.id,
      client_id: myId,
      provider_id: service.provider_id,
      scheduled_at: dt.toISOString(),
      duration_minutes: service.duration_minutes || 30,
      status: 'pending',
      notes: notes.trim() || null,
    })

    setBusy(false)
    if (insErr) {
      if (insErr.code === '23505') setError('That slot was just booked. Pick another time.')
      else setError(insErr.message)
      return
    }
    setDone(true)
  }

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, margin: '0 auto', maxWidth: 480, background: '#0B0B14', display: 'flex' }}>
        <div className="flex-1 grid place-items-center">
          <span className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  if (error && !service) {
    return (
      <div style={{ position: 'fixed', inset: 0, margin: '0 auto', maxWidth: 480, background: '#0B0B14', display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 52 }} className="px-3 flex items-center gap-2">
          <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted"><ArrowLeft size={20} /></button>
          <span className="text-cream font-bold text-[15px]">Book</span>
        </header>
        <div className="flex-1 grid place-items-center px-6"><p className="text-muted text-[14px]">{error}</p></div>
      </div>
    )
  }

  if (done) {
    return (
      <div style={{ position: 'fixed', inset: 0, margin: '0 auto', maxWidth: 480, background: '#0B0B14', display: 'flex', flexDirection: 'column' }}>
        <BrandGlow />
        <div className="flex-1 grid place-items-center px-6 text-center">
          <div>
            <div className="w-20 h-20 rounded-full grid place-items-center mx-auto mb-5"
                 style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(168,85,247,0.2))', border: '1.5px solid rgba(236,72,153,0.5)' }}>
              <Check size={36} className="text-purple-300" strokeWidth={3} />
            </div>
            <p className="text-cream font-black text-[20px] mb-2">Request sent</p>
            <p className="text-muted text-[13.5px] leading-relaxed mb-6 max-w-[300px] mx-auto">
              {provider?.display_name || 'The provider'} will confirm your booking soon. You'll get a notification.
            </p>
            <button
              onClick={() => nav('/me/bookings', { replace: true })}
              className="h-12 px-6 rounded-full text-white font-bold text-[14px]"
              style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}>
              View my bookings
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />

      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted"><ArrowLeft size={20} /></button>
        <span className="text-cream font-bold text-[15px] flex-1">Pick a time</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 pb-32">
        {/* Service summary */}
        {service && (
          <div className="border-b border-white/6 pb-3 mb-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-purple-500/15 grid place-items-center text-purple-300 shrink-0">
              <Calendar size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-cream font-bold text-[13.5px] truncate">{service.title}</p>
              <p className="text-muted text-[11.5px] flex items-center gap-1">
                <Clock size={11} /> {service.duration_minutes} min · {service.price ? `${service.price.toLocaleString()} ${service.currency || 'BIF'}` : 'Free'}
              </p>
            </div>
          </div>
        )}

        {/* Date strip */}
        <Field label="Pick a day">
          {availableDays.length === 0 ? (
            <p className="text-muted text-[13px] py-2">This provider has no availability set.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {availableDays.map((d) => {
                const key = localDateKey(d)
                const active = selectedDateKey === key
                return (
                  <button
                    key={key}
                    onClick={() => { tap('light'); setSelectedDateKey(key); setSelectedTime(null) }}
                    className="shrink-0 flex flex-col items-center justify-center rounded-2xl"
                    style={{
                      width: 56, height: 74,
                      background: active ? 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' : 'rgba(255,255,255,0.04)',
                      border: active ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <span className="text-[10.5px] font-bold" style={{ color: active ? '#fff' : '#888' }}>
                      {DAYS_SHORT[d.getDay()]}
                    </span>
                    <span className="text-[18px] font-black leading-none my-0.5" style={{ color: active ? '#fff' : '#ccc' }}>
                      {d.getDate()}
                    </span>
                    <span className="text-[10px]" style={{ color: active ? 'rgba(255,255,255,0.85)' : '#666' }}>
                      {MONTHS[d.getMonth()]}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Field>

        {/* Time slots */}
        {selectedDateKey && (
          <Field label="Pick a time">
            {slots.length === 0 ? (
              <p className="text-muted text-[13px] py-2">No slots on this day.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => {
                  const disabled = s.past || s.taken
                  const active = selectedTime === s.time
                  return (
                    <button
                      key={s.time}
                      disabled={disabled}
                      onClick={() => { tap('light'); setSelectedTime(s.time) }}
                      className="h-11 rounded-xl text-[13.5px] font-bold"
                      style={{
                        background: active
                          ? 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)'
                          : disabled
                            ? 'rgba(255,255,255,0.02)'
                            : 'rgba(255,255,255,0.05)',
                        border: active ? 'none' : '1px solid rgba(255,255,255,0.08)',
                        color: active ? '#fff' : disabled ? '#444' : '#ddd',
                        textDecoration: disabled && s.taken ? 'line-through' : 'none',
                      }}>
                      {s.time}
                    </button>
                  )
                })}
              </div>
            )}
          </Field>
        )}

        {/* Notes */}
        {selectedTime && (
          <Field label="Notes (optional)">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 400))}
              placeholder="Anything the provider should know? Address, style, prep..."
              rows={3}
              className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none" />
          </Field>
        )}

        {error && (
          <div className="flex items-start gap-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-2xl px-3 py-2.5 mt-3">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {selectedTime && (
        <div className="shrink-0 px-4 py-3 border-t border-white/8"
             style={{ background: 'rgba(11,11,20,0.95)', backdropFilter: 'blur(12px)', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={confirm}
            disabled={busy}
            className="w-full h-12 rounded-full text-white font-bold text-[14.5px] disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}>
            {busy ? 'Booking…' : 'Request booking'}
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="mb-5">
      <label className="block text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">{label}</label>
      {children}
    </div>
  )
}
