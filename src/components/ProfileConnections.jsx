import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

export default function ProfileConnections({ userId, visibility }) {
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState('followers')
  const [connections, setConnections] = useState({ followers: [], following: [], matches: [] })

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)

      const [followerRows, followingRows, matchRows] = await Promise.all([
        supabase.from('follows').select('follower_id').eq('following_id', userId).limit(200),
        supabase.from('follows').select('following_id').eq('follower_id', userId).limit(200),
        supabase.from('matches').select('user_one_id, user_two_id').or('user_one_id.eq.' + userId + ',user_two_id.eq.' + userId).limit(200),
      ])

      const followerIds = (followerRows.data || []).map((r) => r.follower_id)
      const followingIds = (followingRows.data || []).map((r) => r.following_id)
      const matchIds = (matchRows.data || []).map((m) => m.user_one_id === userId ? m.user_two_id : m.user_one_id)

      const allIds = [...new Set([...followerIds, ...followingIds, ...matchIds])]

      let profMap = new Map(), photoMap = new Map()
      if (allIds.length > 0) {
        const [profs, ph] = await Promise.all([
          supabase.from('profiles').select('id, display_name, username, is_verified').in('id', allIds),
          supabase.from('profile_photos')
            .select('user_id, storage_path, is_primary, display_order')
            .in('user_id', allIds)
            .order('is_primary', { ascending: false })
            .order('display_order', { ascending: true }),
        ])
        ;(profs.data || []).forEach((pr) => profMap.set(pr.id, pr))
        ;(ph.data || []).forEach((x) => { if (!photoMap.has(x.user_id)) photoMap.set(x.user_id, x.storage_path) })
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
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [userId])

  const list = connections[subTab] || []

  return (
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
            onClick={() => { tap("light"); setSubTab(t.id) }}
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

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/8 p-3 h-14 shimmer" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-cream font-bold text-[15px] mb-1">
            {subTab === 'followers' ? 'No followers yet'
             : subTab === 'following' ? 'Not following anyone'
             : 'No matches yet'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {list.map((u) => (
            <button
              key={u.id}
              onClick={() => { tap("light"); nav('/profile/' + u.id) }}
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
  )
}
