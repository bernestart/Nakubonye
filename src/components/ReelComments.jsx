import { useCallback, useEffect, useRef, useState } from "react"
import { X, Send, Trash2, Heart, Pencil, CornerDownRight, Pin } from "lucide-react"
import VerifiedBadge from "./VerifiedBadge"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"

export default function ReelComments({ reelId, onClose, onCountChange }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const [comments, setComments] = useState([])
  const [reelOwnerId, setReelOwnerId] = useState(null)
  const [profiles, setProfiles] = useState(new Map())
  const [photos, setPhotos] = useState(new Map())
  const [reactions, setReactions] = useState(new Map())
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [canComment, setCanComment] = useState(true)
  const [canCommentReason, setCanCommentReason] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState("")
  const [pickerFor, setPickerFor] = useState(null)
  const listRef = useRef(null)
  const onCountChangeRef = useRef(onCountChange)

  useEffect(() => { onCountChangeRef.current = onCountChange }, [onCountChange])

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from("reel_comments")
      .select("id, user_id, content, created_at, reply_to_id, edited_at, deleted_at, pinned_at")
      .eq("reel_id", reelId)
      .order("created_at", { ascending: true })
      .limit(300)

    const list = (rows || []).slice().sort((a, b) => {
      if (a.pinned_at && !b.pinned_at) return -1
      if (b.pinned_at && !a.pinned_at) return 1
      return new Date(a.created_at) - new Date(b.created_at)
    })
    setComments(list)
    onCountChangeRef.current?.(list.filter((c) => !c.deleted_at).length)

    const ids = [...new Set(list.map((c) => c.user_id))]
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, username, is_verified")
        .in("id", ids)
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

    const commentIds = list.map((c) => c.id)
    if (commentIds.length > 0) {
      const { data: reacts } = await supabase
        .from("reel_comment_reactions")
        .select("comment_id, user_id, reaction")
        .in("comment_id", commentIds)
      const rmap = new Map()
      ;(reacts || []).forEach((r) => {
        if (!rmap.has(r.comment_id)) rmap.set(r.comment_id, new Map())
        rmap.get(r.comment_id).set(r.user_id, r.reaction)
      })
      setReactions(rmap)
    } else {
      setReactions(new Map())
    }

    setLoading(false)
  }, [reelId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [comments.length])

  async function submit() {
    if (!canComment) return
    const body = text.trim()
    if (!body || !myId || busy) return
    setBusy(true); tap("light")
    const { error } = await supabase.from("reel_comments").insert({
      reel_id: reelId,
      user_id: myId,
      content: body.slice(0, 500),
      reply_to_id: replyingTo?.id || null,
    })
    setBusy(false)
    if (!error) {
      setText(""); setReplyingTo(null)
      load()
      try {
        const { data: r } = await supabase.from("reels").select("user_id").eq("id", reelId).maybeSingle()
        if (r?.user_id && r.user_id !== myId) {
          await supabase.from("notifications").insert({
            user_id: r.user_id,
            actor_id: myId,
            type: "reel_comment",
            ref_id: String(reelId),
            ref_type: "reel",
            body: "commented on your reel",
          })
        }
      } catch (e) { console.warn("reel comment notify failed", e) }
    }
  }

  async function saveEdit(id) {
    const body = editText.trim()
    if (!body || busy) return
    setBusy(true)
    const nowIso = new Date().toISOString()
    const { error } = await supabase.from("reel_comments")
      .update({ content: body.slice(0, 500), edited_at: nowIso })
      .eq("id", id).eq("user_id", myId)
    setBusy(false)
    if (error) return
    setComments((cur) => cur.map((c) => c.id === id ? { ...c, content: body.slice(0, 500), edited_at: nowIso } : c))
    setEditingId(null); setEditText("")
  }

  async function togglePin(comment) {
    if (!reelOwnerId || reelOwnerId !== myId) return
    const next = comment.pinned_at ? null : new Date().toISOString()
    tap("light")
    if (next) {
      const others = comments.filter((c) => c.id !== comment.id && c.pinned_at)
      for (const o of others) {
        await supabase.from("reel_comments").update({ pinned_at: null }).eq("id", o.id)
      }
    }
    await supabase.from("reel_comments").update({ pinned_at: next }).eq("id", comment.id)
    setComments((cur) => {
      const updated = cur.map((c) => {
        if (c.id === comment.id) return { ...c, pinned_at: next }
        if (next && c.pinned_at) return { ...c, pinned_at: null }
        return c
      })
      return updated.slice().sort((a, b) => {
        if (a.pinned_at && !b.pinned_at) return -1
        if (b.pinned_at && !a.pinned_at) return 1
        return new Date(a.created_at) - new Date(b.created_at)
      })
    })
  }

  async function remove(id) {
    if (!confirm("Delete this comment?")) return
    await supabase.from("reel_comments").update({ deleted_at: new Date().toISOString(), content: "" }).eq("id", id)
    setComments((cur) => cur.map((c) => c.id === id ? { ...c, deleted_at: new Date().toISOString(), content: "" } : c))
  }

  async function toggleReaction(id, emoji) {
    if (!myId) return
    tap("light")
    const cur = reactions.get(id)?.get(myId)
    const next = new Map(reactions)
    const inner = new Map(next.get(id) || [])
    if (cur === emoji) {
      inner.delete(myId)
      await supabase.from("reel_comment_reactions").delete().eq("comment_id", id).eq("user_id", myId)
    } else if (cur) {
      inner.set(myId, emoji)
      await supabase.from("reel_comment_reactions").update({ reaction: emoji }).eq("comment_id", id).eq("user_id", myId)
    } else {
      inner.set(myId, emoji)
      await supabase.from("reel_comment_reactions").insert({ comment_id: id, user_id: myId, reaction: emoji })
    }
    next.set(id, inner)
    setReactions(next)
    setPickerFor(null)
  }

  function grouped() {
    const visible = comments.filter((c) => !c.deleted_at)
    const roots = []
    const byParent = new Map()
    visible.forEach((c) => {
      if (!c.reply_to_id) roots.push(c)
      else {
        if (!byParent.has(c.reply_to_id)) byParent.set(c.reply_to_id, [])
        byParent.get(c.reply_to_id).push(c)
      }
    })
    return roots.map((r) => ({
      root: r,
      replies: byParent.get(r.id) || [],
    }))
  }

  const groupedList = grouped()
  const total = comments.filter((c) => !c.deleted_at).length

  return (
    <div className="fixed inset-0 z-[300] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 flex flex-col"
        style={{ maxHeight: "85dvh", height: "85dvh" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
          <span className="text-cream font-bold text-[15px]">
            {total} {total === 1 ? "comment" : "comments"}
          </span>
          <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="grid place-items-center h-32 text-muted text-[13px]">Loading…</div>
          ) : groupedList.length === 0 ? (
            <div className="grid place-items-center h-full text-center">
              <div>
                <p className="text-cream font-bold text-[15px] mb-1">No comments yet</p>
                <p className="text-muted text-[13px]">Be the first to say something.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {groupedList.map(({ root, replies }) => {
                const prof = profiles.get(root.user_id)
                const photoPath = photos.get(root.user_id)
                const name = prof?.display_name || prof?.username || "Someone"
                const mine = root.user_id === myId
                return (
                  <div key={root.id}>
                    {renderComment(root, prof, photoPath, name, mine, false)}
                    {replies.length > 0 && (
                      <div className="flex flex-col gap-3 mt-3 pl-11">
                        {replies.map((rep) => {
                          const p2 = profiles.get(rep.user_id)
                          const ph2 = photos.get(rep.user_id)
                          const n2 = p2?.display_name || p2?.username || "Someone"
                          const mine2 = rep.user_id === myId
                          return <div key={rep.id}>{renderComment(rep, p2, ph2, n2, mine2, true)}</div>
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {replyingTo && (
          <div className="shrink-0 mx-3 mb-2 px-3 py-2 rounded-xl bg-elevated border border-purple-500/30 flex items-start gap-2">
            <CornerDownRight size={14} className="text-purple-300 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-purple-300 text-[10.5px] font-bold tracking-wide uppercase mb-0.5">
                Replying to {profiles.get(replyingTo.user_id)?.display_name || profiles.get(replyingTo.user_id)?.username || "Someone"}
              </p>
              <p className="text-muted text-[12px] truncate">{replyingTo.content}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="w-6 h-6 rounded-full grid place-items-center text-muted shrink-0" aria-label="Cancel reply">
              <X size={14} strokeWidth={2.4} />
            </button>
          </div>
        )}

        <div className="px-3 py-3 border-t border-white/8 shrink-0" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          {!canComment ? (
            <div className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-center">
              <p className="text-red-300 text-[12.5px] font-semibold">{canCommentReason || "You can't comment here"}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 500))}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit() }}
                placeholder={replyingTo ? "Write a reply…" : "Add a comment…"}
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
          )}
        </div>
      </div>
    </div>
  )

  function renderComment(c, prof, photoPath, name, mine, isReply) {
    const isOwner = reelOwnerId && reelOwnerId === myId
    const isPinned = !!c.pinned_at
    const showPin = isOwner && !isReply
    const reacts = reactions.get(c.id) || new Map()
    const myReaction = reacts.get(myId)
    const reactCount = reacts.size
    const isEditing = editingId === c.id
    return (
      <div className="flex items-start gap-2.5">
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
            {c.edited_at && <span className="text-subtle text-[10.5px] italic">(edited)</span>}
            {isPinned && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-black tracking-wider uppercase text-amber-200 bg-amber-500/15 border border-amber-500/30">
                <Pin size={9} fill="currentColor" /> Pinned
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="mt-1 flex flex-col gap-2">
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value.slice(0, 500))}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(c.id); if (e.key === "Escape") { setEditingId(null); setEditText("") } }}
                autoFocus
                className="w-full h-10 rounded-xl bg-white/[0.06] border border-white/12 px-3 text-cream text-[13px] focus:outline-none focus:border-purple-500"
              />
              <div className="flex gap-2">
                <button onClick={() => saveEdit(c.id)} disabled={busy} className="h-8 px-3 rounded-full text-white text-[12px] font-bold disabled:opacity-50" style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}>Save</button>
                <button onClick={() => { setEditingId(null); setEditText("") }} className="h-8 px-3 rounded-full bg-white/[0.06] border border-white/10 text-cream text-[12px] font-bold">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-cream/90 text-[13.5px] leading-[1.45] whitespace-pre-wrap break-words">{c.content}</p>
          )}

          {!isEditing && (
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <button
                onClick={() => toggleReaction(c.id, "❤️")}
                onContextMenu={(e) => { e.preventDefault(); setPickerFor(pickerFor === c.id ? null : c.id) }}
                className="flex items-center gap-1 text-[11.5px] font-semibold"
                style={{ color: myReaction ? "#EC4899" : "#888" }}
              >
                <Heart size={13} fill={myReaction ? "#EC4899" : "none"} color={myReaction ? "#EC4899" : "#888"} />
                {reactCount > 0 ? reactCount : ""}
              </button>
              {!isReply && (
                <button onClick={() => { tap("light"); setReplyingTo(c) }} className="text-muted text-[11.5px] font-semibold">Reply</button>
              )}
              {mine && !c.deleted_at && (
                <>
                  {showPin && (
                    <button
                      onClick={() => togglePin(c)}
                      className={`text-[11.5px] font-semibold inline-flex items-center gap-1 ${isPinned ? "text-amber-300" : "text-muted"}`}
                    >
                      <Pin size={11} fill={isPinned ? "currentColor" : "none"} /> {isPinned ? "Unpin" : "Pin"}
                    </button>
                  )}
                  <button onClick={() => { setEditingId(c.id); setEditText(c.content) }} className="text-muted text-[11.5px] font-semibold inline-flex items-center gap-1">
                    <Pencil size={11} /> Edit
                  </button>
                  <button onClick={() => remove(c.id)} className="text-red-400/80 text-[11.5px] font-semibold inline-flex items-center gap-1">
                    <Trash2 size={11} /> Delete
                  </button>
                </>
              )}
            </div>
          )}

          {pickerFor === c.id && (
            <div className="mt-1.5 flex gap-1 p-1.5 rounded-full bg-elevated border border-white/10 w-fit">
              {["❤️","😂","👍","😮","😢","😡"].map((e) => (
                <button key={e} onClick={() => toggleReaction(c.id, e)} className="w-7 h-7 rounded-full grid place-items-center text-[15px] hover:bg-white/10">{e}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }
}
