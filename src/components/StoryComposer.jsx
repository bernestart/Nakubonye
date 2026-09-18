import { useRef, useState } from "react"
import { X, ImagePlus } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"

export default function StoryComposer({ onClose, onDone }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState("")
  const [caption, setCaption] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  function pick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) {
      setError("Only images and videos allowed")
      return
    }
    if (f.size > 25 * 1024 * 1024) { setError("Max 25 MB"); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError("")
  }

  async function submit() {
    if (!file || !myId) return
    setBusy(true); setError("")
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
    const path = `stories/${myId}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from("chat-media")
      .upload(path, file, { upsert: false, contentType: file.type })
    if (upErr) { setError(upErr.message); setBusy(false); return }
    const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path)
    const mediaType = file.type.startsWith("video/") ? "video" : "image"
    const { error: insErr } = await supabase.from("stories").insert({
      user_id: myId,
      media_url: pub?.publicUrl,
      media_type: mediaType,
      caption: caption.trim() || null,
    })
    if (insErr) { setError(insErr.message); setBusy(false); return }
    setBusy(false)
    onDone?.()
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md grid place-items-center p-4">
      <div className="w-full max-w-[420px] bg-surface rounded-[24px] border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-cream font-extrabold text-[18px]">New story</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {preview ? (
          <div className="rounded-2xl overflow-hidden mb-4 bg-black">
            {file?.type.startsWith("video/") ? (
              <video src={preview} controls className="w-full max-h-[50vh] object-contain" />
            ) : (
              <img src={preview} alt="" className="w-full max-h-[50vh] object-contain" />
            )}
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-48 rounded-2xl border-2 border-dashed border-white/15 grid place-items-center mb-4"
          >
            <div className="text-center px-4">
              <ImagePlus size={28} className="text-purple-400 mx-auto mb-2" />
              <p className="text-cream text-[14px] font-semibold">Tap to choose a photo or video</p>
              <p className="text-subtle text-[12px] mt-1">Disappears after 24 hours</p>
            </div>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={pick} />

        {preview && (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-10 rounded-full bg-white/[0.06] border border-white/12 text-cream font-semibold text-[13px] mb-3"
          >
            Change media
          </button>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, 200))}
          placeholder="Add a caption…"
          rows={2}
          className="w-full bg-elevated border border-white/8 rounded-2xl px-4 py-3 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none mb-4"
        />

        {error && <p className="text-red-400 text-[12.5px] mb-3">{error}</p>}

        <button
          onClick={submit}
          disabled={!file || busy}
          className="w-full h-12 rounded-full text-white font-bold text-[15px] disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
        >
          {busy ? "Posting…" : "Share story"}
        </button>
      </div>
    </div>
  )
}
