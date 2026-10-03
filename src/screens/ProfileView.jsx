import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Heart, Flag, Ban, MoreVertical, X , MessageCircle} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl, calcAge } from '../lib/photo'
import { tap } from '../lib/haptic'
import BrandGlow from '../components/BrandGlow'
import FollowButton from '../components/FollowButton'
import DirectMessageModal from '../components/DirectMessageModal'
import ReportModal from '../components/ReportModal'
import BlockConfirm from '../components/BlockConfirm'

export default function ProfileView() {
  const nav = useNavigate()
  const { userId } = useParams()
  const { session } = useAuth()
  const myId = session?.user?.id
  const isMe = myId === userId

  const [loading, setLoading] = useState(true)
  const [person, setPerson] = useState(null)
  const [photos, setPhotos] = useState([])
  const [interests, setInterests] = useState([])
  const [prompts, setPrompts] = useState([])
  const [myPosts, setMyPosts] = useState([])
  const [reels, setReels] = useState([])
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isMatch, setIsMatch] = useState(false)
  const [myLike, setMyLike] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('posts')
  const [playingReel, setPlayingReel] = useState(null)
  const [viewingPhoto, setViewingPhoto] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [dmOpen, setDmOpen] = useState(false)
  const [canView, setCanView] = useState(true)
  const [canViewMessage, setCanViewMessage] = useState('')
  const [canSeeLocation, setCanSeeLocation] = useState(true)

  const load = useCallback(async () => {
    if (!myId || !userId) return
    setLoading(true); setError('')

    try { await supabase.rpc('record_profile_view', { p_viewed_id: userId }) } catch {}

    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('id, display_name, username, date_of_birth, bio, city, country, is_verified, looking_for, cover_photo_path, profession, education, religion, relationship_status, body_height_cm, languages, body_type, personality, relationship_preference, music_genres, smoker, drinking, partying, exercise, tattoos, diet, pets, children')
      .eq('id', userId)
      .single()

    if (profErr || !prof) {
      setError(profErr?.message || 'Profile not found.')
      setLoading(false)
      return
    }
    setPerson(prof)

    // Enforce profile_visibility
    if (userId !== myId) {
      const { data: allowed } = await supabase.rpc('can_view_profile', {
        viewer: myId,
        owner: userId,
      })
      if (allowed === false) {
        setCanView(false)
        setCanViewMessage('This profile is private')
        setLoading(false)
        return
      }
    }
    setCanView(true)

    // Enforce location visibility
    if (userId !== myId) {
      const { data: locAllowed } = await supabase.rpc('can_see_location', {
        viewer: myId,
        owner: userId,
      })
      setCanSeeLocation(locAllowed !== false)
    } else {
      setCanSeeLocation(true)
    }


    const [photoRes, promptRes, linksRes, reelRes, personalRes, communityRes, f1, f2] = await Promise.all([
      supabase.from('profile_photos').select('storage_path, is_primary, display_order').eq('user_id', userId)
        .order('is_primary', { ascending: false }).order('display_order', { ascending: true }),
      supabase.from('profile_prompts').select('prompt_key, answer, display_order').eq('profile_id', userId)
        .order('display_order', { ascending: true }),
      supabase.from('profile_interests').select('interest_id').eq('profile_id', userId),
      supabase.from('reels').select('id, video_url, thumbnail_url, caption, created_at')
        .eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false }).limit(30),
      supabase.from('user_posts').select('id, content, image_path, created_at')
        .eq('user_id', userId).eq('is_active', true).eq('audience', 'public').order('created_at', { ascending: false }).limit(30),
      supabase.from('community_posts').select('id, content, image_path, created_at')
        .eq('author_id', userId).order('created_at', { ascending: false }).limit(30),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    ])

    setPhotos((photoRes.data || []).map((p) => publicPhotoUrl(p.storage_path)).filter(Boolean))
    setPrompts(promptRes.data || [])
    setReels(reelRes.data || [])
    setFollowersCount(f1.count || 0)
    setFollowingCount(f2.count || 0)

    if (linksRes.data?.length) {
      const ids = linksRes.data.map((l) => l.interest_id)
      const { data: rows } = await supabase.from('interests').select('id, name').in('id', ids)
      setInterests((rows || []).map((r) => r.name))
    } else setInterests([])

    const personal = (personalRes.data || []).map((p) => ({ ...p, _source: 'personal' }))
    const community = (communityRes.data || []).map((p) => ({ ...p, _source: 'community' }))
    setMyPosts([...personal, ...community].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))

    if (!isMe) {
      const lo = myId < userId ? myId : userId
      const hi = myId < userId ? userId : myId
      const [{ data: match }, { data: like }] = await Promise.all([
        supabase.from('matches').select('id').eq('user_one_id', lo).eq('user_two_id', hi).maybeSingle(),
        supabase.from('likes').select('id').eq('user_id', myId).eq('liked_user_id', userId).maybeSingle(),
      ])
      setIsMatch(!!match)
      setMyLike(!!like)
    }

    setLoading(false)
  }, [myId, userId, isMe])

  useEffect(() => { load() }, [load])

  async function handleLike() {
    if (busy || myLike || isMe) return
    setBusy(true); tap('medium')
    const { error: err } = await supabase.rpc('like_user', { target_user_id: userId })
    setBusy(false)
    if (err) { setError(err.message); return }
    setMyLike(true)
  }

  // Fetch connections when the Connections tab is active
  useEffect(() => {
    if (activeTab !== 'connections' || !userId) return
    let cancelled = false
    ;(async () => {
      setConnLoading(true)

      // Followers of this user
      const { data: followerRows } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId)
        .limit(100)
      const followerIds = (followerRows || []).map((r) => r.follower_id)

      // People this user follows
      const { data: followingRows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)
        .limit(100)
      const followingIds = (followingRows || []).map((r) => r.following_id)

      // Matches (both sides)
      const { data: matchRows } = await supabase
        .from('matches')
        .select('user_one_id, user_two_id')
        .or('user_one_id.eq.' + userId + ',user_two_id.eq.' + userId)
        .limit(100)
      const matchIds = (matchRows || []).map((m) => m.user_one_id === userId ? m.user_two_id : m.user_one_id)

      // Fetch profiles + photos for all of them
      const allIds = [...new Set([...followerIds, ...followingIds, ...matchIds])]
      let profMap = new Map(), photoMap = new Map()
      if (allIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name, username, is_verified')
          .in('id', allIds)
        ;(profs || []).forEach((pr) => profMap.set(pr.id, pr))

        const { data: ph } = await supabase
          .from('profile_photos')
          .select('user_id, storage_path, is_primary, display_order')
          .in('user_id', allIds)
          .order('is_primary', { ascending: false })
          .order('display_order', { ascending: true })
        ;(ph || []).forEach((ph2) => { if (!photoMap.has(ph2.user_id)) photoMap.set(ph2.user_id, ph2.storage_path) })
      }
      if (cancelled) return

      const toPerson = (id) => {
        const pr = profMap.get(id)
        if (!pr) return null
        return {
          id,
          display_name: pr.display_name,
          username: pr.username,
          is_verified: pr.is_verified,
          photo_url: photoMap.get(id) ? publicPhotoUrl(photoMap.get(id)) : null,
        }
      }

      setConnections({
        followers: followerIds.map(toPerson).filter(Boolean),
        following: followingIds.map(toPerson).filter(Boolean),
        matches:   matchIds.map(toPerson).filter(Boolean),
      })
      setConnLoading(false)
    })()
    return () => { cancelled = true }
  }, [activeTab, userId])

  if (loading) {
    return (
      <div className="mobile-shell flex items-center justify-center" style={{ position: 'fixed', inset: 0, background: '#0B0B14' }}>
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!canView && !isMe) {
    return (
      <div className="mobile-shell" style={{ position: 'fixed', inset: 0, background: '#0B0B14', display: 'flex', flexDirection: 'column' }}>
        <header className="px-3 py-3 flex items-center gap-2 shrink-0">
          <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
            <ArrowLeft size={20} strokeWidth={2.3} />
          </button>
          <span className="text-cream font-bold text-[15px] flex-1 truncate">{person?.display_name || person?.username || 'Profile'}</span>
        </header>
        <div className="flex-1 grid place-items-center px-6 text-center">
          <div className="max-w-[300px]">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-purple-600 grid place-items-center mx-auto mb-4">
              {photos[0] ? (
                <img src={photos[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-2xl font-black">{(person?.display_name || person?.username || 'U')[0]?.toUpperCase()}</span>
              )}
            </div>
            <p className="text-cream font-black text-[17px] mb-1">{person?.display_name || person?.username}</p>
            <p className="text-muted text-[13px] leading-relaxed mb-6">{canViewMessage || 'This profile is private'}</p>
            <button
              onClick={() => nav('/messages/' + userId)}
              className="h-11 px-5 rounded-full text-white font-bold text-[13.5px] inline-flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
            >
              <MessageCircle size={15} /> Message
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (error || !person) {
    return (
      <div className="mobile-shell flex flex-col items-center justify-center gap-3" style={{ position: 'fixed', inset: 0, background: '#0B0B14' }}>
        <p className="text-danger text-[14px]">{error || 'Profile not found'}</p>
        <button onClick={() => nav(-1)} className="text-purple-300 font-bold text-[13px]">Go back</button>
      </div>
    )
  }

  const tabs = [
    { id: 'posts',       label: 'Posts' },
    { id: 'about',       label: 'About' },
    { id: 'connections', label: 'Connections' },
    { id: 'photos',      label: 'Photos' },
    { id: 'reels',       label: 'Reels' },
    { id: 'more',        label: 'More' },
  ]

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />

      {/* Top bar */}
      <header className="shrink-0 h-12 px-3 flex items-center justify-between"
              style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        {!isMe && (
          <button
            onClick={() => { tap('light'); setMenuOpen(true) }}
            className="w-9 h-9 rounded-full grid place-items-center text-muted"
            aria-label="More"
          >
            <MoreVertical size={20} />
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto pb-10">
        {/* Cover photo */}
        <div className="relative -mx-4" style={{ height: 150 }}>
          {person.cover_photo_path ? (
            <img src={publicPhotoUrl(person.cover_photo_path)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.35) 0%, rgba(236,72,153,0.35) 100%)" }} />
          )}
        </div>

        {/* Header */}
        <div className="px-4 pb-3">
          <div className="flex items-start gap-4 -mt-14 relative">
            <span className="shrink-0 block rounded-full overflow-hidden bg-elevated border-4 relative z-10" style={{ width: 96, height: 96, borderColor: '#0B0B14' }}>
              {photos[0] ? (
                <img src={photos[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full grid place-items-center text-purple-400 font-black text-2xl">
                  {(person.display_name || person.username || '?')[0].toUpperCase()}
                </span>
              )}
            </span>

            <div className="flex-1 min-w-0 pt-16">
              <div className="flex items-center gap-1.5 mb-1">
                <h1 className="text-cream text-[18px] font-extrabold tracking-tight truncate">
                  {person.display_name || person.username}
                  {person.date_of_birth ? `, ${calcAge(person.date_of_birth)}` : ''}
                </h1>
                {person.is_verified && (
                  <span className="w-[16px] h-[16px] rounded-full bg-[#1DA1F2] grid place-items-center shrink-0">
                    <span className="text-white text-[10px] font-black">✓</span>
                  </span>
                )}
              </div>
              <p className="text-muted text-[13px] truncate mb-2">@{person.username || 'user'}</p>

              <div className="flex items-center gap-4">
                <button className="text-left">
                  <p className="text-cream text-[15px] font-extrabold leading-none">{myPosts.length}</p>
                  <p className="text-muted text-[11px] mt-0.5">Posts</p>
                </button>
                <button onClick={() => { tap('light'); nav(`/user/${userId}/followers`) }} className="text-left">
                  <p className="text-cream text-[15px] font-extrabold leading-none">{followersCount}</p>
                  <p className="text-muted text-[11px] mt-0.5">Followers</p>
                </button>
                <button onClick={() => { tap('light'); nav(`/user/${userId}/following`) }} className="text-left">
                  <p className="text-cream text-[15px] font-extrabold leading-none">{followingCount}</p>
                  <p className="text-muted text-[11px] mt-0.5">Following</p>
                </button>
              </div>
            </div>
          </div>

          {(person.bio || (person.city && canSeeLocation)) && (
            <div className="mt-3">
              {person.city && canSeeLocation && (
                <p className="text-muted text-[12.5px] mb-1">📍 {person.city}{person.country ? `, ${person.country}` : ''}</p>
              )}
              {person.bio && (
                <p className="text-cream/90 text-[13.5px] leading-[1.45] whitespace-pre-wrap">{person.bio}</p>
              )}
            </div>
          )}

          {/* Actions */}
          {!isMe && (
            <div className="mt-3 flex items-center gap-2">
              <FollowButton userId={userId} />
              {isMatch ? (
                <button
                  onClick={() => { tap('light'); nav('/messages/' + userId) }}
                  className="flex-1 h-9 rounded-full text-white font-bold text-[13px]"
                  style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
                >
                  Send a message
                </button>
              ) : myLike ? (
                <button disabled className="flex-1 h-9 rounded-full bg-white/[0.06] border border-white/10 text-white/60 font-semibold text-[13px]">
                  Like sent ✓
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { tap('light'); setDmOpen(true) }}
                    className="h-9 px-3 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[12.5px] shrink-0"
                  >
                    Message
                  </button>
                  <button
                    onClick={handleLike}
                    disabled={busy}
                    className="flex-1 h-9 rounded-full text-white font-bold text-[13px] flex items-center justify-center gap-1.5 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
                  >
                    <Heart size={14} strokeWidth={2.6} fill="currentColor" /> Like
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-white/8">
          <div className="flex overflow-x-auto px-4" style={{ scrollbarWidth: 'none' }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { tap('light'); setActiveTab(t.id) }}
                className="shrink-0 px-4 py-2.5 text-[13px] font-bold relative"
                style={{ color: activeTab === t.id ? '#fff' : '#888' }}
              >
                {t.label}
                {activeTab === t.id && (
                  <span className="absolute left-3 right-3 bottom-0 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #EC4899, #A855F7)' }} />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3">
          {activeTab === 'posts' && (
            <>
              {(interests.length > 0 || prompts.length > 0) && (
                <div className="px-4 mb-4 pb-4 border-b border-white/8">
                  {interests.length > 0 && (
                    <div className="mb-4">
                      <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">Interests</p>
                      <div className="flex flex-wrap gap-1.5">
                        {interests.map((n) => (
                          <span key={n} className="px-2.5 py-1 rounded-full text-[12px] font-semibold border border-purple-500/30 text-purple-100" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.20) 0%, rgba(236,72,153,0.10) 100%)' }}>{n}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {prompts.length > 0 && (
                    <div>
                      <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">Prompts</p>
                      <div className="flex flex-col gap-2">
                        {prompts.map((p, i) => (
                          <div key={i} className="rounded-2xl bg-white/[0.04] border border-white/8 p-3">
                            <p className="text-purple-200 text-[11.5px] font-bold mb-1">{p.prompt_key}</p>
                            <p className="text-cream text-[13.5px]">{p.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {myPosts.length === 0 ? (
                <EmptyTab icon="✏️" title="No posts yet" subtitle="When they post something, it shows here." />
              ) : (
                <div className="grid grid-cols-3 gap-1 px-1">
                  {myPosts.map((p) => {
                    const url = p.image_path ? supabase.storage.from('community-media').getPublicUrl(p.image_path).data?.publicUrl : null
                    return (
                      <button key={p._source + '-' + p.id} onClick={() => { tap('light'); nav('/feed') }}
                        className="relative aspect-square rounded-lg overflow-hidden bg-white/[0.04] border border-white/8">
                        {url ? (
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full grid place-items-center p-2">
                            <p className="text-muted text-[10.5px] leading-tight line-clamp-3 text-center">{p.content}</p>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'reels' && (
            reels.length === 0 ? (
              <EmptyTab icon="🎬" title="No reels yet" subtitle="Nothing posted yet." />
            ) : (
              <div className="grid grid-cols-3 gap-1 px-1">
                {reels.map((r) => (
                  <button key={r.id} onClick={() => setPlayingReel(r)} className="relative aspect-[9/16] rounded-lg overflow-hidden bg-black">
                    {r.thumbnail_url ? (
                      <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={r.video_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                    )}
                    <span className="absolute bottom-1 left-1 text-white text-[10px] font-bold bg-black/60 rounded px-1.5 py-0.5">▶</span>
                  </button>
                ))}
              </div>
            )
          )}

          {activeTab === 'about' && (
            <div className="px-4 py-3">
              {person.bio && (
                <AboutSection title="Bio">
                  <p className="text-cream/90 text-[13.5px] leading-[1.55] whitespace-pre-wrap">{person.bio}</p>
                </AboutSection>
              )}

              {(person.profession || person.education) && (
                <AboutSection title="Work & Education">
                  {person.profession && (
                    <AboutRow icon="💼" label="Profession" value={person.profession} />
                  )}
                  {person.education && (
                    <AboutRow icon="🎓" label="Education" value={person.education} />
                  )}
                </AboutSection>
              )}

              {(person.city || person.country) && (
                <AboutSection title="Location">
                  <AboutRow
                    icon="📍"
                    label="Lives in"
                    value={[person.city, person.country].filter(Boolean).join(', ')}
                  />
                </AboutSection>
              )}

              {(person.date_of_birth || person.gender) && (
                <AboutSection title="Basic info">
                  {person.date_of_birth && (
                    <AboutRow icon="🎂" label="Birthday" value={new Date(person.date_of_birth).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })} />
                  )}
                  {person.gender && (
                    <AboutRow icon="👤" label="Gender" value={person.gender} />
                  )}
                  {person.languages?.length > 0 && (
                    <AboutRow icon="🗣️" label="Languages" value={Array.isArray(person.languages) ? person.languages.join(', ') : person.languages} />
                  )}
                </AboutSection>
              )}

              {(person.relationship_status || person.looking_for || person.relationship_preference) && (
                <AboutSection title="Relationship">
                  {person.relationship_status && (
                    <AboutRow icon="💜" label="Status" value={person.relationship_status} />
                  )}
                  {person.looking_for && (
                    <AboutRow icon="🔍" label="Looking for" value={person.looking_for} />
                  )}
                  {person.relationship_preference && (
                    <AboutRow icon="💫" label="Interested in" value={person.relationship_preference} />
                  )}
                </AboutSection>
              )}

              {(person.smoker || person.drinking || person.exercise || person.diet || person.pets || person.children || person.partying) && (
                <AboutSection title="Lifestyle">
                  {person.smoker && <AboutRow icon="🚬" label="Smoking" value={person.smoker} />}
                  {person.drinking && <AboutRow icon="🍷" label="Drinking" value={person.drinking} />}
                  {person.exercise && <AboutRow icon="🏃" label="Exercise" value={person.exercise} />}
                  {person.diet && <AboutRow icon="🥗" label="Diet" value={person.diet} />}
                  {person.partying && <AboutRow icon="🎉" label="Partying" value={person.partying} />}
                  {person.pets && <AboutRow icon="🐾" label="Pets" value={person.pets} />}
                  {person.children && <AboutRow icon="👶" label="Children" value={person.children} />}
                </AboutSection>
              )}

              {(person.body_type || person.personality || person.tattoos || person.body_height_cm) && (
                <AboutSection title="Appearance & Personality">
                  {person.body_height_cm && (
                    <AboutRow icon="📏" label="Height" value={`${person.body_height_cm} cm`} />
                  )}
                  {person.body_type && (
                    <AboutRow icon="💪" label="Body type" value={person.body_type} />
                  )}
                  {person.personality && (
                    <AboutRow icon="✨" label="Personality" value={person.personality} />
                  )}
                  {person.tattoos && (
                    <AboutRow icon="🖋️" label="Tattoos" value={person.tattoos} />
                  )}
                </AboutSection>
              )}

              {person.music_genres?.length > 0 && (
                <AboutSection title="Music">
                  <p className="text-cream/90 text-[13.5px]">
                    {Array.isArray(person.music_genres) ? person.music_genres.join(', ') : person.music_genres}
                  </p>
                </AboutSection>
              )}

              {(!person.bio && !person.profession && !person.education && !person.city && !person.gender && !person.relationship_status && !person.body_type) && (
                <div className="py-12 text-center">
                  <p className="text-cream font-bold text-[15px] mb-1">Nothing to show yet</p>
                  <p className="text-muted text-[13px]">They haven't filled in their details.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'connections' && (
            <div className="px-4 py-3">
              {/* Sub-tabs */}
              <div className="flex gap-1.5 mb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {[
                  { id: 'followers', label: 'Followers', count: connections.followers.length },
                  { id: 'following', label: 'Following', count: connections.following.length },
                  { id: 'matches',   label: 'Matches',   count: connections.matches.length },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { tap('light'); setConnSubTab(t.id) }}
                    className="shrink-0 h-9 px-3.5 rounded-full text-[12.5px] font-bold transition-colors"
                    style={{
                      background: connSubTab === t.id ? 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' : 'rgba(255,255,255,0.05)',
                      border: connSubTab === t.id ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      color: connSubTab === t.id ? '#fff' : '#aaa',
                    }}
                  >
                    {t.label} {t.count > 0 ? '· ' + t.count : ''}
                  </button>
                ))}
              </div>

              {connLoading ? (
                <div className="flex flex-col gap-2">
                  {[0,1,2].map((i) => (
                    <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/8 p-3 h-14 shimmer" />
                  ))}
                </div>
              ) : connections[connSubTab].length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-cream font-bold text-[15px] mb-1">
                    {connSubTab === 'followers' ? 'No followers yet'
                     : connSubTab === 'following' ? 'Not following anyone'
                     : 'No matches yet'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {connections[connSubTab].map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { tap('light'); nav('/profile/' + u.id) }}
                      className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/[0.04] active:opacity-80 text-left"
                    >
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0">
                        {u.photo_url ? (
                          <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (u.display_name || u.username || '?')[0].toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-cream font-semibold text-[14px] truncate flex items-center gap-1.5">
                          {u.display_name || u.username || 'User'}
                          {u.is_verified && (
                            <span className="w-[14px] h-[14px] rounded-full bg-[#1DA1F2] grid place-items-center shrink-0">
                              <span className="text-white text-[9px] font-black">✓</span>
                            </span>
                          )}
                        </p>
                        {u.username && <p className="text-muted text-[11.5px] truncate">@{u.username}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'more' && (
            <div className="px-4 py-12 text-center">
              <p className="text-cream font-bold text-[15px] mb-1">More</p>
              <p className="text-muted text-[13px]">Coming in the next step.</p>
            </div>
          )}

          {activeTab === 'photos' && (
            photos.length === 0 ? (
              <EmptyTab icon="📸" title="No photos" subtitle="No photos on this profile yet." />
            ) : (
              <div className="grid grid-cols-3 gap-1 px-1">
                {photos.map((url, i) => (
                  <button key={i} onClick={() => setViewingPhoto(url)} className="relative aspect-square rounded-lg overflow-hidden bg-black">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        <div style={{ height: 40 }} />
      </div>

      {/* Fullscreen viewers */}
      {playingReel && (
        <div className="fixed inset-0 z-[500] bg-black flex items-center justify-center" onClick={() => setPlayingReel(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full grid place-items-center bg-white/15 text-white z-10" onClick={() => setPlayingReel(null)} aria-label="Close">✕</button>
          <video src={playingReel.video_url} autoPlay loop playsInline controls className="w-full h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {viewingPhoto && (
        <div className="fixed inset-0 z-[500] bg-black flex items-center justify-center" onClick={() => setViewingPhoto(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full grid place-items-center bg-white/15 text-white z-10" onClick={() => setViewingPhoto(null)} aria-label="Close">✕</button>
          <img src={viewingPhoto} alt="" className="w-full h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Options menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-[400] flex items-end" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <div className="flex flex-col gap-2">
              <button onClick={() => { setMenuOpen(false); setReportOpen(true) }} className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left">
                <span className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center"><Flag size={17} className="text-purple-300" /></span>
                <span className="text-cream font-semibold text-[14.5px]">Report</span>
              </button>
              <button onClick={() => { setMenuOpen(false); setBlockOpen(true) }} className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/8 border border-red-500/25 text-left">
                <span className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 grid place-items-center"><Ban size={17} className="text-red-400" /></span>
                <span className="text-cream font-semibold text-[14.5px]">Block</span>
              </button>
              <button onClick={() => setMenuOpen(false)} className="w-full h-11 mt-2 text-muted font-semibold text-[13.5px]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} target={person} />
      <BlockConfirm open={blockOpen} onClose={() => setBlockOpen(false)} target={person} onBlocked={() => nav('/feed', { replace: true })} />
      <DirectMessageModal open={dmOpen} onClose={() => setDmOpen(false)} target={person} onSuccess={() => { setDmOpen(false); nav('/messages/' + userId) }} />
    </div>
  )
}

function AboutSection({ title, children }) {
  return (
    <div className="mb-5">
      <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">{title}</p>
      <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-3.5 flex flex-col gap-2.5">
        {children}
      </div>
    </div>
  )
}

function AboutRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-5 text-center text-[15px] shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-muted text-[11.5px] mb-0.5">{label}</p>
        <p className="text-cream text-[13.5px] leading-snug break-words">{value}</p>
      </div>
    </div>
  )
}

function EmptyTab({ icon, title, subtitle }) {
  return (
    <div className="grid place-items-center py-16 text-center px-6">
      <div>
        <div className="w-14 h-14 rounded-2xl bg-purple-500/12 border border-purple-500/25 grid place-items-center mx-auto mb-3 text-[22px]">{icon}</div>
        <p className="text-cream font-bold text-[15px] mb-1">{title}</p>
        <p className="text-muted text-[13px] leading-relaxed">{subtitle}</p>
      </div>
    </div>
  )
}
