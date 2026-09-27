import { useEffect, useRef, useState } from "react"
import { X, ImagePlus, Send } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import { tap } from "../lib/haptic"

const AUDIENCES = [
  { id: "public",  label: "Everyone",  icon: "🌍", desc: "Anyone on Nakubonye can see this" },
  { id: "matches", label: "Matches",   icon: "💜", desc: "Only people you've matched with" },
  { id: "private", label: "Only me",   icon: "🔒", desc: "Just for you" },
]

const MAX_IMAGES = 10

export default function PostComposer({ onClose, onDone }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const fileRef = useRef(null)
  const [content, setContent] = useState("")
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [audience, setAudience] = useState("public")
  const [audienceSheetOpen, setAudienceSheetOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0)

  function pickImages(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const remaining = MAX_IMAGES - imageFiles.length
    if (remaining <= 0) { setError(`Max ${MAX_IMAGES} images`); return }

    const accepted = []
    const previews = []
    for (const f of files.slice(0, remaining)) {
      if (!f.type.startsWith("image/")) { setError("Only images allowed"); continue }
      if (f.size > 20 * 1024 * 1024) { setError("Each image must be under 20 MB"); continue }
      accepted.push(f)
      previews.push(URL.createObjectURL(f))
    }
    if (accepted.length === 0) return
    setImageFiles((cur) => [...cur, ...accepted])
    setImagePreviews((cur) => [...cur, ...previews])
    setError("")
    e.target.value = ""
  }

  function removeImage(idx) {
    setImageFiles((cur) => cur.filter((_, i) => i !== idx))
    setImagePreviews((cur) => {
      URL.revokeObjectURL(cur[idx])
      return cur.filter((_, i) => i !== idx)
    })
  }

  async function submit() {
    const body = content.trim()
    if ((!body && imageFiles.length === 0) || !myId || busy) return
    setBusy(true); setError(""); setProgress(0)

    const uploadedPaths = []
    for (let i = 0; i < imageFiles.length; i++) {
      const f = imageFiles[i]
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase()
      const path = `${myId}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from("community-media")
        .upload(path, f, { upsert: false, contentType: f.type })
      if (upErr) { setError(upErr.message); setBusy(false); return }
      uploadedPaths.push(path)
      setProgress(Math.round(((i + 1) / imageFiles.length) * 90))
    }

    const { error: insErr } = await supabase.from("user_posts").insert({
      user_id: myId,
      content: body || null,
      image_path: uploadedPaths[0] || null,     // legacy single-image field
      image_paths: uploadedPaths,               // new multi-image field
      audience,
    })

    if (insErr) { setError(insErr.message); setBusy(false); return }
    setProgress(100)
    setBusy(false)
    onDone?.()
  }

  useEffect(() => () => {
    imagePreviews.forEach((p) => URL.revokeObjectURL(p))
  }, [])

  const activeAud = AUDIENCES.find((a) => a.id === audience) || AUDIENCES[0]
  const canPost = (content.trim() || imageFiles.length > 0) && !busy

  return (
    <div className="fixed inset-0 z-[220] bg-[#0B0B14] flex flex-col" style={{ height: "100dvh" }}>
      <header className="flex items-center justify-between px-3 py-3 shrink-0"
              style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full grid place-items-center bg-white/[0.06] text-muted"
          aria-label="Close"
        >
          <X size={20} />
        </button>
        <h2 className="text-cream font-bold text-[16px]">Create post</h2>
        <button
          onClick={submit}
          disabled={!canPost}
          className="h-10 px-4 rounded-full text-white font-bold text-[13.5px] inline-flex items-center gap-2 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
        >
          <Send size={14} /> {busy ? "Posting…" : "Post"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 1000))}
          placeholder="Share something real…"
          rows={5}
          autoFocus
          className="w-full bg-transparent border-0 text-cream text-[16px] leading-[1.5] placeholder:text-subtle focus:outline-none resize-none mb-3"
        />

        {/* Image grid */}
        {imagePreviews.length > 0 && (
          <div className="grid grid-cols-3 gap-1 mb-3">
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-black">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full grid place-items-center bg-black/70 backdrop-blur-md text-white"
                  aria-label="Remove image"
                >
                  <X size={12} strokeWidth={3} />
                </button>
                {i === 0 && imagePreviews.length > 1 && (
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9.5px] font-black bg-black/70 text-white">
                    COVER
                  </span>
                )}
              </div>
            ))}
            {imagePreviews.length < MAX_IMAGES && (
              <button
                onClick={() => fileRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-white/15 grid place-items-center"
              >
                <ImagePlus size={22} className="text-purple-400" />
              </button>
            )}
          </div>
        )}

        {imagePreviews.length === 0 && (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-32 rounded-2xl border-2 border-dashed border-white/15 grid place-items-center mb-3"
          >
            <div className="text-center">
              <ImagePlus size={24} className="text-purple-400 mx-auto mb-1.5" />
              <p className="text-cream text-[13.5px] font-semibold">Add photos</p>
              <p className="text-subtle text-[11.5px]">Up to {MAX_IMAGES} · optional</p>
            </div>
          </button>
        )}

        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pickImages} />

        {error && (
          <div className="mb-3 text-red-400 text-[12.5px] bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {busy && progress > 0 && (
          <div className="mb-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-purple-500 transition-all" style={{ width: progress + "%" }} />
          </div>
        )}

        {/* Audience pill */}
        <button
          onClick={() => setAudienceSheetOpen(true)}
          className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 text-left"
        >
          <span className="text-2xl">{activeAud.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-cream font-bold text-[13.5px]">{activeAud.label}</p>
            <p className="text-muted text-[12px] truncate">{activeAud.desc}</p>
          </div>
        </button>
      </div>

      {audienceSheetOpen && (
        <div className="fixed inset-0 z-[240] flex items-end" onClick={() => setAudienceSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <h3 className="text-cream font-extrabold text-[16px] mb-2">Who can see this?</h3>
            {AUDIENCES.map((a) => (
              <button
                key={a.id}
                onClick={() => { tap("light"); setAudience(a.id); setAudienceSheetOpen(false) }}
                className="flex items-center gap-3 p-4 rounded-2xl text-left"
                style={{
                  background: audience === a.id ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
                  border: audience === a.id ? "1px solid rgba(168,85,247,0.5)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span className="text-2xl">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-cream font-semibold text-[14px]">{a.label}</p>
                  <p className="text-muted text-[12px]">{a.desc}</p>
                </div>
                {audience === a.id && <span className="text-purple-400 text-[16px]">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
