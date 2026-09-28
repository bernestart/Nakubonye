import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Plus, Tag, MapPin, Store } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'
import BrandGlow from '../components/BrandGlow'
import BottomNav from '../components/BottomNav'

const CATEGORIES = [
  { id: 'all',        label: 'All' },
  { id: 'electronics',label: 'Electronics' },
  { id: 'fashion',    label: 'Fashion' },
  { id: 'home',       label: 'Home' },
  { id: 'beauty',     label: 'Beauty' },
  { id: 'food',       label: 'Food' },
  { id: 'vehicles',   label: 'Vehicles' },
  { id: 'services',   label: 'Services' },
  { id: 'other',      label: 'Other' },
]

export default function Marketplace() {
  const nav = useNavigate()
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [listings, setListings] = useState([])
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('listings')
      .select('id, seller_id, title, price, currency, category, location, image_paths, status, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(60)

    if (category !== 'all') q = q.eq('category', category)

    const { data, error } = await q
    if (error) { console.warn('listings load:', error.message); setListings([]); setLoading(false); return }

    // Attach seller info
    const ids = [...new Set((data || []).map((l) => l.seller_id))]
    let sellerMap = new Map()
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, username, photo_url')
        .in('id', ids)
      ;(profs || []).forEach((p) => sellerMap.set(p.id, p))
    }

    setListings((data || []).map((l) => ({ ...l, seller: sellerMap.get(l.seller_id) })))
    setLoading(false)
  }, [category])

  useEffect(() => { load() }, [load])

  const filtered = search.trim()
    ? listings.filter((l) =>
        l.title.toLowerCase().includes(search.toLowerCase()) ||
        (l.location || '').toLowerCase().includes(search.toLowerCase())
      )
    : listings

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
        <span className="text-cream font-bold text-[15px] flex-1">Marketplace</span>
        <button
          onClick={() => { tap('light'); nav('/marketplace/new') }}
          className="h-9 px-3 rounded-full text-white font-bold text-[13px] inline-flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
        >
          <Plus size={15} strokeWidth={3} /> Sell
        </button>
      </header>

      {/* Search */}
      <div className="px-4 pb-2 shrink-0">
        <div className="flex items-center gap-2 rounded-2xl bg-surface border border-white/8 px-3.5 h-11">
          <Search size={16} className="text-muted shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search listings..."
            className="flex-1 bg-transparent border-0 text-cream text-[14px] placeholder:text-subtle focus:outline-none"
          />
        </div>
      </div>

      {/* Category pills */}
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

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.03] animate-pulse" style={{ height: 200 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
              <Store size={26} className="text-muted" />
            </div>
            <p className="text-cream font-bold text-[15px] mb-1">Nothing here yet</p>
            <p className="text-muted text-[12.5px] mb-5">
              {search ? 'Try a different search.' : 'Be the first to post something for sale.'}
            </p>
            <button
              onClick={() => { tap('light'); nav('/marketplace/new') }}
              className="h-11 px-5 rounded-full text-white font-bold text-[13.5px] inline-flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
            >
              <Plus size={15} strokeWidth={3} /> Post a listing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((l) => (
              <ListingCard key={l.id} listing={l} onClick={() => nav(`/marketplace/${l.id}`)} />
            ))}
          </div>
        )}
        <div style={{ height: 80 }} />
      </div>

      <BottomNav />
    </div>
  )
}

function ListingCard({ listing, onClick }) {
  const img = listing.image_paths?.[0]
    ? supabase.storage.from('listing-media').getPublicUrl(listing.image_paths[0]).data?.publicUrl
    : null
  return (
    <button
      onClick={() => { tap('light'); onClick() }}
      className="rounded-2xl bg-surface border border-white/8 overflow-hidden text-left active:opacity-80 transition-opacity"
    >
      <div className="aspect-square bg-black/40 relative">
        {img ? (
          <img src={img} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-subtle text-[11px]">No photo</div>
        )}
        <div
          className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-white text-[11.5px] font-black"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          {listing.price ? `${listing.price.toLocaleString()} ${listing.currency}` : 'Free'}
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-cream font-bold text-[13px] leading-tight line-clamp-2 mb-1">{listing.title}</p>
        {listing.location && (
          <p className="text-subtle text-[10.5px] flex items-center gap-1 truncate">
            <MapPin size={10} /> {listing.location}
          </p>
        )}
      </div>
    </button>
  )
}
