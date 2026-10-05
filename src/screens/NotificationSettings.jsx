import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"
import BrandGlow from "../components/BrandGlow"
import AppHeader from "../components/AppHeader"

const TOGGLES = [
  { key: "notif_likes",         label: "Likes",         sub: "When someone likes your post, reel or comment" },
  { key: "notif_comments",      label: "Comments",      sub: "When someone comments on your content" },
  { key: "notif_matches",       label: "Matches",       sub: "When you match with someone new" },
  { key: "notif_messages",      label: "Messages",      sub: "New direct and group messages" },
  { key: "notif_story_replies", label: "Story replies", sub: "Replies and reactions to your stories" },
  { key: "notif_reel_activity", label: "Reel activity", sub: "Likes, comments, remixes on your reels" },
  { key: "notif_commerce",      label: "Commerce",      sub: "Marketplace, service bookings, orders" },
]

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => { tap("light"); onChange(!value) }}
      className="relative w-11 h-6 rounded-full transition-colors shrink-0"
      style={{ background: value ? "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" : "rgba(255,255,255,0.12)" }}
      aria-label="Toggle"
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md"
        style={{ left: value ? "22px" : "2px" }}
      />
    </button>
  )
}

export default function NotificationSettings() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({})

  useEffect(() => {
    if (!myId) return
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from("user_settings")
        .select("notif_likes, notif_comments, notif_matches, notif_messages, notif_story_replies, notif_reel_activity, notif_commerce")
        .eq("user_id", myId)
        .maybeSingle()
      if (data) setSettings(data)
      else {
        await supabase.from("user_settings").insert({ user_id: myId })
        setSettings({})
      }
      setLoading(false)
    })()
  }, [myId])

  async function update(key, value) {
    setSettings((cur) => ({ ...cur, [key]: value }))
    await supabase
      .from("user_settings")
      .update({ [key]: value, updated_at: new Date().toISOString() })
      .eq("user_id", myId)
  }

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480, display: "flex", flexDirection: "column", background: "#0B0B14", overflow: "hidden" }}>
      <BrandGlow />
      <AppHeader />
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          <button
            onClick={() => { tap("light"); nav(-1) }}
            className="w-9 h-9 rounded-full grid place-items-center bg-white/[0.06] border border-white/10"
            aria-label="Back"
          >
            <ArrowLeft size={18} className="text-cream" />
          </button>
          <h1 className="text-cream font-extrabold text-[16px]">Notification settings</h1>
        </div>

        {loading ? (
          <div className="p-4 flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 border-b border-white/6 bg-white/[0.03] shimmer" />)}
          </div>
        ) : (
          <div className="flex flex-col">
            {TOGGLES.map((t) => (
              <div
                key={t.key}
                className="flex items-center gap-4 px-4 py-3.5 border-b border-white/6"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-cream text-[15px] font-medium">{t.label}</p>
                  <p className="text-muted text-[12px] leading-snug mt-0.5">{t.sub}</p>
                </div>
                <Toggle value={settings[t.key] !== false} onChange={(v) => update(t.key, v)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
