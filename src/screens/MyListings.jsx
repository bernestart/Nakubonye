import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, MoreVertical, Eye, Trash2, Edit3, MapPin, Tag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'
import BrandGlow from '../components/BrandGlow'
import BottomNav from '../components/BottomNav'

export default function MyListings() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

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
        <span className="text-cream font-bold text-[15px] flex-1">My listings</span>
        <button
          onClick={() => { tap('light'); nav('/marketplace/new') }}
          className="h-9 px-3 rounded-full text-white font-bold text-[13px] inline-flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
        >
          <Plus size={15} strokeWidth={3} /> New
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border-b border-white/6 bg-white/[0.02] animate-pulse" style={{ height: 100 }} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16 px-6">
            <p className="text-cream font-bold text-[15px] mb-1">No listings yet</p>
            <p className="text-muted text-[12.5px] mb-5">Post your first item for sale.</p>
            <button
              onClick={() => { tap('light'); nav('/marketplace/new') }}
              className="h-11 px-5 rounded-full text-white font-bold text-[13.5px] inline-flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
            >
              <Plus size={15} strokeWidth={3} /> Post a listing
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {listings.map((l) => (
              <MyListingRow
                key={l.id}
                listing={l}
                onOpen={() => nav(`/marketplace/${l.id}`)}
                onMenu={() => setMenuFor(l)}
              />
            ))}
          </div>
        )}
        <div style={{ height: 80 }} />
      </div>

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
            <button
              onClick={() => { tap('light'); setMenuFor(null); nav(`/marketplace/${menuFor.id}`) }}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]"
            >
              <Eye size={18} /> <span className="font-semibold text-[14px]">View listing</span>
            </button>
            <button
              onClick={() => { tap('light'); setMenuFor(null); nav(`/marketplace/${menuFor.id}/edit`) }}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]"
            >
              <Edit3 size={18} /> <span className="font-semibold text-[14px]">Edit listing</span>
            </button>
            <button
              onClick={() => markSold(menuFor.id, menuFor.status)}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]"
            >
              <Tag size={18} /> <span className="font-semibold text-[14px]">{menuFor.status === 'sold' ? 'Mark as available' : 'Mark as sold'}</span>
            </button>
            <button
              onClick={() => deleteListing(menuFor.id)}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-danger/20 text-left text-danger active:bg-red-500/[0.06]"
            >
              <Trash2 size={18} /> <span className="font-semibold text-[14px]">Delete listing</span>
            </button>
            <button onClick={() => setMenuFor(null)} className="w-full h-11 mt-1 text-muted font-semibold text-[13.5px]">Cancel</button>
          </div>
        </div>
      )}

      <BottomNav />
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
