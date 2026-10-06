import ProfileHighlights from '../components/ProfileHighlights'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Pencil, MoreVertical, MapPin, Edit, Share2, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl, calcAge } from '../lib/photo'
import { tap } from '../lib/haptic'
import AppHeader from '../components/AppHeader'
import ProfileHeader from '../components/ProfileHeader'
import BottomNav from '../components/BottomNav'
import BrandGlow from '../components/BrandGlow'
import ProfileConnections from '../components/ProfileConnections'
import ProfilePhotos from '../components/ProfilePhotos'
import ProfilePostCard from '../components/ProfilePostCard'
import ProfileMenuSheet from '../components/ProfileMenuSheet'
import ProfileFriendsStrip from '../components/ProfileFriendsStrip'
import ProfileHobbies from '../components/ProfileHobbies'
import ProfilePersonalDetails from '../components/ProfilePersonalDetails'
import PhotoViewer from '../components/PhotoViewer'
import ReelViewer from '../components/ReelViewer'
import ProfileAbout from '../components/ProfileAbout'

export default function Preview() {
  const nav = useNavigate()
  const { session, profile } = useAuth()
  const myId = session?.user?.id

  const [photos, setPhotos] = useState([])
  const [interests, setInterests] = useState([])
  const [prompts, setPrompts] = useState([])
  const [communities, setCommunities] = useState([])
  const [reels, setReels] = useState([])
  const [savedReels, setSavedReels] = useState([])
  const [myPosts, setMyPosts] = useState([])
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [matchesCount, setMatchesCount] = useState(0)
  const [activeTab, setActiveTab] = useState("all")
  const [reactionCounts, setReactionCounts] = useState(new Map())
  const [myReactions, setMyReactions] = useState(new Set())
  const [myReactionTypes, setMyReactionTypes] = useState(new Map())
  const [commentCounts, setCommentCounts] = useState(new Map())
  const [menuOpen, setMenuOpen] = useState(false)
  const [playingReel, setPlayingReel] = useState(null)
  const [viewingPhoto, setViewingPhoto] = useState(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!myId) return

    const [photoRes, promptRes, linksRes, reelRes, saveRes, personalRes, communityRes, f1, f2, f3] = await Promise.all([
      supabase.from('profile_photos').select('storage_path, is_primary, display_order').eq('user_id', myId)
        .order('is_primary', { ascending: false }).order('display_order', { ascending: true }),
      supabase.from('profile_prompts').select('prompt_key, answer, display_order').eq('profile_id', myId)
        .order('display_order', { ascending: true }),
      supabase.from('profile_interests').select('interest_id').eq('profile_id', myId),
      supabase.from('reels').select('id, user_id, video_url, thumbnail_url, caption, created_at, allow_comments, clips, trim_start, trim_end, mirrored, filter_id, text_overlays, sticker_overlays, view_count, location')
        .eq('user_id', myId).eq('is_active', true).order('created_at', { ascending: false }).limit(30),
      supabase.from('reel_saves').select('reel_id').eq('user_id', myId),
      supabase.from('user_posts').select('id, content, image_path, created_at')
        .eq('user_id', myId).eq('is_active', true).order('created_at', { ascending: false }).limit(30),
      supabase.from('community_posts').select('id, content, image_path, community_id, created_at')
        .eq('author_id', myId).order('created_at', { ascending: false }).limit(30),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', myId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', myId),
      supabase.from('matches').select('*', { count: 'exact', head: true }).or(`user_one_id.eq.${myId},user_two_id.eq.${myId}`),
    ])

    setPhotos((photoRes.data || []).map((p) => publicPhotoUrl(p.storage_path)).filter(Boolean))
    setPrompts(promptRes.data || [])
    setReels(reelRes.data || [])
    setFollowersCount(f1.count || 0)
    setFollowingCount(f2.count || 0)
    setMatchesCount(f3?.count || 0)

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
        .eq('user_id', myId)
        .limit(20)
      setCommunities((cmRows || []).map((r) => r.communities).filter(Boolean))
    } catch { setCommunities([]) }

    const savedIds = (saveRes.data || []).map((r) => r.reel_id)
    if (savedIds.length > 0) {
      const { data: saved } = await supabase.from('reels')
        .select('id, video_url, thumbnail_url, caption, created_at')
        .in('id', savedIds).eq('is_active', true).order('created_at', { ascending: false }).limit(30)
      setSavedReels(saved || [])
    } else setSavedReels([])

    const personal = (personalRes.data || []).map((p) => ({ ...p, _source: 'personal' }))
    const community = (communityRes.data || []).map((p) => ({ ...p, _source: 'community' }))
    setMyPosts([...personal, ...community].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))

    // Load reactions + comments
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
          if (r.user_id === myId) { mine.add(k); mineTypes.set(k, r.reaction || "❤️") }
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
          if (r.user_id === myId) { mine.add(k); mineTypes.set(k, r.reaction || "❤️") }
        })
        ;(cmtsRes.data || []).forEach((c) => {
          const k = "community:" + c.post_id
          cmtCounts.set(k, (cmtCounts.get(k) || 0) + 1)
        })
      }
      setReactionCounts(counts)
      setMyReactions(mine)
      setMyReactionTypes(mineTypes)
      setCommentCounts(cmtCounts)
    } catch (e) { console.warn("preview reactions load failed", e) }
  }, [myId])

  useEffect(() => { load() }, [load])

  async function share() {
    tap('light')
    const url = window.location.origin
    const text = `Check out my Nakubonye profile — ${url}`
    if (navigator.share) {
      try { await navigator.share({ title: 'Nakubonye', text }) } catch {}
    } else {
      try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch {}
    }
  }

  const tabs = [
    { id: "all",    label: "All" },
    { id: "photos", label: "Photos" },
    { id: "reels",  label: "Reels" },
  ]

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />
      <AppHeader />

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Cover */}
        <div className="relative -mx-4" style={{ height: 150 }}>
          {profile?.cover_photo_path ? (
            <img src={publicPhotoUrl(profile.cover_photo_path)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.35) 0%, rgba(236,72,153,0.35) 100%)" }} />
          )}
        </div>

        {/* Top bar — name + edit + search + ⋯ */}
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted shrink-0" aria-label="Back">
            <ArrowLeft size={20} strokeWidth={2.3} />
          </button>
          <span className="text-cream font-extrabold text-[17px] truncate flex-1 min-w-0">
            {profile?.display_name || profile?.username || "Your profile"}
          </span>
          <button
            onClick={() => { tap('light'); nav('/me/edit') }}
            className="w-9 h-9 rounded-full grid place-items-center text-muted shrink-0"
            aria-label="Edit profile"
          >
            <Pencil size={18} />
          </button>
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
        </div>

        {/* Avatar centered */}
        <div className="flex justify-center -mt-16 relative z-10">
          <div className="relative">
            <span className="block w-32 h-32 rounded-full overflow-hidden bg-elevated border-4" style={{ borderColor: '#0B0B14' }}>
              {photos[0] ? (
                <img src={photos[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full grid place-items-center text-purple-400 font-black text-3xl">
                  {(profile?.display_name || profile?.username || '?')[0].toUpperCase()}
                </span>
              )}
            </span>
            <span className="absolute bottom-4 right-4 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0B0B14]" />
          </div>
        </div>

        {/* Name */}
        <div className="flex items-center justify-center gap-1.5 mt-3 px-4">
          <h1 className="text-cream text-[22px] font-extrabold tracking-tight text-center">
            {profile?.display_name || profile?.username}
          </h1>
          {profile?.is_verified && (
            <span className="w-[16px] h-[16px] rounded-full bg-[#1DA1F2] grid place-items-center shrink-0">
              <span className="text-white text-[10px] font-black">✓</span>
            </span>
          )}
        </div>

        {/* Headline (profession · education) */}
        {(() => {
          const parts = []
          if (profile?.profession) parts.push(profile.profession)
          if (profile?.education) parts.push(profile.education)
          const line = parts.slice(0, 2).join(' · ')
          return line ? (
            <p className="text-cream/85 text-[13.5px] text-center mt-2 px-6 leading-snug">{line}</p>
          ) : null
        })()}

        {/* Stats */}
        <div className="flex items-center justify-center gap-2 mt-3 text-[13.5px]">
          <button onClick={() => { tap('light'); nav(`/user/${myId}/followers`) }} className="text-cream font-bold active:opacity-70">
            {followersCount} follower{followersCount === 1 ? "" : "s"}
          </button>
          <span className="text-muted">·</span>
          <button onClick={() => { tap('light'); nav(`/user/${myId}/following`) }} className="text-cream font-bold active:opacity-70">
            {followingCount} following
          </button>
          <span className="text-muted">·</span>
          <span className="text-cream font-bold">{myPosts.length} post{myPosts.length === 1 ? "" : "s"}</span>
        </div>

        {/* Location pill */}
        {profile?.city && (
          <div className="flex justify-center mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-white/[0.06] text-cream text-[12.5px] font-semibold">
              <MapPin size={11} /> {profile.city}{profile.country ? `, ${profile.country}` : ''}
            </span>
          </div>
        )}

        {/* Bio */}
        {profile?.bio && (
          <p className="text-cream/85 text-[13.5px] leading-snug text-center px-6 mt-3 whitespace-pre-wrap">
            {profile.bio}
          </p>
        )}

        {/* Own action buttons */}
        <div className="flex items-center gap-2 mt-4 px-4">
          <button
            onClick={() => { tap('light'); nav('/me/edit') }}
            className="flex-1 h-9 rounded-full bg-white/[0.08] border border-white/12 text-cream font-bold text-[13px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
          >
            <Edit size={14} /> Edit profile
          </button>
          <button
            onClick={share}
            className="flex-1 h-9 rounded-full bg-white/[0.08] border border-white/12 text-cream font-bold text-[13px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
          >
            <Share2 size={14} /> {copied ? 'Copied' : 'Share'}
          </button>
        </div>

        {/* Highlights */}
        <ProfileHighlights userId={myId} isOwn={true} />

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
          {activeTab === "all" && (
            <>
              <ProfilePersonalDetails person={profile} isMe={true} />

              <ProfileHobbies interests={interests} isMe={true} />

              <ProfileFriendsStrip userId={myId} isMe={true} />

              <div className="flex flex-col">
                <h2 className="px-4 pt-3 pb-2 text-cream font-extrabold text-[17px]">Posts</h2>

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
                </div>

                {myPosts.length === 0 ? (
                  <EmptyTab icon="✏️" title="No posts yet" subtitle="Share something from the Feed." />
                ) : (
                  <div className="flex flex-col">
                    {myPosts.map((p) => (
                      <ProfilePostCard
                        key={p._source + "-" + p.id}
                        post={p}
                        authorProfile={profile}
                        authorPhoto={photos[0]}
                        isMe={true}
                        onOpenMenu={() => {}}
                        reactionCount={reactionCounts.get(p._source + ":" + p.id) || 0}
                        liked={myReactions.has(p._source + ":" + p.id)}
                        reactionEmoji={myReactionTypes.get(p._source + ":" + p.id) || "❤️"}
                        commentCount={commentCounts.get(p._source + ":" + p.id) || 0}
                        onToggleLike={async () => {
                          const key = p._source + ":" + p.id
                          const isLiked = myReactions.has(key)
                          const nextMine = new Set(myReactions)
                          const nextCounts = new Map(reactionCounts)
                          const nextTypes = new Map(myReactionTypes)
                          const table = p._source === "personal" ? "user_post_likes" : "community_post_reactions"
                          if (isLiked) {
                            nextMine.delete(key); nextTypes.delete(key)
                            nextCounts.set(key, Math.max(0, (nextCounts.get(key) || 1) - 1))
                            setMyReactions(nextMine); setMyReactionTypes(nextTypes); setReactionCounts(nextCounts)
                            await supabase.from(table).delete().eq("post_id", p.id).eq("user_id", myId)
                          } else {
                            nextMine.add(key); nextTypes.set(key, "❤️")
                            nextCounts.set(key, (nextCounts.get(key) || 0) + 1)
                            setMyReactions(nextMine); setMyReactionTypes(nextTypes); setReactionCounts(nextCounts)
                            await supabase.from(table).insert({ post_id: p.id, user_id: myId, reaction: "❤️" })
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "reels" && (
            reels.length === 0 ? (
              <EmptyTab icon="🎬" title="No reels yet" subtitle="Create one from the Feed." />
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

          {activeTab === "photos" && (
            <ProfilePhotos userId={myId} onPhotoClick={setViewingPhoto} emptySubtitle="Add photos from Edit profile." />
          )}

        </div>

        <div style={{ height: 40 }} />
      </div>

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
        isMe={true}
        userId={myId}
        person={profile}
      />

      <BottomNav />
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
