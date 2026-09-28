import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ImagePlus, X, MapPin, DollarSign, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'
import BrandGlow from '../components/BrandGlow'

const CATEGORIES = ['electronics', 'fashion', 'home', 'beauty', 'food', 'vehicles', 'services', 'other']
const CONDITIONS = [
  { id: 'new',       label: 'New' },
  { id: 'like-new',  label: 'Like new' },
  { id: 'used',      label: 'Used' },
]
const MAX_IMAGES = 6

export default function CreateListing() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const fileRef = useRef(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('other')
  const [condition, setCondition] = useState('used')
  const [location, setLocation] = useState('')
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
    setImageFiles((cur) => [...cur, ...accepted])
    setImagePreviews((cur) => [...cur, ...accepted.map((f) => URL.createObjectURL(f))])
    setError('')
    e.target.value = ''
  }

  function removeImage(i) {
    setImageFiles((cur) => cur.filter((_, idx) => idx !== i))
    setImagePreviews((cur) => cur.filter((_, idx) => idx !== i))
  }

  async function submit() {
    if (!myId) return
    const t = title.trim()
    if (!t) { setError('Add a title'); return }
    const priceNum = parseFloat(price) || 0
    setBusy(true); setError('')
    tap('light')
    try {
      const uploadedPaths = []
      for (const f of imageFiles) {
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${myId}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('listing-media')
          .upload(path, f, { upsert: false, contentType: f.type })
        if (upErr) throw new Error(upErr.message)
        uploadedPaths.push(path)
      }
      const { error: insErr } = await supabase.from('listings').insert({
        seller_id: myId,
        title: t,
        description: description.trim() || null,
        price: priceNum,
        category,
        condition,
        location: location.trim() || null,
        image_paths: uploadedPaths,
        status: 'active',
      })
      if (insErr) throw new Error(insErr.message)
      nav('/marketplace', { replace: true })
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
        <span className="text-cream font-bold text-[15px] flex-1">New listing</span>
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
        <div className="mb-5">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative shrink-0" style={{ width: 88, height: 88 }}>
                <img src={src} alt="" className="w-full h-full rounded-xl object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-black/85 border border-white/20 grid place-items-center"
                  aria-label="Remove"
                >
                  <X size={12} color="#fff" />
                </button>
              </div>
            ))}
            {imageFiles.length < MAX_IMAGES && (
              <button
                onClick={() => fileRef.current?.click()}
                className="shrink-0 grid place-items-center rounded-xl border-2 border-dashed border-white/15"
                style={{ width: 88, height: 88 }}
              >
                <div className="text-center">
                  <ImagePlus size={22} className="text-purple-400 mx-auto mb-1" />
                  <span className="text-subtle text-[10.5px] font-semibold">{imageFiles.length}/{MAX_IMAGES}</span>
                </div>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pickImages} />
        </div>

        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="What are you selling?"
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
          <Field label="Condition">
            <select value={condition} onChange={(e) => setCondition(e.target.value)}
              className="w-full bg-elevated border border-white/10 rounded-xl px-3 py-3 text-cream text-[14px] focus:outline-none focus:border-purple-500">
              {CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
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
              placeholder="e.g. Bujumbura"
              className="w-full bg-elevated border border-white/10 rounded-xl pl-9 pr-3 py-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500" />
          </div>
        </Field>

        <Field label="Description (optional)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
            placeholder="Describe condition, size, reason for selling..."
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
