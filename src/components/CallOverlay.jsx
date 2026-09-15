import { useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, SwitchCamera, Volume2, Volume1 } from 'lucide-react'
import { useVoiceCall } from '../lib/voiceCall'
import { useRingtone } from '../lib/useRingtone'

export default function CallOverlay() {
  const {
    state, mode, peer, error, muted, videoOff, durationSec,
    localStreamRef, remoteStreamRef,
    answerCall, declineCall, endCall, toggleMute, toggleVideo, flipCamera,
  } = useVoiceCall()

  const [speakerOn, setSpeakerOn] = useState(false)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)

  // Attach video streams when the call becomes active and mode is video
  useEffect(() => {
    const isVideo = mode === 'video'
    if (!isVideo) return

    let cancelled = false
    let tries = 0

    const tryAttach = () => {
      if (cancelled) return
      const local = localVideoRef.current
      const remote = remoteVideoRef.current

      if (local && localStreamRef?.current) {
        if (local.srcObject !== localStreamRef.current) {
          local.srcObject = localStreamRef.current
        }
        local.play?.().catch(() => {})
      }
      if (remote && remoteStreamRef?.current) {
        if (remote.srcObject !== remoteStreamRef.current) {
          remote.srcObject = remoteStreamRef.current
        }
        remote.play?.().catch(() => {})
      }

      tries++
      // Retry a few times in case the stream isn't ready yet on first render
      if (tries < 20) setTimeout(tryAttach, 150)
    }

    tryAttach()
    return () => { cancelled = true }
  }, [state, mode, localStreamRef, remoteStreamRef])

  // Ringtone: ring for incoming, ring-back for outgoing
  useRingtone(state === 'incoming' ? 'incoming' : state === 'outgoing' ? 'outgoing' : 'none')

  // Vibration for incoming calls (mobile)
  useEffect(() => {
    if (state === 'incoming' && navigator.vibrate) {
      const id = setInterval(() => navigator.vibrate([400, 200, 400]), 2400)
      return () => { clearInterval(id); navigator.vibrate(0) }
    }
  }, [state])

  if (state === 'idle') return null

  const photo = peer?.photo_url || null
  const name = peer?.display_name || 'Someone'
  const isVideo = mode === 'video'
  const isActive = state === 'active'

  // ---------- INCOMING ----------
  if (state === 'incoming') {
    return (
      <div className="fixed inset-0 z-[300] bg-obsidian/95  grid place-items-center px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-purple-600/25 blur-[120px]" />
        </div>

        <div className="relative text-center w-full max-w-[380px]">
          <div className="w-32 h-32 rounded-full overflow-hidden bg-elevated border-4 border-purple-500/50 mx-auto mb-5 shadow-[0_0_40px_rgba(124,58,237,0.6)]">
            {photo ? (
              <img src={photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-5xl font-black text-purple-400">
                {name[0]}
              </div>
            )}
          </div>

          <p className="text-purple-400 text-[11px] font-black tracking-[0.18em] uppercase mb-2">
            Incoming {isVideo ? 'video call' : 'call'}
          </p>
          <h2 className="text-cream text-[26px] font-extrabold tracking-tight mb-8">{name}</h2>

          <div className="flex items-center justify-center gap-12">
            <button
              onClick={declineCall}
              aria-label="Decline"
              className="w-[68px] h-[68px] rounded-full grid place-items-center bg-red-500 text-white shadow-[0_12px_32px_rgba(239,68,68,0.5)] active:scale-95 transition-transform"
            >
              <PhoneOff size={26} strokeWidth={2.4} />
            </button>
            <button
              onClick={answerCall}
              aria-label="Answer"
              className="w-[68px] h-[68px] rounded-full grid place-items-center bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-[0_12px_32px_rgba(124,58,237,0.6)] active:scale-95 transition-transform"
            >
              {isVideo ? <Video size={26} strokeWidth={2.4} /> : <Phone size={26} strokeWidth={2.4} />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- ACTIVE VIDEO ----------
  if (isActive && isVideo) {
    return (
      <div className="fixed inset-0 z-[300] bg-black overflow-hidden">
        {/* Remote full-screen */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Fallback when remote track hasn't arrived */}
        {(!remoteStreamRef?.current || remoteStreamRef.current.getVideoTracks().length === 0) && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-elevated border-4 border-purple-500/50 mx-auto mb-4 shadow-[0_0_40px_rgba(124,58,237,0.6)]">
                {photo ? (
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-5xl font-black text-purple-400">
                    {name[0]}
                  </div>
                )}
              </div>
              <p className="text-white/85 text-[14px] font-medium">
                Waiting for {name}'s video…
              </p>
            </div>
          </div>
        )}

        {/* Top bar — name + duration */}
        <div
          className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}
        >
          <div>
            <p className="text-white text-[16px] font-bold">{name}</p>
            <p className="text-white/70 text-[12px] tabular-nums">{fmtDuration(durationSec)}</p>
          </div>
        </div>

        {/* Local PiP — bottom-right above the control bar */}
        <div className="absolute bottom-28 right-4 w-[100px] h-[140px] rounded-2xl overflow-hidden border-2 border-white/20 bg-black shadow-2xl">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          {videoOff && (
            <div className="absolute inset-0 grid place-items-center bg-obsidian/90">
              <VideoOff size={20} className="text-white/60" />
            </div>
          )}
        </div>

        {/* Control bar */}
        <div
          className="absolute bottom-0 left-0 right-0 pt-4 flex items-center justify-center gap-5"
          style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}
        >
          <ControlBtn onClick={toggleMute} label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </ControlBtn>

          <button
            onClick={() => endCall('ended')}
            aria-label="End call"
            className="w-[68px] h-[68px] rounded-full grid place-items-center bg-red-500 text-white shadow-[0_12px_32px_rgba(239,68,68,0.5)] active:scale-95 transition-transform"
          >
            <PhoneOff size={26} strokeWidth={2.4} />
          </button>

          <ControlBtn onClick={toggleVideo} label={videoOff ? 'Camera on' : 'Camera off'}>
            {videoOff ? <VideoOff size={22} /> : <Video size={22} />}
          </ControlBtn>

          <ControlBtn onClick={flipCamera} label="Flip camera">
            <SwitchCamera size={22} />
          </ControlBtn>
        </div>

        {error && (
          <p className="absolute top-20 left-0 right-0 text-center text-danger text-[13px]">{error}</p>
        )}
      </div>
    )
  }

  // ---------- OUTGOING / CONNECTING VIDEO — WhatsApp-style ----------
  if (isVideo && (state === 'outgoing' || state === 'connecting')) {
    return (
      <div className="fixed inset-0 z-[300] bg-black overflow-hidden">
        {/* Local camera preview — full screen, sharp, no dark overlay */}
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Top: name + status, small, centered — nothing else covers the frame */}
        <div className="absolute top-0 left-0 right-0 pt-14 px-6 text-center pointer-events-none">
          <h2 className="text-white text-[22px] font-bold tracking-tight mb-1"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
            {name}
          </h2>
          <p className="text-white/80 text-[13px] font-medium"
             style={{ textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
            Video calling…
          </p>
        </div>

        {/* Right rail: flip camera button (WhatsApp keeps it always visible) */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4">
          <button
            onClick={flipCamera}
            aria-label="Flip camera"
            className="w-[52px] h-[52px] rounded-full grid place-items-center bg-white/15  border border-white/15 active:scale-95 transition-transform"
          >
            <SwitchCamera size={22} strokeWidth={2.2} className="text-white" />
          </button>
        </div>

        {error && (
          <p className="absolute bottom-40 left-0 right-0 text-center text-danger text-[13px] px-6">
            {error}
          </p>
        )}

        {/* Bottom pill — mute, camera-off toggle, red end */}
        <div
          className="absolute bottom-0 left-0 right-0 flex justify-center"
          style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center gap-3 px-3 py-3 rounded-full bg-black/55  border border-white/10">
            <button
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className={`w-[54px] h-[54px] rounded-full grid place-items-center transition-transform active:scale-95 ${
                muted ? 'bg-white text-black' : 'bg-white/12 text-white'
              }`}
            >
              {muted ? <MicOff size={22} strokeWidth={2.3} /> : <Mic size={22} strokeWidth={2.3} />}
            </button>

            <button
              onClick={toggleVideo}
              aria-label={videoOff ? 'Camera on' : 'Camera off'}
              className={`w-[54px] h-[54px] rounded-full grid place-items-center transition-transform active:scale-95 ${
                videoOff ? 'bg-white text-black' : 'bg-white/12 text-white'
              }`}
            >
              {videoOff ? <VideoOff size={22} strokeWidth={2.3} /> : <Video size={22} strokeWidth={2.3} />}
            </button>

            <button
              onClick={() => endCall('ended')}
              aria-label="Cancel call"
              className="w-[64px] h-[64px] rounded-full grid place-items-center bg-red-500 text-white shadow-[0_10px_28px_rgba(239,68,68,0.55)] active:scale-95 transition-transform"
            >
              <PhoneOff size={26} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- OUTGOING / CONNECTING / ACTIVE AUDIO ----------
  const label =
    state === 'outgoing' ? (isVideo ? 'Video calling…' : 'Voice calling…') :
    state === 'connecting' ? 'Connecting…' :
    (isVideo ? 'Video call' : 'Voice call')

  return (
    <div className="fixed inset-0 z-[300] bg-obsidian/95  grid place-items-center px-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-purple-600/25 blur-[120px]" />
      </div>

      <div className="relative text-center w-full max-w-[380px]">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-elevated border-4 border-purple-500/50 mx-auto mb-5 shadow-[0_0_40px_rgba(124,58,237,0.6)]">
          {photo ? (
            <img src={photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-5xl font-black text-purple-400">
              {name[0]}
            </div>
          )}
        </div>

        <p className="text-purple-400 text-[11px] font-black tracking-[0.18em] uppercase mb-2">
          {label}
        </p>
        {state === 'outgoing' && (
          <p className="text-muted text-[12px] mb-4">
            Waiting for {name} to answer…
          </p>
        )}
        <h2 className="text-cream text-[28px] font-extrabold tracking-tight mb-2">{name}</h2>
        {isActive ? (
          <p className="text-muted text-[13px] font-medium tabular-nums mb-8">
            {fmtDuration(durationSec)}
          </p>
        ) : (
          <p className="text-muted text-[13px] mb-8">{'\u00A0'}</p>
        )}

        {error && <p className="text-danger text-[13px] mb-4">{error}</p>}

        <div className="flex items-center justify-center gap-12">
          {/* Only show Mute + Speaker when the call is actually connected */}
          {isActive && (
            <ControlBtn onClick={toggleMute} label={muted ? 'Unmute' : 'Mute'}>
              {muted ? <MicOff size={22} /> : <Mic size={22} />}
            </ControlBtn>
          )}

          <button
            onClick={() => endCall('ended')}
            aria-label={isActive ? 'End call' : 'Cancel call'}
            className="w-[68px] h-[68px] rounded-full grid place-items-center bg-red-500 text-white shadow-[0_12px_32px_rgba(239,68,68,0.5)] active:scale-95 transition-transform"
          >
            <PhoneOff size={26} strokeWidth={2.4} />
          </button>

          {isActive && (
            <ControlBtn onClick={() => setSpeakerOn((v) => !v)} label={speakerOn ? 'Speaker off' : 'Speaker on'}>
              {speakerOn ? <Volume2 size={22} /> : <Volume1 size={22} />}
            </ControlBtn>
          )}
        </div>
      </div>
    </div>
  )
}

function ControlBtn({ onClick, label, children, active }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`w-[60px] h-[60px] rounded-full grid place-items-center border transition-colors ${
        active
          ? 'bg-white text-obsidian border-white'
          : 'bg-white/[0.08] text-white border-white/15'
      }`}
    >
      {children}
    </button>
  )
}

function fmtDuration(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
