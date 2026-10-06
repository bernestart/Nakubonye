import { useState, useEffect } from 'react'
import { useNavigate } from "react-router-dom"
import {
  Megaphone, Smile, Archive, ScrollText, MessageSquare, Star,
  Eye, EyeOff, Search, Sparkles, UserPlus, Link2, Phone, Video,
  Users, UserCheck, Flag, Heart, Ban,
} from "lucide-react"
import { tap } from "../lib/haptic"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"

function Row({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      onClick={() => { tap("light"); onClick?.() }}
      className="w-full flex items-center gap-4 px-4 py-3.5 text-left active:bg-white/[0.04] transition-colors"
    >
      <Icon size={20} strokeWidth={1.9} className={danger ? "text-red-400" : "text-cream"} />
      <span className={`flex-1 text-[15px] font-medium ${danger ? "text-red-300" : "text-cream"}`}>
        {label}
      </span>
    </button>
  )
}

export default function ProfileMenuSheet({ open, onClose, isMe, userId, person, onReport, onBlock }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [storyHidden, setStoryHidden] = useState(false)
  const [storyHiddenBusy, setStoryHiddenBusy] = useState(false)

  useEffect(() => {
    if (!myId || !userId || isMe) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("story_hides")
        .select("owner_id")
        .eq("owner_id", myId)
        .eq("hidden_user_id", userId)
        .maybeSingle()
      if (!cancelled) setStoryHidden(!!data)
    })()
    return () => { cancelled = true }
  }, [myId, userId, isMe])

  async function toggleStoryHide() {
    if (!myId || !userId || storyHiddenBusy) return
    setStoryHiddenBusy(true)
    tap("light")
    const next = !storyHidden
    setStoryHidden(next)
    try {
      if (next) {
        await supabase.from("story_hides").insert({ owner_id: myId, hidden_user_id: userId })
      } else {
        await supabase.from("story_hides").delete().eq("owner_id", myId).eq("hidden_user_id", userId)
      }
    } catch (e) {
      setStoryHidden(!next)
      console.warn("story hide toggle failed", e)
    }
    setStoryHiddenBusy(false)
    onClose?.()
  }
  const nav = useNavigate()
  if (!open) return null

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin + "/profile/" + userId)
      alert("Link copied")
    } catch {}
    onClose()
  }

  function go(path) { onClose(); nav(path) }

  return (
    <div className="fixed inset-0 z-[400] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] flex flex-col"
        style={{ maxHeight: "85dvh", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="shrink-0 pt-3 pb-2 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="flex-1 overflow-y-auto pb-2">
          {isMe ? (
            <>
              <Row icon={Megaphone}    label="Boost a post"                onClick={() => go("/boost")} />
              <Row icon={Smile}        label="Profile status"              onClick={() => go("/me/edit")} />
              <Row icon={Archive}      label="Archive"                     onClick={() => go("/story-archive")} />
              <Row icon={ScrollText}   label="Activity log"                onClick={() => go("/notifications")} />
              <Row icon={MessageSquare} label="Review posts and tags"      onClick={() => go("/settings/pending-tags")} />
              <Row icon={Star}         label="Add highlights"              onClick={() => go("/story-archive")} />
              <Row icon={Eye}          label="View as"                     onClick={() => go("/me/preview")} />
              <Row icon={Search}       label="Search"                      onClick={() => go("/search")} />
              <Row icon={Sparkles}     label="Inner Circle"                onClick={() => go("/inner-circle")} />
              <Row icon={UserPlus}     label="Invite people to connect"    onClick={() => go("/invite")} />
              <Row icon={Link2}        label="Copy link to profile"        onClick={copyLink} />
            </>
          ) : (
            <>
              <Row icon={Phone}        label="Audio call"                  onClick={() => go("/messages/" + userId)} />
              <Row icon={Video}        label="Video call"                  onClick={() => go("/messages/" + userId)} />
              <Row icon={Users}        label="See connections"             onClick={() => go("/user/" + userId + "/followers")} />
              <Row icon={UserCheck}    label="Following"                   onClick={() => go("/user/" + userId + "/following")} />
              <Row icon={Heart}        label={"Help " + (person?.display_name?.split(" ")[0] || "them")} onClick={() => {}} />
              <Row icon={Search}       label="Search"                      onClick={() => go("/search")} />
              <Row icon={Link2}        label="Copy link to profile"        onClick={copyLink} />
              <Row
                icon={storyHidden ? Eye : EyeOff}
                label={storyHidden
                  ? "Unhide story from " + (person?.display_name?.split(" ")[0] || "them")
                  : "Hide my story from " + (person?.display_name?.split(" ")[0] || "them")}
                onClick={toggleStoryHide}
              />
              <Row icon={Flag}         label="Report profile"              onClick={() => { onClose(); onReport?.() }} />
              <Row icon={Ban}          label="Block"                       danger onClick={() => { onClose(); onBlock?.() }} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
