import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { usePresence } from './lib/usePresence'
import MaintenanceScreen from './components/MaintenanceScreen'
import GlobalMatchCelebration from './components/GlobalMatchCelebration'
import GlobalEventPopup from './components/GlobalEventPopup'
import { WalletProvider } from './lib/wallet'
import { VoiceCallProvider } from './lib/voiceCall'
import { NotificationsProvider } from './lib/notifications'
import { supabase } from './lib/supabase'
import BottomNav from './components/BottomNav'
import BrandGlow from './components/BrandGlow'

import Welcome from './screens/Welcome'
import SignUp from './screens/SignUp'
import SignIn from './screens/SignIn'
import ResetPassword from './screens/ResetPassword'
import Onboarding from './screens/Onboarding'
import Discover from './screens/Discover'
import Stories from './screens/Stories'
import Filters from './screens/Filters'
import Terms from './screens/Terms'
import About from './screens/About'
import Privacy from './screens/Privacy'
import Verify from './screens/Verify'
import Roadmap from './screens/Roadmap'
import Feed from './screens/Feed'
import Reels from './screens/Reels'
import Search from './screens/Search'
import Online from './screens/Online'
import Boost from './screens/Boost'
import AdminVerifications from './screens/AdminVerifications'
import Likes from './screens/Likes'
import Matches from './screens/Matches'
import Messages from './screens/Messages'
import Chat from './screens/Chat'
import SafetyCenter from './screens/SafetyCenter'
import BlockedList from './screens/BlockedList'
import ProfileView from './screens/ProfileView'
import EditProfile from './screens/EditProfile'
import Preview from './screens/Preview'
import ProfileSettings from './screens/ProfileSettings'
import ProfileViewers from './screens/ProfileViewers'
import Admin from './screens/Admin'
import FacebookReward from './screens/FacebookReward'
import AccountSecurity from './screens/AccountSecurity'
import Wallet from './screens/Wallet'
import Premium from './screens/Premium'
import Invite from './screens/Invite'
import Communities from './screens/Communities'
import CommunityView from './screens/CommunityView'
import Notifications from './screens/Notifications'
import DeleteAccountModal from './components/DeleteAccountModal'
import CallOverlay from './components/CallOverlay'

function Loading() {
  return (
    <div className="mobile-shell grid place-items-center">
      <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
    </div>
  )
}

function Guard({ children }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/" replace />
  if (profile?.is_banned) return <BannedScreen reason={profile.banned_reason} />
  return children
}

function BannedScreen({ reason }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
      background: '#0B0B14', padding: 24, textAlign: 'center', zIndex: 9999
    }}>
      <div style={{ maxWidth: 340 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🚫</div>
        <h1 className="text-cream text-[22px] font-extrabold mb-3">Account suspended</h1>
        <p className="text-muted text-[14px] leading-relaxed mb-4">
          {reason || 'Your account has been suspended for violating our community guidelines.'}
        </p>
        <p className="text-muted text-[13px] leading-relaxed mb-2">
          If you believe this is a mistake, contact support:
        </p>
        <a
          href="https://wa.me/25765394084"
          target="_blank"
          rel="noopener"
          className="text-purple-300 font-semibold text-[14px]"
        >
          +257 65 39 40 84
        </a>
        <button
          onClick={async () => { const { supabase } = await import('./lib/supabase'); await supabase.auth.signOut() }}
          className="block w-full mt-8 h-11 rounded-full bg-white/[0.06] border border-white/12 text-cream font-semibold text-[14px]"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function PublicOnly({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <Loading />
  if (session) return <Navigate to="/feed" replace />
  return children
}


function MaintenanceGate({ children }) {
  const { profile, loading: authLoading } = useAuth()
  const [state, setState] = useState({ loading: true, on: false, message: "" })

  useEffect(() => {
    let cancelled = false
    supabase
      .from("app_config")
      .select("key, value")
      .in("key", ["maintenance_mode", "maintenance_message"])
      .then(({ data }) => {
        if (cancelled) return
        const map = {}
        ;(data || []).forEach((r) => { map[r.key] = r.value })
        setState({
          loading: false,
          on: map.maintenance_mode === "true",
          message: map.maintenance_message || "",
        })
      })
    return () => { cancelled = true }
  }, [])

  if (state.loading || authLoading) return null
  if (!state.on) return children
  // Admin bypasses maintenance
  if (profile?.is_admin) return children
  return <MaintenanceScreen message={state.message} />
}

function PresenceKeeper() {
  usePresence()
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <PresenceKeeper />
      <WalletProvider>
      <NotificationsProvider>
      <GlobalMatchCelebration />
      <GlobalEventPopup />
      <VoiceCallProvider>
      <MaintenanceGate>
      <Routes>
        <Route path="/" element={<PublicOnly><Welcome /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><SignUp /></PublicOnly>} />
        <Route path="/signin" element={<PublicOnly><SignIn /></PublicOnly>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/onboarding" element={<Guard><Onboarding /></Guard>} />
        <Route path="/feed" element={<Guard><Feed /></Guard>} />
        <Route path="/reels" element={<Guard><Reels /></Guard>} />
        <Route path="/search" element={<Guard><Search /></Guard>} />
        <Route path="/online" element={<Guard><Online /></Guard>} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/discover" element={<Guard><Discover /></Guard>} />
        <Route path="/stories" element={<Guard><Stories /></Guard>} />
        <Route path="/filters" element={<Guard><Filters /></Guard>} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/verify" element={<Guard><Verify /></Guard>} />
        <Route path="/boost" element={<Guard><Boost /></Guard>} />
        <Route path="/admin/verifications" element={<Guard><AdminVerifications /></Guard>} />
        <Route path="/likes"    element={<Guard><Likes /></Guard>} />
        <Route path="/matches"  element={<Guard><Matches /></Guard>} />
        <Route path="/messages" element={<Guard><Messages /></Guard>} />
        <Route path="/messages/:userId" element={<Guard><Chat /></Guard>} />
        <Route path="/me"         element={<Guard><ProfileSettings /></Guard>} />
        <Route path="/me/preview"  element={<Guard><Preview /></Guard>} />
        <Route path="/profile-views" element={<Guard><ProfileViewers /></Guard>} />
        <Route path="/admin" element={<Guard><Admin /></Guard>} />
        <Route path="/facebook-reward" element={<Guard><FacebookReward /></Guard>} />
        <Route path="/settings/security" element={<Guard><AccountSecurity /></Guard>} />
        <Route path="/safety"   element={<Guard><SafetyCenter /></Guard>} />
        <Route path="/blocked"  element={<Guard><BlockedList /></Guard>} />
        <Route path="/profile/:userId" element={<Guard><ProfileView /></Guard>} />
        <Route path="/me/edit" element={<Guard><EditProfile /></Guard>} />
        <Route path="/me/preview" element={<Guard><Preview /></Guard>} />
        <Route path="/wallet" element={<Guard><Wallet /></Guard>} />
        <Route path="/premium" element={<Guard><Premium /></Guard>} />
        <Route path="/invite" element={<Guard><Invite /></Guard>} />
        <Route path="/communities" element={<Guard><Communities /></Guard>} />
        <Route path="/communities/:id" element={<Guard><CommunityView /></Guard>} />
        <Route path="/communities/:id/discover" element={<Guard><Discover /></Guard>} />
        <Route path="/notifications" element={<Guard><Notifications /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </MaintenanceGate>
      <CallOverlay />
      </VoiceCallProvider>
      </NotificationsProvider>
      </WalletProvider>
    </AuthProvider>
  )
}
