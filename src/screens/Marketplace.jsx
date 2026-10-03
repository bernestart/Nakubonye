import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Plus, MapPin, Store, Heart, Trash2, MoreVertical, Eye, Edit3, Tag } from 'lucide-react'
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
  const myId = session?.user?.id

  const [tab, setTab] = useState('browse') // browse | listings | saved

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

      {/* Tabs */}
      <div className="flex px-4 pb-2 shrink-0 gap-1">
        {[
          { id: 'browse',   label: 'Browse' },
          { id: 'listings', label: 'My listings' },
          { id: 'saved',    label: 'Saved' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => { tap('light'); setTab(t.id) }}
            className="flex-1 h-9 rounded-xl text-[12.5px] font-bold"
            style={{
              background: tab === t.id ? 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' : 'rgba(255,255,255,0.04)',
              border: tab === t.id ? 'none' : '1px solid rgba(255,255,255,0.08)',
              color: tab === t.id ? '#fff' : '#888',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'browse' && <BrowseTab nav={nav} myId={myId} />}
      {tab === 'listings' && <MyListingsTab nav={nav} myId={myId} />}
      {tab === 'saved' && <SavedTab nav={nav} myId={myId} />}

      <BottomNav />
    </div>
  )
}

/* ============================== BROWSE ============================== */
function BrowseTab({ nav, myId }) {
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
    <>
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
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.03] shimmer" style={{ height: 200 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Empty
            title={search ? 'No results' : 'Nothing here yet'}
            sub={search ? 'Try a different search.' : 'Be the first to post something for sale.'}
            cta="Post a listing"
            onCta={() => nav('/marketplace/new')}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((l) => (
              <ListingCard key={l.id} listing={l} onClick={() => nav(`/marketplace/${l.id}`)} />
            ))}
          </div>
        )}
        <div style={{ height: 80 }} />
      </div>
    </>
  )
}

/* ============================== MY LISTINGS ============================== */
function MyListingsTab({ nav, myId }) {
  const [loading, setLoading] = useState(true)
  const [listings, setListings] = useState([])
  const [menuFor, setMenuFor] = useState(null)

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true)
    const { data } = await supabase
      .from('listings')
      .select('id, title, price, currency, category, condition, location, image_paths, status, created_at')
      .eq('seller_id', myId)
      .order('created_at', { ascending: false })
    setListings(data || [])
    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  async function deleteListing(id) {
    if (!confirm('Delete this listing permanently?')) return
    tap('light')
    await supabase.from('listings').delete().eq('id', id)
    setMenuFor(null)
    load()
  }

  async function markSold(id, currentStatus) {
    tap('light')
    const next = currentStatus === 'sold' ? 'active' : 'sold'
    await supabase.from('listings').update({ status: next }).eq('id', id)
    setMenuFor(null)
    load()
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-white/[0.03] shimmer" style={{ height: 100 }} />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <Empty title="No listings yet" sub="Post your first item for sale." cta="Post a listing" onCta={() => nav('/marketplace/new')} />
      ) : (
        <div className="flex flex-col gap-3">
          {listings.map((l) => (
            <MyListingRow key={l.id} listing={l} onOpen={() => nav(`/marketplace/${l.id}`)} onMenu={() => setMenuFor(l)} />
          ))}
        </div>
      )}
      <div style={{ height: 80 }} />

      {menuFor && (
        <div className="fixed inset-0 z-[400] flex items-end" onClick={() => setMenuFor(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <p className="text-cream font-bold text-[15px] mb-2 truncate">{menuFor.title}</p>
            <button onClick={() => { tap('light'); setMenuFor(null); nav(`/marketplace/${menuFor.id}`) }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream">
              <Eye size={18} /> <span className="font-semibold text-[14px]">View listing</span>
            </button>
            <button onClick={() => { tap('light'); setMenuFor(null); nav(`/marketplace/${menuFor.id}/edit`) }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream">
              <Edit3 size={18} /> <span className="font-semibold text-[14px]">Edit listing</span>
            </button>
            <button onClick={() => markSold(menuFor.id, menuFor.status)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left text-cream">
              <Tag size={18} /> <span className="font-semibold text-[14px]">{menuFor.status === 'sold' ? 'Mark as available' : 'Mark as sold'}</span>
            </button>
            <button onClick={() => deleteListing(menuFor.id)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-danger/10 border border-danger/30 text-left text-danger">
              <Trash2 size={18} /> <span className="font-semibold text-[14px]">Delete listing</span>
            </button>
            <button onClick={() => setMenuFor(null)} className="w-full h-11 mt-1 text-muted font-semibold text-[13.5px]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function MyListingRow({ listing, onOpen, onMenu }) {
  const img = listing.image_paths?.[0]
    ? supabase.storage.from('listing-media').getPublicUrl(listing.image_paths[0]).data?.publicUrl
    : null
  const sold = listing.status === 'sold'
  return (
    <div className="rounded-2xl bg-surface border border-white/8 flex overflow-hidden">
      <button onClick={onOpen} className="flex-1 flex gap-3 p-3 text-left active:opacity-80">
        <div className="shrink-0 rounded-xl overflow-hidden bg-black/40" style={{ width: 80, height: 80 }}>
          {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-subtle text-[10px]">No photo</div>}
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <p className="text-cream font-bold text-[13.5px] leading-tight line-clamp-2 mb-1">{listing.title}</p>
          <p className="text-cream font-black text-[14px] mb-1">
            {listing.price ? `${listing.price.toLocaleString()} ${listing.currency || 'BIF'}` : 'Free'}
          </p>
          {sold && <span className="inline-block px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/40 text-red-300 text-[10px] font-black uppercase">Sold</span>}
        </div>
      </button>
      <button onClick={onMenu} className="px-3 grid place-items-center text-muted active:bg-white/[0.03]" aria-label="Options">
        <MoreVertical size={18} />
      </button>
    </div>
  )
}

/* ============================== SAVED ============================== */
function SavedTab({ nav, myId }) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true)
    const { data: saves } = await supabase
      .from('listing_saves')
      .select('listing_id, created_at')
      .eq('user_id', myId)
      .order('created_at', { ascending: false })

    const ids = (saves || []).map((s) => s.listing_id)
    if (ids.length === 0) { setItems([]); setLoading(false); return }

    const { data: lns } = await supabase
      .from('listings')
      .select('id, title, price, currency, image_paths, category, location, status, seller_id')
      .in('id', ids)
    setItems(lns || [])
    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-white/[0.03] shimmer" style={{ height: 200 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty title="No saved listings" sub="Tap the heart on any listing to save it for later." icon={<Heart size={26} className="text-muted" />} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((l) => (
            <ListingCard key={l.id} listing={l} onClick={() => nav(`/marketplace/${l.id}`)} />
          ))}
        </div>
      )}
      <div style={{ height: 80 }} />
    </div>
  )
}

/* ============================== SHARED ============================== */
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
          {listing.price ? `${listing.price.toLocaleString()} ${listing.currency || 'BIF'}` : 'Free'}
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

function Empty({ title, sub, cta, onCta, icon }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
        {icon || <Store size={26} className="text-muted" />}
      </div>
      <p className="text-cream font-bold text-[15px] mb-1">{title}</p>
      <p className="text-muted text-[12.5px] mb-5">{sub}</p>
      {cta && onCta && (
        <button
          onClick={() => { tap('light'); onCta() }}
          className="h-11 px-5 rounded-full text-white font-bold text-[13.5px] inline-flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
        >
          <Plus size={15} strokeWidth={3} /> {cta}
        </button>
      )}
    </div>
  )
}
