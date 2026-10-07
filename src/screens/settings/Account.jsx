import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, User, Mail, Phone, Lock, Activity, PauseCircle, Trash2, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { tap } from '../../lib/haptic'
import BrandGlow from '../../components/BrandGlow'
import DeleteAccountModal from '../../components/DeleteAccountModal'

export default function Account() {
  const nav = useNavigate()
  const { session, profile } = useAuth()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (session?.user?.email) setEmail(session.user.email)
    if (profile?.phone) setPhone(profile.phone)
  }, [session, profile])

  return (
    <div style={{
      position: 'fixed', inset: 0, margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />

      <header className="shrink-0 flex items-center gap-2 px-3 h-14 border-b border-white/6"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button onClick={() => { tap('light'); nav(-1) }}
          className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-extrabold text-[16px]">Account</span>
      </header>

      <div className="flex-1 overflow-y-auto pb-10">

        <SectionTitle>Personal details</SectionTitle>
        <Row
          icon={User}
          label="Name, username, photo"
          sub="How you appear on Nakubonye"
          to="/me/edit"
          onNav={nav}
        />

        <SectionTitle>Login & security</SectionTitle>
        <Row
          icon={Mail}
          label="Email"
          value={email || '—'}
          to="/settings/security"
          onNav={nav}
        />
        <Row
          icon={Phone}
          label="Phone number"
          value={phone || 'Not set'}
          to="/settings/security"
          onNav={nav}
        />
        <Row
          icon={Lock}
          label="Password"
          sub="Change your password"
          to="/settings/security"
          onNav={nav}
        />
        <Row
          icon={Activity}
          label="Where you're logged in"
          sub="Devices and sessions"
          to="/settings/security"
          onNav={nav}
        />

        <SectionTitle>Account status</SectionTitle>
        <Row
          icon={PauseCircle}
          label="Deactivate my account"
          sub="Temporarily hide your profile"
          soon
        />
        <Row
          icon={Trash2}
          label="Delete my account"
          sub="Permanently remove everything"
          danger
          onClick={() => { tap('medium'); setDeleteOpen(true) }}
        />

      </div>

      {deleteOpen && <DeleteAccountModal onClose={() => setDeleteOpen(false)} />}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mt-6 mb-2 px-4">
      {children}
    </p>
  )
}

function Row({ icon: Icon, label, sub, value, to, onNav, soon, danger, onClick }) {
  function handle() {
    tap('light')
    if (onClick) { onClick(); return }
    if (to && onNav) onNav(to)
  }
  return (
    <button
      onClick={handle}
      disabled={soon}
      className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left active:bg-white/[0.03] disabled:opacity-45"
    >
      <span className={`shrink-0 ${danger ? 'text-red-400' : 'text-cream'}`}>
        <Icon size={19} strokeWidth={2.1} />
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-[14.5px] font-medium ${danger ? 'text-red-300' : 'text-cream'}`}>
          {label}
        </p>
        {sub && <p className="text-muted text-[12px] mt-0.5 leading-snug">{sub}</p>}
      </div>
      {value && (
        <span className="text-muted text-[12.5px] max-w-[140px] truncate shrink-0">
          {value}
        </span>
      )}
      {soon && <span className="text-subtle text-[11px] shrink-0">Soon</span>}
      {!soon && !value && (
        <ChevronRight size={16} className="text-muted shrink-0" strokeWidth={2.3} />
      )}
    </button>
  )
}
