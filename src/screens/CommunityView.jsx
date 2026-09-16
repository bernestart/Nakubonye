import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Plus, MapPin, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl, calcAge } from '../lib/photo'
import { tap } from '../lib/haptic'
import BrandGlow from '../components/BrandGlow'
import CommunityFeed from '../components/CommunityFeed'
import CommunityChat from '../components/CommunityChat'

export default function CommunityView() {
  const nav = useNavigate()
  const { id } = useParams()
  const { session } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [community, setCommunity] = useState(null)
  const [members, setMembers] = useState([])
  const [joined, setJoined] = useState(false)
  const [busy, setBusy] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [tab, setTab] = useState('feed')

  const load = useCallback(async () => {
    if (!session?.user?.id || !id) return
    setLoading(true); setError('')

    const { data: c, error: cErr } = await supabase
      .from('communities')
      .select('id, slug, name, description, emoji, cover_color, member_count')
      .eq('id', id)
      .single()

    if (cErr || !c) { setError(cErr?.message || 'Community not found'); setLoading(false); return }
    setCommunity(c)

    const { data: meRow } = await supabase
      .from('community_memberships')
      .select('user_id')
      .eq('user_id', session.user.id)
      .eq('community_id', id)
      .maybeSingle()
    setJoined(!!meRow)

    const { data: rows, error: mErr } = await supabase
      .from('community_memberships')
      .select('user_id, joined_at')
      .eq('community_id', id)
      .order('joined_at', { ascending: false })
      .limit(100)

    if (mErr) { setError(mErr.message); setLoading(false); return }

    const ids = (rows || []).map((r) => r.user_id)
    if (ids.length === 0) {
      setMembers([])
      setLoading(false)
      return
    }

    const { data: profs } = await supabase
      .from('profiles')
      .select('id, display_name, username, date_of_birth, city, country, is_verified')
      .in('id', ids)

    const { data: photos } = await supabase
      .from('profile_photos')
      .select('user_id, storage_path, is_primary, display_order')
      .in('user_id', ids)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true })

    const pmap = new Map()
    ;(photos || []).forEach((p) => { if (!pmap.has(p.user_id)) pmap.set(p.user_id, p.storage_path) })
    const profMap = new Map((profs || []).map((p) => [p.id, p]))

    setMembers((rows || []).map((r) => {
      const p = profMap.get(r.user_id)
      if (!p) return null
      return {
        id: p.id,
        display_name: p.display_name,
        username: p.username,
        age: calcAge(p.date_of_birth),
        city: p.city,
        country: p.country,
        is_verified: p.is_verified,
        photo_url: publicPhotoUrl(pmap.get(p.id)),
        joined_at: r.joined_at,
      }
    }).filter(Boolean))

    setLoading(false)
  }, [session?.user?.id, id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!session?.user?.id) { setIsPremium(false); return }
    supabase.rpc('is_premium').then(({ data }) => setIsPremium(!!data))
  }, [session?.user?.id])

  async function toggle() {
    if (busy || !community) return
    setBusy(true); tap('light')

    if (joined) {
      const { error: err } = await supabase
        .from('community_memberships')
        .delete()
        .eq('user_id', session.user.id)
        .eq('community_id', community.id)
      if (err) { setError(err.message); setBusy(false); return }
      setJoined(false)
      setCommunity((c) => ({ ...c, member_count: Math.max(0, c.member_count - 1) }))
      setMembers((m) => m.filter((x) => x.id !== session.user.id))
    } else {
      const { error: err } = await supabase
        .from('community_memberships')
        .insert({ user_id: session.user.id, community_id: community.id })
      if (err) { setError(err.message); setBusy(false); return }
      setJoined(true)
      setCommunity((c) => ({ ...c, member_count: c.member_count + 1 }))
      load()
    }

    setBusy(false)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow variant="default" />

      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px] truncate">
          {community?.name || 'Community'}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-10">
        {error && (
          <div className="mb-4 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">Loading…</div>
        ) : !community ? null : (
          <>
            <div
              className="rounded-3xl p-5 mb-5 text-center"
              style={{
                background: `${community.cover_color}22`,
                border: `1px solid ${community.cover_color}44`,
              }}
            >
              <div
                className="w-16 h-16 rounded-2xl grid place-items-center mx-auto mb-3 text-[32px]"
                style={{ background: `${community.cover_color}33`, border: `1px solid ${community.cover_color}66` }}
              >
                {community.emoji || '💬'}
              </div>
              <h1 className="text-cream text-[22px] font-extrabold tracking-tight mb-1.5">
                {community.name}
              </h1>
              {community.description && (
                <p className="text-muted text-[13.5px] leading-relaxed max-w-[300px] mx-auto mb-3">
                  {community.description}
                </p>
              )}
              <p className="text-subtle text-[11.5px] mb-4">
                {community.member_count} {community.member_count === 1 ? 'member' : 'members'}
              </p>

              <button
                onClick={toggle}
                disabled={busy}
                className={`h-11 px-6 rounded-full font-bold text-[14px] disabled:opacity-50 flex items-center gap-2 mx-auto ${
                  joined ? 'bg-white/[0.08] border border-white/15 text-cream' : 'text-white'
                }`}
                style={!joined ? {
                  background: `linear-gradient(135deg, ${community.cover_color}, #EC4899)`,
                } : undefined}
              >
                {joined ? (
                  <>
                    <Check size={16} strokeWidth={3} />
                    Joined
                  </>
                ) : (
                  <>
                    <Plus size={16} strokeWidth={3} />
                    Join community
                  </>
                )}
              </button>

              <button
                onClick={() => { tap('light'); nav('/communities/' + community.id + '/discover') }}
                className="h-11 px-6 rounded-full font-bold text-[14px] flex items-center gap-2 mx-auto mt-3 bg-white/[0.06] border border-white/12 text-cream"
              >
                Discover members →
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/8 mb-4">
              <button
                type="button"
                onClick={() => { tap('light'); setTab('feed') }}
                className={`flex-1 h-9 rounded-xl text-[13px] font-bold transition-colors ${
                  tab === 'feed'
                    ? 'bg-white text-[#0B0B14] shadow-[0_2px_6px_rgba(0,0,0,0.25)]'
                    : 'text-muted'
                }`}
              >
                Feed
              </button>
              <button
                type="button"
                onClick={() => { tap('light'); setTab('chat') }}
                className={`flex-1 h-9 rounded-xl text-[13px] font-bold transition-colors ${
                  tab === 'chat'
                    ? 'bg-white text-[#0B0B14] shadow-[0_2px_6px_rgba(0,0,0,0.25)]'
                    : 'text-muted'
                }`}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => { tap('light'); setTab('members') }}
                className={`flex-1 h-9 rounded-xl text-[13px] font-bold transition-colors ${
                  tab === 'members'
                    ? 'bg-white text-[#0B0B14] shadow-[0_2px_6px_rgba(0,0,0,0.25)]'
                    : 'text-muted'
                }`}
              >
                Members · {members.length}
              </button>
            </div>

            {tab === 'feed' ? (
              <CommunityFeed communityId={community.id} isMember={joined} />
            ) : tab === 'chat' ? (
              <CommunityChat communityId={community.id} isMember={joined} isPremium={isPremium} />
            ) : (
              <>
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
                  Members · {members.length}
                </p>

            {members.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
                  <UserPlus size={22} strokeWidth={1.8} className="text-muted" />
                </div>
                <p className="text-cream font-semibold text-[14.5px] mb-1">No members yet</p>
                <p className="text-muted text-[12.5px]">Be the first to join.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { tap('light'); nav('/profile/' + m.id) }}
                    className="relative rounded-2xl overflow-hidden bg-surface border border-white/8 aspect-[3/4] text-left"
                  >
                    {m.photo_url ? (
                      <img src={m.photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-4xl opacity-25">👤</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-obsidian via-obsidian/55 to-transparent" />

                    {m.is_verified && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-purple-600 px-1.5 py-0.5 rounded-full">
                        <Check size={9} strokeWidth={3} />
                        <span className="text-[8.5px] font-bold text-white">VERIFIED</span>
                      </div>
                    )}

                    <div className="absolute inset-x-0 bottom-0 p-2.5">
                      <p className="text-white text-[14px] font-extrabold leading-tight drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
                        {m.display_name || m.username || 'Someone'}
                        {m.age ? `, ${m.age}` : ''}
                      </p>
                      {m.city && (
                        <p className="text-white/85 text-[10.5px] font-medium flex items-center gap-1 mt-0.5">
                          <MapPin size={9} />
                          {m.city}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
