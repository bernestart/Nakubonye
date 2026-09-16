import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { usePresence } from './lib/usePresence'
import { WalletProvider } from './lib/wallet'
import { VoiceCallProvider } from './lib/voiceCall'
import { NotificationsProvider } from './lib/notifications'
import { supabase } from './lib/supabase'
import BottomNav from './components/BottomNav'
import BrandGlow from './components/BrandGlow'

import Welcome from './screens/Welcome'
import SignUp from './screens/SignUp'
import SignIn from './screens/SignIn'
import Onboarding from './screens/Onboarding'
import Discover from './screens/Discover'
import Filters from './screens/Filters'
import Terms from './screens/Terms'
import About from './screens/About'
import Privacy from './screens/Privacy'
import Verify from './screens/Verify'
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
import Wallet from './screens/Wallet'
import Premium from './screens/Premium'
import Invite from './screens/Invite'
import Communities from './screens/Communities'
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
  const { session, loading } = useAuth()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/" replace />
  return children
}

function PublicOnly({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <Loading />
  if (session) return <Navigate to="/discover" replace />
  return children
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
      <VoiceCallProvider>
      <Routes>
        <Route path="/" element={<PublicOnly><Welcome /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><SignUp /></PublicOnly>} />
        <Route path="/signin" element={<PublicOnly><SignIn /></PublicOnly>} />
        <Route path="/onboarding" element={<Guard><Onboarding /></Guard>} />
        <Route path="/discover" element={<Guard><Discover /></Guard>} />
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
        <Route path="/safety"   element={<Guard><SafetyCenter /></Guard>} />
        <Route path="/blocked"  element={<Guard><BlockedList /></Guard>} />
        <Route path="/profile/:userId" element={<Guard><ProfileView /></Guard>} />
        <Route path="/me/edit" element={<Guard><EditProfile /></Guard>} />
        <Route path="/me/preview" element={<Guard><Preview /></Guard>} />
        <Route path="/wallet" element={<Guard><Wallet /></Guard>} />
        <Route path="/premium" element={<Guard><Premium /></Guard>} />
        <Route path="/invite" element={<Guard><Invite /></Guard>} />
        <Route path="/communities" element={<Guard><Communities /></Guard>} />
        <Route path="/notifications" element={<Guard><Notifications /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CallOverlay />
      </VoiceCallProvider>
      </NotificationsProvider>
      </WalletProvider>
    </AuthProvider>
  )
}
