import { useMyPresence } from './hooks/usePresence';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { useSafeArea } from './lib/useSafeArea'
import { AuthProvider, useAuth } from './lib/auth'
import { SettingsProvider } from './lib/settings.jsx'
import RatePrompt from './components/RatePrompt'
import { recordSession, shouldPrompt } from './lib/ratePrompt'
import { usePresence } from './lib/usePresence'
import MaintenanceScreen from './components/MaintenanceScreen'
import GlobalMatchCelebration from './components/GlobalMatchCelebration'
import GlobalEventPopup from './components/GlobalEventPopup'
import InAppNotificationBanner from './components/InAppNotificationBanner'
import { WalletProvider } from './lib/wallet'
import { VoiceCallProvider } from './lib/voiceCall'
import { NotificationsProvider } from './lib/notifications'
import { supabase } from './lib/supabase'
import BottomNav from './components/BottomNav'
import BrandGlow from './components/BrandGlow'

const Welcome = lazy(() => import('./screens/Welcome'));
const SignUp = lazy(() => import('./screens/SignUp'));
const SignIn = lazy(() => import('./screens/SignIn'));
const ResetPassword = lazy(() => import('./screens/ResetPassword'));
const Onboarding = lazy(() => import('./screens/Onboarding'));
const OnboardingSuggestions = lazy(() => import('./screens/OnboardingSuggestions'));
const Discover = lazy(() => import('./screens/Discover'));
const Filters = lazy(() => import('./screens/Filters'));
const Terms = lazy(() => import('./screens/Terms'));
const About = lazy(() => import('./screens/About'));
const Privacy = lazy(() => import('./screens/Privacy'));
const Verify = lazy(() => import('./screens/Verify'));
const VerifyIdentity = lazy(() => import('./screens/VerifyIdentity'));
const Roadmap = lazy(() => import('./screens/Roadmap'));
const Feed = lazy(() => import('./screens/Feed'));
const PostDetail = lazy(() => import('./screens/PostDetail'));
const Saved = lazy(() => import('./screens/Saved'));
const EventDetail = lazy(() => import('./screens/EventDetail'));
const CommunityRequests = lazy(() => import('./screens/CommunityRequests'));
const StoryArchive = lazy(() => import('./screens/StoryArchive'));
const Memories = lazy(() => import('./screens/Memories'));
const Drafts = lazy(() => import('./screens/Drafts'));
const MutedWords = lazy(() => import('./screens/MutedWords'));
const MutedUsers = lazy(() => import('./screens/MutedUsers'));
const InnerCircle = lazy(() => import('./screens/InnerCircle'));
const Circles = lazy(() => import('./screens/Circles'));
const CircleDetail = lazy(() => import('./screens/CircleDetail'));
const OfflineReels = lazy(() => import('./screens/OfflineReels'));
const NotificationSettings = lazy(() => import('./screens/NotificationSettings'));
const Reels = lazy(() => import('./screens/Reels'));
const FollowList = lazy(() => import('./screens/FollowList'));
const Create = lazy(() => import('./screens/Create'));
const Search = lazy(() => import('./screens/Search'));
const HashtagPage = lazy(() => import('./screens/HashtagPage'));
const Online = lazy(() => import('./screens/Online'));
const AdminVerifications = lazy(() => import('./screens/AdminVerifications'));
const Likes = lazy(() => import('./screens/Likes'));
const Matches = lazy(() => import('./screens/Matches'));
const Messages = lazy(() => import('./screens/Messages'));
const MessagesSearch = lazy(() => import('./screens/MessagesSearch'));
const MessagingSettings = lazy(() => import('./screens/MessagingSettings'));
const ChatInfo = lazy(() => import('./screens/ChatInfo'));
const ArchivedMessages = lazy(() => import('./screens/ArchivedMessages'));
const MessageRequests = lazy(() => import('./screens/MessageRequests'));
const Chat = lazy(() => import('./screens/Chat'));
const SafetyCenter = lazy(() => import('./screens/SafetyCenter'));
const BlockedList = lazy(() => import('./screens/BlockedList'));
const ProfileView = lazy(() => import('./screens/ProfileView'));
const EditProfile = lazy(() => import('./screens/EditProfile'));
const Preview = lazy(() => import('./screens/Preview'));
const ProfileSettings = lazy(() => import('./screens/ProfileSettings'));
const Monetization = lazy(() => import('./screens/Monetization'));
const PrivacySettings = lazy(() => import('./screens/PrivacySettings'));
const YourData = lazy(() => import('./screens/settings/YourData'));
const BlockingMuted = lazy(() => import('./screens/settings/BlockingMuted'));
const ContentAudience = lazy(() => import('./screens/settings/ContentAudience'));
const PendingTags = lazy(() => import('./screens/PendingTags'));
const Marketplace = lazy(() => import('./screens/Marketplace'));
const CreateGroup = lazy(() => import('./screens/CreateGroup'));
const GroupChat = lazy(() => import('./screens/GroupChat'));
const JoinGroup = lazy(() => import('./screens/JoinGroup'));
const EditGroup = lazy(() => import('./screens/EditGroup'));
const GroupMembers = lazy(() => import('./screens/GroupMembers'));
const AddGroupMembers = lazy(() => import('./screens/AddGroupMembers'));
const CreateListing = lazy(() => import('./screens/CreateListing'));
const Services = lazy(() => import('./screens/Services'));
const MyBookings = lazy(() => import('./screens/MyBookings'));
const BookService = lazy(() => import('./screens/BookService'));
const CreateService = lazy(() => import('./screens/CreateService'));
const ServiceDetail = lazy(() => import('./screens/ServiceDetail'));
const MyListings = lazy(() => import('./screens/MyListings'));
const EditListing = lazy(() => import('./screens/EditListing'));
const ListingDetail = lazy(() => import('./screens/ListingDetail'));
const ComingSoon = lazy(() => import('./screens/_ComingSoon'));
const Admin = lazy(() => import('./screens/Admin'));
const FacebookReward = lazy(() => import('./screens/FacebookReward'));
const AccountSecurity = lazy(() => import('./screens/AccountSecurity'));
const Account = lazy(() => import('./screens/settings/Account'));
const TermsPolicies = lazy(() => import('./screens/settings/TermsPolicies'));
const Invite = lazy(() => import('./screens/Invite'));
const Communities = lazy(() => import('./screens/Communities'));
const CreateCommunity = lazy(() => import('./screens/CreateCommunity'));
const CommunityView = lazy(() => import('./screens/CommunityView'));
const EditCommunity = lazy(() => import('./screens/EditCommunity'));
const JoinCommunity = lazy(() => import('./screens/JoinCommunity'));
const Notifications = lazy(() => import('./screens/Notifications'));
const CreatorMode = lazy(() => import('./screens/CreatorMode'));
const CreatorDashboardScreen = lazy(() => import('./screens/CreatorDashboardScreen'));
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
  if (!profile?.username) return <Navigate to="/signup" replace />  // PROFILE GATE
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
          onClick={async () => {
            const { supabase } = await import('./lib/supabase')
            const { detachDeviceToken } = await import('./lib/deviceToken.js')
            await detachDeviceToken()
            localStorage.removeItem('auth_token'); window.location.reload();
          }}
          className="block w-full mt-8 h-11 rounded-full bg-white/[0.06] border border-white/12 text-cream font-semibold text-[14px]"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function PublicOnly({ children }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <Loading />
  if (session && profile?.username) return <Navigate to="/feed" replace />
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
    <VoiceCallProvider>
      {children}
      {show && <RatePrompt onClose={() => setShow(false)} />}
    </VoiceCallProvider>
  )
}

