import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Trash2 } from 'lucide-react'
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

export default function EditListing() {
  const nav = useNavigate()
  const { id } = useParams()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('other')
  const [condition, setCondition] = useState('used')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState('active')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id || !myId) return
    ;(async () => {
      const { data, error: lErr } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (lErr || !data) { setError('Listing not found'); setLoading(false); return }
      if (data.seller_id !== myId) { setError('You can only edit your own listings'); setLoading(false); return }
      setTitle(data.title || '')
      setDescription(data.description || '')
      setPrice(String(data.price || ''))
      setCategory(data.category || 'other')
      setCondition(data.condition || 'used')
      setLocation(data.location || '')
      setStatus(data.status || 'active')
      setLoading(false)
    })()
  }, [id, myId])

  async function save() {
    if (!title.trim()) { setError('Title required'); return }
    setBusy(true); setError(''); tap('light')
    const { error: upErr } = await supabase
      .from('listings')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        price: parseFloat(price) || 0,
        category, condition,
        location: location.trim() || null,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    setBusy(false)
    if (upErr) { setError(upErr.message); return }
    nav(-1)
  }

  async function deleteListing() {
    if (!confirm('Delete this listing permanently?')) return
    tap('light')
    await supabase.from('listings').delete().eq('id', id)
    nav('/me/listings', { replace: true })
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

  return (
    <div style={{
      position: 'fixed', inset: 0, margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />
      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px] flex-1">Edit listing</span>
        <button
          onClick={save}
          disabled={busy || !title.trim()}
          className="h-9 px-4 rounded-full text-white font-bold text-[13px] disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-10">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[14px] focus:outline-none focus:border-purple-500" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (BIF)">
            <input type="number" inputMode="numeric" value={price}
              onChange={(e) => setPrice(e.target.value.slice(0, 10))}
              className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[14px] focus:outline-none focus:border-purple-500" />
          </Field>
          <Field label="Condition">
            <select value={condition} onChange={(e) => setCondition(e.target.value)}
              className="w-full bg-elevated border border-white/10 rounded-xl px-3 py-3 text-cream text-[14px] focus:outline-none focus:border-purple-500">
              {CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Status">
          <div className="flex gap-2">
            {['active', 'sold'].map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className="flex-1 h-10 rounded-xl text-[13px] font-bold capitalize"
                style={{
                  background: status === s ? 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(168,85,247,0.2))' : 'rgba(255,255,255,0.04)',
                  border: status === s ? '1px solid rgba(236,72,153,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  color: status === s ? '#fff' : '#888',
                }}>
                {s}
              </button>
            ))}
          </div>
        </Field>

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
          <input value={location} onChange={(e) => setLocation(e.target.value.slice(0, 60))}
            className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[14px] focus:outline-none focus:border-purple-500" />
        </Field>

        <Field label="Description (optional)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))} rows={5}
            className="w-full bg-elevated border border-white/10 rounded-xl px-4 py-3 text-cream text-[14px] focus:outline-none focus:border-purple-500 resize-none" />
        </Field>

        {error && (
          <div className="flex items-start gap-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 mb-3">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={deleteListing}
          className="w-full h-12 rounded-full bg-danger/10 border border-danger/30 text-danger font-bold text-[14px] inline-flex items-center justify-center gap-2 mt-2"
        >
          <Trash2 size={16} /> Delete listing
        </button>
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
