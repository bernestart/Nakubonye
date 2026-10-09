import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Heart, MessageCircle, UserPlus, Sparkles, Play, MessageSquare, Bell, Check, Trash2, Users, AtSign, Settings } from 'lucide-react'
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
    like_post:         { Icon: Heart,           color: "text-pink-400" },
    comment_post:      { Icon: MessageCircle,   color: "text-sky-400" },
    match:             { Icon: Sparkles,        color: "text-purple-400" },
    follow:            { Icon: UserPlus,        color: "text-emerald-400" },
    reel_like:         { Icon: Play,            color: "text-pink-400" },
    reel_comment:      { Icon: MessageSquare,   color: "text-sky-400" },
    message:           { Icon: MessageCircle,   color: "text-blue-400" },
    photo_tag:         { Icon: Users,           color: "text-purple-400" },
    photo_tag_pending: { Icon: Users,           color: "text-purple-400" },
    mention:           { Icon: AtSign,          color: "text-purple-400" },
  }
  const entry = map[type] || { Icon: Bell, color: "text-muted" }
  const { Icon, color } = entry
  return (
    <span className={`w-9 h-9 rounded-full grid place-items-center shrink-0 bg-white/[0.05] ${color}`}>
      <Icon size={16} strokeWidth={2.4} />
    </span>
  )
}

// Group consecutive same-target notifications within 24h
function groupItems(list) {
  const out = []
  const used = new Set()
  for (let i = 0; i < list.length; i++) {
    const n = list[i]
    if (used.has(n.id)) continue
    const group = [n]
    used.add(n.id)
    if (n.ref_id && n.ref_type) {
      for (let j = i + 1; j < list.length; j++) {
        const m = list[j]
        if (used.has(m.id)) continue
        if (m.type !== n.type) continue
        if (m.ref_id !== n.ref_id || m.ref_type !== n.ref_type) continue
        const dt = Math.abs(new Date(n.created_at) - new Date(m.created_at))
        if (dt > 24 * 60 * 60 * 1000) continue
        group.push(m)
        used.add(m.id)
        if (group.length >= 5) break
      }
    }
    out.push(group)
  }
  return out
}

