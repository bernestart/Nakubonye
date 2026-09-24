import { useEffect, useRef, useState } from "react"
import { X, Send, Circle, Square, RotateCcw, Mic, MicOff, Camera, Upload } from "lucide-react"
import ReelTrim from "./ReelTrim"
import ReelDecorate from "./ReelDecorate"
import TagPicker from "./TagPicker"
import { supabase } from "../lib/supabase"
import { getReelDraft, clearReelDraft } from "../lib/draftStore"
import { useAuth } from "../lib/auth"

const MAX_RECORD_SECONDS = 60

async function extractThumbnail(file, timeSec) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const v = document.createElement("video")
      v.src = url
      v.muted = true
      v.playsInline = true
      v.crossOrigin = "anonymous"
      let resolved = false
      const done = (blob) => {
        if (resolved) return
        resolved = true
        try { URL.revokeObjectURL(url) } catch {}
        resolve(blob)
      }
      v.onloadedmetadata = () => {
        const t = Math.max(0, Math.min(timeSec || 0.1, (v.duration || 1) - 0.1))
        try { v.currentTime = t } catch { done(null) }
      }
      v.onseeked = () => {
        try {
          const c = document.createElement("canvas")
          c.width = v.videoWidth || 720
          c.height = v.videoHeight || 1280
          const ctx = c.getContext("2d")
          ctx.drawImage(v, 0, 0, c.width, c.height)
          c.toBlob((blob) => done(blob), "image/jpeg", 0.85)
        } catch { done(null) }
      }
      v.onerror = () => done(null)
      setTimeout(() => done(null), 5000)
    } catch {
      resolve(null)
    }
  })
}

