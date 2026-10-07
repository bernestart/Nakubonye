import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { SettingsProvider } from './lib/settings.jsx'
import RatePrompt from './components/RatePrompt'
import { recordSession, shouldPrompt } from './lib/ratePrompt'
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
import OnboardingSuggestions from './screens/OnboardingSuggestions'
import Discover from './screens/Discover'
import Stories from './screens/Stories'
import Filters from './screens/Filters'
import Terms from './screens/Terms'
import About from './screens/About'
import Privacy from './screens/Privacy'
import Verify from './screens/Verify'
import VerifyIdentity from './screens/VerifyIdentity'
import Roadmap from './screens/Roadmap'
import Feed from './screens/Feed'
import PostDetail from './screens/PostDetail'
import Saved from './screens/Saved'
import EventDetail from './screens/EventDetail'
import CommunityRequests from './screens/CommunityRequests'
import StoryArchive from './screens/StoryArchive'
import Memories from './screens/Memories'
import Drafts from './screens/Drafts'
import MutedWords from './screens/MutedWords'
import MutedUsers from './screens/MutedUsers'
import InnerCircle from './screens/InnerCircle'
import Circles from './screens/Circles'
import CircleDetail from './screens/CircleDetail'
import OfflineReels from './screens/OfflineReels'
import NotificationSettings from './screens/NotificationSettings'
import Reels from './screens/Reels'
import FollowList from './screens/FollowList'
import Create from './screens/Create'
import Search from './screens/Search'
import Online from './screens/Online'
import AdminVerifications from './screens/AdminVerifications'
import Likes from './screens/Likes'
import Matches from './screens/Matches'
import Messages from './screens/Messages'
import MessagesSearch from './screens/MessagesSearch'
import MessagingSettings from './screens/MessagingSettings'
import ChatInfo from './screens/ChatInfo'
import ArchivedMessages from './screens/ArchivedMessages'
import MessageRequests from './screens/MessageRequests'
import Chat from './screens/Chat'
import SafetyCenter from './screens/SafetyCenter'
import BlockedList from './screens/BlockedList'
import ProfileView from './screens/ProfileView'
import EditProfile from './screens/EditProfile'
import Preview from './screens/Preview'
import ProfileSettings from './screens/ProfileSettings'
import Monetization from './screens/Monetization'
import PrivacySettings from './screens/PrivacySettings'
import YourData from './screens/settings/YourData'
import BlockingMuted from './screens/settings/BlockingMuted'
import ContentAudience from './screens/settings/ContentAudience'
import PendingTags from './screens/PendingTags'
import Marketplace from './screens/Marketplace'
import CreateGroup from './screens/CreateGroup'
import GroupChat from './screens/GroupChat'
import JoinGroup from './screens/JoinGroup'
import EditGroup from './screens/EditGroup'
import GroupMembers from './screens/GroupMembers'
import AddGroupMembers from './screens/AddGroupMembers'
import CreateListing from './screens/CreateListing'
import Services from './screens/Services'
import MyBookings from './screens/MyBookings'
import BookService from './screens/BookService'
import CreateService from './screens/CreateService'
import ServiceDetail from './screens/ServiceDetail'
import MyListings from './screens/MyListings'
import EditListing from './screens/EditListing'
import ListingDetail from './screens/ListingDetail'
import ComingSoon from './screens/_ComingSoon'
import Admin from './screens/Admin'
import FacebookReward from './screens/FacebookReward'
import AccountSecurity from './screens/AccountSecurity'
import Invite from './screens/Invite'
import Communities from './screens/Communities'
import CreateCommunity from './screens/CreateCommunity'
import CommunityView from './screens/CommunityView'
import EditCommunity from './screens/EditCommunity'
import JoinCommunity from './screens/JoinCommunity'
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