function MaintenanceGate({ children }) {
  const { profile, loading: authLoading } = useAuth();
  useMyPresence(profile?.id);
  const [state, setState] = useState({ loading: true, on: false, message: "" })

  useEffect(() => {
    // TODO: Move maintenance check to Neon /api/config later
    setState({ loading: false, on: false, message: "" });
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
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: false });
    }
  }, []);

  useSafeArea();
  return (
    <AuthProvider>
      <SettingsProvider>
      <PresenceKeeper />
      <WalletProvider>
      <NotificationsProvider>
        <InAppNotificationBanner />
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
        <Route path="/user/:userId/connections" element={<Guard><FollowList /></Guard>} />
        <Route path="/user/:userId/followers" element={<Guard><FollowList /></Guard>} />
        <Route path="/user/:userId/following" element={<Guard><FollowList /></Guard>} />
        <Route path="/create" element={<Guard><Create /></Guard>} />
        <Route path="/search" element={<Guard><Search /></Guard>} />
        <Route path="/hashtag/:tag" element={<Guard><HashtagPage /></Guard>} />
        <Route path="/online" element={<Guard><Online /></Guard>} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/discover" element={<Guard><Discover /></Guard>} />
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
        <Route path="/settings/account" element={<Guard><Account /></Guard>} />
        <Route path="/settings/terms-policies" element={<Guard><TermsPolicies /></Guard>} />
        <Route path="/settings/privacy" element={<Guard><PrivacySettings /></Guard>} />
        <Route path="/settings/your-data" element={<Guard><YourData /></Guard>} />
        <Route path="/settings/blocking-muted" element={<Guard><BlockingMuted /></Guard>} />
        <Route path="/settings/content-audience" element={<Guard><ContentAudience /></Guard>} />
        <Route path="/creator-dashboard" element={<Guard><CreatorDashboardScreen /></Guard>} />
        <Route path="/settings/creator" element={<Guard><CreatorMode /></Guard>} />
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
