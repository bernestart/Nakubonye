import { useNavigate } from 'react-router-dom'
import { tap } from '../lib/haptic'
import { ArrowLeft, ChevronRight, ChevronDown, LogOut, Bell, Gift, Crown, Wallet as WalletIcon, UserX, Shield, ShieldCheck, Info, FileText, Eye, Zap, Key, Users, User, Plus, Bookmark, LayoutGrid, Play, Heart, Store, Briefcase, Calendar, Clock, Camera, Star, Layers, WifiOff, Coins, UserCircle, MessageCircle, Globe, Activity, Ban, Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import StoryComposer from '../components/StoryComposer'
import BrandGlow from '../components/BrandGlow'
import BottomNav from '../components/BottomNav'

export default function ProfileSettings() {
  const nav = useNavigate()
  const { profile, session } = useAuth()
  const [composerOpen, setComposerOpen] = useState(false)
  const [hasStory, setHasStory] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)

  const initial = (profile?.display_name || 'U')[0].toUpperCase()
  const isAdmin = !!profile?.is_admin

  useEffect(() => {
    if (!session?.user?.id) return
    const checkStory = async () => {
      const { data } = await supabase
        .from("stories")
        .select("id")
        .eq("user_id", session.user.id)
        .gt("expires_at", new Date().toISOString())
        .limit(1)
      setHasStory((data || []).length > 0)
    }
    checkStory()
  }, [session?.user?.id])

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />

      {composerOpen && (
        <StoryComposer
          onClose={() => setComposerOpen(false)}
          onDone={() => { setComposerOpen(false); window.location.reload() }}
        />
      )}

      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button
          onClick={() => { tap('light'); nav(-1) }}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Menu</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-10">

        {/* LAYER 1 — Identity */}
        <button
          type="button"
          onClick={() => { tap('light'); nav('/me/preview') }}
          className="w-full flex items-center gap-4 px-4 py-4 text-left border-b border-white/6 active:bg-white/[0.03]"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setComposerOpen(true) }}
            className="relative shrink-0"
            aria-label="Add to your story"
          >
            <span
              className="block rounded-full p-[2px]"
              style={{
                background: hasStory
                  ? "linear-gradient(135deg, #C084FC 0%, #EC4899 100%)"
                  : "rgba(255,255,255,0.15)",
              }}
            >
              <span className="block w-14 h-14 rounded-full bg-purple-600 grid place-items-center text-white text-xl font-black overflow-hidden border-2 border-[#0B0B14]">
                {profile?.photo_url ? (
                  <img src={profile.photo_url} alt="" className="w-full h-full object-cover" />
                ) : initial}
              </span>
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-purple-600 border-2 border-[#0B0B14] grid place-items-center">
              <Plus size={10} strokeWidth={3} className="text-white" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-cream font-bold text-[16px] truncate">
              {profile?.display_name || 'Your name'}
            </p>
            <p className="text-muted text-[12.5px] truncate">View your profile</p>
          </div>
          <ChevronRight size={18} className="text-subtle shrink-0" />
        </button>

        {/* Standalone rows above grid — Facebook pattern */}
        <div className="flex flex-col gap-1.5 mb-4">
          <button
            onClick={() => { tap('light'); setComposerOpen(true) }}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-white/[0.03]"
          >
            <span className="shrink-0 text-cream">
              <Plus size={18} />
            </span>
            <span className="flex-1 text-cream text-[15px] font-medium">Add to your story</span>
            <ChevronRight size={18} className="text-muted shrink-0" />
          </button>
          <button
            onClick={() => { tap('light'); nav('/invite') }}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-white/[0.03]"
          >
            <span className="shrink-0 text-cream">
              <Gift size={18} />
            </span>
            <span className="flex-1 text-cream text-[15px] font-medium">Invite friends</span>
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
          </button>
          <button
            onClick={() => { tap('light'); nav('/story-archive') }}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-white/[0.03]"
          >
            <span className="shrink-0 text-cream">
              <Clock size={18} />
            </span>
            <span className="flex-1 text-cream text-[15px] font-medium">Story archive</span>
            <ChevronRight size={18} className="text-muted shrink-0" />
          </button>
          <button
            onClick={() => { tap('light'); nav('/memories') }}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-white/[0.03]"
          >
            <span className="shrink-0 text-cream">
              <Camera size={18} />
            </span>
            <span className="flex-1 text-cream text-[15px] font-medium">Memories</span>
            <ChevronRight size={18} className="text-muted shrink-0" />
          </button>
          <button
            onClick={() => { tap('light'); nav('/drafts') }}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-white/[0.03]"
          >
            <span className="shrink-0 text-cream">
              <FileText size={18} />
            </span>
            <span className="flex-1 text-cream text-[15px] font-medium">Drafts</span>
            <ChevronRight size={18} className="text-muted shrink-0" />
          </button>
          <button
            onClick={() => { tap('light'); nav('/offline-reels') }}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-white/[0.03]"
          >
            <span className="shrink-0 text-cream">
              <WifiOff size={18} />
            </span>
            <span className="flex-1 text-cream text-[15px] font-medium">Offline reels</span>
            <ChevronRight size={18} className="text-muted shrink-0" />
          </button>
        </div>

        {/* Feature tile grid — NO label */}
        <div className="flex flex-col mb-5">
          <FeatureTile icon={<Bookmark size={20} />} label="Saved" to="/saved" nav={nav} />
          <FeatureTile icon={<LayoutGrid size={20} />} label="Posts" to="/me/preview" nav={nav} />
          <FeatureTile icon={<Play size={20} />} label="Reels" to="/reels" nav={nav} />
          <FeatureTile icon={<Heart size={20} />} label="Matches" to="/matches" nav={nav} />
          <FeatureTile icon={<Users size={20} />} label="Communities" to="/communities" nav={nav} />
          <FeatureTile icon={<ShieldCheck size={20} />} label="Get verified" to="/verify" nav={nav} />
          <FeatureTile icon={<Coins size={20} />} label="Monetization" to="/monetization" nav={nav} />
          <FeatureTile icon={<Layers size={20} />} label="Audiences" to="/circles" nav={nav} />
          <FeatureTile icon={<Store size={20} />} label="Marketplace" to="/marketplace" nav={nav} />
          <FeatureTile icon={<Briefcase size={20} />} label="Services" to="/services" nav={nav} />
        </div>

        {/* Collapsible — Settings & privacy (Facebook-style hierarchy) */}
        <Collapsible
          icon={<Key size={18} />}
          label="Settings & privacy"
          open={settingsOpen}
          onToggle={() => { tap('light'); setSettingsOpen((v) => !v) }}
        >
          <MenuRow icon={<User size={18} />} label="Account" to="/settings/account" nav={nav} />
          <MenuRow icon={<Shield size={18} />} label="Privacy" to="/settings/privacy" nav={nav} />
          <MenuRow icon={<UserCircle size={18} />} label="Profile & tagging" to="/settings/profile-tagging" nav={nav} />
          <MenuRow icon={<MessageCircle size={18} />} label="Interactions" to="/settings/interactions" nav={nav} />
          <MenuRow icon={<Globe size={18} />} label="Content & audience" to="/settings/content-audience" nav={nav} />
          <MenuRow icon={<Activity size={18} />} label="Activity & presence" to="/settings/activity-presence" nav={nav} />
          <MenuRow icon={<Ban size={18} />} label="Blocking & muting" to="/settings/blocking-muted" nav={nav} />
          <MenuRow icon={<Key size={18} />} label="Security" to="/settings/security" nav={nav} />
          <MenuRow icon={<Bell size={18} />} label="Notifications" to="/settings/notifications" nav={nav} />
          <MenuRow icon={<Download size={18} />} label="Your data" to="/settings/your-data" nav={nav} />
        </Collapsible>

        {/* Collapsible — Help & support */}
        <Collapsible
          icon={<Shield size={18} />}
          label="Help & support"
          open={supportOpen}
          onToggle={() => { tap('light'); setSupportOpen((v) => !v) }}
        >
          <MenuRow icon={<Shield size={18} />} label="Safety Center" to="/safety" nav={nav} />
          <MenuRow icon={<Info size={18} />} label="About Nakubonye" to="/about" nav={nav} />
          <MenuRow icon={<Gift size={18} />} label="Get 50 free coins" to="/facebook-reward" nav={nav} />
        </Collapsible>

        {isAdmin && (
          <div className="mt-3">
            <Collapsible
              icon={<Shield size={18} />}
              label="Admin"
              open={false}
              onToggle={() => nav('/admin')}
            >
              <></>
            </Collapsible>
          </div>
        )}

        {/* Bottom rows — Sign out, Delete account (Facebook flat row style) */}
        <div className="flex flex-col gap-1.5 mt-4">
          <button
            onClick={async () => {
              tap('light')
              await supabase.auth.signOut()
              nav('/', { replace: true })
            }}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-white/8 text-left text-danger"
          >
            <span className="shrink-0 text-cream">
              <LogOut size={18} />
            </span>
            <span className="flex-1 text-cream text-[15px] font-medium">Log out</span>
            <ChevronRight size={18} className="text-muted shrink-0" />
          </button>
        </div>

        <p className="text-center text-subtle text-[11px] mt-10 leading-relaxed">
          Nakubonye · v2.0 · Made in Burundi 🇧🇮
          <br />
          Built by Ernest Niyobuhungiro · Bernest 🎨 Designer
        </p>
      </div>

      <div style={{ height: 72, flexShrink: 0 }} />
      <BottomNav />
    </div>
  )
}

