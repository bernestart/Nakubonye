import {
  createContext, useCallback, useContext, useEffect, useRef, useState
} from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

const VoiceCallCtx = createContext(null)

export function VoiceCallProvider({ children }) {
  const { session } = useAuth()
  const myId = session?.user?.id

  const [state, setState] = useState('idle') // idle | outgoing | incoming | connecting | active
  const [mode, setMode] = useState('audio')  // audio | video
  const [peer, setPeer] = useState(null)
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(false)
  const [videoOff, setVideoOff] = useState(false)
  const [durationSec, setDurationSec] = useState(0)

  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const myChannelRef = useRef(null)
  const callIdRef = useRef(null)
  const peerRef = useRef(null)
  const stateRef = useRef(state)
  const modeRef = useRef('audio')
  const pendingIceRef = useRef([])
  const durationTimerRef = useRef(null)
  const ringTimerRef = useRef(null)
  const audioRef = useRef(null)
  const peerSendRef = useRef(null)
  const handlerRef = useRef(null)

  useEffect(() => { peerRef.current = peer }, [peer])
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { modeRef.current = mode }, [mode])

  const send = useCallback((msg) => {
    if (peerSendRef.current) {
      peerSendRef.current.send({ type: 'broadcast', event: 'msg', payload: { ...msg, from: myId } })
    }
  }, [myId])

  const cleanup = useCallback(() => {
    clearInterval(durationTimerRef.current)
    clearTimeout(ringTimerRef.current)
    durationTimerRef.current = null
    ringTimerRef.current = null
    pendingIceRef.current = []

    if (peerSendRef.current) {
      try { supabase.removeChannel(peerSendRef.current) } catch {}
      peerSendRef.current = null
    }
    if (pcRef.current) {
      try { pcRef.current.close() } catch {}
      pcRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
    remoteStreamRef.current = null
    if (audioRef.current) audioRef.current.srcObject = null
    callIdRef.current = null
    setDurationSec(0)
    setMuted(false)
    setVideoOff(false)
  }, [])

  const endCall = useCallback((reason = 'ended') => {
    send({ type: 'end', callId: callIdRef.current, reason })
    cleanup()
    setState('idle')
    setPeer(null)
  }, [cleanup, send])

  const declineCall = useCallback((reason = 'declined') => {
    send({ type: 'decline', callId: callIdRef.current, reason })
    cleanup()
    setState('idle')
    setPeer(null)
  }, [cleanup, send])

  // ---------------------------------------------------------------
  // Peer connection factory — requests video only when mode is video
  // ---------------------------------------------------------------
  const ensurePc = useCallback(async (wantVideo) => {
    if (pcRef.current) return pcRef.current

    const pc = new RTCPeerConnection(RTC_CONFIG)
    pcRef.current = pc

    const isVideo = !!wantVideo
    // Portrait mobile needs width/height order matching the screen orientation.
    // Some Android Chrome builds reject 1080x1920 as portrait but accept it as-is.
    // We request a tall box and let the browser fit.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: isVideo ? {
        facingMode: 'user',
        width:  { ideal: 720, min: 480, max: 1080 },
        height: { ideal: 1280, min: 640, max: 1920 },
        aspectRatio: { ideal: 9 / 16 },
        frameRate: { ideal: 24, min: 15, max: 30 },
      } : false,
    })
    localStreamRef.current = stream
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))

    // Log actual camera resolution Chrome gave us
    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      const settings = videoTrack.getSettings()
      console.log('[Nakubonye] Camera settings:', settings)
      console.log('[Nakubonye] Resolution:', settings.width + 'x' + settings.height, 'at', settings.frameRate + ' fps')
    }

    const remote = new MediaStream()
    remoteStreamRef.current = remote
    if (audioRef.current) {
      audioRef.current.srcObject = remote
      audioRef.current.play().catch(() => {})
    }

    pc.ontrack = (event) => {
      const track = event.track
      if (!remote.getTracks().some((t) => t.id === track.id)) {
        remote.addTrack(track)
      }
      if (audioRef.current) {
        audioRef.current.srcObject = remote
        audioRef.current.play().catch(() => {})
      }
      // Trigger a UI re-render when the video track arrives
      setDurationSec((s) => s)
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send({ type: 'ice', callId: callIdRef.current, candidate: e.candidate.toJSON() })
      }
    }

    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState
      if (st === 'connected' || st === 'completed') {
        setState('active')
        if (!durationTimerRef.current) {
          durationTimerRef.current = setInterval(() => setDurationSec((s) => s + 1), 1000)
        }
      } else if (st === 'failed' || st === 'disconnected') {
        setError('Connection lost')
        setTimeout(() => endCall('lost'), 500)
      }
    }

    return pc
  }, [send, endCall])

  // ---------------------------------------------------------------
  // Message handlers
  // ---------------------------------------------------------------
  const handleIncoming = useCallback(async (msg) => {
    const myState = stateRef.current
    const myIdNow = myId

    if (msg.type === 'ring') {
      if (myState !== 'idle') {
        const ch = supabase.channel('voice-' + msg.from + '-tmp-decline')
        ch.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            ch.send({ type: 'broadcast', event: 'msg', payload: {
              type: 'decline', from: myIdNow, callId: msg.callId, reason: 'busy',
            }})
            setTimeout(() => supabase.removeChannel(ch), 400)
          }
        })
        return
      }

      const sendCh = supabase.channel('voice-' + msg.from + '-in')
      await new Promise((resolve) => {
        sendCh.subscribe((status) => { if (status === 'SUBSCRIBED') resolve() })
      })
      peerSendRef.current = sendCh

      callIdRef.current = msg.callId
      modeRef.current = msg.mode || 'audio'
      setMode(msg.mode || 'audio')
      setPeer({ id: msg.from, display_name: msg.peer?.display_name, photo_url: msg.peer?.photo_url })
      setState('incoming')

      clearTimeout(ringTimerRef.current)
      ringTimerRef.current = setTimeout(() => {
        if (callIdRef.current === msg.callId && stateRef.current === 'incoming') {
          declineCall('timeout')
        }
      }, 45000)
      return
    }

    if (msg.type === 'accept') {
      if (myState !== 'outgoing') return
      setState('connecting')
      clearTimeout(ringTimerRef.current)
      const pc = await ensurePc(modeRef.current === 'video')
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: modeRef.current === 'video' })
      await pc.setLocalDescription(offer)
      send({ type: 'offer', callId: callIdRef.current, sdp: offer })
      return
    }

    if (msg.type === 'decline') {
      if (myState === 'outgoing' || myState === 'connecting') {
        setError('Call declined')
        cleanup()
        setState('idle')
        setPeer(null)
      }
      return
    }

    if (msg.type === 'offer') {
      if (myState !== 'connecting' && myState !== 'incoming') return
      const pc = await ensurePc(modeRef.current === 'video')
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
      for (const c of pendingIceRef.current) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {}
      }
      pendingIceRef.current = []
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      send({ type: 'answer', callId: callIdRef.current, sdp: answer })
      setState('connecting')
      return
    }

    if (msg.type === 'answer') {
      const pc = pcRef.current
      if (!pc) return
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
      for (const c of pendingIceRef.current) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {}
      }
      pendingIceRef.current = []
      return
    }

    if (msg.type === 'ice') {
      const pc = pcRef.current
      if (!pc) return
      if (pc.remoteDescription && pc.remoteDescription.type) {
        try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)) } catch {}
      } else {
        pendingIceRef.current.push(msg.candidate)
      }
      return
    }

    if (msg.type === 'end') {
      cleanup()
      setState('idle')
      setPeer(null)
      return
    }
  }, [myId, ensurePc, send, cleanup, declineCall])

  useEffect(() => { handlerRef.current = handleIncoming }, [handleIncoming])

  // Inbox channel
  useEffect(() => {
    if (!myId) return
    const ch = supabase.channel('voice-' + myId, { config: { broadcast: { self: false } } })
    ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
      if (!payload || payload.from === myId) return
      handlerRef.current?.(payload)
    })
    ch.subscribe()
    myChannelRef.current = ch
    return () => {
      try { supabase.removeChannel(ch) } catch {}
      myChannelRef.current = null
    }
  }, [myId])

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------
  const startCall = useCallback(async (target, peerInfo = null, opts = {}) => {
    if (!myId) return
    if (stateRef.current !== 'idle') return
    try {
      setError('')
      const callId = crypto.randomUUID()
      callIdRef.current = callId

      const wantVideo = opts.mode === 'video'
      modeRef.current = wantVideo ? 'video' : 'audio'
      setMode(wantVideo ? 'video' : 'audio')

      const sendCh = supabase.channel('voice-' + target + '-out')
      await new Promise((resolve) => {
        sendCh.subscribe((status) => { if (status === 'SUBSCRIBED') resolve() })
      })
      peerSendRef.current = sendCh

      setPeer({ id: target, display_name: peerInfo?.display_name, photo_url: peerInfo?.photo_url })
      setState('outgoing')

      // Request camera immediately in video mode so caller sees their own preview
      if (modeRef.current === 'video') {
        await ensurePc(true)
      }

      send({
        type: 'ring',
        callId,
        mode: modeRef.current,
        peer: peerInfo ? { display_name: peerInfo.display_name, photo_url: peerInfo.photo_url } : null,
      })

      clearTimeout(ringTimerRef.current)
      ringTimerRef.current = setTimeout(() => {
        if (callIdRef.current === callId && stateRef.current === 'outgoing') {
          endCall('timeout')
        }
      }, 45000)
    } catch (err) {
      setError(err?.message || 'Could not start call')
      cleanup()
      setState('idle')
      setPeer(null)
    }
  }, [myId, send, endCall, cleanup])

  const answerCall = useCallback(async () => {
    if (!callIdRef.current || !peerRef.current) return
    try {
      setError('')
      setState('connecting')
      clearTimeout(ringTimerRef.current)
      await ensurePc(modeRef.current === 'video')
      send({ type: 'accept', callId: callIdRef.current })
    } catch (err) {
      setError(err?.message || 'Could not answer')
      endCall('error')
    }
  }, [ensurePc, send, endCall])

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const next = !muted
    stream.getAudioTracks().forEach((t) => { t.enabled = !next })
    setMuted(next)
  }, [muted])

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const next = !videoOff
    stream.getVideoTracks().forEach((t) => { t.enabled = !next })
    setVideoOff(next)
  }, [videoOff])

  // Flip camera (front <-> back) — best-effort, only when video is on
  const flipCamera = useCallback(async () => {
    const pc = pcRef.current
    const stream = localStreamRef.current
    if (!pc || !stream) return
    const currentVideoTrack = stream.getVideoTracks()[0]
    if (!currentVideoTrack) return
    const currentFacing = currentVideoTrack.getSettings()?.facingMode || 'user'
    const newFacing = currentFacing === 'user' ? 'environment' : 'user'
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing, width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: false,
      })
      const newVideo = fresh.getVideoTracks()[0]
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) await sender.replaceTrack(newVideo)
      currentVideoTrack.stop()
      // Update local stream's video track reference
      stream.getVideoTracks().forEach((t) => stream.removeTrack(t))
      stream.addTrack(newVideo)
      setDurationSec((s) => s)
    } catch (err) {
      setError(err?.message || 'Could not flip camera')
    }
  }, [])

  const value = {
    state, mode, peer, error, muted, videoOff, durationSec,
    localStreamRef, remoteStreamRef, audioRef,
    startCall, answerCall, declineCall, endCall,
    toggleMute, toggleVideo, flipCamera,
  }

  return (
    <VoiceCallCtx.Provider value={value}>
      {children}
      <audio ref={audioRef} autoPlay playsInline />
    </VoiceCallCtx.Provider>
  )
}

export function useVoiceCall() {
  const ctx = useContext(VoiceCallCtx)
  if (!ctx) throw new Error('useVoiceCall must be used inside VoiceCallProvider')
  return ctx
}
