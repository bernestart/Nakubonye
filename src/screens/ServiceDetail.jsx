import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Clock, MessageCircle, Calendar, ChevronLeft, ChevronRight, Share2, Video, MoreVertical, Edit3, Trash2, Tag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'
import { publicPhotoUrl } from '../lib/photo'
import BrandGlow from '../components/BrandGlow'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ServiceDetail() {
  const nav = useNavigate()
  const { id } = useParams()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [service, setService] = useState(null)
  const [provider, setProvider] = useState(null)
  const [availability, setAvailability] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data, error: sErr } = await supabase
      .from('services')
      .select('id, provider_id, title, description, category, price, currency, duration_minutes, location, in_person, image_paths, status, created_at')
      .eq('id', id)
      .maybeSingle()
    if (sErr || !data) { setError(sErr?.message || 'Service not found'); setLoading(false); return }
    setService(data)

    const { data: prof } = await supabase
      .from('profiles')
      .select('id, display_name, username, photo_url, is_verified')
      .eq('id', data.provider_id)
      .maybeSingle()
    setProvider(prof)

    const { data: av } = await supabase
      .from('service_availability')
      .select('day_of_week, start_time, end_time')
      .eq('service_id', id)
      .order('day_of_week', { ascending: true })
    setAvailability(av || [])

    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  function messageProvider() {
    if (!provider || !myId) return
    if (provider.id === myId) return
    tap('light')
    nav(`/messages/${provider.id}`)
  }

  async function share() {
    tap('light')
    const url = window.location.origin + `/services/${id}`
    const text = `${service?.title} — ${service?.price?.toLocaleString() || 0} ${service?.currency || 'BIF'} on Nakubonye`
    try {
      if (navigator.share) await navigator.share({ title: service?.title, text, url })
      else { await navigator.clipboard.writeText(url); alert('Link copied!') }
    } catch {}
  }

  if (loading) {
    async function deactivateService() {
    if (!service || !myId || busy) return
    setBusy(true)
    const next = service.status === "inactive" ? "active" : "inactive"
    await supabase.from("services").update({ status: next, updated_at: new Date().toISOString() }).eq("id", service.id)
    setService((cur) => ({ ...cur, status: next }))
    setBusy(false)
    setMenuOpen(false)
  }

  async function deleteService() {
    if (!service || !myId || busy) return
    if (!confirm("Delete this service permanently?")) return
    setBusy(true)
    await supabase.from("services").delete().eq("id", service.id)
    setBusy(false)
    setMenuOpen(false)
    nav(-1)
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); alert("Link copied") } catch {}
    setMenuOpen(false)
  }

  async function reportService() {
    setMenuOpen(false)
    alert("Report submitted.")
  }

  return (
      <div style={{ position: 'fixed', inset: 0, margin: '0 auto', maxWidth: 480, background: '#0B0B14', display: 'flex' }}>
        <div className="flex-1 grid place-items-center">
          <span className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !service) {
    return (
      <div style={{ position: 'fixed', inset: 0, margin: '0 auto', maxWidth: 480, background: '#0B0B14', display: 'flex', flexDirection: 'column' }}>
        <BrandGlow />
        <header style={{ height: 52 }} className="px-3 flex items-center gap-2">
          <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted"><ArrowLeft size={20} /></button>
          <span className="text-cream font-bold text-[15px]">Service</span>
        </header>
        <div className="flex-1 grid place-items-center px-6">
          <p className="text-muted text-[14px]">{error || 'Not found'}</p>
        </div>
      </div>
    )
  }

  const photos = service.image_paths || []
  const isOwner = service.provider_id === myId
  const photoUrl = photos[photoIdx]
    ? supabase.storage.from('service-media').getPublicUrl(photos[photoIdx]).data?.publicUrl
    : null
  const providerName = provider?.display_name || provider?.username || 'Provider'
  const providerAvatar = provider?.photo_url ? publicPhotoUrl(provider.photo_url) : null

  return (
    <div style={{
      position: 'fixed', inset: 0, margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />

      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2 z-10">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted"><ArrowLeft size={20} /></button>
        <span className="text-cream font-bold text-[15px] flex-1">Service</span>
        <button onClick={share} className="w-9 h-9 rounded-full grid place-items-center text-muted"><Share2 size={18} /></button>
        <button onClick={() => { setMenuOpen(true); tap("light") }} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="More"><MoreVertical size={18} /></button>
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
              <button onClick={() => setPhotoIdx((i) => Math.max(0, i - 1))} disabled={photoIdx === 0}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full grid place-items-center disabled:opacity-0"
                style={{ background: 'rgba(0,0,0,0.55)' }}>
                <ChevronLeft size={20} color="#fff" />
              </button>
              <button onClick={() => setPhotoIdx((i) => Math.min(photos.length - 1, i + 1))} disabled={photoIdx === photos.length - 1}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full grid place-items-center disabled:opacity-0"
                style={{ background: 'rgba(0,0,0,0.55)' }}>
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
        </div>

        {/* Price + title */}
        <div className="px-5 pt-4 pb-3 border-b border-white/8">
          <p className="text-cream font-black text-[24px] mb-1">
            {service.price ? `${service.price.toLocaleString()} ${service.currency || 'BIF'}` : 'Free'}
          </p>
          <p className="text-cream font-bold text-[16px] leading-tight mb-2">{service.title}</p>
          <div className="flex flex-wrap items-center gap-3 text-muted text-[12.5px]">
            <span className="flex items-center gap-1 capitalize">{service.category}</span>
            <span className="flex items-center gap-1"><Clock size={12} /> {service.duration_minutes} min</span>
            {service.location && <span className="flex items-center gap-1"><MapPin size={12} /> {service.location}</span>}
            <span className="flex items-center gap-1"><Video size={12} /> {service.in_person ? 'In person' : 'Online'}</span>
          </div>
        </div>

        {/* Provider */}
        <button onClick={() => nav(`/profile/${provider?.id}`)}
          className="w-full flex items-center gap-3 px-5 py-3 border-b border-white/8 text-left active:bg-white/[0.03]">
          <span className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center shrink-0 text-white font-black">
            {providerAvatar ? <img src={providerAvatar} alt="" className="w-full h-full object-cover" /> : providerName[0].toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-cream font-bold text-[14px] truncate">{providerName}</p>
            <p className="text-muted text-[11.5px]">View provider profile</p>
          </div>
          <ChevronRight size={18} className="text-subtle" />
        </button>

        {/* Availability */}
        {availability.length > 0 && (
          <div className="px-5 py-4 border-b border-white/8">
            <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">Available</p>
            <div className="flex flex-col gap-1.5">
              {availability.map((a) => (
                <div key={a.day_of_week} className="flex items-center justify-between text-[13px]">
                  <span className="text-cream font-semibold w-12">{DAYS[a.day_of_week]}</span>
                  <span className="text-muted">{a.start_time.slice(0, 5)} – {a.end_time.slice(0, 5)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {service.description && (
          <div className="px-5 py-4 border-b border-white/8">
            <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">About</p>
            <p className="text-cream text-[13.5px] leading-relaxed whitespace-pre-wrap">{service.description}</p>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {!isOwner && (
        <div className="shrink-0 px-4 py-3 border-t border-white/8 flex gap-2"
             style={{ background: 'rgba(11,11,20,0.95)', backdropFilter: 'blur(12px)', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button onClick={messageProvider}
            className="h-12 px-4 rounded-full bg-white/[0.06] border border-white/12 text-cream font-bold text-[14px] inline-flex items-center justify-center gap-2">
            <MessageCircle size={17} />
          </button>
          <button
            onClick={() => { tap('light'); nav(`/services/${id}/book`) }}
            className="flex-1 h-12 rounded-full text-white font-bold text-[14.5px] inline-flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}>
            <Calendar size={17} /> Book now
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
                  onClick={() => { setMenuOpen(false); nav(`/services/${service.id}/edit`) }}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
                >
                  <span className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                    <Edit3 size={17} className="text-purple-300" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">Edit service</span>
                </button>
                <button
                  onClick={deactivateService}
                  disabled={busy}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left disabled:opacity-50"
                >
                  <span className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                    <Tag size={17} className="text-purple-300" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">
                    {service.status === "inactive" ? "Activate service" : "Deactivate service"}
                  </span>
                </button>
                <button
                  onClick={deleteService}
                  disabled={busy}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/8 border border-red-500/25 text-left disabled:opacity-50"
                >
                  <span className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 grid place-items-center">
                    <Trash2 size={17} color="#F87171" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">Delete service</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
                >
                  <span className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                    <Share2 size={17} className="text-purple-300" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">Copy link</span>
                </button>
                <button
                  onClick={reportService}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
                >
                  <span className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 grid place-items-center">
                    <Tag size={17} color="#F87171" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">Report service</span>
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
