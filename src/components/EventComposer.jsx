import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X, ImagePlus } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"

export default function EventComposer({ communityId, onClose, onCreated, existing = null }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const fileRef = useRef(null)

  const [title, setTitle] = useState(existing?.title || "")
  const [description, setDescription] = useState(existing?.description || "")
  const [location, setLocation] = useState(existing?.location || "")
  const [startsAt, setStartsAt] = useState(existing?.starts_at ? existing.starts_at.slice(0, 16) : "")
  const [endsAt, setEndsAt] = useState(existing?.ends_at ? existing.ends_at.slice(0, 16) : "")
  const [isOnline, setIsOnline] = useState(existing?.is_online || false)
  const [onlineUrl, setOnlineUrl] = useState(existing?.online_url || "")
  const [privacy, setPrivacy] = useState(existing?.privacy || "public")
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(existing?.cover_url || "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  function pickCover(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith("image/")) { setError("Cover must be an image"); return }
    if (f.size > 8 * 1024 * 1024) { setError("Cover must be under 8 MB"); return }
    setCoverFile(f)
    setCoverPreview(URL.createObjectURL(f))
    setError("")
  }

  async function save() {
    if (!myId || busy) return
    const t = title.trim()
    if (!t) { setError("Give your event a title"); return }
    if (!startsAt) { setError("Pick a start time"); return }
    setBusy(true); setError(""); tap("light")

    let coverUrl = existing?.cover_url || null
    if (coverFile) {
      try {
        const ext = coverFile.name.split(".").pop()?.toLowerCase() || "jpg"
        const path = `events/${myId}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from("community-media")
          .upload(path, coverFile, { upsert: false, contentType: coverFile.type })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from("community-media").getPublicUrl(path)
        coverUrl = pub?.publicUrl || null
      } catch (e) {
        setBusy(false); setError(e.message || String(e)); return
      }
    }

    const payload = {
      community_id: communityId,
      host_id: myId,
      title: t,
      description: description.trim() || null,
      location: location.trim() || null,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      is_online: isOnline,
      online_url: onlineUrl.trim() || null,
      privacy,
      cover_url: coverUrl,
      updated_at: new Date().toISOString(),
    }

    let err
    if (existing?.id) {
      const { error: e1 } = await supabase.from("events").update(payload).eq("id", existing.id)
      err = e1
    } else {
      const { data, error: e1 } = await supabase.from("events").insert(payload).select("id").single()
      err = e1
      if (!err && data?.id) {
        // Host auto-RSVPs as going
        await supabase.from("event_attendees").insert({
          event_id: data.id,
          user_id: myId,
          status: "going",
        })
      }
    }

    setBusy(false)
    if (err) { setError(err.message); return }
    onCreated?.()
    onClose?.()
  }

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 flex flex-col"
        style={{ maxHeight: "90dvh", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/8">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full grid place-items-center text-muted"
            aria-label="Close"
          ><X size={18} /></button>
          <h3 className="text-cream font-extrabold text-[16px]">{existing ? "Edit event" : "New event"}</h3>
          <button
            onClick={save}
            disabled={busy}
            className="h-9 px-4 rounded-full text-white font-bold text-[13px] disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            {busy ? "Saving…" : existing ? "Save" : "Create"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {/* Cover */}
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-32 rounded-2xl bg-white/[0.03] border border-dashed border-white/15 grid place-items-center overflow-hidden"
          >
            {coverPreview ? (
              <img src={coverPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-muted text-[12.5px] flex items-center gap-2">
                <ImagePlus size={16} /> Add cover (optional)
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickCover} />

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            placeholder="Event title"
            className="h-12 rounded-2xl bg-white/[0.04] border border-white/8 px-4 text-cream text-[14.5px] placeholder:text-muted focus:outline-none focus:border-purple-500"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
            placeholder="What's it about?"
            rows={3}
            className="rounded-2xl bg-white/[0.04] border border-white/8 px-4 py-3 text-cream text-[14px] placeholder:text-muted focus:outline-none focus:border-purple-500 resize-none"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-muted text-[11px] font-bold uppercase tracking-wide mb-1 block">Starts</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/8 px-3 text-cream text-[13px] focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-muted text-[11px] font-bold uppercase tracking-wide mb-1 block">Ends (optional)</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/8 px-3 text-cream text-[13px] focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/8 cursor-pointer">
            <input
              type="checkbox"
              checked={isOnline}
              onChange={(e) => setIsOnline(e.target.checked)}
              className="w-4 h-4 accent-purple-500"
            />
            <span className="text-cream text-[13.5px] font-semibold">Online event</span>
          </label>

          {isOnline ? (
            <input
              value={onlineUrl}
              onChange={(e) => setOnlineUrl(e.target.value)}
              placeholder="Meeting link"
              className="h-11 rounded-xl bg-white/[0.04] border border-white/8 px-4 text-cream text-[13.5px] placeholder:text-muted focus:outline-none focus:border-purple-500"
            />
          ) : (
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
              className="h-11 rounded-xl bg-white/[0.04] border border-white/8 px-4 text-cream text-[13.5px] placeholder:text-muted focus:outline-none focus:border-purple-500"
            />
          )}

          <div>
            <p className="text-muted text-[11px] font-bold uppercase tracking-wide mb-1.5">Who can see</p>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { id: "public", label: "Everyone" },
                { id: "matches", label: "Matches" },
                { id: "following", label: "People I follow" },
                { id: "private", label: "Invite only" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPrivacy(p.id)}
                  className="h-9 px-3.5 rounded-full text-[12.5px] font-bold"
                  style={{
                    background: privacy === p.id ? "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" : "rgba(255,255,255,0.05)",
                    border: privacy === p.id ? "none" : "1px solid rgba(255,255,255,0.08)",
                    color: privacy === p.id ? "#fff" : "#aaa",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-300 text-[12.5px] text-center">{error}</p>}
        </div>
      </div>
    </div>,
    document.body
  )
}
