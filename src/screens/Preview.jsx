import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit, Share2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl, calcAge } from '../lib/photo'
import { tap } from '../lib/haptic'
import AppHeader from '../components/AppHeader'
import ProfileHeader from '../components/ProfileHeader'
import BottomNav from '../components/BottomNav'
import BrandGlow from '../components/BrandGlow'
import ProfileConnections from '../components/ProfileConnections'
import ProfileAbout from '../components/ProfileAbout'

export default function Preview() {
  const nav = useNavigate()
  const { session, profile } = useAuth()
  const myId = session?.user?.id

  const [photos, setPhotos] = useState([])
  const [interests, setInterests] = useState([])
  const [prompts, setPrompts] = useState([])
  const [reels, setReels] = useState([])
  const [savedReels, setSavedReels] = useState([])
  const [myPosts, setMyPosts] = useState([])
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [matchesCount, setMatchesCount] = useState(0)
  const [activeTab, setActiveTab] = useState("posts")
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
      supabase.from('reels').select('id, video_url, thumbnail_url, caption, created_at')
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
    { id: "posts",       label: "Posts" },
    { id: "about",       label: "About" },
    { id: "connections", label: "Connections" },
    { id: "photos",      label: "Photos" },
    { id: "reels",       label: "Reels" },
    { id: "more",        label: "More" },
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
        <ProfileHeader
          profile={{ ...profile, age: profile?.date_of_birth ? calcAge(profile.date_of_birth) : null }}
          photos={photos}
          isOwn={true}
          coverPhotoPath={profile?.cover_photo_path || null}
          followersCount={followersCount}
          followingCount={followingCount}
          postsCount={myPosts.length}
          matchesCount={matchesCount}
          onMatchesClick={() => nav("/matches")}
          onFollowersClick={() => nav(`/user/${myId}/followers`)}
          onFollowingClick={() => nav(`/user/${myId}/following`)}
          actions={
            <>
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
            </>
          }
        />

        <div className="mt-2 border-b border-white/8">
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
          {activeTab === "posts" && (
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
                <EmptyTab icon="✏️" title="No posts yet" subtitle="Share something from the Feed." />
              ) : (
                <div className="grid grid-cols-3 gap-1 px-1">
                  {myPosts.map((p) => {
                    const url = p.image_path ? supabase.storage.from("community-media").getPublicUrl(p.image_path).data?.publicUrl : null
                    return (
                      <button key={p._source + "-" + p.id} onClick={() => { tap("light"); nav("/feed") }}
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
            photos.length === 0 ? (
              <EmptyTab icon="📸" title="No photos" subtitle="Add photos from Edit profile." />
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

          {activeTab === "about" && <ProfileAbout person={profile} />}

          {activeTab === "connections" && <ProfileConnections userId={myId} />}

          {activeTab === "more" && (
            savedReels.length === 0 ? (
              <EmptyTab icon="🔖" title="Nothing saved" subtitle="Save reels to see them here." />
            ) : (
              <div className="grid grid-cols-3 gap-1 px-1">
                {savedReels.map((r) => (
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
        </div>

        <div style={{ height: 40 }} />
      </div>

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
