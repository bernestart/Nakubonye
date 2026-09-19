import { useEffect, useRef, useState } from "react"
import { X, Video, Send } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"

export default function ReelComposer({ onClose, onDone }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState("")
  const [duration, setDuration] = useState(0)
  const [caption, setCaption] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0)

  function pick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith("video/")) { setError("Only videos allowed"); return }
    if (f.size > 100 * 1024 * 1024) { setError("Max 100 MB"); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError("")
  }

  function onLoadedMeta(e) {
    const v = e.target
    setDuration(Math.round(v.duration || 0))
  }

  async function submit() {
    if (!file || !myId) return
    setBusy(true); setError(""); setProgress(0)
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase()
    const path = myId + "/" + crypto.randomUUID() + "." + ext

    const { error: upErr } = await supabase.storage
      .from("reels-media")
      .upload(path, file, { upsert: false, contentType: file.type })

    if (upErr) { setError(upErr.message); setBusy(false); return }
    setProgress(70)

    const { data: pub } = supabase.storage.from("reels-media").getPublicUrl(path)
    const videoUrl = pub?.publicUrl
    if (!videoUrl) { setError("Upload failed"); setBusy(false); return }

    const { error: insErr } = await supabase.from("reels").insert({
      user_id: myId,
      video_url: videoUrl,
      caption: caption.trim() || null,
      duration_sec: duration || null,
    })

    if (insErr) { setError(insErr.message); setBusy(false); return }
    setProgress(100)
    setBusy(false)
    onDone?.()
  }

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  return (
    <div className="fixed inset-0 z-[220] bg-black flex flex-col">
      <input ref={fileRef} type="file" accept="video/*" hidden onChange={pick} />

      <header className="flex items-center justify-between px-3 py-3 z-10">
        <button onClick={onClose} className="w-10 h-10 rounded-full grid place-items-center bg-black/50 text-white" aria-label="Close">
          <X size={22} />
        </button>
        <h2 className="text-white font-bold text-[16px]">New reel</h2>
        <button
          onClick={submit}
          disabled={!file || busy}
          className="h-10 px-4 rounded-full text-white font-bold text-[13.5px] inline-flex items-center gap-2 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
        >
          <Send size={14} /> {busy ? "Posting…" : "Post"}
        </button>
      </header>

      {!preview ? (
        <div className="flex-1 grid place-items-center p-5">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full max-w-[420px] h-64 rounded-3xl border-2 border-dashed border-white/20 grid place-items-center"
          >
            <div className="text-center px-6">
              <Video size={40} className="text-purple-400 mx-auto mb-3" />
              <p className="text-white text-[16px] font-bold mb-1">Choose a video</p>
              <p className="text-white/50 text-[12.5px]">MP4, MOV, WebM · up to 100 MB</p>
            </div>
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 grid place-items-center bg-black overflow-hidden">
            <video
              src={preview}
              controls
              playsInline
              onLoadedMetadata={onLoadedMeta}
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div className="p-3 flex flex-col gap-2" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 200))}
              placeholder="Add a caption…"
              className="h-12 rounded-full bg-white/10 px-5 text-white text-[14.5px] placeholder:text-white/50 focus:outline-none"
            />
            {error && <p className="text-red-400 text-[12.5px] text-center">{error}</p>}
            {busy && progress > 0 && (
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-purple-500" style={{ width: progress + "%" }} />
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="h-11 rounded-full bg-white/10 text-white font-semibold text-[13.5px]"
            >
              Change video
            </button>
          </div>
        </>
      )}
    </div>
  )
}
