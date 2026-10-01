import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Plus, Users , Search , X } from 'lucide-react'
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
  const [tabFilter, setTabFilter] = useState("discover")
  const [search, setSearch] = useState("")

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

  const filtered = communities.filter((c) => {
    if (tabFilter === "mine" && !myIds.has(c.id)) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchName = (c.name || "").toLowerCase().includes(q)
      const matchDesc = (c.description || "").toLowerCase().includes(q)
      if (!matchName && !matchDesc) return false
    }
    return true
  })

  const showHero = tabFilter === "discover" && !search.trim() && communities.length > 0

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
        <span className="text-cream font-bold text-[15px] flex-1">Communities</span>
        <button
          onClick={() => { tap("light"); nav("/communities/new") }}
          className="h-9 px-3 rounded-full text-white font-bold text-[13px] inline-flex items-center gap-1.5"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
        >
          <Plus size={15} strokeWidth={3} /> Create
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-10">
        {error && (
          <div className="mb-4 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        {/* Search bar */}
        <div className="flex items-center gap-2 rounded-2xl bg-surface border border-white/8 px-3.5 h-11 mb-3">
          <Search size={16} className="text-muted shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value.slice(0, 60))}
            placeholder="Search communities…"
            className="flex-1 bg-transparent border-0 text-cream text-[14px] placeholder:text-subtle focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted shrink-0" aria-label="Clear">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[
            { id: "discover", label: "Discover" },
            { id: "mine",     label: "My communities" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { tap("light"); setTabFilter(t.id) }}
              className="flex-1 h-9 rounded-xl text-[13px] font-bold transition-colors"
              style={{
                background: tabFilter === t.id
                  ? "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)"
                  : "rgba(255,255,255,0.04)",
                border: tabFilter === t.id ? "none" : "1px solid rgba(255,255,255,0.08)",
                color: tabFilter === t.id ? "#fff" : "#888",
              }}
            >
              {t.label}
              {t.id === "mine" && joinedCount > 0 ? " · " + joinedCount : ""}
            </button>
          ))}
        </div>

        {showHero && (
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
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-2.5 animate-pulse">
            {[0,1,2,3,4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.06] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-3.5 w-1/2 rounded bg-white/[0.08] mb-2" />
                  <div className="h-2.5 w-1/3 rounded bg-white/[0.05]" />
                </div>
                <div className="h-9 w-16 rounded-full bg-white/[0.05] shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          filtered.length === 0 ? (
            <div className="pt-12 text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
                <Users size={26} className="text-muted" />
              </div>
              <p className="text-cream font-bold text-[15px] mb-1">
                {search.trim()
                  ? "No communities found"
                  : tabFilter === "mine"
                    ? "You haven't joined any"
                    : "No communities yet"}
              </p>
              <p className="text-muted text-[13px] max-w-[260px] mx-auto leading-relaxed">
                {search.trim()
                  ? "Try a different search."
                  : tabFilter === "mine"
                    ? "Tap Discover to find one to join, or create your own."
                    : "Create the first community."}
              </p>
            </div>
          ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((c) => {
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
          )
        )}

        <p className="text-center text-subtle text-[11.5px] mt-8 leading-relaxed">
          Can't find your people? <button onClick={() => nav("/communities/new")} className="text-purple-300 font-semibold">Create a community</button>
        </p>
      </div>
    </div>
  )
}
