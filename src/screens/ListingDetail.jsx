import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Tag, Heart, MessageCircle, Share2, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'
import { publicPhotoUrl } from '../lib/photo'
import BrandGlow from '../components/BrandGlow'

export default function ListingDetail() {
  const nav = useNavigate()
  const { id } = useParams()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [listing, setListing] = useState(null)
  const [seller, setSeller] = useState(null)
  const [saved, setSaved] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data, error: lErr } = await supabase
      .from('listings')
      .select('id, seller_id, title, description, price, currency, category, condition, location, image_paths, status, created_at')
      .eq('id', id)
      .maybeSingle()

    if (lErr || !data) {
      setError(lErr?.message || 'Listing not found')
      setLoading(false)
      return
    }
    setListing(data)

    const { data: prof } = await supabase
      .from('profiles')
      .select('id, display_name, username, photo_url, is_verified')
      .eq('id', data.seller_id)
      .maybeSingle()
    setSeller(prof)

    if (myId) {
      const { data: s } = await supabase
        .from('listing_saves')
        .select('listing_id')
        .eq('user_id', myId)
        .eq('listing_id', id)
        .maybeSingle()
      setSaved(!!s)
    }
    setLoading(false)
  }, [id, myId])

  useEffect(() => { load() }, [load])

  async function toggleSave() {
    if (!myId) return
    tap('light')
    if (saved) {
      await supabase.from('listing_saves').delete().eq('user_id', myId).eq('listing_id', id)
      setSaved(false)
    } else {
      await supabase.from('listing_saves').insert({ user_id: myId, listing_id: id })
      setSaved(true)
    }
  }

  async function messageSeller() {
    if (!seller || !myId) return
    if (seller.id === myId) return
    tap('light')

    // Find or create conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(user_a.eq.${myId},user_b.eq.${seller.id}),and(user_a.eq.${seller.id},user_b.eq.${myId})`)
      .maybeSingle()

    if (existing?.id) {
      nav(`/messages/${seller.id}`)
      return
    }
    // Just navigate — the chat screen handles creation
    nav(`/messages/${seller.id}`)
  }

  async function shareListing() {
    tap('light')
    const url = window.location.origin + `/marketplace/${id}`
    const text = `${listing?.title} — ${listing?.price?.toLocaleString() || 0} ${listing?.currency || 'BIF'} on Nakubonye`
    try {
      if (navigator.share) await navigator.share({ title: listing?.title, text, url })
      else { await navigator.clipboard.writeText(url); alert('Link copied!') }
    } catch {}
  }

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, margin: '0 auto', maxWidth: 480,
        display: 'flex', flexDirection: 'column',
        background: '#0B0B14',
      }}>
        <div className="flex-1 grid place-items-center">
          <span className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div style={{
        position: 'fixed', inset: 0, margin: '0 auto', maxWidth: 480,
        display: 'flex', flexDirection: 'column',
        background: '#0B0B14',
      }}>
        <BrandGlow />
        <header style={{ height: 52 }} className="px-3 flex items-center gap-2">
          <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted">
            <ArrowLeft size={20} />
          </button>
          <span className="text-cream font-bold text-[15px]">Listing</span>
        </header>
        <div className="flex-1 grid place-items-center px-6 text-center">
          <p className="text-muted text-[14px]">{error || 'Not found'}</p>
        </div>
      </div>
    )
  }

  const photos = listing.image_paths || []
  const isOwner = listing.seller_id === myId
  const photoUrl = photos[photoIdx]
    ? supabase.storage.from('listing-media').getPublicUrl(photos[photoIdx]).data?.publicUrl
    : null
  const sellerName = seller?.display_name || seller?.username || 'Seller'
  const sellerAvatar = seller?.photo_url ? publicPhotoUrl(seller.photo_url) : null

  return (
    <div style={{
      position: 'fixed', inset: 0, margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />

      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2 z-10">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px] flex-1">Listing</span>
        <button onClick={shareListing} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Share">
          <Share2 size={18} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pb-28">
        {/* Photo carousel */}
        <div className="relative w-full" style={{ aspectRatio: '1 / 1', background: '#000' }}>
          {photoUrl ? (
            <img src={photoUrl} alt="" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full grid place-items-center text-subtle text-[12px]">No photo</div>
          )}

          {photos.length > 1 && (
            <>
              <button
                onClick={() => setPhotoIdx((i) => Math.max(0, i - 1))}
                disabled={photoIdx === 0}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full grid place-items-center disabled:opacity-0"
                style={{ background: 'rgba(0,0,0,0.55)' }}
                aria-label="Previous"
              >
                <ChevronLeft size={20} color="#fff" />
              </button>
              <button
                onClick={() => setPhotoIdx((i) => Math.min(photos.length - 1, i + 1))}
                disabled={photoIdx === photos.length - 1}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full grid place-items-center disabled:opacity-0"
                style={{ background: 'rgba(0,0,0,0.55)' }}
                aria-label="Next"
              >
                <ChevronRight size={20} color="#fff" />
              </button>
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                {photos.map((_, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full"
                    style={{ background: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.4)' }} />
                ))}
              </div>
            </>
          )}

          {listing.status !== 'active' && (
            <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11.5px] font-black uppercase"
                 style={{ background: 'rgba(0,0,0,0.75)', color: '#fca5a5' }}>
              {listing.status}
            </div>
          )}
        </div>

        {/* Price + title */}
        <div className="px-5 pt-4 pb-3 border-b border-white/8">
          <p className="text-cream font-black text-[24px] mb-1">
            {listing.price ? `${listing.price.toLocaleString()} ${listing.currency || 'BIF'}` : 'Free'}
          </p>
          <p className="text-cream font-bold text-[16px] leading-tight mb-2">{listing.title}</p>
          <div className="flex items-center gap-3 text-muted text-[12.5px]">
            <span className="flex items-center gap-1 capitalize">
              <Tag size={12} /> {listing.condition} · {listing.category}
            </span>
            {listing.location && (
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {listing.location}
              </span>
            )}
          </div>
        </div>

        {/* Seller card */}
        <button
          onClick={() => nav(`/profile/${seller?.id}`)}
          className="w-full flex items-center gap-3 px-5 py-3 border-b border-white/8 text-left active:bg-white/[0.03]"
        >
          <span className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center shrink-0 text-white font-black">
            {sellerAvatar ? <img src={sellerAvatar} alt="" className="w-full h-full object-cover" /> : sellerName[0].toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-cream font-bold text-[14px] truncate">{sellerName}</p>
            <p className="text-muted text-[11.5px]">View seller profile</p>
          </div>
          <ChevronRight size={18} className="text-subtle" />
        </button>

        {/* Description */}
        {listing.description && (
          <div className="px-5 py-4 border-b border-white/8">
            <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">Description</p>
            <p className="text-cream text-[13.5px] leading-relaxed whitespace-pre-wrap">{listing.description}</p>
          </div>
        )}

        {/* Save */}
        {!isOwner && (
          <button
            onClick={toggleSave}
            className="w-full flex items-center gap-3 px-5 py-4 border-b border-white/8 text-left text-cream active:bg-white/[0.03]"
          >
            <Heart size={18} className={saved ? 'text-pink-500' : 'text-muted'} fill={saved ? '#EC4899' : 'none'} />
            <span className="font-semibold text-[14px]">{saved ? 'Saved' : 'Save this listing'}</span>
          </button>
        )}
      </div>

      {/* Bottom action bar */}
      {!isOwner && (
        <div className="shrink-0 px-4 py-3 border-t border-white/8"
             style={{ background: 'rgba(11,11,20,0.95)', backdropFilter: 'blur(12px)', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={messageSeller}
            className="w-full h-12 rounded-full text-white font-bold text-[14.5px] inline-flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
          >
            <MessageCircle size={17} /> Message seller
          </button>
        </div>
      )}
    </div>
  )
}