export default function ReelComposer({ onClose, onDone, remixOf }) {
  const { session } = useAuth()
  const myId = session?.user?.id
  const fileRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  const [tab, setTab] = useState("record")
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState("")
  const [duration, setDuration] = useState(0)
  const [caption, setCaption] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0)
  const [trimming, setTrimming] = useState(false)
  const [stage, setStage] = useState("capture")
  const [draftPrompt, setDraftPrompt] = useState(null) // { savedAt, clips, textOverlays, stickerOverlays, filterId } // capture | trim | decorate | publish
  const [trimStart, setTrimStart] = useState(0)
  const [mirroredState, setMirroredState] = useState(false)
  const [textOverlaysState, setTextOverlaysState] = useState([])
  const [stickerOverlaysState, setStickerOverlaysState] = useState([])
  const [filterIdState, setFilterIdState] = useState("none")
  const [clipsState, setClipsState] = useState([])
  const [audienceState, setAudienceState] = useState("public")
  const [allowComments, setAllowComments] = useState(true)
  const [allowRemix, setAllowRemix] = useState(true)
  const [locationState, setLocationState] = useState("")
  const [coverTime, setCoverTime] = useState(0)
  const [taggedUsers, setTaggedUsers] = useState([])
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [aspectRatioState, setAspectRatioState] = useState("9:16")
  const [trimEnd, setTrimEnd] = useState(null)

  const [recording, setRecording] = useState(false)
  const [recordSec, setRecordSec] = useState(0)
  const [facing, setFacing] = useState("user")
  const [micOn, setMicOn] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)

  async function startCamera(newFacing) {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing || facing, width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: micOn,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setCameraReady(true)
      setError("")
    } catch (e) {
      setError("Camera access denied. Allow camera in your browser.")
      setCameraReady(false)
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }

  useEffect(() => {
    if (tab === "record" && !preview) startCamera(facing)
    return () => { if (tab === "record") stopCamera() }
  }, [tab, facing])

  useEffect(() => () => { stopCamera(); clearInterval(timerRef.current) }, [])

  function startRecording() {
    const stream = streamRef.current
    if (!stream) { setError("Camera not ready"); return }
    try {
      const mime = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm"
      const mr = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" })
        const f = new File([blob], "recording.webm", { type: "video/webm" })
        setFile(f)
        setPreview(URL.createObjectURL(f))
        setDuration(recordSec)
        stopCamera()
      }
      recorderRef.current = mr
      mr.start()
      setRecording(true)
      setRecordSec(0)
      timerRef.current = setInterval(() => {
        setRecordSec((s) => {
          if (s + 1 >= MAX_RECORD_SECONDS) { stopRecording(); return MAX_RECORD_SECONDS }
          return s + 1
        })
      }, 1000)
    } catch (e) {
      setError("Recording failed: " + (e?.message || "unknown"))
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop()
    }
    setRecording(false)
  }

  function retake() {
    setFile(null); setPreview(""); setRecordSec(0); setDuration(0)
    setTrimStart(0); setTrimEnd(null); setTrimming(false)
    startCamera(facing)
  }

  function switchCamera() {
    if (recording) return
    const next = facing === "user" ? "environment" : "user"
    setFacing(next)
  }

  function toggleMic() {
    if (recording) return
    setMicOn((m) => !m)
    setTimeout(() => startCamera(facing), 50)
  }

  function pick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith("video/")) { setError("Only videos allowed"); return }
    if (f.size > 100 * 1024 * 1024) { setError("Max 100 MB"); return }
    setFile(f); setPreview(URL.createObjectURL(f)); setError("")
  }

  function onLoadedMeta(e) { setDuration(Math.round(e.target.duration || 0)) }

  async function submit() {
    if (!file || !myId) return
    setBusy(true); setError(""); setProgress(0)

    // Determine list of clips (fall back to the single file if the trim step was skipped)
    const sourceClips = (clipsState && clipsState.length > 0)
      ? clipsState
      : [{ file, url: preview, trimStart: trimStart || 0, trimEnd: trimEnd || duration || 0 }]

    const uploaded = []
    const total = sourceClips.length

    for (let i = 0; i < total; i++) {
      const clip = sourceClips[i]
      const cFile = clip.file || (i === 0 ? file : null)
      if (!cFile) continue
      const ext = (cFile.name.split(".").pop() || "mp4").toLowerCase()
      const path = myId + "/" + crypto.randomUUID() + "." + ext
      const { error: upErr } = await supabase.storage
        .from("reels-media")
        .upload(path, cFile, { upsert: false, contentType: cFile.type })
      if (upErr) { setError(upErr.message); setBusy(false); return }
      const { data: pub } = supabase.storage.from("reels-media").getPublicUrl(path)
      if (!pub?.publicUrl) { setError("Upload failed"); setBusy(false); return }
      uploaded.push({
        url: pub.publicUrl,
        trim_start: clip.trimStart || 0,
        trim_end: clip.trimEnd || null,
      })
      setProgress(Math.round(((i + 1) / total) * 90))
    }

    if (uploaded.length === 0) { setError("Nothing to upload"); setBusy(false); return }

    const firstUrl = uploaded[0].url
    const totalDuration = uploaded.reduce((acc, c) => acc + ((c.trim_end || 0) - (c.trim_start || 0)), 0)

    // Generate + upload a thumbnail from the first clip
    let thumbnailUrl = null
    try {
      const firstClip = sourceClips[0]
      if (firstClip?.file) {
        const blob = await extractThumbnail(firstClip.file, coverTime || 0.1)
        if (blob) {
          const thumbPath = myId + "/" + crypto.randomUUID() + "_thumb.jpg"
          const { error: tErr } = await supabase.storage
            .from("reels-media")
            .upload(thumbPath, blob, { upsert: false, contentType: "image/jpeg" })
          if (!tErr) {
            const { data: tpub } = supabase.storage.from("reels-media").getPublicUrl(thumbPath)
            thumbnailUrl = tpub?.publicUrl || null
          }
        }
      }
    } catch {}

    const { error: insErr } = await supabase.from("reels").insert({
      user_id: myId,
      video_url: firstUrl,
      clips: uploaded,
      caption: caption.trim() || null,
      duration_sec: totalDuration || duration || null,
      trim_start: uploaded[0].trim_start,
      trim_end: uploaded[0].trim_end,
      mirrored: mirroredState,
      aspect_ratio: aspectRatioState,
      text_overlays: textOverlaysState,
      sticker_overlays: stickerOverlaysState,
      filter_id: filterIdState,
      audience: audienceState,
      allow_comments: allowComments,
      allow_remix: allowRemix,
      location: locationState.trim() || null,
      cover_frame_time: coverTime || 0,
      tagged_user_ids: taggedUsers.map((u) => u.id),
      thumbnail_url: thumbnailUrl,
          remix_of: remixOf?.id || null,
    })
    if (insErr) { setError(insErr.message); setBusy(false); return }
    setProgress(100); setBusy(false); setStage("capture"); onDone?.()
  }

  useEffect(() => () => { if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview) }, [preview])

  // On mount: check for an existing draft
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await getReelDraft()
        if (cancelled || !d) return
        const age = Date.now() - (d.savedAt || 0)
        if (age < 24 * 60 * 60 * 1000 && (d.clips?.length > 0)) {
          setDraftPrompt(d)
        } else {
          await clearReelDraft()
        }
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  function restoreDraft() {
    if (!draftPrompt) return
    setClipsState(draftPrompt.clips || [])
    setTextOverlaysState(draftPrompt.textOverlays || [])
    setStickerOverlaysState(draftPrompt.stickerOverlays || [])
    setFilterIdState(draftPrompt.filterId || "none")
    setStage("decorate")
    setDraftPrompt(null)
  }

  async function discardDraft() {
    await clearReelDraft()
    setDraftPrompt(null)
  }

  // When a new file is picked or recorded, open the trim screen automatically
  useEffect(() => {
    if (file && preview && !trimming && trimEnd === null) {
      setTrimming(true)
    }
  }, [file, preview])

  if (trimming && preview && file) {
    return (
      <ReelTrim
        src={preview}
        initialFile={file}
        onCancel={() => {
          setTrimming(false)
          setFile(null)
          setPreview("")
          setTrimStart(0)
          setTrimEnd(null)
          setRecordSec(0)
          setDuration(0)
        }}
        onDone={(trim) => {
          setTrimStart(trim.trimStart || 0)
          setTrimEnd(trim.trimEnd || null)
          setMirroredState(!!trim.mirrored)
          setAspectRatioState(trim.aspectRatio || "9:16")
          setTextOverlaysState(trim.textOverlays || [])
          setClipsState(trim.clips || [])
          setTrimming(false)
          setStage("decorate")
        }}
      />
    )
  }

  if (draftPrompt) {
    return (
      <div className="fixed inset-0 z-[230] bg-black/85 flex items-center justify-center p-5">
        <div className="w-full max-w-[380px] bg-[#0B0B14] rounded-[24px] border border-white/10 p-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 grid place-items-center mx-auto mb-4">
            <span className="text-2xl">📝</span>
          </div>
          <h2 className="text-cream font-extrabold text-[18px] mb-1.5">You have a draft</h2>
          <p className="text-muted text-[13px] leading-relaxed mb-5">
            Saved {new Date(draftPrompt.savedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            <br />
            {draftPrompt.clips?.length || 0} clip{(draftPrompt.clips?.length || 0) > 1 ? "s" : ""} · restore it?
          </p>
          <button
            onClick={restoreDraft}
            className="w-full h-12 rounded-full text-white font-bold text-[14.5px] mb-2"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            Restore draft
          </button>
          <button
            onClick={discardDraft}
            className="w-full h-11 rounded-full bg-white/[0.06] border border-white/12 text-muted font-semibold text-[13.5px]"
          >
            Discard
          </button>
          <button
            onClick={() => setDraftPrompt(null)}
            className="w-full h-10 text-subtle text-[12.5px] mt-1"
          >
            Keep for later
          </button>
        </div>
      </div>
    )
  }

  if (stage === "decorate" && clipsState.length > 0) {
    return (
      <ReelDecorate
        clips={clipsState}
        initialOverlays={textOverlaysState}
        onBack={() => setStage("trim")}
        onNext={({ textOverlays, stickerOverlays, filterId }) => {
          setTextOverlaysState(textOverlays || [])
          setStickerOverlaysState(stickerOverlays || [])
          setFilterIdState(filterId || "none")
          setStage("publish")
        }}
      />
    )
  }

  if (preview && file) {
    const coverThumb = (() => {
      const list = clipsState.length > 0 ? clipsState : [{ url: preview, trimStart: 0, trimEnd: duration || 0 }]
      return list[0].url
    })()

    return (
      <div className="fixed inset-0 z-[220] bg-black flex flex-col" style={{ height: "100dvh" }}>
        {/* Header */}
        <header className="flex items-center justify-between px-3 py-3 z-10 shrink-0">
          <button onClick={() => setStage("decorate")} className="h-10 px-3 rounded-xl bg-white/10 text-white font-semibold text-[13.5px] inline-flex items-center gap-1">
            ← Back
          </button>
          <h2 className="text-white font-bold text-[16px]">New reel</h2>
          <button
            onClick={submit}
            disabled={busy}
            className="h-10 px-4 rounded-full text-white font-bold text-[13.5px] inline-flex items-center gap-2 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
          >
            <Send size={14} /> {busy ? "Posting…" : "Post"}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto pb-4">
          {/* Preview + caption block */}
          <div className="px-3 flex gap-3">
            <div className="relative shrink-0 rounded-xl overflow-hidden bg-black" style={{ width: 96, height: 96 }}>
              <video src={preview} muted playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] text-center py-0.5 font-bold">
                Cover
              </div>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 500))}
              placeholder="Write a caption…"
              rows={4}
              className="flex-1 rounded-xl bg-white/[0.06] border border-white/10 px-3 py-2.5 text-white text-[14px] placeholder:text-white/45 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {/* Cover frame picker */}
          <div className="px-3 mt-3">
            <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
              Cover frame
            </p>
            <input
              type="range"
              min={0}
              max={Math.max(0, Math.floor(duration || 0))}
              step={0.1}
              value={coverTime}
              onChange={(e) => setCoverTime(parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-white/50 text-[11.5px] mt-1">
              Thumbnail at {coverTime.toFixed(1)}s
            </p>
          </div>

          {/* Audience */}
          <div className="px-3 mt-4">
            <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
              Audience
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "public",  label: "Public",  icon: "🌍" },
                { id: "matches", label: "Matches", icon: "💜" },
                { id: "private", label: "Only me", icon: "🔒" },
              ].map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAudienceState(a.id)}
                  className="h-12 rounded-xl font-bold text-[13px] flex flex-col items-center justify-center gap-0.5"
                  style={{
                    background: audienceState === a.id
                      ? "linear-gradient(135deg, rgba(236,72,153,0.22) 0%, rgba(168,85,247,0.22) 100%)"
                      : "rgba(255,255,255,0.04)",
                    border: audienceState === a.id ? "1px solid rgba(236,72,153,0.6)" : "1px solid rgba(255,255,255,0.08)",
                    color: audienceState === a.id ? "#fff" : "#888",
                  }}
                >
                  <span className="text-base leading-none">{a.icon}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="px-3 mt-4 flex flex-col gap-2">
            <ToggleRow
              label="Allow comments"
              sub="People can comment on this reel"
              on={allowComments}
              onToggle={() => setAllowComments((v) => !v)}
            />
            <ToggleRow
              label="Allow remix"
              sub="Others can use this reel in theirs"
              on={allowRemix}
              onToggle={() => setAllowRemix((v) => !v)}
            />
          </div>

          {/* Location */}
          <div className="px-3 mt-4">
            <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
              Location
            </p>
            <input
              value={locationState}
              onChange={(e) => setLocationState(e.target.value.slice(0, 80))}
              placeholder="Add a location (optional)"
              className="w-full h-11 rounded-xl bg-white/[0.06] border border-white/10 px-4 text-white text-[13.5px] placeholder:text-white/45 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Tag people */}
          <div className="px-3 mt-4">
            <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
              Tag people
            </p>
            <button
              onClick={() => setTagPickerOpen(true)}
              className="w-full min-h-11 rounded-xl bg-white/[0.06] border border-white/10 px-4 py-2.5 flex flex-wrap items-center gap-1.5 text-left"
            >
              {taggedUsers.length === 0 ? (
                <span className="text-white/45 text-[13.5px]">Tag people (optional)</span>
              ) : (
                taggedUsers.map((u) => (
                  <span key={u.id} className="text-purple-200 text-[12.5px] font-semibold">
                    @{u.username || u.display_name}
                  </span>
                ))
              )}
            </button>
          </div>

          {error && <p className="text-red-400 text-[12.5px] text-center px-3 mt-3">{error}</p>}

          {busy && progress > 0 && (
            <div className="mx-3 mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-purple-500" style={{ width: progress + "%" }} />
            </div>
          )}

          <div className="px-3 mt-4">
            <button
              onClick={retake}
              className="w-full h-11 rounded-full bg-white/10 text-white font-semibold text-[13.5px] inline-flex items-center justify-center gap-2"
            >
              <RotateCcw size={15} /> Retake / change
            </button>
          </div>
        </div>

        {tagPickerOpen && (
          <TagPicker
            initial={taggedUsers}
            onClose={() => setTagPickerOpen(false)}
            onSave={(users) => setTaggedUsers(users)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[220] bg-black flex flex-col">
      <input ref={fileRef} type="file" accept="video/*" hidden onChange={pick} />

      {remixOf && (
        <div className="shrink-0 px-3 pt-3 flex items-center gap-3"
             style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
          <div className="relative shrink-0 rounded-xl overflow-hidden bg-black border border-white/15" style={{ width: 48, height: 64 }}>
            <video
              src={remixOf.video_url}
              muted
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-purple-300 text-[11px] font-black tracking-wider uppercase">Remixing</p>
            <p className="text-cream text-[13px] font-semibold truncate mt-0.5">
              {remixOf.caption || "Original reel"}
            </p>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between px-3 py-3 z-10">
        <button onClick={() => { stopCamera(); onClose() }} className="w-10 h-10 rounded-full grid place-items-center bg-black/50 text-white" aria-label="Close"><X size={22} /></button>
        <div className="flex bg-white/10 rounded-full p-1">
          <button onClick={() => { stopCamera(); setTab("record"); setError("") }} className={`h-8 px-3 rounded-full text-[12.5px] font-bold ${tab === "record" ? "bg-white text-black" : "text-white"}`}>Record</button>
          <button onClick={() => { stopCamera(); setTab("upload"); setError("") }} className={`h-8 px-3 rounded-full text-[12.5px] font-bold ${tab === "upload" ? "bg-white text-black" : "text-white"}`}>Upload</button>
        </div>
        <div className="w-10" />
      </header>

      {tab === "record" ? (
        <>
          <div className="flex-1 relative bg-black overflow-hidden">
            <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 w-full h-full object-cover" style={{ transform: facing === "user" ? "scaleX(-1)" : "none" }} />
            {recording && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-[13px] font-bold">{recordSec}s / {MAX_RECORD_SECONDS}s</span>
              </div>
            )}
            <div className="absolute top-4 right-4 flex flex-col gap-3">
              <button onClick={toggleMic} disabled={recording} className="w-11 h-11 rounded-full grid place-items-center bg-black/50 backdrop-blur-md text-white disabled:opacity-40" aria-label="Mic">{micOn ? <Mic size={18} /> : <MicOff size={18} />}</button>
              <button onClick={switchCamera} disabled={recording} className="w-11 h-11 rounded-full grid place-items-center bg-black/50 backdrop-blur-md text-white disabled:opacity-40" aria-label="Switch"><Camera size={18} /></button>
            </div>
            {error && <div className="absolute top-20 left-4 right-4 bg-red-500/20 border border-red-500/50 rounded-xl px-3 py-2 text-red-200 text-[12.5px]">{error}</div>}
          </div>
          <div className="p-6 flex items-center justify-center" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
            <button onClick={recording ? stopRecording : startRecording} disabled={!cameraReady} className="grid place-items-center disabled:opacity-40" aria-label={recording ? "Stop" : "Record"}>
              <span className="grid place-items-center transition-all" style={{ width: 74, height: 74, borderRadius: 999, border: "5px solid #fff", background: recording ? "#EC4899" : "#fff" }}>
                {recording ? <Square size={22} fill="#fff" color="#fff" /> : <Circle size={30} fill="#0B0B14" color="#0B0B14" />}
              </span>
            </button>
          </div>
        </>
      ) : (
        <div className="flex-1 grid place-items-center p-5">
          <button onClick={() => fileRef.current?.click()} className="w-full max-w-[420px] h-72 rounded-3xl border-2 border-dashed border-white/20 grid place-items-center">
            <div className="text-center px-6">
              <Upload size={40} className="text-purple-400 mx-auto mb-3" />
              <p className="text-white text-[16px] font-bold mb-1">Choose a video from gallery</p>
              <p className="text-white/50 text-[12.5px]">MP4, MOV, WebM · up to 100 MB</p>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}

function ToggleRow({ label, sub, on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/8 text-left"
    >
      <div className="flex-1 min-w-0 pr-3">
        <p className="text-cream font-semibold text-[13.5px]">{label}</p>
        <p className="text-muted text-[11.5px] truncate">{sub}</p>
      </div>
      <span
        className="w-11 h-6 rounded-full relative shrink-0"
        style={{ background: on ? "#EC4899" : "rgba(255,255,255,0.15)", transition: "background 200ms" }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
          style={{ left: on ? "calc(100% - 22px)" : 2, transition: "left 200ms" }}
        />
      </span>
    </button>
  )
}
