import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, UserX } from 'lucide-react'
import BrandGlow from '../components/BrandGlow'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl } from '../lib/photo'

export default function BlockedList() {
  const nav = useNavigate()
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true)
    const { data: blocks } = await supabase
      .from('blocks')
      .select('id, blocked_id, created_at')
      .eq('blocker_id', session.user.id)
      .order('created_at', { ascending: false })

    const ids = (blocks || []).map((b) => b.blocked_id)
    if (!ids.length) { setItems([]); setLoading(false); return }

    const { data: profs } = await supabase
      .from('profiles')
      .select('id, display_name, username')
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

    setItems((blocks || []).map((b) => {
      const p = profMap.get(b.blocked_id)
      return {
        blockId: b.id,
        userId: b.blocked_id,
        display_name: p?.display_name || p?.username || 'Unknown',
        photo_url: publicPhotoUrl(pmap.get(b.blocked_id)),
      }
    }))
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  async function unblock(item) {
    await supabase.from('blocks').delete().eq('id', item.blockId)
    setItems((cur) => cur.filter((x) => x.blockId !== item.blockId))
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />
      <header
        style={{ height: 52, flexShrink: 0 }}
        className="px-3 flex items-center gap-2 border-b border-white/8"
      >
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Blocked users</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">Loading…</div>
        ) : items.length === 0 ? (
          <div className="pt-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] grid place-items-center mx-auto mb-4">
              <UserX size={22} strokeWidth={2} className="text-muted" />
            </div>
            <p className="text-cream font-semibold text-[15px] mb-1">No one blocked</p>
            <p className="text-muted text-[13px]">You haven't blocked anyone.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <div
                key={item.blockId}
                className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-white/8"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-elevated shrink-0">
                  {item.photo_url ? (
                    <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-lg font-black text-purple-400">
                      {(item.display_name || '?')[0]}
                    </div>
                  )}
                </div>
                <p className="flex-1 text-cream font-semibold text-[14.5px] truncate">
                  {item.display_name}
                </p>
                <button
                  onClick={() => unblock(item)}
                  className="px-4 py-2 rounded-full bg-white/[0.06] border border-white/10 text-cream text-[12.5px] font-semibold"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
