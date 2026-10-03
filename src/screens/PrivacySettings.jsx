import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronRight, MessageCircle, Users, MessageSquare, Image,
  AtSign, Eye, MapPin, Activity, Check, EyeOff, Bell, Shield,
} from 'lucide-react'
import { tap } from '../lib/haptic'
import {
  useSettings, AUDIENCE_LEVELS, PROFILE_VISIBILITY_LEVELS,
  LOCATION_LEVELS, REQUEST_LEVELS, TAG_LEVELS,
} from '../lib/settings.jsx'
import BrandGlow from '../components/BrandGlow'
import BottomNav from '../components/BottomNav'

export default function PrivacySettings() {
  const nav = useNavigate()
  const { settings, update, loading } = useSettings()
  const [sheet, setSheet] = useState(null) // { key, title, options, current }

  function openSheet(key, title, options) {
    tap('light')
    setSheet({ key, title, options, current: settings[key] })
  }

  function selectOption(value) {
    if (!sheet) return
    tap('light')
    update({ [sheet.key]: value })
    setSheet(null)
  }

  function labelFor(key, options) {
    const v = settings[key]
    const opt = options.find((o) => o.id === v)
    return opt?.label || v
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <BrandGlow />

      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Privacy & visibility</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-10">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.03] animate-pulse" style={{ height: 56 }} />
            ))}
          </div>
        ) : (
          <>
            {/* ─── INTERACTIONS ─── */}
            <SectionLabel icon={<Users size={14} />}>Interactions</SectionLabel>

            <SelectorRow
              icon={<MessageCircle size={18} />}
              label="Who can message me"
              value={labelFor('who_can_message', AUDIENCE_LEVELS)}
              onClick={() => openSheet('who_can_message', 'Who can message me', AUDIENCE_LEVELS)}
            />
            <SelectorRow
              icon={<Users size={18} />}
              label="Who can send me match requests"
              value={labelFor('who_can_request', REQUEST_LEVELS)}
              onClick={() => openSheet('who_can_request', 'Who can send me match requests', REQUEST_LEVELS)}
            />
            <SelectorRow
              icon={<MessageSquare size={18} />}
              label="Who can comment on my posts"
              value={labelFor('who_can_comment', AUDIENCE_LEVELS)}
              onClick={() => openSheet('who_can_comment', 'Who can comment on my posts', AUDIENCE_LEVELS)}
            />
            <SelectorRow
              icon={<Image size={18} />}
              label="Who can reply to my stories"
              value={labelFor('who_can_story_reply', AUDIENCE_LEVELS)}
              onClick={() => openSheet('who_can_story_reply', 'Who can reply to my stories', AUDIENCE_LEVELS)}
            />
            <SelectorRow
              icon={<Eye size={18} />}
              label="Who can see my stories"
              value={labelFor('who_can_see_story', AUDIENCE_LEVELS)}
              onClick={() => openSheet('who_can_see_story', 'Who can see my stories', AUDIENCE_LEVELS)}
            />
            <SelectorRow
              icon={<AtSign size={18} />}
              label="Who can tag or mention me"
              value={labelFor('who_can_tag', TAG_LEVELS)}
              onClick={() => openSheet('who_can_tag', 'Who can tag or mention me', TAG_LEVELS)}
            />
            <ToggleRow
              icon={<AtSign size={18} />}
              label="Tag review"
              sub="Review tags people add before they appear on your profile"
              value={settings.tag_review_enabled}
              onChange={(v) => update({ tag_review_enabled: v })}
            />
            <ToggleRow
              icon={<Image size={18} />}
              label="Allow story replies"
              sub="People can reply to your stories"
              value={settings.allow_story_replies}
              onChange={(v) => update({ allow_story_replies: v })}
            />
            <ToggleRow
              icon={<Image size={18} />}
              label="Allow sharing to stories"
              sub="Others can share your posts to their story"
              value={settings.allow_sharing_to_story}
              onChange={(v) => update({ allow_sharing_to_story: v })}
            />

            {/* ─── VISIBILITY ─── */}
            <SectionLabel icon={<Eye size={14} />}>Visibility</SectionLabel>

            <SelectorRow
              icon={<Eye size={18} />}
              label="Profile visibility"
              value={labelFor('profile_visibility', PROFILE_VISIBILITY_LEVELS)}
              onClick={() => openSheet('profile_visibility', 'Who can see your profile', PROFILE_VISIBILITY_LEVELS)}
            />
            <SelectorRow
              icon={<Activity size={18} />}
              label="Who can see my online status"
              value={labelFor('who_can_see_online', AUDIENCE_LEVELS)}
              onClick={() => openSheet('who_can_see_online', 'Who can see my online status', AUDIENCE_LEVELS)}
            />
            <SelectorRow
              icon={<MapPin size={18} />}
              label="Who can see my location"
              value={labelFor('who_can_see_location', LOCATION_LEVELS)}
              onClick={() => openSheet('who_can_see_location', 'Who can see my location', LOCATION_LEVELS)}
            />
            <ToggleRow
              icon={<Activity size={18} />}
              label="Show activity status"
              sub="Let others see when you're active"
              value={settings.show_activity_status}
              onChange={(v) => update({ show_activity_status: v })}
            />
            <ToggleRow
              icon={<Check size={18} />}
              label="Show read receipts"
              sub="Let others see when you've read messages"
              value={settings.show_read_receipts}
              onChange={(v) => update({ show_read_receipts: v })}
            />
            <ToggleRow
              icon={<MapPin size={18} />}
              label="Show location on profile"
              sub="Display your city on your profile"
              value={settings.show_location_on_profile}
              onChange={(v) => update({ show_location_on_profile: v })}
            />

            {/* ─── NOTIFICATIONS ─── */}
            <SectionLabel icon={<Bell size={14} />}>Notifications</SectionLabel>

            <ToggleRow icon={<Bell size={18} />} label="Likes" sub="When someone likes your post or reel"
              value={settings.notif_likes} onChange={(v) => update({ notif_likes: v })} />
            <ToggleRow icon={<Bell size={18} />} label="Comments" sub="When someone comments on your content"
              value={settings.notif_comments} onChange={(v) => update({ notif_comments: v })} />
            <ToggleRow icon={<Bell size={18} />} label="New matches" sub="When you match with someone"
              value={settings.notif_matches} onChange={(v) => update({ notif_matches: v })} />
            <ToggleRow icon={<Bell size={18} />} label="Messages" sub="When someone sends you a message"
              value={settings.notif_messages} onChange={(v) => update({ notif_messages: v })} />
            <ToggleRow icon={<Bell size={18} />} label="Story replies" sub="When someone replies to your story"
              value={settings.notif_story_replies} onChange={(v) => update({ notif_story_replies: v })} />
            <ToggleRow icon={<Bell size={18} />} label="Reel activity" sub="Likes and comments on your reels"
              value={settings.notif_reel_activity} onChange={(v) => update({ notif_reel_activity: v })} />
            <ToggleRow icon={<Bell size={18} />} label="Marketplace & services" sub="New listings, bookings, and offers"
              value={settings.notif_commerce} onChange={(v) => update({ notif_commerce: v })} />

            {/* ─── LINK TO SAFETY ─── */}
            <SectionLabel icon={<Shield size={14} />}>Safety</SectionLabel>
            <button onClick={() => { tap('light'); nav('/blocked') }}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-white/8 text-left text-cream">
              <span className="w-9 h-9 rounded-xl bg-white/[0.05] grid place-items-center shrink-0"><EyeOff size={18} /></span>
              <span className="flex-1 font-semibold text-[14.5px]">Blocked users</span>
              <ChevronRight size={18} className="text-subtle" />
            </button>
          </>
        )}
      </div>

      {/* Selector sheet */}
      {sheet && (
        <div className="fixed inset-0 z-[400] flex items-end" onClick={() => setSheet(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <p className="text-cream font-bold text-[15px] mb-2">{sheet.title}</p>
            {sheet.options.map((opt) => {
              const active = sheet.current === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => selectOption(opt.id)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left"
                  style={{
                    background: active ? 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.15))' : 'rgba(255,255,255,0.03)',
                    borderColor: active ? 'rgba(236,72,153,0.5)' : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-cream font-bold text-[14px]">{opt.label}</p>
                    <p className="text-muted text-[11.5px] mt-0.5">{opt.sub}</p>
                  </div>
                  {active && <Check size={18} className="text-purple-400 shrink-0" strokeWidth={3} />}
                </button>
              )
            })}
            <button onClick={() => setSheet(null)} className="w-full h-11 mt-1 text-muted font-semibold text-[13.5px]">Cancel</button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

function SectionLabel({ children, icon }) {
  return (
    <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2 mt-5 flex items-center gap-1.5">
      {icon}{children}
    </p>
  )
}

function SelectorRow({ icon, label, value, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-white/8 text-left text-cream mb-1.5"
    >
      <span className="w-9 h-9 rounded-xl bg-white/[0.05] grid place-items-center shrink-0">{icon}</span>
      <span className="flex-1 font-semibold text-[14px] min-w-0 truncate">{label}</span>
      <span className="text-muted text-[13px] shrink-0 max-w-[110px] truncate">{value}</span>
      <ChevronRight size={16} className="text-subtle shrink-0" />
    </button>
  )
}

function ToggleRow({ icon, label, sub, value, onChange }) {
  return (
    <button
      onClick={() => { tap('light'); onChange(!value) }}
      className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-white/8 text-left mb-1.5"
    >
      <span className="w-9 h-9 rounded-xl bg-white/[0.05] grid place-items-center shrink-0 text-cream">{icon}</span>
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-cream font-semibold text-[14px]">{label}</p>
        {sub && <p className="text-muted text-[11.5px] mt-0.5 truncate">{sub}</p>}
      </div>
      <span
        className="w-11 h-6 rounded-full relative shrink-0 transition-colors"
        style={{ background: value ? 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' : 'rgba(255,255,255,0.12)' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
          style={{ left: value ? 'calc(100% - 22px)' : 2 }}
        />
      </span>
    </button>
  )
}
