import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, Check, X, AlertCircle, ShieldCheck, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { tap } from '../lib/haptic'

// The standard verification flow used by Tinder, Bumble, Hinge
const STEPS = [
  { key: 'center', label: 'Look straight at the camera', icon: '😐', show: true },
  { key: 'left',   label: 'Slowly turn your head to the LEFT', icon: '⬅️' },
  { key: 'right',  label: 'Slowly turn your head to the RIGHT', icon: '➡️' },
  { key: 'up',     label: 'Slowly look UP', icon: '⬆️' },
  { key: 'down',   label: 'Slowly look DOWN', icon: '⬇️' },
]

export default function Verify() {
  const nav = useNavigate()
  const { session, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [reason, setReason] = useState('')
  const [isVerified, setIsVerified] = useState(false)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [stepIndex, setStepIndex] = useState(0)
  const [captures, setCaptures] = useState([])         // array of Blob
  const [previews, setPreviews] = useState([])         // object URLs
  const [composed, setComposed] = useState(null)       // Blob (final grid)
  const [composedPreview, setComposedPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true); setError('')

    const { data, error: err } = await supabase.rpc('get_my_verification_status')
    if (err) { setError(err.message); setLoading(false); return }

    const row = Array.isArray(data) ? data[0] : data
    setIsVerified(!!row?.is_verified)

    if (row?.is_verified) setStatus('approved')
    else if (row?.pending) setStatus('pending')
    else if (row?.last_status === 'rejected') { setStatus('rejected'); setReason(row.last_reason || '') }
    else setStatus('none')

    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => { load() }, [load])

  // Refresh auth profile when verification completes (so badge appears live)
  useEffect(() => {
    if (isVerified && refreshProfile) {
      refreshProfile().catch(() => {})
    }
  }, [isVerified, refreshProfile])

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  useEffect(() => () => stopCamera(), [])

  async function startCamera() {
    setCameraError(''); setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      }, 50)
    } catch (err) {
      setCameraError('Allow camera access to continue. ' + (err?.message || ''))
    }
  }

  function captureFrame() {
    const video = videoRef.current
    if (!video) return null
    const canvas = document.createElement('canvas')
    canvas.width = 480
    canvas.height = 480
    const size = Math.min(video.videoWidth || 480, video.videoHeight || 480)
    const sx = (video.videoWidth - size) / 2
    const sy = (video.videoHeight - size) / 2
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 480, 480)
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85)
    })
  }

  async function doCapture() {
    tap('light')
    const blob = await captureFrame()
    if (!blob) return

    const newCaptures = [...captures, blob]
    const newPreviews = [...previews, URL.createObjectURL(blob)]
    setCaptures(newCaptures)
    setPreviews(newPreviews)

    if (newCaptures.length >= STEPS.length) {
      // All done — compose into a grid
      await composeGrid(newCaptures)
      stopCamera()
    } else {
      setStepIndex(newCaptures.length)
    }
  }

  // Auto-countdown for each capture (2 seconds)
  useEffect(() => {
    if (!cameraActive) return
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(t)
    }
    if (countdown === 0 && cameraActive && stepIndex >= 0 && stepIndex < STEPS.length && captures.length < STEPS.length) {
      // When stepIndex changes, kick off countdown
    }
  }, [countdown, cameraActive, stepIndex, captures.length])

  function beginCountdown() {
    setCountdown(2)
  }

  useEffect(() => {
    if (countdown === 0) return
    if (countdown === 1) {
      // last tick — capture after 1 more second
      const t = setTimeout(() => { doCapture() }, 1000)
      return () => clearTimeout(t)
    }
    // countdown > 1 — just decrement (handled by main effect)
  }, [countdown])

  async function composeGrid(blobs) {
    const canvas = document.createElement('canvas')
    canvas.width = 960
    canvas.height = 960
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#0B0B14'
    ctx.fillRect(0, 0, 960, 960)

    // 2x2 grid at 480x480 each = 4 cells; we have 5 captures
    // Layout: 3 on top row (320 wide each), 2 on bottom row (480 wide each)
    // Simpler: 2x2 grid of the first 4, and put the 5th (down) below in a small strip
    // Actually cleanest: 2 columns x 3 rows is awkward. Let's do a 2x3 grid = 6 cells, use 5.

    const cellW = 480
    const cellH = 320
    // 2 columns x 3 rows = 6 cells
    // positions: (0,0), (480,0), (0,320), (480,320), (0,640), (480,640)
    const positions = [
      [0, 0], [480, 0],
      [0, 320], [480, 320],
      [0, 640], [480, 640],
    ]

    await Promise.all(blobs.slice(0, 5).map(async (blob, i) => {
      const img = await loadImage(URL.createObjectURL(blob))
      const [x, y] = positions[i]
      ctx.drawImage(img, x, y, cellW, cellH)
      // label overlay
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(x, y + cellH - 32, cellW, 32)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 18px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(STEPS[i].label.replace('Slowly ', ''), x + cellW / 2, y + cellH - 10)
    }))

    return new Promise((resolve) => {
      canvas.toBlob((finalBlob) => {
        setComposed(finalBlob)
        setComposedPreview(URL.createObjectURL(finalBlob))
        resolve(finalBlob)
      }, 'image/jpeg', 0.85)
    })
  }

  function loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.src = url
    })
  }

  function resetCaptures() {
    previews.forEach((u) => URL.revokeObjectURL(u))
    if (composedPreview) URL.revokeObjectURL(composedPreview)
    setCaptures([])
    setPreviews([])
    setComposed(null)
    setComposedPreview('')
    setStepIndex(0)
    setCountdown(0)
  }

  async function retake() {
    resetCaptures()
    await startCamera()
  }

  async function submit() {
    if (!composed || !session?.user?.id) return
    setUploading(true); setError('')

    const path = `${session.user.id}/${Date.now()}.jpg`
    const { error: upErr } = await supabase.storage
      .from('verification-selfies')
      .upload(path, composed, { upsert: false, contentType: 'image/jpeg' })

    if (upErr) { setUploading(false); setError(upErr.message); return }

    const { error: rpcErr } = await supabase.rpc('request_verification', { p_selfie_path: path })
    if (rpcErr) { setUploading(false); setError(rpcErr.message); return }

    setUploading(false)
    setSubmitted(true)
    setStatus('pending')
    resetCaptures()
    stopCamera()
  }

  const totalSteps = STEPS.length
  const doneSteps = captures.length
  const currentStep = STEPS[stepIndex] || null
  const inProgress = cameraActive && !composed
  const allCaptured = composed !== null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-purple-600/22" style={{ filter: 'blur(120px)' }} />
        <div className="absolute bottom-[-180px] right-[-100px] w-[420px] h-[420px] rounded-full bg-pink-500/14" style={{ filter: 'blur(120px)' }} />
      </div>

      <header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Back">
          <ArrowLeft size={20} strokeWidth={2.3} />
        </button>
        <span className="text-cream font-bold text-[15px]">Get verified</span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-32">
        {loading ? (
          <div className="grid place-items-center h-40 text-muted text-[13px]">Loading…</div>
        ) : isVerified || status === 'approved' ? (
          <ApprovedState />
        ) : status === 'pending' ? (
          <PendingState submitted={submitted} />
        ) : (
          <>
            {status === 'rejected' && (
              <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} strokeWidth={2.3} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-cream font-bold text-[14.5px] mb-1">Previous request wasn't accepted</p>
                    <p className="text-muted text-[12.5px] leading-relaxed">
                      {reason || 'We could not verify your selfie. Please try again.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!inProgress && !allCaptured && (
              <>
                <div className="text-center mb-5">
                  <div className="w-16 h-16 rounded-2xl grid place-items-center mx-auto mb-4"
                    style={{
                      background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)',
                      boxShadow: '0 12px 36px rgba(168,85,247,0.5)',
                    }}>
                    <ShieldCheck size={28} strokeWidth={2.2} className="text-white" />
                  </div>
                  <h1 className="text-cream text-[22px] font-extrabold tracking-tight mb-2">
                    Prove it's you
                  </h1>
                  <p className="text-muted text-[13.5px] leading-relaxed max-w-[330px] mx-auto">
                    We'll guide you through 5 quick head movements. It takes about 15 seconds.
                    Your selfies go to our team only — never to other users.
                  </p>
                </div>

                <div className="rounded-2xl bg-white/[0.04] border border-purple-500/30 p-5 mb-5">
                  <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-3">
                    You'll do these 5 steps
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {STEPS.map((s) => (
                      <div key={s.key} className="flex items-center gap-3">
                        <span className="text-[22px] leading-none w-7 text-center">{s.icon}</span>
                        <span className="text-cream/90 text-[13.5px] font-medium">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4 mb-5">
                  <p className="text-cream text-[12.5px] font-semibold mb-1">When approved you get</p>
                  <p className="text-muted text-[12.5px]">
                    A blue <span className="text-purple-300 font-semibold">✓ verified badge</span> on your profile and cards, plus{' '}
                    <span className="text-purple-300 font-semibold">150 coins</span>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full h-14 rounded-full text-white font-bold text-[15px] flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)',
                    boxShadow: '0 12px 36px rgba(236,72,153,0.5)',
                  }}
                >
                  <Camera size={18} strokeWidth={2.4} /> Start verification
                </button>

                {cameraError && (
                  <div className="mt-4 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
                    {cameraError}
                  </div>
                )}
              </>
            )}

            {inProgress && currentStep && (
              <>
                {/* Progress dots */}
                <div className="flex items-center justify-center gap-1.5 mb-4">
                  {STEPS.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i < doneSteps ? 'w-8 bg-purple-500' : i === stepIndex ? 'w-8 bg-purple-400' : 'w-4 bg-white/15'
                      }`}
                    />
                  ))}
                </div>

                <div className="text-center mb-3">
                  <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase mb-1">
                    Step {stepIndex + 1} of {totalSteps}
                  </p>
                  <h2 className="text-cream text-[20px] font-extrabold tracking-tight">
                    {currentStep.label}
                  </h2>
                </div>

                <div className="relative rounded-2xl overflow-hidden border border-purple-500/40 bg-black mb-4" style={{ aspectRatio: '1 / 1' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />

                  {/* Countdown overlay */}
                  {countdown > 0 && (
                    <div className="absolute inset-0 grid place-items-center bg-obsidian/55 backdrop-blur-sm">
                      <div className="text-white text-[90px] font-black leading-none tabular-nums"
                        style={{ textShadow: '0 4px 30px rgba(0,0,0,0.9)' }}
                      >
                        {countdown}
                      </div>
                    </div>
                  )}

                  {/* Pose emoji overlay */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-obsidian/70 border border-white/20 grid place-items-center pointer-events-none">
                    <span className="text-[28px] leading-none">{currentStep.icon}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { resetCaptures(); stopCamera() }}
                    className="flex-1 h-11 rounded-full bg-white/[0.06] border border-white/12 text-muted font-semibold text-[13.5px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={beginCountdown}
                    disabled={countdown > 0}
                    className="flex-1 h-11 rounded-full text-white font-bold text-[13.5px] flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)',
                      boxShadow: '0 8px 24px rgba(236,72,153,0.4)',
                    }}
                  >
                    <Camera size={15} strokeWidth={2.4} />
                    {countdown > 0 ? 'Hold still…' : 'Capture'}
                  </button>
                </div>

                {/* Preview strip */}
                {previews.length > 0 && (
                  <div className="flex gap-2 mt-4">
                    {previews.map((url, i) => (
                      <div key={i} className="w-14 h-14 rounded-xl overflow-hidden border-2 border-purple-500/40">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {allCaptured && (
              <>
                <div className="text-center mb-5">
                  <h2 className="text-cream text-[20px] font-extrabold tracking-tight mb-2">
                    All 5 captured
                  </h2>
                  <p className="text-muted text-[13px]">
                    Review the collage below. Submit if it looks right.
                  </p>
                </div>

                <div className="rounded-2xl overflow-hidden border border-purple-500/40 mb-5">
                  <img src={composedPreview} alt="Your verification collage" className="w-full" />
                </div>

                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={retake}
                    className="flex-1 h-11 rounded-full bg-white/[0.06] border border-white/12 text-cream font-semibold text-[13.5px] flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={15} strokeWidth={2.4} /> Retake
                  </button>
                </div>
              </>
            )}

            {error && (
              <div className="mt-3 text-danger text-[12.5px] bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {/* Submit bar */}
      {allCaptured && !submitted && (
        <div
          className="shrink-0 px-5 pt-3 border-t border-white/8"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={submit}
            disabled={uploading}
            className="w-full h-12 rounded-full text-white font-bold text-[15px] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)',
              boxShadow: '0 10px 28px rgba(236,72,153,0.5)',
            }}
          >
            <Check size={16} strokeWidth={2.6} />
            {uploading ? 'Sending…' : 'Submit for review'}
          </button>
        </div>
      )}
    </div>
  )
}

function PendingState({ submitted }) {
  return (
    <div className="pt-16 text-center">
      <div className="w-20 h-20 rounded-3xl bg-purple-500/15 border border-purple-500/30 grid place-items-center mx-auto mb-6">
        <span className="text-4xl">⏳</span>
      </div>
      <h2 className="text-cream text-[20px] font-extrabold tracking-tight mb-2">
        {submitted ? 'Sent for review' : 'Review in progress'}
      </h2>
      <p className="text-muted text-[13.5px] leading-relaxed max-w-[300px] mx-auto mb-6">
        Our team is checking your selfies. This usually takes a few hours.
      </p>
      <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4 text-left max-w-[340px] mx-auto">
        <p className="text-purple-300 text-[11px] font-bold tracking-wide uppercase mb-2">
          While you wait
        </p>
        <p className="text-cream/90 text-[13px] leading-relaxed">
          Make sure your profile photos show your face clearly. Blurry or
          heavily-filtered photos are the most common reason verification fails.
        </p>
      </div>
    </div>
  )
}

function ApprovedState() {
  return (
    <div className="pt-16 text-center">
      <div
        className="w-20 h-20 rounded-3xl grid place-items-center mx-auto mb-6"
        style={{
          background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)',
          boxShadow: '0 16px 44px rgba(168,85,247,0.6)',
        }}
      >
        <Check size={40} strokeWidth={3} className="text-white" />
      </div>
      <h2 className="text-cream text-[22px] font-extrabold tracking-tight mb-2">
        You're verified
      </h2>
      <p className="text-muted text-[13.5px] leading-relaxed max-w-[300px] mx-auto">
        Your blue check appears on your profile and cards.
      </p>
    </div>
  )
}
