import { useNavigate } from 'react-router-dom'
import { tap } from '../lib/haptic'
import {
  ArrowLeft, ChevronRight, ChevronDown, LogOut, Bell, Gift, Crown,
  Wallet as WalletIcon, UserX, Shield, ShieldCheck, Info, FileText,
  Eye, Zap, Key, Users, Plus, Bookmark, LayoutGrid, Play, Heart,
  Store, Briefcase, Calendar, Clock, Camera
} from 'lucide-react'
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
          className="w-full rounded-2xl bg-surface border border-white/8 p-3.5 flex items-center gap-4 text-left active:opacity-80 transition-opacity mb-5"
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
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-white/8 text-left text-cream"
          >
            <span className="w-9 h-9 rounded-xl bg-white/[0.05] grid place-items-center shrink-0">
              <Plus size={18} />
            </span>
            <span className="flex-1 font-semibold text-[14.5px]">Add to your story</span>
            <ChevronRight size={18} className="text-subtle" />
          </button>
          <button
            onClick={() => { tap('light'); nav('/invite') }}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-white/8 text-left text-cream"
          >
            <span className="w-9 h-9 rounded-xl bg-white/[0.05] grid place-items-center shrink-0">
              <Gift size={18} />
            </span>
            <span className="flex-1 font-semibold text-[14.5px]">Invite friends</span>
            <ChevronRight size={18} className="text-subtle" />
          </button>
          <button
            onClick={() => { tap('light'); nav('/saved') }}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-white/8 text-left text-cream"
          >
            <span className="w-9 h-9 rounded-xl bg-white/[0.05] grid place-items-center shrink-0">
              <Bookmark size={18} />
            </span>
            <span className="flex-1 font-semibold text-[14.5px]">Saved</span>
            <ChevronRight size={18} className="text-subtle" />
          </button>
          <button
            onClick={() => { tap('light'); nav('/story-archive') }}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-white/8 text-left text-cream"
          >
            <span className="w-9 h-9 rounded-xl bg-white/[0.05] grid place-items-center shrink-0">
              <Clock size={18} />
            </span>
            <span className="flex-1 font-semibold text-[14.5px]">Story archive</span>
            <ChevronRight size={18} className="text-subtle" />
          </button>
          <button
            onClick={() => { tap('light'); nav('/memories') }}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-white/8 text-left text-cream"
          >
            <span className="w-9 h-9 rounded-xl bg-white/[0.05] grid place-items-center shrink-0">
              <Camera size={18} />
            </span>
            <span className="flex-1 font-semibold text-[14.5px]">Memories</span>
            <ChevronRight size={18} className="text-subtle" />
          </button>
        </div>

        {/* Feature tile grid — NO label */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <FeatureTile icon={<Bookmark size={20} />} label="Saved" to="/saved" nav={nav} />
          <FeatureTile icon={<LayoutGrid size={20} />} label="Posts" to="/me/preview" nav={nav} />
          <FeatureTile icon={<Play size={20} />} label="Reels" to="/reels" nav={nav} />
          <FeatureTile icon={<Heart size={20} />} label="Matches" to="/matches" nav={nav} />
          <FeatureTile icon={<Users size={20} />} label="Communities" to="/communities" nav={nav} />
          <FeatureTile icon={<Eye size={20} />} label="Profile views" to="/profile-views" nav={nav} />
          <FeatureTile icon={<Crown size={20} />} label="Premium" to="/premium" nav={nav} />
          <FeatureTile icon={<WalletIcon size={20} />} label="Wallet" to="/wallet" nav={nav} />
          <FeatureTile icon={<Zap size={20} />} label="Boost profile" to="/boost" nav={nav} />
          <FeatureTile icon={<ShieldCheck size={20} />} label="Get verified" to="/verify" nav={nav} />
          <FeatureTile icon={<Store size={20} />} label="Marketplace" to="/marketplace" nav={nav} />
          <FeatureTile icon={<Briefcase size={20} />} label="Services" to="/services" nav={nav} />
        </div>

        {/* Collapsible — Settings & privacy */}
        <Collapsible
          icon={<Key size={18} />}
          label="Settings & privacy"
          open={settingsOpen}
          onToggle={() => { tap('light'); setSettingsOpen((v) => !v) }}
        >
          <MenuRow icon={<Key size={18} />} label="Account & security" to="/settings/security" nav={nav} />
          <MenuRow icon={<Shield size={18} />} label="Privacy & visibility" to="/settings/privacy" nav={nav} />
          <MenuRow icon={<ShieldCheck size={18} />} label="Tag review" to="/settings/pending-tags" nav={nav} />
          <MenuRow icon={<Bell size={18} />} label="Notifications" to="/notifications" nav={nav} />
          <MenuRow icon={<UserX size={18} />} label="Blocked users" to="/blocked" nav={nav} />
          <MenuRow icon={<ShieldCheck size={18} />} label="Privacy Policy" to="/privacy" nav={nav} />
          <MenuRow icon={<FileText size={18} />} label="Terms of Service" to="/terms" nav={nav} />
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
            <span className="w-9 h-9 rounded-xl bg-white/[0.05] grid place-items-center shrink-0">
              <LogOut size={18} />
            </span>
            <span className="flex-1 font-semibold text-[14.5px]">Log out</span>
            <ChevronRight size={18} className="text-subtle" />
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
        className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-white/8 text-left text-cream"
      >
        <span className="w-9 h-9 rounded-xl bg-white/[0.05] grid place-items-center shrink-0">
          {icon}
        </span>
        <span className="flex-1 font-semibold text-[14.5px]">{label}</span>
        {open ? <ChevronDown size={18} className="text-subtle" /> : <ChevronRight size={18} className="text-subtle" />}
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
      className={`rounded-2xl border p-3.5 flex flex-col items-start gap-2.5 text-left active:opacity-80 transition-opacity ${
        soon ? 'bg-white/[0.02] border-white/5 opacity-50' : 'bg-surface border-white/8'
      }`}
    >
      <span className="w-9 h-9 rounded-xl bg-purple-500/15 grid place-items-center text-purple-300 shrink-0">
        {icon}
      </span>
      <span className="min-w-0 w-full">
        <span className="block text-cream font-bold text-[13.5px] truncate">{label}</span>
        {soon && <span className="block text-subtle text-[10.5px] mt-0.5">Coming soon</span>}
      </span>
    </button>
  )
}

function MenuRow({ icon, label, to, nav }) {
  return (
    <button
      onClick={() => { tap('light'); nav(to) }}
      className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-white/8 text-left text-cream"
    >
      <span className="w-9 h-9 rounded-xl bg-white/[0.05] grid place-items-center shrink-0">
        {icon}
      </span>
      <span className="flex-1 font-semibold text-[14.5px]">{label}</span>
      <ChevronRight size={18} className="text-subtle" />
    </button>
  )
}
