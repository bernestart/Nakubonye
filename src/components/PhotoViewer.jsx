import { useEffect, useState } from "react"
import { Tag } from "lucide-react"
import { supabase } from "../lib/supabase"
import { photoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import TagPicker from "./TagPicker"

export default function PhotoViewer({ photo, currentUserId, onClose }) {
  const [tags, setTags] = useState([])
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const isOwner = currentUserId && photo?.user_id === currentUserId
  const myTag = tags.find((t) => t.tagged_user_id === currentUserId)

  async function loadTags() {
    if (!photo?.id) return
    const { data: rows } = await supabase
      .from("photo_tags")
      .select("id, tagged_user_id, tagger_id")
      .eq("photo_id", photo.id)

    const ids = [...new Set((rows || []).map((t) => t.tagged_user_id))]
    let profMap = new Map()
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", ids)
      ;(profs || []).forEach((p) => profMap.set(p.id, p))
    }

    setTags(
      (rows || []).map((t) => ({
        ...t,
        profile: profMap.get(t.tagged_user_id) || null,
      }))
    )
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!photo?.id) return
      await loadTags()
      if (cancelled) return
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id])

  async function handleSaveTags(selectedUsers) {
    if (!photo?.id || !currentUserId || busy) return
    setBusy(true); setError("")
    try {
      const currentIds = new Set(tags.map((t) => t.tagged_user_id))
      const nextIds = new Set(selectedUsers.map((u) => u.id))

      // Remove tags
      const toRemove = tags.filter((t) => !nextIds.has(t.tagged_user_id))
      for (const t of toRemove) {
        await supabase.from("photo_tags").delete().eq("id", t.id)
      }

      // Add tags
      const toAdd = selectedUsers.filter(
        (u) => !currentIds.has(u.id) && u.id !== currentUserId
      )

      // Look up recipient tag-review settings in one query
      let reviewMap = new Map()
      if (toAdd.length > 0) {
        const { data: settingsRows } = await supabase
          .from("user_settings")
          .select("user_id, tag_review_enabled")
          .in("user_id", toAdd.map((u) => u.id))
        ;(settingsRows || []).forEach((r) => reviewMap.set(r.user_id, r.tag_review_enabled === true))
      }

      for (const u of toAdd) {
        const requiresReview = reviewMap.get(u.id) === true
        const status = requiresReview ? "pending" : "approved"

        const { error: tagErr } = await supabase.from("photo_tags").insert({
          photo_id: photo.id,
          tagged_user_id: u.id,
          tagger_id: currentUserId,
          status,
        })
        if (tagErr) continue

        try {
          await supabase.from("notifications").insert({
            user_id: u.id,
            actor_id: currentUserId,
            type: requiresReview ? "photo_tag_pending" : "photo_tag",
            ref_id: String(photo.id),
            ref_type: "photo",
            body: requiresReview
              ? "tagged you in a photo — review needed"
              : "tagged you in a photo",
          })
        } catch (e) {
          console.warn("photo tag notification failed", e)
        }
      }
      await loadTags()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
      setTagPickerOpen(false)
    }
  }

  async function removeMyTag() {
    if (!myTag || busy) return
    setBusy(true); setError("")
    try {
      const { error: delErr } = await supabase
        .from("photo_tags")
        .delete()
        .eq("id", myTag.id)
      if (delErr) throw delErr
      setTags((cur) => cur.filter((t) => t.id !== myTag.id))
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-[500] bg-black flex items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 w-10 h-10 rounded-full grid place-items-center bg-white/15 text-white z-10"
        onClick={onClose}
        aria-label="Close"
      >
        ✕
      </button>

      <img
        src={photoUrl(photo.bucket, photo.storage_path)}
        alt=""
        className="w-full h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {tags.length > 0 && (
        <div
          className="absolute left-0 right-0 px-4 flex flex-wrap gap-1.5 justify-center"
          style={{ bottom: 88 }}
          onClick={(e) => e.stopPropagation()}
        >
          {tags.map((t) => (
            <span
              key={t.id}
              className="px-2.5 py-1 rounded-full bg-white/15 text-white text-[12px] font-semibold"
            >
              {t.profile?.display_name || t.profile?.username || "Tagged"}
            </span>
          ))}
        </div>
      )}

      <div
        className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-2 justify-center"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {isOwner && (
          <button
            onClick={() => { tap("light"); setTagPickerOpen(true) }}
            disabled={busy}
            className="h-10 px-4 rounded-full bg-white/15 text-white text-[13px] font-bold flex items-center gap-1.5 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            <Tag size={14} /> Tag people
          </button>
        )}
        {!isOwner && myTag && (
          <button
            onClick={removeMyTag}
            disabled={busy}
            className="h-10 px-4 rounded-full bg-red-500/20 border border-red-500/40 text-red-200 text-[13px] font-bold active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            Remove my tag
          </button>
        )}
      </div>

      {error && (
        <p
          className="absolute top-16 left-4 right-4 text-center text-red-300 text-[12.5px] bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          {error}
        </p>
      )}

      {tagPickerOpen && (
        <TagPicker
          initial={tags.map((t) => t.profile).filter(Boolean)}
          onClose={() => setTagPickerOpen(false)}
          onSave={handleSaveTags}
        />
      )}
    </div>
  )
}
