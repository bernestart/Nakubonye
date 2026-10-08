import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Link2, MessageCircle, Send, Bookmark, X, Share2 } from "lucide-react"
import { shareContent } from "../lib/share"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"

export default function ShareSheet({ post, source = "community", onClose, onShared }) {
  const { session } = useAuth()
  const nav = useNavigate()
  const myId = session?.user?.id
  const [busy, setBusy] = useState(false)

  // Audience mapping — FB-like cap: private posts aren't shareable
  const originalAudience = post?.audience || (source === "community" ? "public" : "public")

  // Facebook rule: reshare inherits the ORIGINAL post's audience cap.
  // Public → public. Matches → matches. Circle → same circle. Private → no share.
  const inheritedAudience =
    originalAudience === "public" || originalAudience === "everyone" ? "public" :
    originalAudience === "matches" ? "matches" :
    originalAudience === "following" ? "following" :
    originalAudience === "private" ? null :
    (typeof originalAudience === "string" && originalAudience.startsWith("circle:")) ? originalAudience :
    "public"
  const canReshare =
    originalAudience === "public" ||
    originalAudience === "everyone" ||
    originalAudience === "matches" ||
    originalAudience === "following" ||
    (typeof originalAudience === "string" && originalAudience.startsWith("circle:"))

  async function buildSnapshot() {
    // Copy the original content so nested card survives deletion
    return {
      content: post.content || "",
      image_path: post.image_path || null,
      image_paths: post.image_paths || [],
      author_id: post.author_id || post.user_id || null,
      original_created_at: post.created_at || new Date().toISOString(),
      community_id: post.community_id || null,
      type: source,
    }
  }

  async function shareNow() {
    if (!myId || busy || !canReshare) return
    setBusy(true); tap("light")
    try {
      const snapshot = await buildSnapshot()
      await supabase.from("user_posts").insert({
        user_id: myId,
        content: null,
        audience: inheritedAudience || "public",
        reshared_from_type: source,
        reshared_from_id: post.id,
        reshared_from_snapshot: snapshot,
        reshared_include_original: true,
      })
      onShared?.()
      onClose?.()
    } catch (e) {
      console.warn("share now failed", e)
      alert(e.message || "Could not share")
    }
    setBusy(false)
  }

  function shareToFeed() {
    onClose?.()
    nav("/create?reshare_type=" + source + "&reshare_id=" + post.id)
  }

  function sendInMessenger() {
    tap("light")
    onClose?.()
    nav("/messages?share_type=" + source + "&share_id=" + post.id)
  }

  async function copyLink() {
    tap("light")
    const url = window.location.origin + "/post/" + source + "/" + post.id
    try {
      await navigator.clipboard.writeText(url)
      alert("Link copied")
    } catch {}
    onClose?.()
  }

  async function shareExternal() {
    tap("light")
    const url = window.location.origin + "/post/" + source + "/" + post.id
    const title = post?.author_display_name ? post.author_display_name + " on Nakubonye" : "Post on Nakubonye"
    const text = (post?.content || "").slice(0, 120)
    onClose?.()
    try {
      await shareContent({ title, text, url })
    } catch {}
  }

  if (!canReshare) {
    return (
      <div className="fixed inset-0 z-[500] flex items-end" onClick={onClose}>
        <div className="absolute inset-0 bg-black/60" />
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] p-5"
          style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        >
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
          <p className="text-cream font-bold text-[15px] mb-1">This post can't be shared</p>
          <p className="text-muted text-[13px] mb-4">The author chose a private audience.</p>
          <button onClick={onClose} className="w-full h-11 text-muted font-semibold text-[13.5px]">Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] pb-2"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="pt-3 pb-2 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <button
          onClick={shareNow}
          disabled={busy}
          className="w-full flex items-center gap-4 px-4 py-3.5 text-left active:bg-white/[0.04] disabled:opacity-50"
        >
          <Send size={20} strokeWidth={1.9} className="text-cream" />
          <span className="text-cream text-[15px] font-medium flex-1">Share now</span>
          {busy && <span className="text-muted text-[12px]">…</span>}
        </button>

        <button
          onClick={shareToFeed}
          className="w-full flex items-center gap-4 px-4 py-3.5 text-left active:bg-white/[0.04]"
        >
          <Bookmark size={20} strokeWidth={1.9} className="text-cream" />
          <span className="text-cream text-[15px] font-medium flex-1">Share to feed with your own words</span>
        </button>

        <button
          onClick={sendInMessenger}
          className="w-full flex items-center gap-4 px-4 py-3.5 text-left active:bg-white/[0.04]"
        >
          <MessageCircle size={20} strokeWidth={1.9} className="text-cream" />
          <span className="text-cream text-[15px] font-medium flex-1">Send in Messenger</span>
        </button>

        <button
          onClick={shareExternal}
          className="w-full flex items-center gap-4 px-4 py-3.5 text-left active:bg-white/[0.04]"
        >
          <Share2 size={20} strokeWidth={1.9} className="text-cream" />
          <span className="text-cream text-[15px] font-medium flex-1">Share externally</span>
        </button>

        <button
          onClick={copyLink}
          className="w-full flex items-center gap-4 px-4 py-3.5 text-left active:bg-white/[0.04]"
        >
          <Link2 size={20} strokeWidth={1.9} className="text-cream" />
          <span className="text-cream text-[15px] font-medium flex-1">Copy link</span>
        </button>

        {inheritedAudience && inheritedAudience !== "public" && (
          <p className="px-4 py-2 text-muted text-[11.5px] leading-snug">
            This post is only visible to {inheritedAudience === "matches" ? "your matches" : inheritedAudience === "following" ? "people you follow" : "a specific circle"}. Your share will respect that limit.
          </p>
        )}

        <button
          onClick={onClose}
          className="w-full h-11 mt-2 text-muted font-semibold text-[13.5px]"
        >Cancel</button>
      </div>
    </div>
  )
}
