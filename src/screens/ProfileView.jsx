import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Heart, Flag, Ban, MoreVertical, X , MessageCircle, Search, Pencil, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl, calcAge } from '../lib/photo'
import { tap } from '../lib/haptic'
import BrandGlow from '../components/BrandGlow'
import ProfileConnections from '../components/ProfileConnections'
import ProfileIntro from '../components/ProfileIntro'
import ProfilePhotos from '../components/ProfilePhotos'
import ProfileHighlights from '../components/ProfileHighlights'
import ProfileFriendsStrip from '../components/ProfileFriendsStrip'
import ProfileHobbies from '../components/ProfileHobbies'
import ProfilePersonalDetails from '../components/ProfilePersonalDetails'
import ProfileMenuSheet from '../components/ProfileMenuSheet'
import ResharedPost from '../components/ResharedPost'
import ProfilePostCard from '../components/ProfilePostCard'
import MutualConnections from '../components/MutualConnections'
import PhotoViewer from '../components/PhotoViewer'
import ReelViewer from '../components/ReelViewer'
import ProfileAbout from '../components/ProfileAbout'
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
  const [communities, setCommunities] = useState([])
  const [myPosts, setMyPosts] = useState([])
  const [profileReactionCounts, setProfileReactionCounts] = useState(new Map())
  const [profileMyReactions, setProfileMyReactions] = useState(new Set())
  const [profileMyReactionTypes, setProfileMyReactionTypes] = useState(new Map())
  const [profileCommentCounts, setProfileCommentCounts] = useState(new Map())
  const [profileTopReactors, setProfileTopReactors] = useState(new Map())  // key → [{name, emoji}]
  const [reels, setReels] = useState([])
  const [followersCount, setFollowersCount] = useState(0)
  const [followedBy, setFollowedBy] = useState({ people: [], more: 0 })
  const [followingCount, setFollowingCount] = useState(0)
  const [isMatch, setIsMatch] = useState(false)
  const [myLike, setMyLike] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [postsFilter, setPostsFilter] = useState('all')
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
      supabase.from('reels').select('id, user_id, video_url, thumbnail_url, caption, created_at, allow_comments, clips, trim_start, trim_end, mirrored, filter_id, text_overlays, sticker_overlays, view_count, location')
        .eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false }).limit(30),
      supabase.from('user_posts').select('id, content, image_path, created_at')
        .eq('user_id', userId).eq('is_active', true).eq('audience', 'public').order('created_at', { ascending: false }).limit(30),
      supabase.from('community_posts').select('id, content, image_path, created_at, pinned_until')
        .eq('author_id', userId).order('created_at', { ascending: false }).limit(30),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    ])

    setPhotos((photoRes.data || []).map((p) => publicPhotoUrl(p.storage_path)).filter(Boolean))
    setPrompts(promptRes.data || [])
    setReels(reelRes.data || [])
    setFollowersCount(f1.count || 0)
    setFollowingCount(f2.count || 0)

    // Followed-by: people I follow who also follow this user
    if (userId !== myId) {
      try {
        const [myFollowsRes, theirFollowersRes] = await Promise.all([
          supabase.from('follows').select('following_id').eq('follower_id', myId).limit(500),
          supabase.from('follows').select('follower_id').eq('following_id', userId).limit(500),
        ])
        const myFollowSet = new Set((myFollowsRes.data || []).map((r) => r.following_id))
        const sharedIds = (theirFollowersRes.data || [])
          .map((r) => r.follower_id)
          .filter((id) => myFollowSet.has(id) && id !== myId && id !== userId)

        if (sharedIds.length > 0) {
          const top = sharedIds.slice(0, 3)
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, display_name, username')
            .in('id', top)
          const pMap = new Map((profs || []).map((p) => [p.id, p]))
          const people = top.map((id) => pMap.get(id)).filter(Boolean)
          setFollowedBy({ people, more: Math.max(0, sharedIds.length - people.length) })
        } else {
          setFollowedBy({ people: [], more: 0 })
        }
      } catch (e) { console.warn('followedBy failed', e) }
    }

    if (linksRes.data?.length) {
      const ids = linksRes.data.map((l) => l.interest_id)
      const { data: rows } = await supabase.from('interests').select('id, name').in('id', ids)
      setInterests((rows || []).map((r) => r.name))
    } else setInterests([])

    // Communities (best-effort)
    try {
      const { data: cmRows } = await supabase
        .from('community_memberships')
        .select('community_id, communities(id, name, slug, emoji, cover_color)')
        .eq('user_id', userId)
        .limit(20)
      setCommunities((cmRows || []).map((r) => r.communities).filter(Boolean))
    } catch { setCommunities([]) }

    const personal = (personalRes.data || []).map((p) => ({ ...p, _source: 'personal' }))
    const community = (communityRes.data || []).map((p) => ({ ...p, _source: 'community' }))
    setMyPosts([...personal, ...community].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))

    // Load reactions + comments for these posts
    try {
      const personalIds = personal.map((p) => p.id)
      const communityIds = community.map((p) => p.id)
      const counts = new Map()
      const mine = new Set()
      const mineTypes = new Map()
      const cmtCounts = new Map()

      if (personalIds.length > 0) {
        const [likesRes, cmtsRes] = await Promise.all([
          supabase.from("user_post_likes").select("post_id, user_id, reaction").in("post_id", personalIds),
          supabase.from("user_post_comments").select("post_id").in("post_id", personalIds).is("deleted_at", null),
        ])
        ;(likesRes.data || []).forEach((r) => {
          const k = "personal:" + r.post_id
          counts.set(k, (counts.get(k) || 0) + 1)
          if (r.user_id === myId) {
            mine.add(k)
            mineTypes.set(k, r.reaction || "❤️")
          }
        })
        ;(cmtsRes.data || []).forEach((c) => {
          const k = "personal:" + c.post_id
          cmtCounts.set(k, (cmtCounts.get(k) || 0) + 1)
        })
      }

      if (communityIds.length > 0) {
        const [likesRes, cmtsRes] = await Promise.all([
          supabase.from("community_post_reactions").select("post_id, user_id, reaction").in("post_id", communityIds),
          supabase.from("community_post_comments").select("post_id").in("post_id", communityIds).is("deleted_at", null),
        ])
        ;(likesRes.data || []).forEach((r) => {
          const k = "community:" + r.post_id
          counts.set(k, (counts.get(k) || 0) + 1)
          if (r.user_id === myId) {
            mine.add(k)
            mineTypes.set(k, r.reaction || "❤️")
          }
        })
        ;(cmtsRes.data || []).forEach((c) => {
          const k = "community:" + c.post_id
          cmtCounts.set(k, (cmtCounts.get(k) || 0) + 1)
        })
      }

      setProfileReactionCounts(counts)
      setProfileMyReactions(mine)
      setProfileMyReactionTypes(mineTypes)
      setProfileCommentCounts(cmtCounts)

      // Fetch top 3 reactor names per post (own profile side)
      const topReactors = new Map()
      if (personalIds.length > 0) {
        const { data: personalLikes } = await supabase
          .from("user_post_likes")
          .select("post_id, user_id, reaction, created_at")
          .in("post_id", personalIds)
          .order("created_at", { ascending: false })
        const reactorIds = [...new Set((personalLikes || []).map((r) => r.user_id))].slice(0, 100)
        let profMap = new Map()
        if (reactorIds.length > 0) {
          const { data: profs } = await supabase.from("profiles").select("id, display_name, username").in("id", reactorIds)
          ;(profs || []).forEach((x) => profMap.set(x.id, x))
        }
        ;(personalLikes || []).forEach((r) => {
          const k = "personal:" + r.post_id
          if (!topReactors.has(k)) topReactors.set(k, [])
          const arr = topReactors.get(k)
          if (arr.length < 3) arr.push({ name: profMap.get(r.user_id)?.display_name || profMap.get(r.user_id)?.username || "Someone", emoji: r.reaction || "❤️", userId: r.user_id })
        })
      }
      if (communityIds.length > 0) {
        const { data: commLikes } = await supabase
          .from("community_post_reactions")
          .select("post_id, user_id, reaction, created_at")
          .in("post_id", communityIds)
          .order("created_at", { ascending: false })
        const reactorIds = [...new Set((commLikes || []).map((r) => r.user_id))].slice(0, 100)
        let profMap = new Map()
        if (reactorIds.length > 0) {
          const { data: profs } = await supabase.from("profiles").select("id, display_name, username").in("id", reactorIds)
          ;(profs || []).forEach((x) => profMap.set(x.id, x))
        }
        ;(commLikes || []).forEach((r) => {
          const k = "community:" + r.post_id
          if (!topReactors.has(k)) topReactors.set(k, [])
          const arr = topReactors.get(k)
          if (arr.length < 3) arr.push({ name: profMap.get(r.user_id)?.display_name || profMap.get(r.user_id)?.username || "Someone", emoji: r.reaction || "❤️", userId: r.user_id })
        })
      }
      setProfileTopReactors(topReactors)
    } catch (e) { console.warn("profile reactions load failed", e) }

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
    { id: 'all',    label: 'All' },
    { id: 'photos', label: 'Photos' },
    { id: 'reels',  label: 'Reels' },
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
      <header className="shrink-0 h-12 px-3 flex items-center gap-2"
              style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>

        <span className="text-cream font-extrabold text-[17px] truncate flex-1 min-w-0">
          {person?.display_name || person?.username || "Profile"}
        </span>

        {isMe && (
          <button
            onClick={() => { tap('light'); nav('/me/edit') }}
            className="w-9 h-9 rounded-full grid place-items-center text-muted shrink-0"
            aria-label="Edit profile"
          >
            <Pencil size={18} />
          </button>
        )}

        <button
          onClick={() => { tap('light'); nav('/search') }}
          className="w-9 h-9 rounded-full grid place-items-center text-muted shrink-0"
          aria-label="Search"
        >
          <Search size={19} />
        </button>

        <button
          onClick={() => { tap('light'); setMenuOpen(true) }}
          className="w-9 h-9 rounded-full grid place-items-center text-muted shrink-0"
          aria-label="More"
        >
          <MoreVertical size={20} />
        </button>
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

        {/* Header — centered Facebook layout */}
        <div className="flex justify-center -mt-16 relative z-10">
          <div className="relative">
            <span className="block w-32 h-32 rounded-full overflow-hidden bg-elevated border-4" style={{ borderColor: '#0B0B14' }}>
              {photos[0] ? (
                <img src={photos[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full grid place-items-center text-purple-400 font-black text-3xl">
                  {(person.display_name || person.username || '?')[0].toUpperCase()}
                </span>
              )}
            </span>
            <span className="absolute bottom-4 right-4 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0B0B14]" />
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-3 px-4">
          <h1 className="text-cream text-[22px] font-extrabold tracking-tight text-center">
            {person.display_name || person.username}
          </h1>
          {person.is_verified && (
            <span className="w-[16px] h-[16px] rounded-full bg-[#1DA1F2] grid place-items-center shrink-0">
              <span className="text-white text-[10px] font-black">✓</span>
            </span>
          )}
        </div>

        {(() => {
          const parts = []
          if (person.profession) parts.push(person.profession)
          if (person.education) parts.push(person.education)
          const line = parts.slice(0, 2).join(' · ')
          return line ? (
            <p className="text-cream/85 text-[13.5px] text-center mt-2 px-6 leading-snug">{line}</p>
          ) : null
        })()}

        <div className="flex items-center justify-center gap-2 mt-3 text-[13.5px]">
          <button onClick={() => { tap('light'); nav(`/user/${userId}/followers`) }} className="text-cream font-bold active:opacity-70">
            {followersCount} follower{followersCount === 1 ? "" : "s"}
          </button>
          <span className="text-muted">·</span>
          <button onClick={() => { tap('light'); nav(`/user/${userId}/following`) }} className="text-cream font-bold active:opacity-70">
            {followingCount} following
          </button>
          <span className="text-muted">·</span>
          <span className="text-cream font-bold">{myPosts.length} post{myPosts.length === 1 ? "" : "s"}</span>
        </div>

        {person.city && canSeeLocation && (
          <div className="flex justify-center mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-white/[0.06] text-cream text-[12.5px] font-semibold">
              <MapPin size={11} /> {person.city}{person.country ? `, ${person.country}` : ''}
            </span>
          </div>
        )}

        {person.bio && (
          <p className="text-cream/85 text-[13.5px] leading-snug text-center px-6 mt-3 whitespace-pre-wrap">
            {person.bio}
          </p>
        )}

        {!isMe && followedBy.people.length > 0 && (
          <div className="flex flex-col items-center mt-4 px-4">
            <div className="flex -space-x-2 mb-2">
              {followedBy.people.slice(0, 3).map((p) => (
                <span key={p.id} className="w-7 h-7 rounded-full overflow-hidden bg-purple-600 border-2 border-[#0B0B14] grid place-items-center text-white text-[10px] font-black">
                  {(p.display_name || p.username || "?")[0].toUpperCase()}
                </span>
              ))}
            </div>
            <p className="text-muted text-[12.5px] text-center leading-snug">
              Followed by{" "}
              <span className="text-cream font-semibold">
                {followedBy.people.map((p) => p.display_name || p.username).join(", ")}
              </span>
              {followedBy.more > 0 ? ` and ${followedBy.more} other${followedBy.more === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        )}

        {!isMe && (
          <div className="flex items-center gap-2 mt-4 px-4">
            <div className="flex-1">
              <FollowButton userId={userId} />
            </div>
            {isMatch ? (
              <button
                onClick={() => { tap('light'); nav('/messages/' + userId) }}
                className="flex-1 h-9 rounded-full text-white font-bold text-[13px]"
                style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
              >Message</button>
            ) : myLike ? (
              <button disabled className="flex-1 h-9 rounded-full bg-white/[0.06] border border-white/10 text-white/60 font-semibold text-[13px]">
                Like sent ✓
              </button>
            ) : (
              <>
                <button
                  onClick={() => { tap('light'); setDmOpen(true) }}
                  className="h-9 px-3 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[12.5px] shrink-0"
                >Message</button>
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
          <ProfileHighlights userId={userId} isOwn={isMe} />

          {!isMe && <MutualConnections userId={userId} myId={myId} />}

        {/* Tabs — sticky below top bar, flat text */}
        <div className="border-b border-white/8 sticky top-0 z-20" style={{ background: '#0B0B14' }}>
          <div className="flex px-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { tap('light'); setActiveTab(t.id) }}
                className="shrink-0 flex-1 max-w-[140px] px-3 py-3 text-[13.5px] font-semibold relative"
                style={{ color: activeTab === t.id ? '#EC4899' : '#888' }}
              >
                {t.label}
                {activeTab === t.id && (
                  <span className="absolute left-3 right-3 bottom-0 h-[2px] rounded-full" style={{ background: '#EC4899' }} />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3">
          {activeTab === 'all' && (
            <>
              <ProfilePersonalDetails person={person} isMe={isMe} />

              <ProfileHobbies interests={interests} isMe={isMe} />

              <ProfileFriendsStrip userId={userId} isMe={isMe} />


              {/* Featured — pinned posts */}
              {(() => {
                const now = Date.now()
                const pinned = myPosts.filter((p) => p.pinned_until && new Date(p.pinned_until).getTime() > now)
                if (pinned.length === 0) return null
                return (
                  <div className="px-4 mb-4">
                    <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">Featured</p>
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                      {pinned.slice(0, 6).map((p) => {
                        const url = p.image_path ? supabase.storage.from('community-media').getPublicUrl(p.image_path).data?.publicUrl : null
                        return (
                          <button
                            key={p._source + '-' + p.id}
                            onClick={() => { tap('light'); nav('/feed') }}
                            className="shrink-0 w-24 h-32 rounded-xl overflow-hidden bg-white/[0.04] border border-white/8 relative"
                          >
                            {url ? (
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full grid place-items-center p-2">
                                <p className="text-muted text-[10.5px] leading-tight line-clamp-4 text-center">{p.content}</p>
                              </div>
                            )}
                            <span className="absolute top-1 right-1 text-[10px] bg-black/60 rounded px-1.5 py-0.5 text-white font-bold">📌</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Filter pills — Facebook-style */}
              <div className="flex gap-1.5 px-4 mb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {[
                  { id: 'all',    label: 'All' },
                  { id: 'photos', label: 'Photos' },
                  { id: 'text',   label: 'Text' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => { tap('light'); setPostsFilter(f.id) }}
                    className="shrink-0 h-8 px-3.5 rounded-full text-[12px] font-bold transition-colors"
                    style={{
                      background: postsFilter === f.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                      color: postsFilter === f.id ? '#fff' : '#888',
                      border: postsFilter === f.id ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {(() => {
                const filtered = myPosts.filter((p) => {
                  if (postsFilter === 'photos') return !!p.image_path
                  if (postsFilter === 'text')   return !p.image_path
                  return true
                })
                if (filtered.length === 0) {
                  return <EmptyTab icon="✏️" title="No posts yet" subtitle="When they post something, it shows here." />
                }
                return (
                  <div className="flex flex-col">
                    {/* Posts section header */}
                    <h2 className="px-4 pt-3 pb-2 text-cream font-extrabold text-[17px]">Posts</h2>

                    {/* Composer pill — own profile only */}
                    {isMe && (
                      <div className="px-4 pb-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { tap("light"); nav("/create") }}
                            className="flex-1 h-11 rounded-full bg-white/[0.06] border border-white/8 px-4 text-left text-muted text-[14px]"
                          >
                            What's on your mind?
                          </button>
                          <button
                            onClick={() => { tap("light"); nav("/create") }}
                            className="w-11 h-11 rounded-full grid place-items-center bg-white/[0.06] border border-white/8"
                            aria-label="Add photo"
                          >
                            <span className="text-[18px]">🖼️</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2.5 pl-1">
                          {[
                            { emoji: "🖼️", label: "Photo",   path: "/create" },
                            { emoji: "🎬", label: "Reels",   path: "/create" },
                            { emoji: "💜", label: "Life event", path: "/create" },
                          ].map((c) => (
                            <button
                              key={c.label}
                              onClick={() => { tap("light"); nav(c.path) }}
                              className="flex-1 h-8 rounded-lg flex items-center justify-center gap-1.5 text-cream text-[12.5px] font-bold active:bg-white/[0.04]"
                            >
                              <span>{c.emoji}</span> {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Post cards */}
                    <div className="flex flex-col">
                      {filtered.map((p) => (
                        <ProfilePostCard
                          key={p._source + '-' + p.id}
                          post={p}
                          authorProfile={person}
                          authorPhoto={photos[0]}
                          isMe={isMe}
                          onOpenMenu={() => {}}
                          reactionCount={profileReactionCounts.get(p._source + ":" + p.id) || 0}
                          liked={profileMyReactions.has(p._source + ":" + p.id)}
                          reactionEmoji={profileMyReactionTypes.get(p._source + ":" + p.id) || "❤️"}
                          commentCount={profileCommentCounts.get(p._source + ":" + p.id) || 0}
                          topReactors={profileTopReactors.get(p._source + ":" + p.id) || []}
                          onToggleLike={async () => {
                            const key = p._source + ":" + p.id
                            const isLiked = profileMyReactions.has(key)
                            const nextMine = new Set(profileMyReactions)
                            const nextCounts = new Map(profileReactionCounts)
                            const nextTypes = new Map(profileMyReactionTypes)
                            const table = p._source === "personal" ? "user_post_likes" : "community_post_reactions"
                            if (isLiked) {
                              nextMine.delete(key)
                              nextTypes.delete(key)
                              nextCounts.set(key, Math.max(0, (nextCounts.get(key) || 1) - 1))
                              setProfileMyReactions(nextMine)
                              setProfileMyReactionTypes(nextTypes)
                              setProfileReactionCounts(nextCounts)
                              await supabase.from(table).delete().eq("post_id", p.id).eq("user_id", myId)
                            } else {
                              nextMine.add(key)
                              nextTypes.set(key, "❤️")
                              nextCounts.set(key, (nextCounts.get(key) || 0) + 1)
                              setProfileMyReactions(nextMine)
                              setProfileMyReactionTypes(nextTypes)
                              setProfileReactionCounts(nextCounts)
                              const row = p._source === "personal"
                                ? { post_id: p.id, user_id: myId, reaction: "❤️" }
                                : { post_id: p.id, user_id: myId, reaction: "❤️" }
                              await supabase.from(table).insert(row)
                            }
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )
              })()}
            </>
          )}

          {activeTab === 'reels' && (
            reels.length === 0 ? (
              <EmptyTab icon="🎬" title="No reels yet" subtitle="Nothing posted yet." />
            ) : (
              <div className="flex flex-col">
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <h2 className="text-cream font-extrabold text-[17px]">Reels</h2>
                  <span className="text-muted text-[12.5px]">{reels.length}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 px-1 pb-4">
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
              </div>
            )
          )}

          {activeTab === 'about' && <ProfileAbout person={person} />}

          {activeTab === 'connections' && <ProfileConnections userId={userId} />}

          {activeTab === 'more' && (
            <div className="px-4 py-3">
              {interests.length > 0 && (
                <div className="mb-5">
                  <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">Interests</p>
                  <div className="flex flex-wrap gap-1.5">
                    {interests.map((n) => (
                      <span
                        key={n}
                        className="px-2.5 py-1 rounded-full text-[12px] font-semibold border border-purple-500/30 text-purple-100"
                        style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.20) 0%, rgba(236,72,153,0.10) 100%)' }}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {prompts.length > 0 && (
                <div className="mb-5">
                  <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">Prompts</p>
                  <div className="flex flex-col gap-2">
                    {prompts.map((pr, i) => (
                      <div key={i} className="rounded-2xl bg-white/[0.04] border border-white/8 p-3">
                        <p className="text-purple-200 text-[11.5px] font-bold mb-1">{pr.prompt_key}</p>
                        <p className="text-cream text-[13.5px] leading-snug">{pr.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {communities.length > 0 && (
                <div className="mb-5">
                  <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">Communities</p>
                  <div className="flex flex-col gap-1">
                    {communities.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { tap('light'); nav('/community/' + (c.slug || c.id)) }}
                        className="flex items-center gap-3 p-2 rounded-2xl bg-white/[0.03] border border-white/8 text-left active:opacity-80"
                      >
                        <span className="w-10 h-10 rounded-xl grid place-items-center text-[18px] shrink-0" style={{ background: c.cover_color || 'rgba(168,85,247,0.25)' }}>
                          {c.emoji || '🌐'}
                        </span>
                        <span className="flex-1 min-w-0 text-cream font-semibold text-[13.5px] truncate">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {interests.length === 0 && prompts.length === 0 && communities.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-cream font-bold text-[15px] mb-1">Nothing here yet</p>
                  <p className="text-muted text-[13px]">Their interests and prompts will show up here.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'photos' && (
            <ProfilePhotos userId={userId} onPhotoClick={setViewingPhoto} emptySubtitle="No photos on this profile yet." />
          )}
        </div>

        <div style={{ height: 40 }} />
      </div>

      {/* Fullscreen viewers */}
      {playingReel && (
        <ReelViewer
          reel={playingReel}
          currentUserId={myId}
          onClose={() => setPlayingReel(null)}
        />
      )}

      {viewingPhoto && (
        <PhotoViewer
          photo={viewingPhoto}
          currentUserId={myId}
          onClose={() => setViewingPhoto(null)}
        />
      )}

      <ProfileMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        isMe={isMe}
        userId={userId}
        person={person}
        onReport={() => setReportOpen(true)}
        onBlock={() => setBlockOpen(true)}
      />

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