function Collapsible({ icon, label, open, onToggle, children }) {
  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-white/[0.03]"
      >
        <span className="shrink-0 text-cream">
          {icon}
        </span>
        <span className="flex-1 text-cream text-[15px] font-medium">{label}</span>
        {open ? <ChevronDown size={18} className="text-subtle" /> : <ChevronRight size={18} className="text-muted shrink-0" />}
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 mt-1.5 pl-3">
          {children}
        </div>
      )}
    </div>
  )
}

function FeatureTile({ icon, label, to, nav, soon }) {
  const handle = () => {
    if (soon) return
    tap('light')
    nav(to)
  }
  return (
    <button
      type="button"
      onClick={handle}
      disabled={soon}
      className={`w-full flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-white/[0.03] ${
        soon ? 'opacity-50' : ''
      }`}
    >
      <span className="shrink-0 text-cream">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-cream text-[15px] font-medium truncate">{label}</span>
        {soon && <span className="block text-muted text-[11px] mt-0.5">Coming soon</span>}
      </span>
      <ChevronRight size={18} className="text-muted shrink-0" />
    </button>
  )
}

function MenuRow({ icon, label, to, nav }) {
  return (
    <button
      onClick={() => { tap('light'); nav(to) }}
      className="w-full flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-white/[0.03]"
    >
      <span className="shrink-0 text-cream">
        {icon}
      </span>
      <span className="flex-1 text-cream text-[15px] font-medium">{label}</span>
      <ChevronRight size={18} className="text-muted shrink-0" />
    </button>
  )
}
