import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Check, Sparkles, Heart, Share2, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl, calcAge } from '../lib/photo'
import { tap } from '../lib/haptic'
import ProfileTabs from '../components/ProfileTabs'
import ProfileDetails from '../components/ProfileDetails'
import { PromptList } from '../components/PromptCard'
import BottomNav from '../components/BottomNav'

export default function Preview() {
  const nav = useNavigate()
  const { profile, session } = useAuth()
  const [photos, setPhotos] = useState([])
  const [interests, setInterests] = useState([])
  const [reels, setReels] = useState([])
  const [playingReel, setPlayingReel] = useState(null)
  const [savedReels, setSavedReels] = useState([])
  const [activeTab, setActiveTab] = useState("about")
  const [prompts, setPrompts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePhoto, setActivePhoto] = useState(0)
  const [copied, setCopied] = useState(false)

  const myId = session?.user?.id

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true)

    const { data: photoRows } = await supabase
      .from('profile_photos')
      .select('storage_path, is_primary, display_order')
      .eq('user_id', myId)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true })

    setPhotos((photoRows || []).map((p) => publicPhotoUrl(p.storage_path)).filter(Boolean))

    const { data: promptRows } = await supabase
      .from('profile_prompts')
      .select('prompt_key, answer, display_order')
      .eq('profile_id', myId)
      .order('display_order', { ascending: true })
    setPrompts(promptRows || [])

    const { data: links } = await supabase
      .from('profile_interests')
      .select('interest_id')
      .eq('profile_id', myId)

    if (links?.length) {
      const ids = links.map((l) => l.interest_id)
      const { data: rows } = await supabase
        .from('interests').select('id, name').in('id', ids)
      setInterests((rows || []).map((r) => r.name))
    } else {
      setInterests([])
    }

    const { data: reelRows } = await supabase
      .from("reels")
      .select("id, video_url, thumbnail_url, caption, created_at")
      .eq("user_id", myId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(30)
    setReels(reelRows || [])

    // Load saved reels
    const { data: saveRows } = await supabase
      .from("reel_saves")
      .select("reel_id")
      .eq("user_id", myId)
    const savedIds = (saveRows || []).map((r) => r.reel_id)
    if (savedIds.length > 0) {
      const { data: savedData } = await supabase
        .from("reels")
        .select("id, video_url, thumbnail_url, caption, created_at")
        .in("id", savedIds)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(30)
      setSavedReels(savedData || [])
    } else {
      setSavedReels([])
    }

    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  async function share() {
    tap('light')
    const url = window.location.origin
    const text = `Check out my Nakubonye profile — ${url}`
    if (navigator.share) {
      try { await navigator.share({ title: 'Nakubonye', text }) } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      } catch {}
    }
  }

  const lookingLabel = {
    serious: 'Relationship',
    dating: 'Dating',
    friends: 'Friendship',
    unsure: 'Open to anything',
  }[profile?.looking_for] || null

  const lookingEmoji = {
    serious: '💜',
    dating: '✨',
    friends: '🤝',
    unsure: '🌱',
  }[profile?.looking_for] || '💜'

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-purple-600/22" style={{ filter: 'blur(120px)' }} />
        <div className="absolute bottom-[-180px] right-[-100px] w-[420px] h-[420px] rounded-full bg-pink-500/14" style={{ filter: 'blur(120px)' }} />
      </div>

      <ProfileTabs active="preview" />

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="grid place-items-center h-full text-muted text-[13px]">Loading preview…</div>
        ) : !profile ? null : (
          <>
            {/* Discover-visible warning */}
            {!loading && photos.length === 0 && (
              <div className="mx-4 mb-4 flex items-start gap-3 p-4 rounded-2xl bg-amber-500/12 border border-amber-500/30">
                <AlertTriangle size={18} strokeWidth={2.3} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-cream text-[14px] font-bold mb-0.5">
                    You're hidden from Discover
                  </p>
                  <p className="text-muted text-[12.5px] leading-snug">
                    Add a profile photo to appear in Discover and start matching.
                  </p>
                </div>
              </div>
            )}

            {/* Photo */}
            <div className="px-4">
              <div
                className="relative rounded-[24px] overflow-hidden bg-surface border border-purple-500/25"
                style={{ aspectRatio: '3 / 4', boxShadow: '0 20px 60px rgba(124,58,237,0.35), 0 0 40px rgba(124,58,237,0.15)' }}
              >
                {photos.length > 0 ? (
                  <img
                    src={photos[activePhoto]}
                    alt={profile.display_name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-7xl opacity-20">👤</div>
                )}

                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0, height: '52%',
                  background: 'linear-gradient(to top, rgba(11,11,20,0.96) 0%, rgba(11,11,20,0.55) 45%, rgba(11,11,20,0) 100%)',
                  pointerEvents: 'none',
                }} />

                {photos.length > 1 && (
                  <div className="absolute top-3 left-3 right-3 flex gap-1.5">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActivePhoto(i)}
                        className="flex-1 h-1 rounded-full"
                        style={{ background: i === activePhoto ? '#fff' : 'rgba(255,255,255,0.35)' }}
                        aria-label={`Photo ${i + 1}`}
                      />
                    ))}
                  </div>
                )}

                <div className="absolute left-5 right-5 bottom-5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h1 className="text-white text-[28px] leading-[1.05] font-extrabold tracking-tight drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)]">
                      {profile.display_name || profile.username || 'You'}
                      {profile.date_of_birth ? `, ${calcAge(profile.date_of_birth)}` : ''}
                    </h1>
                    {profile.is_verified && (
                      <span className="w-[22px] h-[22px] rounded-full bg-[#1DA1F2] grid place-items-center shadow-[0_2px_8px_rgba(29,161,242,0.5)] shrink-0">
                        <Check size={13} strokeWidth={3.5} className="text-white" />
                      </span>
                    )}
                  </div>

                  <p className="text-white/90 text-[13.5px] font-medium flex items-center gap-1.5 mb-2">
                    <MapPin size={12} />
                    {profile.city || 'Unknown'}{profile.country ? `, ${profile.country}` : ''}
                  </p>

                  {lookingLabel && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur border border-white/20">
                      <span className="text-[12px]">{lookingEmoji}</span>
                      <span className="text-white text-[12px] font-semibold">{lookingLabel}</span>
                    </div>
                  )}
                </div>
              </div>

              {photos.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {photos.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePhoto(i)}
                      className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 ${
                        i === activePhoto ? 'border-purple-500 shadow-[0_0_16px_rgba(124,58,237,0.5)]' : 'border-white/10 opacity-60'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="px-4 mt-5 flex gap-2">
              {[
                { id: "about", label: "About" },
                { id: "reels", label: "Reels" + (reels.length ? " · " + reels.length : "") },
                { id: "saved", label: "Saved" + (savedReels.length ? " · " + savedReels.length : "") },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className="flex-1 h-11 rounded-2xl font-bold text-[13.5px] transition-colors"
                  style={{
                    background: activeTab === t.id
                      ? "linear-gradient(135deg, rgba(168,85,247,0.22) 0%, rgba(236,72,153,0.16) 100%)"
                      : "rgba(255,255,255,0.04)",
                    color: activeTab === t.id ? "#fff" : "#888",
                    border: activeTab === t.id ? "1px solid rgba(196,181,253,0.4)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* TABS_BAR_MARKER */}

            {activeTab === "about" && (
              <>

            {/* Bio */}
            {profile.bio && (
              <div className="px-5 mt-6">
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">About</p>
                <p className="text-cream/90 text-[14.5px] leading-[1.55]">{profile.bio}</p>
              </div>
            )}

            {/* Interests */}
            {interests.length > 0 && (
              <div className="px-5 mt-6">
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">Interests</p>
                <div className="flex flex-wrap gap-2">
                  {interests.map((name) => (
                    <span
                      key={name}
                      className="px-3.5 py-2 rounded-full text-[13px] font-semibold border border-purple-500/30 text-purple-100"
                      style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.20) 0%, rgba(236,72,153,0.10) 100%)' }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <PromptList prompts={prompts} />

            {/* Details */}
            <ProfileDetails profile={profile} />

            {/* Info */}
            <div className="px-5 mt-6">
              <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">My info</p>
              <div className="flex flex-col gap-2">
                <InfoChip icon={<MapPin size={13} />} label={profile.city || 'Unknown'} />
                {profile.country && <InfoChip icon={<Sparkles size={13} />} label={profile.country} />}
                {lookingLabel && (
                  <InfoChip icon={<Heart size={13} />} label={lookingLabel} />
                )}
              </div>
            </div>

            </>
            )}
            {/* REELS_WRAPPER_MARKER */}

            {activeTab === "reels" && (
              <>
                {reels.length === 0 && (
                  <div className="px-6 mt-10 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/12 border border-purple-500/25 grid place-items-center mx-auto mb-3">
                      <span className="text-[22px]">🎬</span>
                    </div>
                    <p className="text-cream font-bold text-[15px] mb-1">No reels yet</p>
                    <p className="text-muted text-[13px]">Share your first reel from the Feed tab.</p>
                  </div>
                )}

            {/* Reels grid */}
            {reels.length > 0 && (
              <div className="px-5 mt-6">
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
                  Reels · {reels.length}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {reels.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setPlayingReel(r)}
                      className="aspect-[9/16] rounded-xl overflow-hidden bg-black relative"
                      aria-label="Play reel"
                    >
                      <video
                        src={r.video_url}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 text-white text-[10px] font-bold bg-black/60 rounded px-1.5 py-0.5">
                        ▶
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
              </>
            )}

            {activeTab === "saved" && (
              <>
                {savedReels.length === 0 ? (
                  <div className="px-6 mt-10 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/12 border border-amber-500/25 grid place-items-center mx-auto mb-3">
                      <span className="text-[22px]">🔖</span>
                    </div>
                    <p className="text-cream font-bold text-[15px] mb-1">Nothing saved yet</p>
                    <p className="text-muted text-[13px]">Tap the bookmark on any reel to save it here.</p>
                  </div>
                ) : (
                  <div className="px-5 mt-4">
                    <div className="grid grid-cols-3 gap-1.5">
                      {savedReels.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setPlayingReel(r)}
                          className="aspect-[9/16] rounded-xl overflow-hidden bg-black relative"
                          aria-label="Play saved reel"
                        >
                          <video
                            src={r.video_url}
                            muted
                            playsInline
                            preload="metadata"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-1 left-1 text-white text-[10px] font-bold bg-black/60 rounded px-1.5 py-0.5">
                            ▶
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Share */}
            <div className="px-5 mt-6">
              <button
                onClick={share}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                  <Share2 size={16} strokeWidth={2.4} className="text-purple-300" />
                </div>
                <div className="flex-1">
                  <p className="text-cream font-semibold text-[14.5px]">Share profile</p>
                  <p className="text-muted text-[12px]">{copied ? 'Copied to clipboard' : 'Share an invite link'}</p>
                </div>
              </button>
            </div>

            <p className="text-center text-subtle text-[11.5px] mt-8 px-6 leading-relaxed">
              This is how other people see your profile.
            </p>

            <div style={{ height: 40 }} />
          </>
        )}
      </div>

      <div style={{ height: 72, flexShrink: 0 }} />
      {playingReel && (
        <div
          className="fixed inset-0 z-[500] bg-black flex items-center justify-center"
          onClick={() => setPlayingReel(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full grid place-items-center bg-white/15 text-white z-10 text-[18px]"
            onClick={() => setPlayingReel(null)}
            aria-label="Close"
          >
            ✕
          </button>
          <video
            src={playingReel.video_url}
            autoPlay
            loop
            playsInline
            controls
            className="w-full h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <BottomNav />
    </div>
  )
}

function InfoChip({ icon, label }) {
  return (
    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/8 w-fit">
      <span className="text-purple-300">{icon}</span>
      <span className="text-cream text-[13px] font-medium">{label}</span>
    </div>
  )
}
