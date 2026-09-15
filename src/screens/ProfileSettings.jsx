import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ShieldCheck, UserX, LogOut, ChevronRight,
  Wallet as WalletIcon, Crown, Trash2, Bell, Gift, FileText, Zap
} from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import DeleteAccountModal from '../components/DeleteAccountModal'
import BrandGlow from '../components/BrandGlow'
import BottomNav from '../components/BottomNav'

export default function ProfileSettings() {
  const nav = useNavigate()
  const { profile, session } = useAuth()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const initial = (profile?.display_name || 'U')[0].toUpperCase()

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
        className="px-3 flex items-center gap-2"
      >
        <button
          onClick={() => nav(-1)}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Settings</span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-10">
        {/* Profile header */}
        <button
          type="button"
          onClick={() => nav('/me/preview')}
          className="flex items-center gap-4 mb-8 text-left w-full active:opacity-70 transition-opacity"
          aria-label="Back to preview"
        >
          <div className="w-16 h-16 rounded-full bg-purple-600 grid place-items-center text-white text-2xl font-black shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-cream font-bold text-[18px] truncate">
              {profile?.display_name || 'Your name'}
            </p>
            <p className="text-muted text-[13px] truncate">
              @{profile?.username || 'username'}
            </p>
            <p className="text-subtle text-[11.5px] mt-0.5 truncate">
              {session?.user?.email}
            </p>
          </div>
        </button>

        <div className="flex flex-col gap-2">
          <MenuItem icon={<Gift size={18} />} label="Invite friends" onClick={() => nav('/invite')} />
          <MenuItem icon={<Bell size={18} />} label="Notifications" onClick={() => nav('/notifications')} />
          <MenuItem icon={<Crown size={18} />} label="Premium" onClick={() => nav('/premium')} />
          <MenuItem icon={<Zap size={18} />} label="Boost my profile" onClick={() => nav('/boost')} />
          <MenuItem icon={<WalletIcon size={18} />} label="Wallet" onClick={() => nav('/wallet')} />
          {profile?.is_admin && (
            <MenuItem
              icon={<ShieldCheck size={18} />}
              label="Review verifications"
              onClick={() => nav('/admin/verifications')}
            />
          )}
          <MenuItem icon={<ShieldCheck size={18} />} label="Get verified" onClick={() => nav('/verify')} />
          <MenuItem icon={<ShieldCheck size={18} />} label="Safety Center" onClick={() => nav('/safety')} />
          <MenuItem icon={<UserX size={18} />} label="Blocked users" onClick={() => nav('/blocked')} />
          <MenuItem icon={<FileText size={18} />} label="Terms of Service" onClick={() => nav('/terms')} />
          <MenuItem icon={<ShieldCheck size={18} />} label="Privacy Policy" onClick={() => nav('/privacy')} />
          <MenuItem
            icon={<LogOut size={18} />}
            label="Sign out"
            danger
            onClick={async () => {
              await supabase.auth.signOut()
              nav('/', { replace: true })
            }}
          />
          <MenuItem
            icon={<Trash2 size={18} />}
            label="Delete account"
            danger
            onClick={() => setDeleteOpen(true)}
          />
        </div>

        <p className="text-center text-subtle text-[11px] mt-10">
          Nakubonye · v2.0
        </p>
      </div>

      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => nav('/', { replace: true })}
      />

      <div style={{ height: 72, flexShrink: 0 }} />
      <BottomNav />
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 rounded-2xl bg-surface border border-white/8 text-left ${danger ? 'text-danger' : 'text-cream'}`}
    >
      <span className="w-9 h-9 rounded-xl bg-white/[0.05] grid place-items-center shrink-0">
        {icon}
      </span>
      <span className="flex-1 font-semibold text-[14.5px]">{label}</span>
      <ChevronRight size={18} className="text-subtle" />
    </button>
  )
}
