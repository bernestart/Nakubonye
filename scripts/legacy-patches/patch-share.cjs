const fs = require('fs');

// ---------- 1. New ShareProfileSheet component ----------
{
  const p = 'src/components/ShareProfileSheet.jsx';
  const code = `import { useRef, useState } from 'react'
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
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
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
`;
  fs.writeFileSync(p, code);
  console.log('✅ ShareProfileSheet.jsx created');
}

// ---------- 2. Wire into ProfileSettings ----------
{
  const p = 'src/screens/ProfileSettings.jsx';
  let s = fs.readFileSync(p, 'utf8');
  let n = 0;
  function apply(find, replace, label) {
    if (!s.includes(find)) { console.error('❌', label); process.exit(1); }
    s = s.replace(find, replace); console.log('✅', label); n++;
  }

  // Import
  apply(
`import BrandGlow from '../components/BrandGlow'`,
`import BrandGlow from '../components/BrandGlow'
import ShareProfileSheet from '../components/ShareProfileSheet'`,
'import ShareProfileSheet');

  // State
  apply(
`  const [composerOpen, setComposerOpen] = useState(false)`,
`  const [composerOpen, setComposerOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)`,
'add shareOpen state');

  // Row — insert right after the "Creator mode" row
  apply(
`          <button
            onClick={() => { tap('light'); nav('/saved') }}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-white/[0.03]"
          >
            <span className="shrink-0 text-cream">
              <Bookmark size={18} />
            </span>
            <span className="flex-1 text-cream text-[15px] font-medium">Saved</span>
            <ChevronRight size={18} className="text-muted shrink-0" />
          </button>`,
`          <button
            onClick={() => { tap('light'); setShareOpen(true) }}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-white/[0.03]"
          >
            <span className="shrink-0 text-purple-300">
              <Share2 size={18} />
            </span>
            <span className="flex-1 text-cream text-[15px] font-medium">Share profile</span>
            <ChevronRight size={18} className="text-muted shrink-0" />
          </button>

          <button
            onClick={() => { tap('light'); nav('/saved') }}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-white/[0.03]"
          >
            <span className="shrink-0 text-cream">
              <Bookmark size={18} />
            </span>
            <span className="flex-1 text-cream text-[15px] font-medium">Saved</span>
            <ChevronRight size={18} className="text-muted shrink-0" />
          </button>`,
'share profile row');

  // Render sheet + pass username
  apply(
`      {composerOpen && (
        <StoryComposer`,
`      <ShareProfileSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        username={profile?.username}
        displayName={profile?.display_name}
      />

      {composerOpen && (
        <StoryComposer`,
'render sheet');

  // Import Share2 icon
  apply(
`import { ArrowLeft, ChevronRight, ChevronDown, LogOut, Bell, Gift, Crown, Wallet as WalletIcon, UserX, Shield, ShieldCheck, Info, FileText, Eye, Zap, Key, Users, User, Plus, Bookmark, LayoutGrid, Play, Heart, Store, Briefcase, Calendar, Clock, Camera, Star, Layers, WifiOff, Coins, UserCircle, MessageCircle, Globe, Activity, Ban, Download, Sparkles } from 'lucide-react'`,
`import { ArrowLeft, ChevronRight, ChevronDown, LogOut, Bell, Gift, Crown, Wallet as WalletIcon, UserX, Shield, ShieldCheck, Info, FileText, Eye, Zap, Key, Users, User, Plus, Bookmark, LayoutGrid, Play, Heart, Store, Briefcase, Calendar, Clock, Camera, Star, Layers, WifiOff, Coins, UserCircle, MessageCircle, Globe, Activity, Ban, Download, Sparkles, Share2 } from 'lucide-react'`,
'import Share2');

  fs.writeFileSync(p, s);
  console.log(`✅ ProfileSettings.jsx — ${n} edits`);
}

console.log('\n✅ all done');
