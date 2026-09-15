import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function DeleteAccountModal({ open, onClose, onDeleted }) {
  const { session } = useAuth()
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const ready = confirmText.trim().toUpperCase() === 'DELETE'

  async function confirm() {
    if (!ready || !session?.user?.id) return
    setBusy(true); setError('')

    const { error: err } = await supabase.rpc('delete_my_account')

    if (err) {
      setBusy(false)
      setError(err.message)
      return
    }

    // Clear local session and hand back to the parent for redirect
    await supabase.auth.signOut()
    setBusy(false)
    onDeleted?.()
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-end sm:place-items-center bg-obsidian/90 backdrop-blur-md">
      <div className="w-full max-w-[480px] bg-surface rounded-t-[28px] sm:rounded-[28px] border border-white/10 p-6 relative overflow-hidden">
        <button
          onClick={onClose}
          disabled={busy}
          className="absolute top-4 right-4 w-8 h-8 rounded-full grid place-items-center text-muted disabled:opacity-50"
          aria-label="Close"
        >
          <X size={18} strokeWidth={2.4} />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/40 grid place-items-center mx-auto mb-4">
          <AlertTriangle size={26} strokeWidth={2.2} className="text-red-400" />
        </div>

        <h3 className="text-cream font-extrabold text-[19px] text-center mb-2">
          Delete your account?
        </h3>
        <p className="text-muted text-[13.5px] text-center mb-5 px-3 leading-relaxed">
          This is permanent. Your profile, photos, matches, messages, and coin balance
          will be deleted. <strong className="text-cream">This cannot be undone.</strong>
        </p>

        <div className="rounded-2xl bg-red-500/8 border border-red-500/25 p-3.5 mb-5 text-[12.5px] text-red-300 leading-relaxed">
          Coins and Premium time are not refunded. If you have an active subscription,
          cancel it in the store before deleting.
        </div>

        <label className="block mb-5">
          <span className="block text-[12.5px] font-semibold text-muted mb-2">
            Type <span className="text-red-400 font-black">DELETE</span> to confirm
          </span>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="DELETE"
            disabled={busy}
            className="w-full bg-elevated border border-white/8 rounded-2xl px-4 py-3 text-cream text-[14.5px] placeholder:text-subtle focus:outline-none focus:border-red-500 disabled:opacity-50"
          />
        </label>

        {error && (
          <div className="mb-3 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <button
          onClick={confirm}
          disabled={!ready || busy}
          className="w-full h-12 rounded-full bg-red-500 text-white font-bold text-[14.5px] mb-2 disabled:opacity-40"
        >
          {busy ? 'Deleting…' : 'Delete my account'}
        </button>
        <button
          onClick={onClose}
          disabled={busy}
          className="w-full h-11 text-muted font-semibold text-[13.5px] disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
