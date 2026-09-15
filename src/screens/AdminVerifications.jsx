import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X, RefreshCw, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'

export default function AdminVerifications() {
  const nav = useNavigate()
  const { session, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [rejectFor, setRejectFor] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [signedUrls, setSignedUrls] = useState({})

  const isAdmin = profile?.is_admin === true

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    if (!isAdmin) { setLoading(false); return }

    setLoading(true); setError('')

    const { data, error: err } = await supabase.rpc('admin_list_verifications')
    if (err) { setError(err.message); setLoading(false); return }

    const list = data || []
    setItems(list)

    // Fetch signed URLs for each selfie (bucket is private)
    const urlMap = {}
    for (const item of list) {
      const { data: signed } = await supabase.storage
        .from('verification-selfies')
        .createSignedUrl(item.selfie_path, 3600)
      if (signed?.signedUrl) urlMap[item.id] = signed.signedUrl
    }
    setSignedUrls(urlMap)

    setLoading(false)
  }, [session?.user?.id, isAdmin])

  useEffect(() => { load() }, [load])

  async function approve(item) {
    if (busyId) return
    setBusyId(item.id); tap('medium')
    const { error: err } = await supabase.rpc('admin_approve_verification', { p_request_id: item.id })
    setBusyId(null)
    if (err) { setError(err.message); return }
    setItems((cur) => cur.filter((x) => x.id !== item.id))
  }

  function openReject(item) {
    tap('light')
    setRejectFor(item)
    setRejectReason('')
  }

  async function confirmReject() {
    if (!rejectFor || busyId) return
    setBusyId(rejectFor.id)
    const { error: err } = await supabase.rpc('admin_reject_verification', {
      p_request_id: rejectFor.id,
      p_reason: rejectReason.trim() || 'Did not match your photos',
    })
    setBusyId(null)
    if (err) { setError(err.message); return }
    setItems((cur) => cur.filter((x) => x.id !== rejectFor.id))
    setRejectFor(null)
    setRejectReason('')
  }

  if (!isAdmin) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        margin: '0 auto', maxWidth: 480,
        display: 'flex', flexDirection: 'column',
        background: '#0B0B14', overflow: 'hidden',
      }}>
        <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
          <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
            <ArrowLeft size={20} strokeWidth={2.3} />
          </button>
        </header>
        <div className="flex-1 grid place-items-center text-center px-6">
          <p className="text-muted text-[14px]">You don't have access to this screen.</p>
        </div>
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
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-purple-600/22" style={{ filter: 'blur(120px)' }} />
        <div className="absolute bottom-[-180px] right-[-100px] w-[420px] h-[420px] rounded-full bg-pink-500/14" style={{ filter: 'blur(120px)' }} />
      </div>

      <header
        style={{ height: 52, flexShrink: 0 }}
        className="px-3 flex items-center gap-2 border-b border-white/8"
      >
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px] flex-1">
          Verification review
        </span>
        <button
          onClick={load}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Refresh"
        >
          <RefreshCw size={17} strokeWidth={2.3} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-8">
        {error && (
          <div className="mb-3 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">Loading…</div>
        ) : items.length === 0 ? (
          <div className="pt-16 text-center">
            <div className="w-16 h-16 rounded-3xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
              <ShieldCheck size={26} strokeWidth={1.8} className="text-muted" />
            </div>
            <p className="text-cream font-semibold text-[15px] mb-1">All caught up</p>
            <p className="text-muted text-[13px]">No pending verification requests.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-surface border border-white/8 overflow-hidden"
              >
                {/* Selfie */}
                <div className="relative bg-black" style={{ aspectRatio: '1 / 1' }}>
                  {signedUrls[item.id] ? (
                    <img
                      src={signedUrls[item.id]}
                      alt="Selfie"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-muted text-[12px]">
                      Loading selfie…
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="text-cream font-bold text-[15px] mb-0.5">
                    {item.display_name || item.username || 'Someone'}
                  </p>
                  <p className="text-muted text-[12.5px] mb-3">
                    @{item.username || '—'} · {new Date(item.created_at).toLocaleString([], {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openReject(item)}
                      disabled={busyId === item.id}
                      className="flex-1 h-11 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 font-bold text-[13.5px] flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <X size={15} strokeWidth={2.6} />
                      Reject
                    </button>
                    <button
                      onClick={() => approve(item)}
                      disabled={busyId === item.id}
                      className="flex-1 h-11 rounded-full text-white font-bold text-[13.5px] flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)',
                        boxShadow: '0 8px 24px rgba(236,72,153,0.4)',
                      }}
                    >
                      <Check size={15} strokeWidth={2.6} />
                      {busyId === item.id ? 'Working…' : 'Approve'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject sheet */}
      {rejectFor && (
        <div
          onClick={() => !busyId && setRejectFor(null)}
          className="fixed inset-0 z-[150] bg-obsidian/85 backdrop-blur-md grid place-items-end"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] mx-auto bg-surface rounded-t-[28px] border-t border-white/10 p-5"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <h3 className="text-cream font-extrabold text-[17px] mb-2">
              Reject {rejectFor.display_name}'s verification?
            </h3>
            <p className="text-muted text-[13px] mb-4">
              Give them a reason so they can try again.
            </p>

            <div className="flex flex-col gap-2 mb-4">
              {[
                'Did not match your photos',
                'Photo too blurry',
                'Face not visible',
                'Pose not visible',
                'Suspicious or repeated submissions',
              ].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRejectReason(r)}
                  className={`text-left px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-colors border ${
                    rejectReason === r
                      ? 'bg-purple-600/25 border-purple-500 text-cream'
                      : 'bg-white/[0.03] border-white/8 text-muted'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="Or write a custom reason…"
              className="w-full bg-elevated border border-white/8 rounded-2xl px-4 py-3 text-cream text-[13.5px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none mb-4"
            />

            <button
              onClick={confirmReject}
              disabled={!!busyId}
              className="w-full h-12 rounded-full bg-red-500 text-white font-bold text-[14.5px] disabled:opacity-50 mb-2"
            >
              {busyId ? 'Rejecting…' : 'Reject'}
            </button>
            <button
              onClick={() => !busyId && setRejectFor(null)}
              disabled={!!busyId}
              className="w-full h-11 text-muted font-semibold text-[13.5px] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
