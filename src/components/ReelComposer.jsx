import { useEffect, useRef, useState } from "react"
import { X, Send, Circle, Square, RotateCcw, Mic, MicOff, Camera, Upload } from "lucide-react"
import ReelTrim from "./ReelTrim"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"

const MAX_RECORD_SECONDS = 60

export default function ReelComposer({ onClose, onDone }) {
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
  const [trimStart, setTrimStart] = useState(0)
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
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase()
    const path = myId + "/" + crypto.randomUUID() + "." + ext
    const { error: upErr } = await supabase.storage.from("reels-media").upload(path, file, { upsert: false, contentType: file.type })
    if (upErr) { setError(upErr.message); setBusy(false); return }
    setProgress(70)
    const { data: pub } = supabase.storage.from("reels-media").getPublicUrl(path)
    const videoUrl = pub?.publicUrl
    if (!videoUrl) { setError("Upload failed"); setBusy(false); return }
    const { error: insErr } = await supabase.from("reels").insert({
      user_id: myId, video_url: videoUrl,
      caption: caption.trim() || null,
      duration_sec: (trimEnd != null && trimStart != null) ? (trimEnd - trimStart) : (duration || null),
      trim_start: trimStart || 0,
      trim_end: trimEnd || null,
    })
    if (insErr) { setError(insErr.message); setBusy(false); return }
    setProgress(100); setBusy(false); onDone?.()
  }

  useEffect(() => () => { if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview) }, [preview])

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
          setTrimming(false)
        }}
      />
    )
  }

  if (preview && file) {
    return (
      <div className="fixed inset-0 z-[220] bg-black flex flex-col">
        <header className="flex items-center justify-between px-3 py-3 z-10">
          <button onClick={onClose} className="w-10 h-10 rounded-full grid place-items-center bg-black/50 text-white" aria-label="Close"><X size={22} /></button>
          <h2 className="text-white font-bold text-[16px]">New reel</h2>
          <button onClick={submit} disabled={busy} className="h-10 px-4 rounded-full text-white font-bold text-[13.5px] inline-flex items-center gap-2 disabled:opacity-40" style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}>
            <Send size={14} /> {busy ? "Posting…" : "Post"}
          </button>
        </header>
        <div className="flex-1 grid place-items-center bg-black overflow-hidden">
          <video src={preview} controls playsInline onLoadedMetadata={onLoadedMeta} className="max-w-full max-h-full object-contain" />
        </div>
        <div className="p-3 flex flex-col gap-2" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 200))} placeholder="Add a caption…" className="h-12 rounded-full bg-white/10 px-5 text-white text-[14.5px] placeholder:text-white/50 focus:outline-none" />
          {error && <p className="text-red-400 text-[12.5px] text-center">{error}</p>}
          {busy && progress > 0 && (
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-purple-500" style={{ width: progress + "%" }} />
            </div>
          )}
          <button onClick={retake} className="h-11 rounded-full bg-white/10 text-white font-semibold text-[13.5px] inline-flex items-center justify-center gap-2">
            <RotateCcw size={15} /> Retake / change
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[220] bg-black flex flex-col">
      <input ref={fileRef} type="file" accept="video/*" hidden onChange={pick} />
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
