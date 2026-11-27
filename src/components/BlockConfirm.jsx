import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { API_BASE_URL } from '../lib/api';

export default function BlockConfirm({ open, onClose, target, onBlocked }) {
  const { session } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  async function confirm() {
    if (!session?.user?.id || !target?.id) return
    setBusy(true); setError('')
    const me = session.user.id
    const them = target.id

    const blockRes = await fetch(`${API_BASE_URL}/api/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocker_id: me, blocked_id: them })
    }).then(r => r.json()).catch(e => ({ success: false, error: e.message }))
    const err = blockRes.success ? null : { message: blockRes.error || 'Block failed' }
    setBusy(false)
    if (err) { setError(err.message); return }

    // Cleanup: remove any photo_tags connecting the two users (both directions)
    // Fire-and-forget — block already succeeded, cleanup shouldn't block the UX.
    try {
      Promise.all([
        fetch(`${API_BASE_URL}/api/photo-tags?taggerId=${me}&taggedId=${them}`, { method: 'DELETE' }).catch(() => {}),
        fetch(`${API_BASE_URL}/api/photo-tags?taggerId=${them}&taggedId=${me}`, { method: 'DELETE' }).catch(() => {}),
      ]).catch(() => {})
    } catch (e) { console.warn("tag cleanup failed", e) }

    onBlocked?.()
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-end sm:place-items-center bg-obsidian/85 backdrop-blur-md">
      <div className="w-full max-w-[480px] bg-surface rounded-t-[28px] sm:rounded-[24px] border border-white/10 p-6">
        <h3 className="text-cream font-extrabold text-[18px] mb-2">
          Block {target?.display_name || target?.username || 'user'}?
        </h3>
        <p className="text-muted text-[13.5px] leading-relaxed mb-6">
          You won't see them again in Discover, Likes, Matches, or Chat.
          They won't be able to message you. They won't be told you blocked them.
        </p>

        {error && (
          <div className="mb-3 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <button
          onClick={confirm}
          disabled={busy}
          className="w-full h-12 rounded-full bg-danger text-white font-bold text-[14.5px] mb-2 disabled:opacity-50"
        >
          {busy ? 'Blocking…' : 'Block'}
        </button>
        <button
          onClick={onClose}
          className="w-full h-11 text-muted font-semibold text-[13.5px]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
