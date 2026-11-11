import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { X, Camera, Image as ImageIcon, Type, LayoutGrid, Loader2, Settings, Video } from "lucide-react"
import { useAuth } from "../lib/auth"
import { Camera as NativeCamera, CameraResultType, CameraSource } from "@capacitor/camera"
import { PhotoLibrary } from "@capgo/capacitor-photo-library"
import { FilePicker } from "@capawesome/capacitor-file-picker"
import { Capacitor } from "@capacitor/core"
import StoryEditor from "./story/StoryEditor"
import { base64ToBlob, uploadStoryMedia } from "../lib/storyUpload"
import { supabase } from "../lib/supabase"

const MIME_TO_EXT = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/3gpp": "3gp",
  "video/x-matroska": "mkv",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
}

function normaliseMime(rawMime, fallbackType) {
  const m = (rawMime || "").toLowerCase().trim()
  if (m.startsWith("video/") || m.startsWith("image/")) return m
  return fallbackType === "video" ? "video/mp4" : "image/jpeg"
}

function extFromMime(mime, fallbackType) {
  return MIME_TO_EXT[mime] || (fallbackType === "video" ? "mp4" : "jpg")
}

export default function StoryComposer({ onClose, onDone, onOptimistic, onResolve, onFail }) {
  const { session } = useAuth()
  const myId = session?.user?.id

  const [step, setStep] = useState("hub")
  const [mediaSrc, setMediaSrc] = useState("")
  const [mediaType, setMediaType] = useState("image")
  const [mediaMime, setMediaMime] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [recent, setRecent] = useState([])
  const [loadingMedia, setLoadingMedia] = useState(true)

  useEffect(() => {
    const current = mediaSrc
    return () => {
      if (current && current.startsWith("blob:")) {
        try { URL.revokeObjectURL(current) } catch {}
      }
    }
  }, [mediaSrc])

  useEffect(() => {
    let cancelled = false
    async function loadRecent() {
      if (!Capacitor.isNativePlatform()) {
        setLoadingMedia(false)
        return
      }
      try {
        const perm = await PhotoLibrary.requestAuthorization()
        if (perm.state === "authorized" || perm.state === "limited") {
          const result = await PhotoLibrary.getLibrary({
            limit: 18,
            thumbnailWidth: 256,
            thumbnailHeight: 256,
            includeImages: true
          })
          if (!cancelled) setRecent(result.assets || [])
        }
      } catch (e) {
        console.warn("Preload failed:", e)
      } finally {
        if (!cancelled) setLoadingMedia(false)
      }
    }
    loadRecent()
    return () => { cancelled = true }
  }, [])

  async function ensureMediaPermission() {
    if (!Capacitor.isNativePlatform()) return true
    try {
      const status = await NativeCamera.checkPermissions()
      if (status.photos === "granted" || status.photos === "limited") return true
      const req = await NativeCamera.requestPermissions({ permissions: ["photos", "camera"] })
      return req.photos === "granted" || req.photos === "limited"
    } catch (e) {
      console.warn("Permission check failed:", e)
      return true
    }
  }

  async function pickFromGallery() {
    setError("")
    if (!Capacitor.isNativePlatform()) {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "image/*,video/*"
      input.onchange = () => {
        const file = input.files?.[0]
        if (file) {
          const isVideo = file.type.startsWith("video/")
          const reader = new FileReader()
          reader.onloadend = () => {
            setMediaSrc(reader.result)
            setMediaType(isVideo ? "video" : "image")
            setStep("editor")
          }
          reader.readAsDataURL(file)
        }
      }
      input.click()
      return
    }

    setBusy(true)
    try {
      // Use FilePicker to get the native path. Do NOT use readData: true for videos.
      const result = await FilePicker.pickFiles({ types: ['image/*', 'video/*'] })
      if (result.files && result.files.length > 0) {
        const file = result.files[0]
        const isVideo = file.mimeType?.startsWith("video/")
        
        if (file.path) {
          // Convert the native path to a safe web URL for the <video> tag
          const safePath = Capacitor.convertFileSrc(file.path)
          setMediaSrc(safePath)
          setMediaType(isVideo ? "video" : "image")
          setStep("editor")
        } else {
           throw new Error("Could not read file path.")
        }
      }
    } catch (e) {
      if (!/cancel/i.test(e.message || "")) setError("Gallery failed: " + (e.message || "unknown"))
    } finally {
      setBusy(false)
    }
  }

  async function selectPreload(asset) {
    setError("")
    setBusy(true)
    try {
      // Replicate the exact logic from your successful grid render
      const thumbSrc = asset.thumbnail?.webPath || (asset.thumbnail?.path ? Capacitor.convertFileSrc(asset.thumbnail.path) : null)
      const fullSrc = asset.file?.webPath || (asset.file?.path ? Capacitor.convertFileSrc(asset.file.path) : null)
      
      const safeSrc = fullSrc || thumbSrc

      if (!safeSrc) {
        throw new Error("No readable path for this asset.")
      }

      setMediaSrc(safeSrc)
      const isVideo = (asset.type || asset.mimeType || asset.file?.mimeType || "").toLowerCase().startsWith("video/")
      setMediaType(isVideo ? "video" : "image")
      if (isVideo) setMediaMime(asset.mimeType || asset.file?.mimeType || "")
      setStep("editor")
    } catch (err) {
      console.warn("Preload tap failed:", err)
      setError("Could not open image: " + err.message)
    } finally {
      setBusy(false)
    }
  }

  async function pickVideoFromCamera() {
    setError("")
    setBusy(true)
    try {
      const result = await FilePicker.pickFiles({ types: ['video/*'] })
      if (result.files && result.files.length > 0) {
        const file = result.files[0]
        if (file.path) {
          const safePath = Capacitor.convertFileSrc(file.path)
          setMediaSrc(safePath)
          setMediaMime(file.mimeType || "")
          setMediaType("video")
          setStep("editor")
        }
      }
    } catch (e) {
      if (!/cancel/i.test(e.message || "")) setError("Video picker failed: " + (e.message || "unknown"))
    } finally {
      setBusy(false)
    }
  }

  async function pickFromCamera() {
    if (!Capacitor.isNativePlatform()) { pickFromGallery(); return }
    setError("")
    setBusy(true)
    try {
      const ok = await ensureMediaPermission()
      if (!ok) throw new Error("Camera permission denied.")
      const shot = await NativeCamera.getPhoto({
        quality: 90, resultType: CameraResultType.Base64, source: CameraSource.Camera
      })
      if (!shot?.base64String) throw new Error("Camera returned no image.")
      const blob = base64ToBlob(shot.base64String, "image/jpeg")
      if (blob.size === 0) throw new Error("Camera returned an empty image.")
      setMediaSrc(URL.createObjectURL(blob))
      setStep("editor")
    } catch (err) {
      if (!/cancel/i.test(err.message || "")) setError("Camera failed: " + (err.message || "unknown"))
    } finally {
      setBusy(false)
    }
  }

  async function handleShare(blob, meta) {
    const finalMediaType = meta.mediaType || mediaType || "image"
    if (!myId) return
    setBusy(true)
    setError("")

    // Stable client-generated ID — used for BOTH optimistic-add AND resolve.
    const clientKey = "temp-" + (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : (Date.now() + "-" + Math.random().toString(36).slice(2)))

    // Optimistic: show the pending card BEFORE upload starts.
    onOptimistic?.({
      _tempId: clientKey,
      _status: "uploading",
      user_id: myId,
      media_type: finalMediaType,
      _localPreview: finalMediaType === "image" ? mediaSrc : null,
      created_at: new Date().toISOString()
    })

    try {
      const rawMime = meta.mimeType || (blob && blob.type) || mediaMime || ""
      const mime = normaliseMime(rawMime, finalMediaType)
      const ext = extFromMime(mime, finalMediaType)
      if (!blob || blob.size === 0) throw new Error("The file is empty or unreadable.")
      const path = await uploadStoryMedia(blob, ext, mime, myId)
      const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path)

      const { error: dbErr } = await supabase.from("stories").insert({
        user_id: myId,
        media_url: pub.publicUrl,
        media_type: finalMediaType,
        caption: meta.caption || null,
        audience: meta.audience || "everyone",
        metadata: meta.metadata || {},
        link_url: meta.metadata?.link?.url || null,
        music_track: meta.metadata?.music || null
      })
      if (dbErr) throw new Error(dbErr.message)

      // Success — resolve the optimistic card using the SAME key.
      onResolve?.(clientKey)
      onClose?.()
    } catch (err) {
      setError(err.message || "Upload failed.")
      onFail?.(clientKey, err.message || "Upload failed")
      setBusy(false)
    }
  }

  if (step === "editor") {
    return <StoryEditor src={mediaSrc} mediaType={mediaType} mediaMime={mediaMime} onCancel={() => setStep("hub")} onShare={handleShare} />
  }

  return createPortal(
    <div className="fixed inset-0 z-[2000] bg-[#18191A] flex flex-col">
      <div className="flex items-center justify-between p-4 shrink-0" style={{ paddingTop: "max(16px, var(--safe-top, 32px))" }}>
        <button onClick={onClose} className="w-10 h-10 bg-white/10 rounded-full grid place-items-center">
          <X size={24} className="text-white" />
        </button>
        <h2 className="text-white font-bold text-lg">Create story</h2>
        <button className="w-10 h-10 grid place-items-center"><Settings size={22} className="text-white" /></button>
      </div>

      <div className="flex gap-3 px-4 py-4 overflow-x-auto shrink-0">
        <button onClick={() => {}} className="flex flex-col items-center justify-center w-[100px] h-[100px] bg-[#1C1C1E] border border-purple-500/30 rounded-xl gap-2 shrink-0 text-white">
          <Type size={28} /><span className="text-sm font-semibold">Text</span>
        </button>
        <button onClick={pickFromCamera} className="flex flex-col items-center justify-center w-[100px] h-[100px] bg-[#1C1C1E] border border-purple-500/30 rounded-xl gap-2 shrink-0 text-white">
          <Camera size={28} /><span className="text-sm font-semibold">Camera</span>
        </button>
        <button onClick={pickVideoFromCamera} className="flex flex-col items-center justify-center w-[100px] h-[100px] bg-[#1C1C1E] border border-purple-500/30 rounded-xl gap-2 shrink-0 text-white">
          <Video size={28} /><span className="text-sm font-semibold">Video</span>
        </button>
        <button onClick={pickFromGallery} className="flex flex-col items-center justify-center w-[100px] h-[100px] bg-[#1C1C1E] border border-purple-500/30 rounded-xl gap-2 shrink-0 text-white">
          <LayoutGrid size={28} /><span className="text-sm font-semibold">Collage</span>
        </button>
      </div>

      <div className="flex-1 px-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white text-lg font-bold">Gallery</h3>
          <button onClick={pickFromGallery} className="text-purple-400 font-semibold text-sm flex items-center gap-1"><ImageIcon size={16} /> Open Gallery</button>
        </div>

        {loadingMedia ? (
          <div className="grid grid-cols-3 gap-1">{[...Array(9)].map((_, i) => <div key={i} className="aspect-square bg-white/5 animate-pulse rounded-sm" />)}</div>
        ) : recent.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {recent.map((asset, i) => {
              const thumbSrc = asset.thumbnail?.webPath || (asset.thumbnail?.path ? Capacitor.convertFileSrc(asset.thumbnail.path) : null)
              return (
                <button key={asset.identifier || i} onClick={() => selectPreload(asset)} className="aspect-square bg-gray-800 overflow-hidden relative active:opacity-70">
                  {thumbSrc ? <img src={thumbSrc} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center"><ImageIcon size={20} className="text-white/30" /></div>}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="grid place-items-center h-40">
            <button onClick={pickFromGallery} className="text-white/50 flex flex-col items-center gap-2">
              <ImageIcon size={32} /><span>Tap to open gallery</span>
            </button>
          </div>
        )}
      </div>

      <div style={{ height: "max(12px, var(--safe-bottom, 8px))" }} />

      {busy && <div className="absolute inset-0 bg-[#0B0B14]/80 z-50 grid place-items-center"><Loader2 className="animate-spin text-white" size={40} /></div>}
      {error && (
        <div className="absolute left-4 right-4 bg-red-500/20 border border-red-500/40 rounded-lg p-3" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>
          <p className="text-red-300 text-sm text-center">{error}</p>
        </div>
      )}
    </div>,
    document.body
  )
}
