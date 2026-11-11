import { useRef, useState } from 'react'
import { X, Copy, Check, Share2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { shareContent } from '../lib/share'
import { tap } from '../lib/haptic'

export default function ShareProfileSheet({ open, onClose, username, displayName }) {
  const { session } = useAuth()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef(null)

  if (!open) return null

  const myId = session?.user?.id
  const handle = username || myId?.slice(0, 8) || 'me'
  const profileUrl = 'https://nakubonye.app/u/' + handle

  async function copyLink() {
    tap('light')
    try {
      await navigator.clipboard.writeText(profileUrl)
      setCopied(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 1800)
    } catch (e) {
      console.warn('copy failed', e)
    }
  }

  async function nativeShare() {
    tap('medium')
    await shareContent({
      title: displayName ? displayName + ' on Nakubonye' : 'Nakubonye',
      text: displayName ? 'Follow ' + displayName + ' on Nakubonye' : 'Find me on Nakubonye',
      url: profileUrl,
      dialogTitle: 'Share profile',
    })
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 flex flex-col"
        style={{ paddingBottom: 'max(20px, var(--safe-bottom, 8px))' }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="w-9" />
          <h3 className="text-cream font-extrabold text-[15px]">Share profile</h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full grid place-items-center text-muted"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col items-center">
          <div className="bg-white rounded-3xl p-4 mb-4">
            <QRCodeSVG
              value={profileUrl}
              size={200}
              level="M"
              bgColor="#FFFFFF"
              fgColor="#4C1D95"
            />
          </div>

          <p className="text-cream font-bold text-[15px] mb-1">
            {displayName || '@' + handle}
          </p>
          <p className="text-muted text-[12.5px] mb-5">
            Scan or share this link to follow
          </p>

          <div className="w-full flex items-center gap-2 p-3 rounded-2xl bg-white/[0.04] border border-white/10 mb-4">
            <span className="flex-1 text-cream text-[13px] truncate">
              {profileUrl}
            </span>
            <button
              onClick={copyLink}
              className="shrink-0 h-9 px-3 rounded-full bg-white/[0.08] border border-white/12 text-cream text-[12.5px] font-semibold inline-flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check size={13} strokeWidth={3} className="text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={13} />
                  Copy
                </>
              )}
            </button>
          </div>

          <button
            onClick={nativeShare}
            className="w-full h-12 rounded-full text-white font-bold text-[14.5px] inline-flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)' }}
          >
            <Share2 size={16} />
            Share via…
          </button>
        </div>
      </div>
    </div>
  )
}
