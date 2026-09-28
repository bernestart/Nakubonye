import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ImagePlus, X, MapPin, DollarSign, Clock, AlertCircle, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'
import BrandGlow from '../components/BrandGlow'

const CATEGORIES = [
  'hair', 'nails', 'beauty', 'tutoring', 'repairs', 'photography',
  'cleaning', 'fitness', 'tech', 'other',
]
const DURATIONS = [15, 30, 45, 60, 90, 120, 180]
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_IMAGES = 6

export default function CreateService() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const fileRef = useRef(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('other')
  const [duration, setDuration] = useState(30)
  const [location, setLocation] = useState('')
  const [inPerson, setInPerson] = useState(true)
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Availability — one row per active day
  const [availability, setAvailability] = useState([
    { day_of_week: 1, start_time: '09:00', end_time: '17:00' },
    { day_of_week: 2, start_time: '09:00', end_time: '17:00' },
    { day_of_week: 3, start_time: '09:00', end_time: '17:00' },
    { day_of_week: 4, start_time: '09:00', end_time: '17:00' },
    { day_of_week: 5, start_time: '09:00', end_time: '17:00' },
  ])

  useEffect(() => () => imagePreviews.forEach((p) => URL.revokeObjectURL(p)), [imagePreviews])

  function pickImages(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const remaining = MAX_IMAGES - imageFiles.length
    if (remaining <= 0) { setError(`Max ${MAX_IMAGES} photos`); return }
    const accepted = []
    for (const f of files.slice(0, remaining)) {
      if (!f.type.startsWith('image/')) continue
      if (f.size > 8 * 1024 * 1024) { setError('Each photo under 8 MB'); continue }
      accepted.push(f)
    }
    setImageFiles((c) => [...c, ...accepted])
    setImagePreviews((c) => [...c, ...accepted.map((f) => URL.createObjectURL(f))])
    setError('')
    e.target.value = ''
  }

  function removeImage(i) {
    setImageFiles((c) => c.filter((_, idx) => idx !== i))
    setImagePreviews((c) => c.filter((_, idx) => idx !== i))
  }

  function toggleDay(dayIdx) {
    const exists = availability.find((a) => a.day_of_week === dayIdx)
    if (exists) setAvailability((a) => a.filter((x) => x.day_of_week !== dayIdx))
    else setAvailability((a) => [...a, { day_of_week: dayIdx, start_time: '09:00', end_time: '17:00' }].sort((x, y) => x.day_of_week - y.day_of_week))
  }

  function updateDay(dayIdx, field, value) {
    setAvailability((a) => a.map((x) => x.day_of_week === dayIdx ? { ...x, [field]: value } : x))
  }

  async function submit() {
    if (!myId) return
    const t = title.trim()
    if (!t) { setError('Add a title'); return }
    if (availability.length === 0) { setError('Pick at least one available day'); return }

    setBusy(true); setError(''); tap('light')
    try {
      const uploadedPaths = []
      for (const f of imageFiles) {
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${myId}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('service-media')
          .upload(path, f, { upsert: false, contentType: f.type })
        if (upErr) throw new Error(upErr.message)
        uploadedPaths.push(path)
      }

      const { data: service, error: insErr } = await supabase
        .from('services')
        .insert({
          provider_id: myId,
          title: t,
          description: description.trim() || null,
          price: parseFloat(price) || 0,
          category,
          duration_minutes: duration,
          location: location.trim() || null,
          in_person: inPerson,
          image_paths: uploadedPaths,
          status: 'active',
        })
        .select('id')
        .single()
      if (insErr) throw new Error(insErr.message)

      const rows = availability.map((a) => ({
        service_id: service.id,
        day_of_week: a.day_of_week,
        start_time: a.start_time,
        end_time: a.end_time,
      }))
      const { error: availErr } = await supabase.from('service_availability').insert(rows)
      if (availErr) throw new Error(availErr.message)

      nav('/services', { replace: true })
    } catch (e) {
      setError(e.message || 'Something went wrong')
      setBusy(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />
      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px] flex-1">New service</span>
        <button
          onClick={submit}
          disabled={busy || !title.trim()}
          className="h-9 px-4 rounded-full text-white font-bold text-[13px] disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
        >
          {busy ? 'Posting…' : 'Post'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-10">
        {/* Photos */}
        <div className="mb-5">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative shrink-0" style={{ width: 88, height: 88 }}>
                <img src={src} alt="" className="w-full h-full rounded-xl object-cover" />
                <button onClick={() => removeImage(i)}
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-black/85 border border-white/20 grid place-items-center">
                  <X size={12} color="#fff" />
                </button>
              </div>
            ))}
            {imageFiles.length < MAX_IMAGES && (
              <button onClick={() => fileRef.current?.click()}
                className="shrink-0 grid place-items-center rounded-xl border-2 border-dashed border-white/15"
                style={{ width: 88, height: 88 }}>
                <div className="text-center">
                  <ImagePlus size={22} className="text-purple-400 mx-auto mb-1" />
                  <span className="text-subtle text-[10.5px] font-semibold">{imageFiles.length}/{MAX_IMAGES}</span>
                </div>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pickImages} />
        </div>

        <Field label="Service title">
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="e.g. Fresh fade haircut"
            className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (BIF)">
            <div className="relative">
              <DollarSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="number" inputMode="numeric" value={price}
                onChange={(e) => setPrice(e.target.value.slice(0, 10))} placeholder="0"
                className="w-full bg-elevated border border-white/10 rounded-xl pl-9 pr-3 py-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500" />
            </div>
          </Field>
          <Field label="Duration">
            <div className="relative">
              <Clock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full bg-elevated border border-white/10 rounded-xl pl-9 pr-3 py-3 text-cream text-[14px] focus:outline-none focus:border-purple-500">
                {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </Field>
        </div>

        <Field label="Category">
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                className="h-8 px-3 rounded-full text-[12px] font-bold capitalize"
                style={{
                  background: category === c ? 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' : 'rgba(255,255,255,0.05)',
                  border: category === c ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  color: category === c ? '#fff' : '#aaa',
                }}>
                {c}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Location (optional)">
          <div className="relative">
            <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={location} onChange={(e) => setLocation(e.target.value.slice(0, 60))}
              placeholder="e.g. Bujumbura, Rohero"
              className="w-full bg-elevated border border-white/10 rounded-xl pl-9 pr-3 py-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500" />
          </div>
        </Field>

        <Field label="Delivery">
          <div className="flex gap-2">
            <button onClick={() => setInPerson(true)}
              className="flex-1 h-10 rounded-xl text-[13px] font-bold"
              style={{
                background: inPerson ? 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(168,85,247,0.2))' : 'rgba(255,255,255,0.04)',
                border: inPerson ? '1px solid rgba(236,72,153,0.5)' : '1px solid rgba(255,255,255,0.08)',
                color: inPerson ? '#fff' : '#888',
              }}>
              In person
            </button>
            <button onClick={() => setInPerson(false)}
              className="flex-1 h-10 rounded-xl text-[13px] font-bold"
              style={{
                background: !inPerson ? 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(168,85,247,0.2))' : 'rgba(255,255,255,0.04)',
                border: !inPerson ? '1px solid rgba(236,72,153,0.5)' : '1px solid rgba(255,255,255,0.08)',
                color: !inPerson ? '#fff' : '#888',
              }}>
              Online
            </button>
          </div>
        </Field>

        <Field label="Availability">
          <div className="flex gap-1.5 mb-3">
            {DAYS.map((d, i) => {
              const active = availability.some((a) => a.day_of_week === i)
              return (
                <button key={i} onClick={() => toggleDay(i)}
                  className="flex-1 h-10 rounded-xl text-[11.5px] font-bold"
                  style={{
                    background: active ? 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' : 'rgba(255,255,255,0.04)',
                    border: active ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    color: active ? '#fff' : '#888',
                  }}>
                  {d}
                </button>
              )
            })}
          </div>

          {availability.length === 0 ? (
            <p className="text-subtle text-[12px] text-center py-2">Pick at least one day above</p>
          ) : (
            <div className="flex flex-col gap-2">
              {availability.map((a) => (
                <div key={a.day_of_week} className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/8 p-2.5">
                  <span className="text-cream font-bold text-[13px] w-10">{DAYS[a.day_of_week]}</span>
                  <input type="time" value={a.start_time} onChange={(e) => updateDay(a.day_of_week, 'start_time', e.target.value)}
                    className="flex-1 bg-elevated border border-white/10 rounded-lg px-2 py-1.5 text-cream text-[13px] focus:outline-none focus:border-purple-500" />
                  <span className="text-muted text-[12px]">–</span>
                  <input type="time" value={a.end_time} onChange={(e) => updateDay(a.day_of_week, 'end_time', e.target.value)}
                    className="flex-1 bg-elevated border border-white/10 rounded-lg px-2 py-1.5 text-cream text-[13px] focus:outline-none focus:border-purple-500" />
                  <button onClick={() => toggleDay(a.day_of_week)} className="w-7 h-7 rounded-lg grid place-items-center text-danger">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Field>

        <Field label="Description (optional)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
            placeholder="What's included, style, preparation..."
            rows={5}
            className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none" />
        </Field>

        {error && (
          <div className="flex items-start gap-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 mt-3">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">{label}</label>
      {children}
    </div>
  )
}
