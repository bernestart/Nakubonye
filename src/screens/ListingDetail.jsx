import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Tag, Heart, MessageCircle, Share2, MoreVertical, ChevronLeft, ChevronRight, Edit3, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'
import { publicPhotoUrl } from '../lib/photo'
import BrandGlow from '../components/BrandGlow'
import VerifiedBadge from "../components/VerifiedBadge"

export default function ListingDetail() {
  const nav = useNavigate()
  const { id } = useParams()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [listing, setListing] = useState(null)
  const [seller, setSeller] = useState(null)
  const [sellerMeta, setSellerMeta] = useState({ listings: 0, joined: null })
  const [saved, setSaved] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
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

    const [profRes, photoRes, listCountRes] = await Promise.all([
      supabase.from('profiles')
        .select('id, display_name, username, photo_url, is_verified, created_at')
        .eq('id', data.seller_id)
        .maybeSingle(),
      supabase.from('profile_photos')
        .select('storage_path')
        .eq('user_id', data.seller_id)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', data.seller_id)
        .eq('status', 'active'),
    ])

    const prof = profRes.data
    if (prof && photoRes.data?.storage_path) {
      prof.photo_url = publicPhotoUrl(photoRes.data.storage_path)
    }
    setSeller(prof)
    setSellerMeta({
      listings: listCountRes.count || 0,
      joined: prof?.created_at || null,
    })

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

  async function markSold() {
    if (!listing || !myId || busy) return
    setBusy(true)
    const next = listing.status === "sold" ? "active" : "sold"
    await supabase.from("listings").update({ status: next, updated_at: new Date().toISOString() }).eq("id", listing.id)
    setListing((cur) => ({ ...cur, status: next }))
    setBusy(false)
    setMenuOpen(false)
  }

  async function deleteListing() {
    if (!listing || !myId || busy) return
    if (!confirm("Delete this listing permanently?")) return
    setBusy(true)
    await supabase.from("listings").delete().eq("id", listing.id)
    setBusy(false)
    setMenuOpen(false)
    nav(-1)
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); alert("Link copied") } catch {}
    setMenuOpen(false)
  }

  async function reportListing() {
    setMenuOpen(false)
    alert("Report submitted.")
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
        <button onClick={() => { setMenuOpen(true); tap("light") }} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="More">
          <MoreVertical size={18} />
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

        {/* Seller card — enriched */}
        <div className="w-full px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => nav(`/profile/${seller?.id}`)}
              className="w-12 h-12 rounded-full overflow-hidden bg-purple-600 grid place-items-center shrink-0 text-white font-black"
            >
              {sellerAvatar ? <img src={sellerAvatar} alt="" className="w-full h-full object-cover" /> : sellerName[0].toUpperCase()}
            </button>
            <button
              onClick={() => nav(`/profile/${seller?.id}`)}
              className="flex-1 min-w-0 text-left"
            >
              <p className="text-cream font-bold text-[14.5px] truncate flex items-center gap-1.5">
                {sellerName}
                {seller?.is_verified && <VerifiedBadge size={13} />}
              </p>
              <p className="text-muted text-[11.5px]">
                {sellerMeta.listings} active listing{sellerMeta.listings === 1 ? "" : "s"}
                {sellerMeta.joined ? ` · Joined ${new Date(sellerMeta.joined).toLocaleDateString([], { month: "short", year: "numeric" })}` : ""}
              </p>
            </button>
            {!isOwner && (
              <button
                onClick={messageSeller}
                className="shrink-0 h-9 px-3.5 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[12.5px] flex items-center gap-1.5"
              >
                <MessageCircle size={14} /> Message
              </button>
            )}
          </div>
        </div>

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

      {menuOpen && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            {isOwner ? (
              <>
                <button
                  onClick={() => { setMenuOpen(false); nav(`/marketplace/${listing.id}/edit`) }}
                  className="flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03]"
                >
                  <span className="shrink-0">
                    <Edit3 size={17} className="text-purple-300" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">Edit listing</span>
                </button>
                <button
                  onClick={markSold}
                  disabled={busy}
                  className="flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left disabled:opacity-50 active:bg-white/[0.03]"
                >
                  <span className="shrink-0">
                    <Tag size={17} className="text-purple-300" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">
                    {listing.status === "sold" ? "Mark as available" : "Mark as sold"}
                  </span>
                </button>
                <button
                  onClick={deleteListing}
                  disabled={busy}
                  className="flex items-center gap-4 px-4 py-3.5 border-b border-danger/20 text-left disabled:opacity-50 active:bg-red-500/[0.06]"
                >
                  <span className="shrink-0">
                    <Trash2 size={17} color="#F87171" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">Delete listing</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { toggleSave(); setMenuOpen(false) }}
                  className="flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03]"
                >
                  <span className="shrink-0">
                    <Heart size={17} fill={saved ? "#C084FC" : "none"} className="text-purple-300" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">{saved ? "Unsave" : "Save listing"}</span>
                </button>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03]"
                >
                  <span className="shrink-0">
                    <Share2 size={17} className="text-purple-300" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">Copy link</span>
                </button>
                <button
                  onClick={reportListing}
                  className="flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03]"
                >
                  <span className="shrink-0">
                    <Tag size={17} color="#F87171" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">Report listing</span>
                </button>
              </>
            )}
            <button
              onClick={() => setMenuOpen(false)}
              className="w-full h-11 mt-2 text-muted font-semibold text-[13.5px]"
            >Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
