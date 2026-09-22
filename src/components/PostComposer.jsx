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

export default function PostComposer({ onClose, onDone }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const fileRef = useRef(null)
  const [content, setContent] = useState("")
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState("")
  const [audience, setAudience] = useState("public")
  const [audienceSheetOpen, setAudienceSheetOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  function pickImage(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith("image/")) { setError("Only images allowed"); return }
    if (f.size > 20 * 1024 * 1024) { setError("Max 20 MB"); return }
    setImageFile(f)
    setImagePreview(URL.createObjectURL(f))
    setError("")
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview("")
  }

  async function submit() {
    const body = content.trim()
    if ((!body && !imageFile) || !myId || busy) return
    setBusy(true); setError("")

    let imagePath = null

    // Upload image if present
    if (imageFile) {
      const ext = (imageFile.name.split(".").pop() || "jpg").toLowerCase()
      const path = `${myId}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from("community-media")
        .upload(path, imageFile, { upsert: false, contentType: imageFile.type })
      if (upErr) { setError(upErr.message); setBusy(false); return }
      imagePath = path
    }

    const { error: insErr } = await supabase.from("user_posts").insert({
      user_id: myId,
      content: body || null,
      image_path: imagePath,
      audience,
    })

    if (insErr) { setError(insErr.message); setBusy(false); return }
    setBusy(false)
    onDone?.()
  }

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
  }, [imagePreview])

  const activeAud = AUDIENCES.find((a) => a.id === audience) || AUDIENCES[0]
  const canPost = (content.trim() || imageFile) && !busy

  return (
    <div className="fixed inset-0 z-[220] bg-[#0B0B14] flex flex-col"
         style={{ height: "100dvh" }}>
      {/* Header */}
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 1000))}
          placeholder="Share something real…"
          rows={6}
          autoFocus
          className="w-full bg-transparent border-0 text-cream text-[16px] leading-[1.5] placeholder:text-subtle focus:outline-none resize-none mb-3"
        />

        {imagePreview && (
          <div className="relative rounded-2xl overflow-hidden mb-3">
            <img src={imagePreview} alt="" className="w-full max-h-[60vh] object-contain bg-black" />
            <button
              onClick={clearImage}
              className="absolute top-2 right-2 w-8 h-8 rounded-full grid place-items-center bg-black/60 backdrop-blur-md text-white"
              aria-label="Remove image"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {!imagePreview && (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-32 rounded-2xl border-2 border-dashed border-white/15 grid place-items-center mb-3"
          >
            <div className="text-center">
              <ImagePlus size={24} className="text-purple-400 mx-auto mb-1.5" />
              <p className="text-cream text-[13.5px] font-semibold">Add a photo</p>
              <p className="text-subtle text-[11.5px]">Optional</p>
            </div>
          </button>
        )}

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />

        {error && (
          <div className="mb-3 text-red-400 text-[12.5px] bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
            {error}
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

      {/* Audience sheet */}
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
