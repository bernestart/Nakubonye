import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Camera, Check, X, AlertCircle, ShieldCheck, RotateCcw, Clock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'

export default function VerifyIdentity() {
  const nav = useNavigate()
  const { session, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('none') // none | camera | preview | pending | approved | rejected
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const [cameraActive, setCameraActive] = useState(false)
  const [capture, setCapture] = useState(null)         // Blob
  const [preview, setPreview] = useState('')           // objectURL
  const [uploading, setUploading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true); setError('')
    const { data, error: err } = await supabase.rpc('get_my_verification_status')
    if (err) { setError(err.message); setLoading(false); return }
    const row = Array.isArray(data) ? data[0] : data
    if (row?.is_verified) setStatus('approved')
    else if (row?.pending) setStatus('pending')
    else if (row?.last_status === 'rejected') { setStatus('rejected'); setReason(row.last_reason || '') }
    else setStatus('none')
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (status === 'approved' && refreshProfile) refreshProfile().catch(() => {})
  }, [status, refreshProfile])

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  useEffect(() => () => stopCamera(), [])

  async function startCamera() {
    setError(''); setCapture(null); setPreview('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
      setStatus('camera')
      // attach stream to video after render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      }, 50)
    } catch (e) {
      setError(e?.message || 'Could not access camera. Check permissions.')
    }
  }

  async function takePhoto() {
    if (!videoRef.current) return
    // 3-2-1 countdown
    for (let i = 3; i > 0; i--) {
      setCountdown(i)
      tap('light')
      await new Promise((r) => setTimeout(r, 700))
    }
    setCountdown(0)
    tap('medium')

    const video = videoRef.current
    const size = Math.min(video.videoWidth, video.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')
    const sx = (video.videoWidth - size) / 2
    const sy = (video.videoHeight - size) / 2
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size)

    canvas.toBlob((blob) => {
      if (!blob) return
      setCapture(blob)
      setPreview(URL.createObjectURL(blob))
      setStatus('preview')
      stopCamera()
    }, 'image/jpeg', 0.85)
  }

  async function retake() {
    setCapture(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview('')
    await startCamera()
  }

  async function submit() {
    if (!capture || !session?.user?.id) return
    setUploading(true); setError('')
    const path = `${session.user.id}/${Date.now()}.jpg`
    const { error: upErr } = await supabase.storage
      .from('verification-selfies')
      .upload(path, capture, { upsert: false, contentType: 'image/jpeg' })
    if (upErr) { setUploading(false); setError(upErr.message); return }

    const { error: rpcErr } = await supabase.rpc('request_verification', { p_selfie_path: path })
    if (rpcErr) { setUploading(false); setError(rpcErr.message); return }

    setUploading(false)
    setStatus('pending')
    setCapture(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview('')
    tap('match')
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-sky-600/22" style={{ filter: 'blur(120px)' }} />
        <div className="absolute bottom-[-180px] right-[-100px] w-[420px] h-[420px] rounded-full bg-purple-500/14" style={{ filter: 'blur(120px)' }} />
      </div>

      <header style={{ height: 52, flexShrink: 0 }}
        className="px-3 flex items-center gap-2 border-b border-white/8">
        <button onClick={() => { stopCamera(); nav(-1) }}
          className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px] flex-1">Prove you're real</span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 pb-12">
        {loading ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">Loading…</div>
        ) : error && status === 'none' ? (
          <div className="text-danger text-[13px] bg-danger/10 border border-danger/30 rounded-2xl px-4 py-3">
            {error}
          </div>
        ) : status === 'approved' ? (
          <ApprovedView />
        ) : status === 'pending' ? (
          <PendingView />
        ) : status === 'rejected' ? (
          <RejectedView reason={reason} onRetry={() => setStatus('none')} />
        ) : status === 'camera' ? (
          <CameraView
            videoRef={videoRef}
            countdown={countdown}
            error={error}
            onCancel={() => { stopCamera(); setStatus('none') }}
            onCapture={takePhoto}
          />
        ) : status === 'preview' ? (
          <PreviewView
            preview={preview}
            uploading={uploading}
            error={error}
            onRetake={retake}
            onSubmit={submit}
          />
        ) : (
          <IntroView onStart={startCamera} />
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Intro
// ------------------------------------------------------------
function IntroView({ onStart }) {
  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-20 h-20 rounded-3xl bg-sky-500/15 border border-sky-500/30 grid place-items-center mx-auto mb-4">
          <ShieldCheck size={36} strokeWidth={2.2} className="text-sky-300" />
        </div>
        <h1 className="text-cream text-[22px] font-extrabold tracking-tight mb-2">
          Prove you're a real person
        </h1>
        <p className="text-muted text-[13.5px] leading-relaxed max-w-[320px] mx-auto">
          Quick selfie check. We use it only to keep Nakubonye safe — it never appears on your profile.
        </p>
      </div>

      <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4 mb-4">
        <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-2">
          How it works
        </p>
        <ul className="space-y-2">
          <Bullet>Take one selfie — look straight at the camera.</Bullet>
          <Bullet>Our team reviews it within 24 hours.</Bullet>
          <Bullet>You'll earn 50 coins once approved.</Bullet>
          <Bullet>Your selfie is private — no one else sees it.</Bullet>
        </ul>
      </div>

      <div className="rounded-2xl bg-emerald-500/8 border border-emerald-500/25 p-4 mb-6">
        <p className="text-emerald-300 text-[12.5px] leading-relaxed">
          <strong className="font-bold">This is a safety check, not a badge.</strong> The blue badge is a separate paid feature in "Get your badge."
        </p>
      </div>

      <button onClick={onStart}
        className="w-full h-12 rounded-full text-white font-bold text-[14.5px] flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #0EA5E9 0%, #A855F7 100%)', boxShadow: '0 10px 28px rgba(14,165,233,0.45)' }}>
        <Camera size={17} strokeWidth={2.4} /> Start selfie
      </button>
    </div>
  )
}

function Bullet({ children }) {
  return (
    <li className="flex items-start gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-2 shrink-0" />
      <span className="text-muted text-[13px] leading-relaxed">{children}</span>
    </li>
  )
}

// ------------------------------------------------------------
// Camera
// ------------------------------------------------------------
function CameraView({ videoRef, countdown, error, onCancel, onCapture }) {
  return (
    <div>
      <div className="rounded-3xl overflow-hidden bg-black border border-white/10 mb-4 relative"
        style={{ aspectRatio: '1 / 1' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        {countdown > 0 && (
          <div className="absolute inset-0 grid place-items-center bg-black/40">
            <p className="text-white font-black text-[80px] leading-none">{countdown}</p>
          </div>
        )}
        {/* Face oval guide */}
        <div className="absolute inset-0 pointer-events-none grid place-items-center">
          <div style={{
            width: '62%', height: '78%',
            border: '3px dashed rgba(255,255,255,0.6)',
            borderRadius: '50%',
          }} />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 mb-4">
          <AlertCircle size={14} strokeWidth={2.4} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-center text-muted text-[12.5px] mb-4">
        Center your face in the oval. Good lighting helps.
      </p>

      <div className="flex gap-3">
        <button onClick={onCancel}
          className="flex-1 h-12 rounded-full text-cream font-bold text-[14px] bg-white/[0.06] border border-white/10">
          Cancel
        </button>
        <button onClick={onCapture} disabled={countdown > 0}
          className="flex-1 h-12 rounded-full text-white font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #0EA5E9 0%, #A855F7 100%)' }}>
          <Camera size={16} strokeWidth={2.4} /> Take photo
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Preview
// ------------------------------------------------------------
function PreviewView({ preview, uploading, error, onRetake, onSubmit }) {
  return (
    <div>
      <h2 className="text-cream text-[19px] font-extrabold tracking-tight text-center mb-1">
        Looking good?
      </h2>
      <p className="text-muted text-[13px] text-center mb-5">
        Submit this selfie or retake it.
      </p>

      <div className="rounded-3xl overflow-hidden border border-white/10 mb-5 mx-auto"
        style={{ maxWidth: 320, aspectRatio: '1 / 1' }}>
        <img src={preview} alt="Selfie" className="w-full h-full object-cover" />
      </div>

      {error && (
        <div className="flex items-start gap-2 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5 mb-4">
          <AlertCircle size={14} strokeWidth={2.4} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onRetake} disabled={uploading}
          className="flex-1 h-12 rounded-full text-cream font-bold text-[14px] bg-white/[0.06] border border-white/10 disabled:opacity-50 flex items-center justify-center gap-2">
          <RotateCcw size={15} strokeWidth={2.4} /> Retake
        </button>
        <button onClick={onSubmit} disabled={uploading}
          className="flex-1 h-12 rounded-full text-white font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #0EA5E9 0%, #A855F7 100%)' }}>
          {uploading ? 'Submitting…' : <><Check size={16} strokeWidth={2.6} /> Submit</>}
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Pending
// ------------------------------------------------------------
function PendingView() {
  return (
    <div className="text-center pt-6">
      <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500/40 grid place-items-center mx-auto mb-5">
        <Clock size={36} strokeWidth={2.2} className="text-amber-400" />
      </div>
      <h2 className="text-cream text-[20px] font-extrabold mb-2">Under review</h2>
      <p className="text-muted text-[13.5px] leading-relaxed max-w-[300px] mx-auto">
        We're checking your selfie. Most reviews take less than 24 hours. You'll get 50 coins once approved.
      </p>
    </div>
  )
}

// ------------------------------------------------------------
// Approved
// ------------------------------------------------------------
function ApprovedView() {
  return (
    <div className="text-center pt-6">
      <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 grid place-items-center mx-auto mb-5">
        <Check size={40} strokeWidth={3} className="text-emerald-400" />
      </div>
      <h2 className="text-cream text-[20px] font-extrabold mb-2">You're verified</h2>
      <p className="text-muted text-[13.5px] leading-relaxed max-w-[300px] mx-auto">
        We've confirmed you're a real person. Thanks for helping keep Nakubonye safe.
      </p>
    </div>
  )
}

// ------------------------------------------------------------
// Rejected
// ------------------------------------------------------------
function RejectedView({ reason, onRetry }) {
  return (
    <div className="text-center pt-6">
      <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/40 grid place-items-center mx-auto mb-5">
        <X size={36} strokeWidth={2.4} className="text-red-400" />
      </div>
      <h2 className="text-cream text-[20px] font-extrabold mb-2">Not approved</h2>
      <p className="text-muted text-[13.5px] leading-relaxed max-w-[300px] mx-auto mb-6">
        {reason || 'We could not verify your selfie. Try again with better lighting and your face clearly visible.'}
      </p>
      <button onClick={onRetry}
        className="w-full h-12 rounded-full text-white font-bold text-[14.5px]"
        style={{ background: 'linear-gradient(135deg, #0EA5E9 0%, #A855F7 100%)', boxShadow: '0 10px 28px rgba(14,165,233,0.45)' }}>
        Try again
      </button>
    </div>
  )
}
