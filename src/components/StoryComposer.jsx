import { useEffect, useRef, useState } from "react"
import { X, ImagePlus, RefreshCw, Send, Pencil } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"
import StoryEditor from "./StoryEditor"
import { createPortal } from "react-dom"

export default function StoryComposer({ onClose, onDone, onOptimistic, onResolve, onFail, onRetryStart }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState("")
  const [editedBlob, setEditedBlob] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
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
    setEditedBlob(null)
    setError("")
    if (f.type.startsWith("image/")) setEditorOpen(true)
  }

  async function runPublish(tempId, useFile, ext, contentType, mediaType, captionSnapshot) {
    try {
      const path = "stories/" + myId + "/" + crypto.randomUUID() + "." + ext
      const { error: upErr } = await supabase.storage
        .from("chat-media")
        .upload(path, useFile, { upsert: false, contentType })
      if (upErr) throw new Error(upErr.message)
      const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path)
      const { error: insErr } = await supabase.from("stories").insert({
        user_id: myId,
        media_url: pub?.publicUrl,
        media_type: mediaType,
        caption: captionSnapshot || null,
      })
      if (insErr) throw new Error(insErr.message)
      onResolve?.(tempId)
    } catch (e) {
      onFail?.(tempId, e.message || String(e))
    }
  }

  function publishNow(blob, ext, contentType, mediaType, captionSnapshot) {
    if (!myId || !blob) return
    const tempId = "pending-story-" + crypto.randomUUID()
    const previewUrl = URL.createObjectURL(blob)
    const retry = () => {
      onRetryStart?.(tempId)
      runPublish(tempId, blob, ext, contentType, mediaType, captionSnapshot)
    }
    onOptimistic?.({
      _tempId: tempId,
      user_id: myId,
      display_name: "You",
      media_url: previewUrl,
      media_type: mediaType,
      caption: captionSnapshot || null,
      _status: "uploading",
      _retry: retry,
      created_at: new Date().toISOString(),
    })
    onClose?.()
    runPublish(tempId, blob, ext, contentType, mediaType, captionSnapshot)
  }

  async function submit() {
    if (!file || !myId) return
    setBusy(true); setError("")
    const useFile = editedBlob || file
    const ext = editedBlob ? "jpg" : (file.name.split(".").pop()?.toLowerCase() || "jpg")
    const contentType = editedBlob ? "image/jpeg" : file.type
    const mediaType = !editedBlob && file.type.startsWith("video/") ? "video" : "image"
    const tempId = "pending-story-" + crypto.randomUUID()
    const captionSnapshot = caption.trim()
    const retry = () => {
      onRetryStart?.(tempId)
      runPublish(tempId, useFile, ext, contentType, mediaType, captionSnapshot)
    }
    onOptimistic?.({
      _tempId: tempId,
      user_id: myId,
      display_name: "You",
      media_url: preview,
      media_type: mediaType,
      caption: captionSnapshot || null,
      _status: "uploading",
      _retry: retry,
      created_at: new Date().toISOString(),
    })
    onClose?.()
    await runPublish(tempId, useFile, ext, contentType, mediaType, captionSnapshot)
  }

  useEffect(() => {
    const el = fileRef.current
    if (!el) return
    const onCancel = () => onClose?.()
    el.addEventListener("cancel", onCancel)
    const t = setTimeout(() => el.click(), 60)
    return () => {
      clearTimeout(t)
      el.removeEventListener("cancel", onCancel)
    }
  }, [])

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  if (editorOpen && preview && file?.type.startsWith("image/")) {
    return (
      <StoryEditor
        src={preview}
        onCancel={() => { setEditorOpen(false); setPreview(""); setFile(null); setEditedBlob(null) }}
        onSave={(blob, meta) => {
          publishNow(blob, "jpg", "image/jpeg", "image", meta?.caption || "")
        }}
      />
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[2000] bg-black">
      <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={pick} />

      {!preview && null}

      {preview && (
        <div className="absolute inset-0 flex flex-col">
          <button
            onClick={onClose}
            className="absolute top-3 left-3 w-10 h-10 rounded-full grid place-items-center bg-black/50 text-white z-20"
            aria-label="Close"
          >
            <X size={22} />
          </button>

          <div className="flex-1 grid place-items-center bg-black overflow-hidden">
            {file?.type.startsWith("video/") ? (
              <video src={preview} controls className="max-w-full max-h-full object-contain" />
            ) : (
              <img src={preview} alt="" className="max-w-full max-h-full object-contain" />
            )}
          </div>

          <div className="p-3 flex flex-col gap-2" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 h-11 rounded-full bg-white/10 text-white font-semibold text-[13.5px] inline-flex items-center justify-center gap-2"
              >
                <RefreshCw size={15} /> Change
              </button>
              {file?.type.startsWith("image/") && (
                <button
                  onClick={() => { setEditorOpen(true); setPreview(preview) }}
                  className="flex-1 h-11 rounded-full bg-white/10 text-white font-semibold text-[13.5px] inline-flex items-center justify-center gap-2"
                >
                  <Pencil size={15} /> Edit drawing
                </button>
              )}
            </div>

            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 200))}
              placeholder="Add a caption…"
              className="h-12 rounded-full bg-white/10 px-5 text-white text-[14.5px] placeholder:text-white/50 focus:outline-none focus:bg-white/15"
            />

            {error && <p className="text-red-400 text-[12.5px] text-center">{error}</p>}

            <button
              onClick={submit}
              disabled={busy}
              className="h-12 rounded-full text-white font-bold text-[15px] inline-flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
            >
              <Send size={16} /> {busy ? "Posting…" : "Share to story"}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
