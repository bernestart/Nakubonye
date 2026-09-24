import { useState } from "react"
import { X, Pencil, Users, Trash2, Flag, EyeOff, Link2, Bookmark } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"

const AUDIENCES = [
  { id: "public",  label: "Everyone" },
  { id: "matches", label: "Matches" },
  { id: "private", label: "Only me" },
]

export default function PostActionsSheet({ post, onClose, onDeleted, onUpdated }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [screen, setScreen] = useState("menu") // menu | edit | audience
  const [content, setContent] = useState(post.content || "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const isMine = post.author_id === myId
  const isPersonal = post._source === "personal"

  async function deletePost() {
    if (!isPersonal) {
      setError("Delete is only available for personal posts right now.")
      return
    }
    if (!confirm("Delete this post permanently?")) return
    setBusy(true); setError("")
    const { error: err } = await supabase.rpc("delete_my_user_post", { p_post_id: post.id })
    setBusy(false)
    if (err) { setError(err.message); return }
    onDeleted?.(post.id)
    onClose?.()
  }

  async function saveEdit() {
    if (!isPersonal) { setError("Editing is only available for personal posts."); return }
    setBusy(true); setError("")
    const { error: err } = await supabase.rpc("update_my_user_post", {
      p_post_id: post.id,
      p_content: content.trim() || null,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    onUpdated?.({ ...post, content: content.trim() || null })
    onClose?.()
  }

  async function changeAudience(aud) {
    setBusy(true); setError("")
    const { error: err } = await supabase.rpc("update_my_user_post", {
      p_post_id: post.id,
      p_audience: aud,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    onUpdated?.({ ...post, audience: aud })
    onClose?.()
  }

  async function copyLink() {
    tap("light")
    const url = window.location.origin + "/feed"
    try { await navigator.clipboard.writeText(url); alert("Link copied!") } catch {}
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

        {screen === "menu" && (
          <>
            <h3 className="text-cream font-extrabold text-[17px] mb-4">Post options</h3>
            <div className="flex flex-col gap-2">
              {isMine && isPersonal && (
                <button
                  onClick={() => setScreen("edit")}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                    <Pencil size={17} className="text-purple-300" />
                  </div>
                  <div className="flex-1">
                    <p className="text-cream font-semibold text-[14.5px]">Edit post</p>
                    <p className="text-muted text-[12px]">Change the text</p>
                  </div>
                </button>
              )}

              {isMine && isPersonal && (
                <button
                  onClick={() => setScreen("audience")}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                    <Users size={17} className="text-purple-300" />
                  </div>
                  <div className="flex-1">
                    <p className="text-cream font-semibold text-[14.5px]">Change audience</p>
                    <p className="text-muted text-[12px] capitalize">{post.audience || "public"}</p>
                  </div>
                </button>
              )}

              <button
                onClick={copyLink}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                  <Link2 size={17} className="text-purple-300" />
                </div>
                <div className="flex-1">
                  <p className="text-cream font-semibold text-[14.5px]">Copy link</p>
                </div>
              </button>

              {!isMine && (
                <button
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                    <Bookmark size={17} className="text-purple-300" />
                  </div>
                  <div className="flex-1">
                    <p className="text-cream font-semibold text-[14.5px]">Save post</p>
                    <p className="text-muted text-[12px]">Coming soon</p>
                  </div>
                </button>
              )}

              {!isMine && (
                <button
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                    <EyeOff size={17} className="text-purple-300" />
                  </div>
                  <div className="flex-1">
                    <p className="text-cream font-semibold text-[14.5px]">Hide post</p>
                    <p className="text-muted text-[12px]">Coming soon</p>
                  </div>
                </button>
              )}

              {!isMine && (
                <button
                  className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/8 border border-red-500/25 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 grid place-items-center">
                    <Flag size={17} className="text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-cream font-semibold text-[14.5px]">Report post</p>
                    <p className="text-muted text-[12px]">Coming soon</p>
                  </div>
                </button>
              )}

              {isMine && (
                <button
                  onClick={deletePost}
                  disabled={busy}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/8 border border-red-500/25 text-left disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 grid place-items-center">
                    <Trash2 size={17} className="text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-cream font-semibold text-[14.5px]">Delete post</p>
                    <p className="text-muted text-[12px]">Remove permanently</p>
                  </div>
                </button>
              )}

              <button
                onClick={onClose}
                className="w-full h-11 mt-2 text-muted font-semibold text-[13.5px]"
              >
                Cancel
              </button>
            </div>

            {error && <p className="text-red-400 text-[12.5px] mt-3 text-center">{error}</p>}
          </>
        )}

        {screen === "edit" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-cream font-extrabold text-[17px]">Edit post</h3>
              <button onClick={() => setScreen("menu")} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
                <X size={18} />
              </button>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 1000))}
              placeholder="Write something…"
              rows={5}
              autoFocus
              className="w-full bg-elevated border border-white/8 rounded-2xl px-4 py-3 text-cream text-[14.5px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none mb-3"
            />
            {error && <p className="text-red-400 text-[12.5px] mb-3">{error}</p>}
            <button
              onClick={saveEdit}
              disabled={busy}
              className="w-full h-12 rounded-full text-white font-bold text-[14.5px] disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </>
        )}

        {screen === "audience" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-cream font-extrabold text-[17px]">Change audience</h3>
              <button onClick={() => setScreen("menu")} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a.id}
                  onClick={() => changeAudience(a.id)}
                  disabled={busy}
                  className="flex items-center justify-between p-4 rounded-2xl disabled:opacity-50"
                  style={{
                    background: (post.audience || "public") === a.id ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
                    border: (post.audience || "public") === a.id ? "1px solid rgba(168,85,247,0.5)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span className="text-cream font-semibold text-[14px]">{a.label}</span>
                  {(post.audience || "public") === a.id && <span className="text-purple-400">✓</span>}
                </button>
              ))}
            </div>
            {error && <p className="text-red-400 text-[12.5px] mt-3 text-center">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
