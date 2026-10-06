import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

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

    const { error: err } = await supabase.from('blocks').insert({
      blocker_id: me,
      blocked_id: them,
    })
    setBusy(false)
    if (err) { setError(err.message); return }

    // Cleanup: remove any photo_tags connecting the two users (both directions)
    // Fire-and-forget — block already succeeded, cleanup shouldn't block the UX.
    try {
      Promise.all([
        supabase.from('photo_tags').delete().eq('tagger_id', me).eq('tagged_user_id', them),
        supabase.from('photo_tags').delete().eq('tagger_id', them).eq('tagged_user_id', me),
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
