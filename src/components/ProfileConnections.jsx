import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search, MessageCircle } from "lucide-react"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import FollowButton from "./FollowButton"

export default function ProfileConnections({ userId, visibility, fullPage = false, initialTab = "followers" }) {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const isMe = myId === userId

  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState(initialTab)
  const [search, setSearch] = useState('')
  const [connections, setConnections] = useState({ followers: [], following: [], matches: [] })
  const [mutuals, setMutuals] = useState({})
  const [suggested, setSuggested] = useState([])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [followerRows, followingRows, matchRows] = await Promise.all([
        supabase.from('follows').select('follower_id, created_at').eq('following_id', userId).order('created_at', { ascending: false }).limit(200),
        supabase.from('follows').select('following_id, created_at').eq('follower_id', userId).order('created_at', { ascending: false }).limit(200),
        supabase.from('matches').select('user_one_id, user_two_id, created_at').or('user_one_id.eq.' + userId + ',user_two_id.eq.' + userId).order('created_at', { ascending: false }).limit(200),
      ])

      const followerIds = (followerRows.data || []).map((r) => r.follower_id)
      const followingIds = (followingRows.data || []).map((r) => r.following_id)
      const matchIds = (matchRows.data || []).map((m) => m.user_one_id === userId ? m.user_two_id : m.user_one_id)
      const allIds = [...new Set([...followerIds, ...followingIds, ...matchIds])]

      let profMap = new Map(), photoMap = new Map()
      if (allIds.length > 0) {
        const [profs, ph] = await Promise.all([
          supabase.from('profiles').select('id, display_name, username, is_verified, city').in('id', allIds),
          supabase.from('profile_photos')
            .select('user_id, storage_path, is_primary, display_order')
            .in('user_id', allIds)
            .order('is_primary', { ascending: false })
            .order('display_order', { ascending: true }),
        ])
        ;(profs.data || []).forEach((pr) => profMap.set(pr.id, pr))
        ;(ph.data || []).forEach((x) => { if (!photoMap.has(x.user_id)) photoMap.set(x.user_id, x.storage_path) })
      }

      // Fetch mutual counts for all listed users
      let mutualCounts = {}
      if (myId && allIds.length > 0) {
        const { data: myRows } = await supabase
          .from('follows').select('following_id').eq('follower_id', myId).limit(500)
        const mySet = (myRows || []).map(r => r.following_id)
        if (mySet.length > 0) {
          const { data: mutualRows } = await supabase
            .from('follows')
            .select('following_id')
            .in('following_id', allIds)
            .in('follower_id', mySet)
          ;(mutualRows || []).forEach(r => {
            mutualCounts[r.following_id] = (mutualCounts[r.following_id] || 0) + 1
          })
        }
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
          city: pr.city,
          photo_url: photoMap.get(id) ? publicPhotoUrl(photoMap.get(id)) : null,
          mutuals: mutualCounts[id] || 0,
        }
      }
      setConnections({
        followers: followerIds.map(toPerson).filter(Boolean),
        following: followingIds.map(toPerson).filter(Boolean),
        matches:   matchIds.map(toPerson).filter(Boolean),
      })
      setMutuals(mutualCounts)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [userId, myId])
  useEffect(() => {
    if (subTab !== 'suggested' || suggested.length > 0) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.rpc('get_suggested_people', { p_limit: 40 })
      if (cancelled || error) return
      const rows = data || []
      if (rows.length === 0) { setSuggested([]); return }
      const ids = rows.map(r => r.id)
      const { data: ph } = await supabase
        .from('profile_photos')
        .select('user_id, storage_path, is_primary, display_order')
        .in('user_id', ids)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true })
      if (cancelled) return
      const pm = new Map()
      ;(ph || []).forEach(x => { if (!pm.has(x.user_id)) pm.set(x.user_id, x.storage_path) })
      setSuggested(rows.map(r => ({
        id: r.id,
        display_name: r.display_name,
        username: r.username,
        is_verified: r.is_verified,
        city: r.city,
        mutuals: r.mutual_count,
        photo_url: pm.get(r.id) ? publicPhotoUrl(pm.get(r.id)) : null,
      })))
    })()
    return () => { cancelled = true }
  }, [subTab]);


  const rawList = subTab === 'suggested' ? suggested : (connections[subTab] || [])
  const list = useMemo(() => {
    if (!search.trim()) return rawList
    const q = search.trim().toLowerCase()
    return rawList.filter((u) =>
      (u.display_name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q)
    )
  }, [rawList, search])

  const tabDefs = [
    { id: 'followers', label: 'Followers', count: connections.followers.length },
    { id: 'following', label: 'Following', count: connections.following.length },
    { id: 'matches',   label: 'Matches',   count: connections.matches.length },
    { id: 'suggested', label: 'Suggested', count: suggested.length },
  ]
  const activeTab = tabDefs.find((t) => t.id === subTab)

  return (
    <div className={fullPage ? "px-4 py-3" : "px-4 py-3"}>
      {/* Sub-tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {tabDefs.map((t) => (
          <button
            key={t.id}
            onClick={() => { tap("light"); setSubTab(t.id); setSearch('') }}
            className="shrink-0 h-9 px-3.5 rounded-full text-[12.5px] font-bold transition-colors"
            style={{
              background: subTab === t.id ? 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' : 'rgba(255,255,255,0.05)',
              border: subTab === t.id ? 'none' : '1px solid rgba(255,255,255,0.08)',
              color: subTab === t.id ? '#fff' : '#aaa',
            }}
          >
            {t.label} {t.count > 0 ? '· ' + t.count : ''}
          </button>
        ))}
      </div>

      {/* Search */}
      {rawList.length > 3 && (
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${activeTab?.label.toLowerCase() || ''}`}
            className="w-full h-10 rounded-full bg-white/[0.05] border border-white/8 pl-9 pr-3 text-cream text-[13px] placeholder:text-muted outline-none focus:border-purple-500/40"
          />
        </div>
      )}

      {/* Count header */}
      {!loading && rawList.length > 0 && (
        <p className="text-cream font-extrabold text-[15px] mb-2 px-1">
          {rawList.length.toLocaleString()} {activeTab?.label.toLowerCase()}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/8 p-3 h-14 shimmer" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-cream font-bold text-[15px] mb-1">
            {search.trim()
              ? 'No matches found'
              : subTab === 'followers' ? 'No followers yet'
              : subTab === 'following' ? 'Not following anyone'
              : 'No matches yet'}
          </p>
          {!search.trim() && (
            <p className="text-muted text-[12.5px]">
              {subTab === 'followers' ? 'When people follow this account, they show up here.'
               : subTab === 'following' ? 'Accounts this user follows will show up here.'
               : 'Mutual matches will show up here.'}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col">
          {list.map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-3 border-b border-white/6">
              <button
                onClick={() => { tap("light"); nav('/profile/' + u.id) }}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black shrink-0">
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
                  {u.mutuals > 0 && (
                    <p className="text-muted text-[11.5px] truncate">{u.mutuals} mutual connection{u.mutuals === 1 ? '' : 's'}</p>
                  )}
                </div>
              </button>
              {u.id !== myId && subTab !== "suggested" && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { tap("light"); nav("/messages/" + u.id) }}
                    className="w-8 h-8 rounded-full grid place-items-center bg-white/[0.06] border border-white/10 text-cream"
                    aria-label="Message"
                  >
                    <MessageCircle size={14} strokeWidth={2.5} />
                  </button>
                  <FollowButton userId={u.id} size="sm" />
                </div>
              )}
              {u.id !== myId && subTab === "suggested" && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={async () => {
                      tap("medium")
                      const { error: rpcErr } = await supabase.rpc("like_user", { target_user_id: u.id })
                      if (rpcErr) { console.warn("like_user failed", rpcErr); return }
                      setSuggested(prev => prev.filter(x => x.id !== u.id))
                    }}
                    className="h-8 px-3.5 rounded-full text-white font-bold text-[12.5px]"
                    style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
                  >Request Match</button>
                  <button
                    onClick={() => { tap("light"); setSuggested((prev) => prev.filter((x) => x.id !== u.id)) }}
                    className="h-8 px-3.5 rounded-full bg-white/[0.06] border border-white/10 text-cream font-bold text-[12.5px]"
                  >Remove</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