export default function Notifications() {
  const nav = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [actors, setActors] = useState(new Map())
  const [photos, setPhotos] = useState(new Map())
  const [actionFor, setActionFor] = useState(null)

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

  async function deleteNotif(ids) {
    if (!ids || ids.length === 0) return
    tap("light")
    await supabase.from("notifications").delete().in("id", ids)
    setItems((prev) => prev.filter((x) => !ids.includes(x.id)))
    setActionFor(null)
  }

  async function markRead(ids) {
    if (!ids || ids.length === 0) return
    tap("light")
    const now = new Date().toISOString()
    await supabase.from("notifications").update({ read_at: now }).in("id", ids).is("read_at", null)
    setItems((prev) => prev.map((x) => ids.includes(x.id) && !x.read_at ? { ...x, read_at: now } : x))
    setActionFor(null)
  }

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
    else if (n.ref_type === "security") nav("/settings/security")
    else if (n.actor_id) nav("/profile/" + n.actor_id)
  }

  async function markGroupRead(group) {
    const unreadIds = group.filter((n) => !n.read_at).map((n) => n.id)
    if (unreadIds.length === 0) return
    const now = new Date().toISOString()
    await supabase.from("notifications").update({ read_at: now }).in("id", unreadIds)
    setItems((prev) => prev.map((x) => unreadIds.includes(x.id) ? { ...x, read_at: now } : x))
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
        <button
          onClick={() => { tap('light'); nav('/settings/notifications') }}
          className="w-9 h-9 rounded-full grid place-items-center text-muted"
          aria-label="Notification settings"
        >
          <Settings size={19} strokeWidth={2.2} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex flex-col gap-2">
            {[0,1,2,3,4].map((i) => (
              <div key={i} className="border-b border-white/6 bg-white/[0.02] shimmer" style={{ height: 64 }} />
            ))}
          </div>
        ) : !hasAny ? (
          <div className="pt-16 text-center px-6">
            <div className="w-16 h-16 rounded-full grid place-items-center mx-auto mb-4">
              <Bell size={26} className="text-muted" />
            </div>
            <p className="text-cream font-bold text-[15px] mb-1">No notifications yet</p>
            <p className="text-muted text-[13px] max-w-[260px] mx-auto leading-relaxed">
              Requests, comments, matches, and follows will appear here.
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
                  {groupItems(list).map((group) => {
                    const first = group[0]
                    const actor = actors.get(first.actor_id)
                    const photoPath = photos.get(first.actor_id)
                    const name = actor?.display_name || actor?.username || "Someone"
                    const unread = group.some((n) => !n.read_at)

                    if (group.length === 1) {
                      return (
                        <button
                          key={first.id}
                          onClick={() => openNotification(first)}
                          onContextMenu={(e) => { e.preventDefault(); setActionFor({ ids: [first.id] }) }}
                          onTouchStart={(e) => {
                            const t = setTimeout(() => setActionFor({ ids: [first.id] }), 500)
                            e.currentTarget._lp = t
                          }}
                          onTouchEnd={(e) => { if (e.currentTarget._lp) { clearTimeout(e.currentTarget._lp); e.currentTarget._lp = null } }}
                          onTouchMove={(e) => { if (e.currentTarget._lp) { clearTimeout(e.currentTarget._lp); e.currentTarget._lp = null } }}
                          className={`w-full flex items-start gap-3 px-4 py-3 border-b border-white/6 text-left active:bg-white/[0.03] transition-colors`}
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
                              <TypeIcon type={first.type} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-cream text-[13.5px] leading-snug">
                              <strong className="font-bold">
                                {name}
                                {actor?.is_verified && <VerifiedBadge size={12} className="ml-1" />}
                              </strong>
                              {" "}
                              <span className="text-cream/85">{first.body?.replace(name, "").trim() || "sent you a notification"}</span>
                            </p>
                            <p className="text-subtle text-[11px] mt-0.5">{relTime(first.created_at)}</p>
                          </div>
                          {unread && (
                            <span className="shrink-0 w-2 h-2 rounded-full bg-pink-500 mt-3" />
                          )}
                        </button>
                      )
                    }

                    // Grouped row: stacked avatars + "X and N others"
                    const others = group.slice(1, 4)
                    const extra = group.length - others.length - 1
                    const verb = (first.body || "").split(" ").slice(1).join(" ").trim() || "reacted to your post"
                    return (
                      <button
                        key={"g-" + first.id}
                        onClick={() => { markGroupRead(group); openNotification(first) }}
                        onContextMenu={(e) => { e.preventDefault(); setActionFor({ ids: group.map((g) => g.id) }) }}
                        onTouchStart={(e) => {
                          const t = setTimeout(() => setActionFor({ ids: group.map((g) => g.id) }), 500)
                          e.currentTarget._lp = t
                        }}
                        onTouchEnd={(e) => { if (e.currentTarget._lp) { clearTimeout(e.currentTarget._lp); e.currentTarget._lp = null } }}
                        onTouchMove={(e) => { if (e.currentTarget._lp) { clearTimeout(e.currentTarget._lp); e.currentTarget._lp = null } }}
                        className={`w-full flex items-start gap-3 px-4 py-3 border-b border-white/6 text-left active:bg-white/[0.03] transition-colors`}
                      >
                        <div className="relative shrink-0">
                          <div className="flex -space-x-2">
                            {others.map((o) => {
                              const oa = actors.get(o.actor_id)
                              const op = photos.get(o.actor_id)
                              const on = oa?.display_name || oa?.username || "?"
                              return (
                                <div key={o.id} className="w-9 h-9 rounded-full overflow-hidden bg-purple-600 grid place-items-center text-white font-black text-[12px] border-2 border-[#0B0B14]">
                                  {op ? <img src={publicPhotoUrl(op)} alt="" className="w-full h-full object-cover" /> : on[0].toUpperCase()}
                                </div>
                              )
                            })}
                            {extra > 0 && (
                              <div className="w-9 h-9 rounded-full grid place-items-center bg-elevated border-2 border-[#0B0B14] text-cream font-black text-[11px]">
                                +{extra}
                              </div>
                            )}
                          </div>
                          <div className="absolute -bottom-1 -right-1">
                            <TypeIcon type={first.type} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-cream text-[13.5px] leading-snug">
                            <strong className="font-bold">{name}</strong>
                            {group.length > 1 && (
                              <> and <strong className="font-bold">{group.length - 1} {group.length - 1 === 1 ? "other" : "others"}</strong></>
                            )}
                            {" "}
                            <span className="text-cream/85">{verb}</span>
                          </p>
                          <p className="text-subtle text-[11px] mt-0.5">{relTime(first.created_at)}</p>
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

      {actionFor && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setActionFor(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <button
              onClick={() => markRead(actionFor.ids)}
              className="flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-white/[0.03]"
            >
              <span className="shrink-0 text-emerald-300 text-[18px]">✓</span>
              <span className="text-cream text-[15px] font-medium">Mark as read</span>
            </button>
            <button
              onClick={() => deleteNotif(actionFor.ids)}
              className="flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-red-500/[0.06]"
            >
              <span className="shrink-0">
                <Trash2 size={18} color="#F87171" />
              </span>
              <span className="text-cream text-[15px] font-medium">Delete {actionFor.ids.length > 1 ? "notifications" : "notification"}</span>
            </button>
            <button
              onClick={() => setActionFor(null)}
              className="w-full h-11 mt-2 text-muted font-semibold text-[13.5px]"
            >Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
