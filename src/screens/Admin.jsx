import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, Shield, ShieldOff, Trash2, Coins,
  AlertTriangle, Check, X, RefreshCw, Ban,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { publicPhotoUrl } from '../lib/photo'
import { tap } from '../lib/haptic'
import BrandGlow from '../components/BrandGlow'

export default function Admin() {
  const nav = useNavigate()
  const { session, profile } = useAuth()
  const isAdmin = profile?.is_admin === true

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [reports, setReports] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!isAdmin) { setLoading(false); return }
    setLoading(true); setError('')

    const [s, u, r] = await Promise.all([
      supabase.rpc('admin_get_stats'),
      supabase.rpc('admin_list_users', { p_search: search || null, p_limit: 100 }),
      supabase.rpc('admin_list_reports', { p_status: 'pending' }),
    ])

    if (s.error) { setError(s.error.message); setLoading(false); return }
    if (u.error) { setError(u.error.message); setLoading(false); return }

    setStats((Array.isArray(s.data) ? s.data[0] : s.data) || {})
    setReports(r.data || [])
    setUsers((u.data || []).map((x) => ({ ...x, photo_url: publicPhotoUrl(x.primary_photo) })))
    setLoading(false)
  }, [isAdmin, search])

  useEffect(() => { load() }, [load])

  async function run(fn) {
    if (busy) return
    setBusy(true); setError('')
    const { error: err } = await fn()
    if (err) setError(err.message)
    else { setSelected(null); await load() }
    setBusy(false)
  }

  if (!isAdmin) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#0B0B14' }}>
        <p className="text-muted text-[14px]">You don't have access to this screen.</p>
      </div>
    )
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
        <span className="text-cream font-bold text-[15px] flex-1">Admin</span>
        <button onClick={load} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Refresh">
          <RefreshCw size={17} strokeWidth={2.3} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-10">
        {error && (
          <div className="mb-4 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">Loading…</div>
        ) : (
          <>
            {/* Stats grid */}
            {stats && (
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                <Stat label="Total users" value={stats.total_users} />
                <Stat label="New today" value={stats.users_today} accent />
                <Stat label="Active 7d" value={stats.active_users_7d} />
                <Stat label="Verified" value={stats.verified_users} />
                <Stat label="Banned" value={stats.banned_users} warn={Number(stats.banned_users) > 0} />
                <Stat label="Pending reports" value={stats.pending_reports} warn={Number(stats.pending_reports) > 0} />
                <Stat label="Matches" value={stats.total_matches} />
                <Stat label="Messages" value={stats.total_messages} />
              </div>
            )}

            {/* Pending reports */}
            {reports.length > 0 && (
              <div className="mb-5">
                <p className="text-red-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
                  Pending reports · {reports.length}
                </p>
                <div className="flex flex-col gap-2">
                  {reports.slice(0, 10).map((r) => (
                    <div key={r.id} className="rounded-2xl bg-red-500/8 border border-red-500/25 p-3 text-[12.5px]">
                      <p className="text-cream font-semibold mb-0.5">
                        {r.reporter_name} → {r.reported_name}
                      </p>
                      <p className="text-muted">{r.reason}{r.details ? ' · ' + r.details : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email, username, or name"
                className="w-full bg-elevated border border-white/8 rounded-2xl pl-11 pr-4 py-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Users list */}
            <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
              Users · {users.length}
            </p>
            <div className="flex flex-col gap-1.5">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { tap('light'); setSelected(u) }}
                  className={`flex items-center gap-3 p-3 rounded-2xl border text-left ${
                    u.is_banned ? 'bg-red-500/8 border-red-500/25' :
                    u.is_admin ? 'bg-purple-500/8 border-purple-500/25' :
                    'bg-white/[0.03] border-white/8'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0">
                    {u.photo_url ? (
                      <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-sm font-black text-purple-400">
                        {(u.display_name || '?')[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-semibold text-[13.5px] truncate flex items-center gap-1.5">
                      {u.display_name || u.username || '—'}
                      {u.is_admin && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-600 text-white font-bold">ADMIN</span>}
                      {u.is_banned && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold">BANNED</span>}
                    </p>
                    <p className="text-muted text-[11.5px] truncate">{u.email}</p>
                  </div>
                  <span className="text-subtle text-[10.5px] shrink-0">{u.balance} ¢</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* User detail sheet */}
      {selected && (
        <div onClick={() => !busy && setSelected(null)} className="fixed inset-0 z-[150] bg-obsidian/85 backdrop-blur-md grid place-items-end">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[480px] mx-auto bg-surface rounded-t-[28px] border-t border-white/10 p-5 max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

            <div className="flex items-center gap-3 mb-5">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0">
                {selected.photo_url ? (
                  <img src={selected.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-lg font-black text-purple-400">
                    {(selected.display_name || '?')[0]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-cream font-bold text-[17px] truncate">
                  {selected.display_name || selected.username}
                </p>
                <p className="text-muted text-[13px] truncate">@{selected.username}</p>
                <p className="text-subtle text-[12px] truncate">{selected.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-5 text-[12.5px]">
              <Info label="Balance" value={selected.balance + ' coins'} />
              <Info label="Verified" value={selected.is_verified ? 'Yes ✓' : 'No'} />
              <Info label="Joined" value={new Date(selected.created_at).toLocaleDateString()} />
              <Info label="Last seen" value={selected.last_seen_at ? new Date(selected.last_seen_at).toLocaleDateString() : 'never'} />
              <Info label="Status" value={selected.is_banned ? 'Banned' : 'Active'} warn={selected.is_banned} />
              <Info label="Role" value={selected.is_admin ? 'Admin' : 'User'} />
            </div>

            {selected.banned_reason && (
              <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-[12.5px]">
                <p className="text-red-400 font-bold text-[11px] uppercase tracking-wide mb-1">Ban reason</p>
                <p className="text-cream">{selected.banned_reason}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {!selected.is_banned ? (
                <button
                  onClick={() => {
                    const reason = prompt('Reason for banning this user?')
                    if (reason === null) return
                    run(() => supabase.rpc('admin_ban_user', { p_user_id: selected.id, p_reason: reason }))
                  }}
                  disabled={busy || selected.is_admin}
                  className="w-full h-11 rounded-full bg-red-500/15 border border-red-500/40 text-red-300 font-bold text-[13.5px] flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Ban size={15} strokeWidth={2.4} /> Ban user
                </button>
              ) : (
                <button
                  onClick={() => run(() => supabase.rpc('admin_unban_user', { p_user_id: selected.id }))}
                  disabled={busy}
                  className="w-full h-11 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-[13.5px] flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Shield size={15} strokeWidth={2.4} /> Unban user
                </button>
              )}

              <button
                onClick={() => {
                  const amount = prompt('Coins to grant (negative to deduct):', '100')
                  if (!amount) return
                  const n = parseInt(amount, 10)
                  if (!n) return
                  run(() => supabase.rpc('admin_grant_coins', {
                    p_user_id: selected.id, p_amount: n, p_reason: 'Admin action'
                  }))
                }}
                disabled={busy}
                className="w-full h-11 rounded-full bg-white/[0.06] border border-white/12 text-cream font-bold text-[13.5px] flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Coins size={15} strokeWidth={2.4} /> Grant / deduct coins
              </button>

              <button
                onClick={() => {
                  if (!confirm('Delete this account permanently? This removes their profile, matches, messages, and coins. Cannot be undone.')) return
                  if (!confirm('Are you absolutely sure?')) return
                  run(() => supabase.rpc('admin_delete_user', { p_user_id: selected.id }))
                }}
                disabled={busy || selected.is_admin}
                className="w-full h-11 rounded-full bg-red-500/20 border border-red-500/50 text-red-300 font-bold text-[13.5px] flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Trash2 size={15} strokeWidth={2.4} /> Delete account
              </button>

              <button
                onClick={() => setSelected(null)}
                className="w-full h-11 text-muted font-semibold text-[13.5px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent, warn }) {
  return (
    <div className={`rounded-2xl border p-3 ${warn ? 'bg-red-500/8 border-red-500/25' : accent ? 'bg-purple-500/8 border-purple-500/25' : 'bg-white/[0.03] border-white/8'}`}>
      <p className="text-subtle text-[10.5px] font-bold uppercase tracking-wide mb-1">{label}</p>
      <p className="text-cream text-[20px] font-extrabold tracking-tight">{value ?? '—'}</p>
    </div>
  )
}

function Info({ label, value, warn }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/6 px-3 py-2">
      <p className="text-subtle text-[10px] font-bold uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-[13px] font-semibold ${warn ? 'text-red-400' : 'text-cream'}`}>{value}</p>
    </div>
  )
}
