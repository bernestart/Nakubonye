import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Plus, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'
import BrandGlow from '../components/BrandGlow'

export default function Communities() {
  const nav = useNavigate()
  const { session } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [communities, setCommunities] = useState([])
  const [myIds, setMyIds] = useState(new Set())
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true); setError('')

    const { data: rows, error: cErr } = await supabase
      .from('communities')
      .select('id, slug, name, description, emoji, cover_color, member_count, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (cErr) { setError(cErr.message); setLoading(false); return }
    setCommunities(rows || [])

    const { data: mine, error: mErr } = await supabase
      .from('community_memberships')
      .select('community_id')
      .eq('user_id', session.user.id)

    if (mErr) { setError(mErr.message); setLoading(false); return }
    setMyIds(new Set((mine || []).map((m) => m.community_id)))

    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  async function join(c) {
    if (busyId || myIds.has(c.id)) return
    setBusyId(c.id); tap('light')

    const { error: err } = await supabase
      .from('community_memberships')
      .insert({ user_id: session.user.id, community_id: c.id })

    if (err) { setError(err.message); setBusyId(null); return }

    setMyIds((s) => new Set([...s, c.id]))
    setCommunities((list) =>
      list.map((x) => x.id === c.id ? { ...x, member_count: x.member_count + 1 } : x)
    )
    setBusyId(null)
  }

  async function leave(c) {
    if (busyId || !myIds.has(c.id)) return
    setBusyId(c.id); tap('light')

    const { error: err } = await supabase
      .from('community_memberships')
      .delete()
      .eq('user_id', session.user.id)
      .eq('community_id', c.id)

    if (err) { setError(err.message); setBusyId(null); return }

    setMyIds((s) => {
      const next = new Set(s)
      next.delete(c.id)
      return next
    })
    setCommunities((list) =>
      list.map((x) => x.id === c.id ? { ...x, member_count: Math.max(0, x.member_count - 1) } : x)
    )
    setBusyId(null)
  }

  const joinedCount = myIds.size

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
        <span className="text-cream font-bold text-[15px]">Communities</span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-10">
        {error && (
          <div className="mb-4 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        <div className="text-center mb-6">
          <div
            className="w-16 h-16 rounded-3xl grid place-items-center mx-auto mb-4"
            style={{
              background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
              boxShadow: '0 12px 36px rgba(168,85,247,0.5)',
            }}
          >
            <Users size={28} strokeWidth={2.2} className="text-white" />
          </div>
          <h1 className="text-cream text-[22px] font-extrabold tracking-tight mb-1.5">
            Find your people
          </h1>
          <p className="text-muted text-[13.5px] leading-relaxed max-w-[320px] mx-auto">
            Join communities that match your vibe. Members see each other's profiles on your profile page.
            {joinedCount > 0 && <> You're in <strong className="text-cream">{joinedCount}</strong>.</>}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2.5">
            {[0,1,2,3,4].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {communities.map((c) => {
              const joined = myIds.has(c.id)
              const busy = busyId === c.id
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-4 rounded-2xl border transition-colors"
                  style={{
                    background: joined ? `${c.cover_color}22` : 'rgba(255,255,255,0.04)',
                    borderColor: joined ? `${c.cover_color}66` : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-2xl grid place-items-center shrink-0 text-[24px]"
                    style={{ background: `${c.cover_color}26`, border: `1px solid ${c.cover_color}55` }}
                  >
                    {c.emoji || '💬'}
                  </div>

                  <button
                    onClick={() => { tap('light'); nav('/communities/' + c.id) }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-cream font-bold text-[14.5px] truncate">
                      {c.name}
                    </p>
                    <p className="text-muted text-[12.5px] truncate">
                      {c.description || ''} · {c.member_count} {c.member_count === 1 ? 'member' : 'members'}
                    </p>
                  </button>

                  <button
                    onClick={() => joined ? leave(c) : join(c)}
                    disabled={busy}
                    className={`shrink-0 h-9 px-4 rounded-full text-[12.5px] font-bold transition-colors ${
                      joined
                        ? 'bg-white/[0.08] border border-white/15 text-cream'
                        : 'text-white'
                    } disabled:opacity-50 flex items-center gap-1.5`}
                    style={!joined ? { background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)' } : undefined}
                    aria-label={joined ? 'Leave' : 'Join'}
                  >
                    {joined ? (
                      <>
                        <Check size={13} strokeWidth={3} />
                        Joined
                      </>
                    ) : (
                      <>
                        <Plus size={13} strokeWidth={3} />
                        Join
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-center text-subtle text-[11.5px] mt-8 leading-relaxed">
          More communities are coming. Want to suggest one? WhatsApp us at <a href="https://wa.me/25765394084" target="_blank" rel="noopener" className="text-purple-300 font-semibold">+257 65 39 40 84</a>
        </p>
      </div>
    </div>
  )
}