function RatePromptGate({ children }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Count this session (once per boot)
    recordSession()
    // Small delay so app finishes loading first
    const t = setTimeout(() => {
      if (shouldPrompt()) setShow(true)
    }, 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      {children}
      {show && <RatePrompt onClose={() => setShow(false)} />}
    </>
  )
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
      <SettingsProvider>
      <PresenceKeeper />
      <WalletProvider>
      <NotificationsProvider>
      <GlobalMatchCelebration />
      <GlobalEventPopup />
      <VoiceCallProvider>
      <RatePromptGate>
      <MaintenanceGate>
      <Routes>
        <Route path="/" element={<PublicOnly><Welcome /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><SignUp /></PublicOnly>} />
        <Route path="/signin" element={<PublicOnly><SignIn /></PublicOnly>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/onboarding" element={<Guard><Onboarding /></Guard>} />
        <Route path="/onboarding/suggestions" element={<Guard><OnboardingSuggestions /></Guard>} />
        <Route path="/feed" element={<Guard><Feed /></Guard>} />
        <Route path="/post/:source/:id" element={<Guard><PostDetail /></Guard>} />
        <Route path="/reels" element={<Guard><Reels /></Guard>} />
        <Route path="/user/:userId/followers" element={<Guard><FollowList /></Guard>} />
        <Route path="/user/:userId/following" element={<Guard><FollowList /></Guard>} />
        <Route path="/create" element={<Guard><Create /></Guard>} />
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
        <Route path="/verify-identity" element={<Guard><VerifyIdentity /></Guard>} />
        <Route path="/admin/verifications" element={<Guard><AdminVerifications /></Guard>} />
        <Route path="/likes"    element={<Guard><Likes /></Guard>} />
        <Route path="/matches"  element={<Guard><Matches /></Guard>} />
        <Route path="/messages" element={<Guard><Messages /></Guard>} />
        <Route path="/messages/settings" element={<Guard><MessagingSettings /></Guard>} />
        <Route path="/messages/search" element={<Guard><MessagesSearch /></Guard>} />
        <Route path="/messages/:userId/info" element={<Guard><ChatInfo /></Guard>} />
        <Route path="/messages/archived" element={<Guard><ArchivedMessages /></Guard>} />
        <Route path="/messages/requests" element={<Guard><MessageRequests /></Guard>} />
        <Route path="/messages/:userId" element={<Guard><Chat /></Guard>} />
        <Route path="/me"         element={<Guard><ProfileSettings /></Guard>} />
        <Route path="/monetization" element={<Guard><Monetization /></Guard>} />
        <Route path="/saved" element={<Guard><Saved /></Guard>} />
        <Route path="/story-archive" element={<Guard><StoryArchive /></Guard>} />
        <Route path="/memories" element={<Guard><Memories /></Guard>} />
        <Route path="/drafts" element={<Guard><Drafts /></Guard>} />
        <Route path="/settings/muted-words" element={<Guard><MutedWords /></Guard>} />
        <Route path="/settings/muted-users" element={<Guard><MutedUsers /></Guard>} />
        <Route path="/inner-circle" element={<Guard><InnerCircle /></Guard>} />
        <Route path="/circles" element={<Guard><Circles /></Guard>} />
        <Route path="/circles/:id" element={<Guard><CircleDetail /></Guard>} />
        <Route path="/offline-reels" element={<Guard><OfflineReels /></Guard>} />
        <Route path="/settings/notifications" element={<Guard><NotificationSettings /></Guard>} />
        <Route path="/community/:communityId/event/:eventId" element={<Guard><EventDetail /></Guard>} />
        <Route path="/communities/:id/requests" element={<Guard><CommunityRequests /></Guard>} />
        <Route path="/marketplace" element={<Guard><Marketplace /></Guard>} />
        <Route path="/groups/new" element={<Guard><CreateGroup /></Guard>} />
        <Route path="/groups/:id" element={<Guard><GroupChat /></Guard>} />
        <Route path="/groups/:id/edit" element={<Guard><EditGroup /></Guard>} />
        <Route path="/join/:code" element={<Guard><JoinGroup /></Guard>} />
        <Route path="/groups/:id/members" element={<Guard><GroupMembers /></Guard>} />
        <Route path="/groups/:id/add" element={<Guard><AddGroupMembers /></Guard>} />
        <Route path="/marketplace/new" element={<Guard><CreateListing /></Guard>} />
        <Route path="/marketplace/:id" element={<Guard><ListingDetail /></Guard>} />
        <Route path="/me/listings" element={<Guard><MyListings /></Guard>} />
        <Route path="/marketplace/:id/edit" element={<Guard><EditListing /></Guard>} />
        <Route path="/services" element={<Guard><Services /></Guard>} />
        <Route path="/services/new" element={<Guard><CreateService /></Guard>} />
        <Route path="/services/:id" element={<Guard><ServiceDetail /></Guard>} />
        <Route path="/services/:id/book" element={<Guard><BookService /></Guard>} />
        <Route path="/me/bookings" element={<Guard><MyBookings /></Guard>} />
        <Route path="/me/preview"  element={<Guard><Preview /></Guard>} />
        <Route path="/admin" element={<Guard><Admin /></Guard>} />
        <Route path="/facebook-reward" element={<Guard><FacebookReward /></Guard>} />
        <Route path="/settings/security" element={<Guard><AccountSecurity /></Guard>} />
        <Route path="/settings/privacy" element={<Guard><PrivacySettings /></Guard>} />
        <Route path="/settings/your-data" element={<Guard><YourData /></Guard>} />
        <Route path="/settings/blocking-muted" element={<Guard><BlockingMuted /></Guard>} />
        <Route path="/settings/content-audience" element={<Guard><ContentAudience /></Guard>} />
        <Route path="/settings/pending-tags" element={<Guard><PendingTags /></Guard>} />
        <Route path="/safety"   element={<Guard><SafetyCenter /></Guard>} />
        <Route path="/blocked"  element={<Guard><BlockedList /></Guard>} />
        <Route path="/profile/:userId" element={<Guard><ProfileView /></Guard>} />
        <Route path="/me/edit" element={<Guard><EditProfile /></Guard>} />
        <Route path="/me/preview" element={<Guard><Preview /></Guard>} />
        <Route path="/invite" element={<Guard><Invite /></Guard>} />
        <Route path="/communities" element={<Guard><Communities /></Guard>} />
        <Route path="/communities/new" element={<Guard><CreateCommunity /></Guard>} />
        <Route path="/communities/:id" element={<Guard><CommunityView /></Guard>} />
        <Route path="/communities/:id/edit" element={<Guard><EditCommunity /></Guard>} />
        <Route path="/join-community/:code" element={<JoinCommunity />} />
        <Route path="/communities/:id/discover" element={<Guard><Discover /></Guard>} />
        <Route path="/notifications" element={<Guard><Notifications /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </MaintenanceGate>
      </RatePromptGate>
      <CallOverlay />
      </VoiceCallProvider>
      </NotificationsProvider>
      </WalletProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}
