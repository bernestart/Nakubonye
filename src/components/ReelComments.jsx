import { useCallback, useEffect, useRef, useState } from "react"
import { X, Send, Trash2 } from "lucide-react"
import VerifiedBadge from "./VerifiedBadge"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

export default function ReelComments({ reelId, onClose, onCountChange }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [comments, setComments] = useState([])
  const [profiles, setProfiles] = useState(new Map())
  const [photos, setPhotos] = useState(new Map())
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const listRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from("reel_comments")
      .select("id, user_id, content, created_at")
      .eq("reel_id", reelId)
      .order("created_at", { ascending: true })
      .limit(200)

    const list = rows || []
    setComments(list)
    onCountChange?.(list.length)

    const ids = [...new Set(list.map((c) => c.user_id))]
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, display_name, username, is_verified").in("id", ids)
      setProfiles(new Map((profs || []).map((p) => [p.id, p])))

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
  }, [reelId, onCountChange])

  useEffect(() => { load() }, [load])

  // Scroll to bottom on new comments
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [comments.length])

  async function submit() {
    const body = text.trim()
    if (!body || !myId || busy) return
    setBusy(true); tap("light")
    const { error } = await supabase.from("reel_comments").insert({
      reel_id: reelId,
      user_id: myId,
      content: body.slice(0, 500),
    })
    setBusy(false)
    if (!error) { setText(""); load() }
  }

  async function remove(id) {
    if (!confirm("Delete this comment?")) return
    await supabase.from("reel_comments").delete().eq("id", id)
    load()
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 flex flex-col"
        style={{ maxHeight: "75dvh", height: "75dvh" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
          <span className="text-cream font-bold text-[15px]">
            {comments.length} {comments.length === 1 ? "comment" : "comments"}
          </span>
          <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="grid place-items-center h-32 text-muted text-[13px]">Loading…</div>
          ) : comments.length === 0 ? (
            <div className="grid place-items-center h-full text-center">
              <div>
                <p className="text-cream font-bold text-[15px] mb-1">No comments yet</p>
                <p className="text-muted text-[13px]">Be the first to say something.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {comments.map((c) => {
                const prof = profiles.get(c.user_id)
                const photoPath = photos.get(c.user_id)
                const name = prof?.display_name || prof?.username || "Someone"
                const mine = c.user_id === myId
                return (
                  <div key={c.id} className="flex items-start gap-2.5 group">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-elevated border border-white/8 shrink-0">
                      {photoPath ? (
                        <img src={publicPhotoUrl(photoPath)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-purple-400 font-black text-sm">{name[0]}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-cream font-bold text-[12.5px] truncate">
                          {name} {prof?.is_verified && <VerifiedBadge size={13} className="ml-1" />}
                        </span>
                        <span className="text-subtle text-[10.5px]">{new Date(c.created_at).toLocaleDateString()}</span>
                        {mine && (
                          <button onClick={() => remove(c.id)} className="ml-auto text-red-400/70" aria-label="Delete">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <p className="text-cream/90 text-[13.5px] leading-[1.45] whitespace-pre-wrap break-words">{c.content}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-3 py-3 border-t border-white/8 shrink-0" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit() }}
              placeholder="Add a comment…"
              className="flex-1 h-11 rounded-full bg-white/[0.06] border border-white/10 px-4 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={submit}
              disabled={!text.trim() || busy}
              className="w-11 h-11 rounded-full grid place-items-center disabled:opacity-40 shrink-0"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
              aria-label="Send"
            >
              <Send size={18} strokeWidth={2.6} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
