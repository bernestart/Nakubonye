import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Plus, MapPin, Clock, Briefcase } from 'lucide-react'
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

export default function Services() {
  const nav = useNavigate()
  const { session } = useAuth()
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
    if (error) { console.warn('services load:', error.message); setServices([]); setLoading(false); return }

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
        <span className="text-cream font-bold text-[15px] flex-1">Services</span>
        <button
          onClick={() => { tap('light'); nav('/services/new') }}
          className="h-9 px-3 rounded-full text-white font-bold text-[13px] inline-flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
        >
          <Plus size={15} strokeWidth={3} /> Offer
        </button>
      </header>

      <div className="px-4 pb-2 shrink-0">
        <div className="flex items-center gap-2 rounded-2xl bg-surface border border-white/8 px-3.5 h-11">
          <Search size={16} className="text-muted shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services..."
            className="flex-1 bg-transparent border-0 text-cream text-[14px] placeholder:text-subtle focus:outline-none"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pb-2 shrink-0" style={{ scrollbarWidth: 'none' }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => { tap('light'); setCategory(c.id) }}
            className="shrink-0 h-8 px-3 rounded-full text-[12.5px] font-bold"
            style={{
              background: category === c.id
                ? 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)'
                : 'rgba(255,255,255,0.05)',
              border: category === c.id ? 'none' : '1px solid rgba(255,255,255,0.08)',
              color: category === c.id ? '#fff' : '#aaa',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.03] animate-pulse" style={{ height: 110 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
              <Briefcase size={26} className="text-muted" />
            </div>
            <p className="text-cream font-bold text-[15px] mb-1">No services yet</p>
            <p className="text-muted text-[12.5px] mb-5">
              {search ? 'Try a different search.' : 'Offer your skill — haircuts, tutoring, repairs, more.'}
            </p>
            <button
              onClick={() => { tap('light'); nav('/services/new') }}
              className="h-11 px-5 rounded-full text-white font-bold text-[13.5px] inline-flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
            >
              <Plus size={15} strokeWidth={3} /> Offer a service
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((s) => (
              <ServiceCard key={s.id} service={s} onClick={() => nav(`/services/${s.id}`)} />
            ))}
          </div>
        )}
        <div style={{ height: 80 }} />
      </div>

      <BottomNav />
    </div>
  )
}

function ServiceCard({ service, onClick }) {
  const img = service.image_paths?.[0]
    ? supabase.storage.from('service-media').getPublicUrl(service.image_paths[0]).data?.publicUrl
    : null
  const providerName = service.provider?.display_name || service.provider?.username || 'Provider'
  const avatar = service.provider?.photo_url ? publicPhotoUrl(service.provider.photo_url) : null

  return (
    <button
      onClick={() => { tap('light'); onClick() }}
      className="rounded-2xl bg-surface border border-white/8 overflow-hidden text-left active:opacity-80 transition-opacity flex"
    >
      <div className="shrink-0 bg-black/40" style={{ width: 110, height: 110 }}>
        {img ? (
          <img src={img} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-subtle text-[10.5px]">No photo</div>
        )}
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
