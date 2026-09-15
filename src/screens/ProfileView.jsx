import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Check, X, Heart, Flag, Ban, MoreVertical, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl, calcAge } from '../lib/photo'
import { tap } from '../lib/haptic'
import ReportModal from '../components/ReportModal'
import BlockConfirm from '../components/BlockConfirm'
import DirectMessageModal from '../components/DirectMessageModal'
import ProfileDetails from '../components/ProfileDetails'
import { PromptList } from '../components/PromptCard'

export default function ProfileView() {
  const nav = useNavigate()
  const { userId } = useParams()
  const { session } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [person, setPerson] = useState(null)
  const [photos, setPhotos] = useState([])
  const [interests, setInterests] = useState([])
  const [prompts, setPrompts] = useState([])
  const [activePhoto, setActivePhoto] = useState(0)
  const [isMatch, setIsMatch] = useState(false)
  const [myLike, setMyLike] = useState(false)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [dmOpen, setDmOpen] = useState(false)

  const myId = session?.user?.id
  const isMe = myId === userId

  const load = useCallback(async () => {
    if (!myId || !userId) return
    setLoading(true); setError('')

    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('id, display_name, username, date_of_birth, gender, bio, city, country, is_verified, looking_for, profession, education, religion, relationship_status, body_height_cm, languages, body_type, personality, relationship_preference, music_genres, smoker, drinking, partying, exercise, tattoos, diet, pets, children')
      .eq('id', userId)
      .single()

    if (profErr || !prof) {
      setError(profErr?.message || 'Profile not found.')
      setLoading(false)
      return
    }
    setPerson(prof)

    const { data: photoRows } = await supabase
      .from('profile_photos')
      .select('storage_path, is_primary, display_order')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true })

    setPhotos((photoRows || []).map((p) => publicPhotoUrl(p.storage_path)).filter(Boolean))

    const { data: promptRows } = await supabase
      .from('profile_prompts')
      .select('prompt_key, answer, display_order')
      .eq('profile_id', userId)
      .order('display_order', { ascending: true })
    setPrompts(promptRows || [])

    const { data: links } = await supabase
      .from('profile_interests')
      .select('interest_id')
      .eq('profile_id', userId)

    if (links?.length) {
      const ids = links.map((l) => l.interest_id)
      const { data: rows } = await supabase
        .from('interests').select('id, name').in('id', ids)
      setInterests((rows || []).map((r) => r.name))
    } else {
      setInterests([])
    }

    if (!isMe) {
      const lo = myId < userId ? myId : userId
      const hi = myId < userId ? userId : myId
      const { data: match } = await supabase
        .from('matches').select('id')
        .eq('user_one_id', lo).eq('user_two_id', hi).maybeSingle()
      setIsMatch(!!match)

      const { data: like } = await supabase
        .from('likes').select('id')
        .eq('user_id', myId).eq('liked_user_id', userId).maybeSingle()
      setMyLike(!!like)
    }

    setLoading(false)
  }, [myId, userId, isMe])

  useEffect(() => { load() }, [load])

  async function handleLike() {
    if (busy || !myId) return
    tap('medium'); setBusy(true)
    const { error: err } = await supabase.rpc('like_user', { target_user_id: userId })
    if (err) { setError(err.message); setBusy(false); return }
    await supabase.from('swipes').upsert(
      { swiper_id: myId, target_id: userId, action: 'like' },
      { onConflict: 'swiper_id,target_id', ignoreDuplicates: true }
    )
    setMyLike(true)
    setBusy(false)
  }

  async function handlePass() {
    if (busy || !myId) return
    tap('light'); setBusy(true)
    await supabase.from('swipes').upsert(
      { swiper_id: myId, target_id: userId, action: 'pass' },
      { onConflict: 'swiper_id,target_id', ignoreDuplicates: true }
    )
    nav(-1)
    setBusy(false)
  }

  const lookingLabel = {
    serious: 'Looking for something serious',
    dating: 'Open to dating',
    friends: 'Friendship first',
    unsure: 'Still figuring it out',
  }[person?.looking_for] || null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      {/* Purple ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-purple-600/25 blur-[120px]" />
        <div className="absolute bottom-[-200px] right-[-100px] w-[380px] h-[380px] rounded-full bg-pink-500/15 blur-[110px]" />
      </div>

      {/* Header */}
      <header
        style={{ height: 52, flexShrink: 0 }}
        className="relative px-3 flex items-center justify-between"
      >
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        {!isMe && (
          <button
            onClick={() => setMenuOpen(true)}
            className="w-9 h-9 rounded-full grid place-items-center text-muted"
            aria-label="More"
          >
            <MoreVertical size={20} strokeWidth={2.2} />
          </button>
        )}
        {isMe && <div className="w-9 h-9" />}
      </header>

      {error && (
        <div className="relative mx-3 mb-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
          {error}
        </div>
      )}

      <div className="relative flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="grid place-items-center h-full text-muted text-[13px]">Loading profile…</div>
        ) : !person ? null : (
          <>
            {/* Photo */}
            <div className="px-4">
              <div
                className="relative rounded-[24px] overflow-hidden bg-surface border border-purple-500/25"
                style={{ aspectRatio: '3 / 4', boxShadow: '0 20px 60px rgba(124,58,237,0.35), 0 0 40px rgba(124,58,237,0.15)' }}
              >
                {photos.length > 0 ? (
                  <img
                    src={photos[activePhoto]}
                    alt={person.display_name || 'profile'}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-7xl opacity-20">👤</div>
                )}

                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0, height: '48%',
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
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-white text-[28px] leading-[1.05] font-extrabold tracking-tight drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)]">
                      {person.display_name || person.username || 'Someone'}
                      {person.date_of_birth ? `, ${calcAge(person.date_of_birth)}` : ''}
                    </h1>
                    {person.is_verified && (
                      <span className="w-[22px] h-[22px] rounded-full bg-[#1DA1F2] grid place-items-center shadow-[0_2px_8px_rgba(29,161,242,0.5)] shrink-0">
                        <Check size={13} strokeWidth={3.5} className="text-white" />
                      </span>
                    )}
                  </div>
                  <p className="text-white/90 text-[13.5px] font-medium flex items-center gap-1.5">
                    <MapPin size={12} />
                    {person.city || 'Unknown'}{person.country ? `, ${person.country}` : ''}
                  </p>
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

            {/* Looking for chip */}
            {lookingLabel && (
              <div className="px-5 mt-5">
                <div
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-purple-500/40"
                  style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.20) 0%, rgba(236,72,153,0.12) 100%)' }}
                >
                  <Sparkles size={13} strokeWidth={2.4} className="text-purple-300" />
                  <span className="text-purple-200 text-[12.5px] font-semibold">{lookingLabel}</span>
                </div>
              </div>
            )}

            {/* Bio */}
            {person.bio && (
              <div className="px-5 mt-6">
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">About</p>
                <p className="text-cream/90 text-[14.5px] leading-[1.55]">{person.bio}</p>
              </div>
            )}

            <PromptList prompts={prompts} />

            {/* Details */}
            <ProfileDetails profile={person} />

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

            <div style={{ height: 130 }} />
          </>
        )}
      </div>

      {/* Action bar */}
      {!isMe && person && !loading && (
        <div
          className="relative shrink-0 px-5 flex items-center justify-center gap-3 border-t border-purple-500/15"
          style={{
            height: 96,
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            background: 'linear-gradient(to top, rgba(124,58,237,0.10), transparent)',
          }}
        >
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handlePass}
            disabled={busy}
            className="w-[58px] h-[58px] rounded-full grid place-items-center bg-white/[0.06] border border-white/10 text-white/85 disabled:opacity-50 shrink-0"
            aria-label="Pass"
          >
            <X size={26} strokeWidth={2.6} />
          </motion.button>

          {isMatch ? (
            <button
              onClick={() => nav('/messages/' + userId)}
              className="flex-1 h-[52px] rounded-full text-white font-bold text-[15px]"
              style={{
                background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)',
                boxShadow: '0 10px 28px rgba(236,72,153,0.5)',
              }}
            >
              Send a message
            </button>
          ) : myLike ? (
            <button
              disabled
              className="flex-1 h-[52px] rounded-full bg-white/[0.06] border border-white/10 text-white/60 font-semibold text-[15px]"
            >
              Like sent ✓
            </button>
          ) : (
            <>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setDmOpen(true)}
                className="h-[52px] px-4 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[13.5px] shrink-0"
              >
                Message · 55
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleLike}
                disabled={busy}
                className="flex-1 h-[52px] rounded-full text-white font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)',
                  boxShadow: '0 10px 28px rgba(236,72,153,0.5)',
                }}
              >
                <Heart size={18} strokeWidth={2.6} fill="currentColor" />
                Like
              </motion.button>
            </>
          )}
        </div>
      )}

      {/* Overflow menu */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} className="fixed inset-0 z-[100] bg-obsidian/70 backdrop-blur-sm">
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-16 right-3 w-56 bg-surface rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          >
            <MenuItem icon={<Flag size={16} />} label="Report" onClick={() => { setMenuOpen(false); setReportOpen(true) }} />
            <MenuItem icon={<Ban size={16} />} label="Block" danger onClick={() => { setMenuOpen(false); setBlockOpen(true) }} />
          </div>
        </div>
      )}

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} target={person} />
      <BlockConfirm
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        target={person}
        onBlocked={() => nav('/discover', { replace: true })}
      />

      <DirectMessageModal
        open={dmOpen}
        onClose={() => setDmOpen(false)}
        target={person}
        onSuccess={() => {
          setDmOpen(false)
          nav('/messages/' + userId)
        }}
      />
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-[14px] font-medium ${danger ? 'text-danger' : 'text-cream'} hover:bg-white/[0.04]`}
    >
      {icon}
      {label}
    </button>
  )
}
