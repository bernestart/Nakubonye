import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft, Heart, MessageCircle, UserPlus, Sparkles, Play,
  MessageSquare, Bell, Check,
} from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import VerifiedBadge from "../components/VerifiedBadge"
import BrandGlow from "../components/BrandGlow"

function relTime(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return "now"
  if (diff < 3600) return Math.floor(diff / 60) + "m"
  if (diff < 86400) return Math.floor(diff / 3600) + "h"
  if (diff < 604800) return Math.floor(diff / 86400) + "d"
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

function dayBucket(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return "today"
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return "yesterday"
  const days = (now - d) / (1000 * 60 * 60 * 24)
  if (days < 7) return "week"
  return "earlier"
}

function TypeIcon({ type }) {
  const map = {
    like_post:    { Icon: Heart,           color: "text-pink-400" },
    comment_post: { Icon: MessageCircle,   color: "text-sky-400" },
    match:        { Icon: Sparkles,        color: "text-purple-400" },
    follow:       { Icon: UserPlus,        color: "text-emerald-400" },
    reel_like:    { Icon: Play,            color: "text-pink-400" },
    reel_comment: { Icon: MessageSquare,   color: "text-sky-400" },
    message:      { Icon: MessageCircle,   color: "text-blue-400" },
  }
  const entry = map[type] || { Icon: Bell, color: "text-muted" }
  const { Icon, color } = entry
  return (
    <span className={`w-9 h-9 rounded-full grid place-items-center shrink-0 bg-white/[0.05] ${color}`}>
      <Icon size={16} strokeWidth={2.4} />
    </span>
  )
}

export default function Notifications() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [actors, setActors] = useState(new Map())
  const [photos, setPhotos] = useState(new Map())

  const load = useCallback(async () => {
    if (!myId) return
    setLoading(true)

    const { data } = await supabase
      .from("notifications")
      .select("id, actor_id, type, ref_id, ref_type, body, read_at, created_at")
      .eq("user_id", myId)
      .order("created_at", { ascending: false })
      .limit(100)

    const list = data || []
    setItems(list)

    const ids = [...new Set(list.map((n) => n.actor_id).filter(Boolean))]
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, username, is_verified")
        .in("id", ids)
      setActors(new Map((profs || []).map((p) => [p.id, p])))

      const { data: ph } = await supabase
        .from("profile_photos")
        .select("user_id, storage_path, is_primary, display_order")
        .in("user_id", ids)
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true })
      const pm = new Map()
      ;(ph || []).forEach((p) => { if (!pm.has(p.user_id)) pm.set(p.user_id, p.storage_path) })
      setPhotos(pm)
    }
    setLoading(false)
  }, [myId])

  useEffect(() => { load() }, [load])

  async function openNotification(n) {
    tap("light")
    // Mark as read
    if (!n.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id)
      setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
    }
    // Navigate
    if (n.ref_type === "post" && n.ref_id) nav("/feed")
    else if (n.ref_type === "reel" && n.ref_id) nav("/reels")
    else if (n.ref_type === "match" && n.actor_id) nav("/messages/" + n.actor_id)
    else if (n.ref_type === "profile" && n.actor_id) nav("/profile/" + n.actor_id)
    else if (n.actor_id) nav("/profile/" + n.actor_id)
  }

  async function markAllRead() {
    if (!myId) return
    tap("light")
    const now = new Date().toISOString()
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", myId).is("read_at", null)
    setItems((prev) => prev.map((x) => x.read_at ? x : { ...x, read_at: now }))
  }

  const grouped = {
    today: [],
    yesterday: [],
    week: [],
    earlier: [],
  }
  items.forEach((n) => { grouped[dayBucket(n.created_at)].push(n) })

  const sections = [
    { id: "today",     label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "week",      label: "This week" },
    { id: "earlier",   label: "Earlier" },
  ]

  const hasAny = items.length > 0
  const hasUnread = items.some((n) => !n.read_at)

  return (
    <div style={{
      position: "fixed", inset: 0, margin: "0 auto", maxWidth: 480,
      display: "flex", flexDirection: "column",
      background: "#0B0B14", overflow: "hidden",
    }}>
      <BrandGlow />
      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px] flex-1">Notifications</span>
        {hasUnread && (
          <button
            onClick={markAllRead}
            className="h-9 px-3 rounded-full text-purple-300 text-[12.5px] font-bold inline-flex items-center gap-1.5 active:opacity-70"
          >
            <Check size={14} strokeWidth={3} /> Mark all read
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex flex-col gap-2">
            {[0,1,2,3,4].map((i) => (
              <div key={i} className="rounded-2xl bg-white/[0.03] animate-pulse" style={{ height: 64 }} />
            ))}
          </div>
        ) : !hasAny ? (
          <div className="pt-16 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/8 grid place-items-center mx-auto mb-4">
              <Bell size={26} className="text-muted" />
            </div>
            <p className="text-cream font-bold text-[15px] mb-1">No notifications yet</p>
            <p className="text-muted text-[13px] max-w-[260px] mx-auto leading-relaxed">
              Likes, comments, matches, and follows will appear here.
            </p>
          </div>
        ) : (
          sections.map((sec) => {
            const list = grouped[sec.id]
            if (list.length === 0) return null
            return (
              <div key={sec.id} className="mb-5">
                <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2 px-1">
                  {sec.label}
                </p>
                <div className="flex flex-col gap-1">
                  {list.map((n) => {
                    const actor = actors.get(n.actor_id)
                    const photoPath = photos.get(n.actor_id)
                    const name = actor?.display_name || actor?.username || "Someone"
                    const unread = !n.read_at
                    return (
                      <button
                        key={n.id}
                        onClick={() => openNotification(n)}
                        className={`w-full flex items-start gap-3 p-3 rounded-2xl text-left active:bg-white/[0.04] transition-colors ${unread ? "bg-white/[0.03]" : ""}`}
                      >
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black text-sm">
                            {photoPath ? (
                              <img src={publicPhotoUrl(photoPath)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              name[0].toUpperCase()
                            )}
                          </div>
                          <div className="absolute -bottom-1 -right-1">
                            <TypeIcon type={n.type} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-cream text-[13.5px] leading-snug">
                            <strong className="font-bold">
                              {name}
                              {actor?.is_verified && <VerifiedBadge size={12} className="ml-1" />}
                            </strong>
                            {" "}
                            <span className="text-cream/85">{n.body?.replace(name, "").trim() || "sent you a notification"}</span>
                          </p>
                          <p className="text-subtle text-[11px] mt-0.5">{relTime(n.created_at)}</p>
                        </div>
                        {unread && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-pink-500 mt-3" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
