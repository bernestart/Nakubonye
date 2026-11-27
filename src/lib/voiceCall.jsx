import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';

const VoiceCallCtx = createContext(null);

export function VoiceCallProvider({ children }) {
  const [state, setState] = useState('idle'); // idle, calling, ringing, connected, ended
  const [mode, setMode] = useState('audio'); // audio or video
  const [peer, setPeer] = useState(null);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const timerRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  const initMedia = async (isVideo) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { facingMode: 'user' } : false
      });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      setError('Camera/Mic access denied.');
      throw err;
    }
  };

  const startTimer = () => {
    let secs = 0;
    timerRef.current = setInterval(() => {
      secs++;
      setDurationSec(secs);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setDurationSec(0);
  };

  // The Caller initiates this
  const startCall = async (targetUserId, isVideo = false, myId) => {
    if (!myId) { setError('Not logged in'); return; }
    setMode(isVideo ? 'video' : 'audio');
    setPeer(targetUserId);
    setState('calling');
    setError('');

    try {
      const stream = await initMedia(isVideo);
      const roomId = `call-${[myId, targetUserId].sort().join('-')}`;
      connectWebSocket(roomId, myId, true, stream, isVideo);
    } catch (err) {
      setState('idle');
    }
  };

  // The Receiver initiates this when they accept
  const answerCall = async (targetUserId, isVideo = false, myId) => {
    setMode(isVideo ? 'video' : 'audio');
    setState('connecting');
    setError('');

    try {
      const stream = await initMedia(isVideo);
      const roomId = `call-${[myId, targetUserId].sort().join('-')}`;
      connectWebSocket(roomId, myId, false, stream, isVideo);
    } catch (err) {
      setState('idle');
    }
  };

  const connectWebSocket = (roomId, myId, isCaller, stream, isVideo) => {
    const token = localStorage.getItem('auth_token');
    const wsUrl = `wss://nakubonye.bernestart.workers.dev/api/ws/${roomId}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pcRef.current = pc;

    // Add local tracks to WebRTC
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Get remote tracks
    pc.ontrack = (event) => {
      if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
      remoteStreamRef.current.addTrack(event.track);
    };

    // Send ICE candidates to the other peer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
      }
    };

    ws.onopen = async () => {
      if (isCaller) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'offer', sdp: offer, isVideo }));
      }
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.type === 'offer') {
        setMode(msg.isVideo ? 'video' : 'audio');
        setState('ringing'); // Ringing state for the receiver
      } else if (msg.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        setState('connected');
        startTimer();
      } else if (msg.type === 'candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      } else if (msg.type === 'hangup') {
        endCall();
      }
    };
  };

  const declineCall = () => {
    if (wsRef.current) wsRef.current.send(JSON.stringify({ type: 'hangup' }));
    endCall();
  };

  const endCall = () => {
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ type: 'hangup' })); wsRef.current.close(); } catch(e) {}
    }
    if (pcRef.current) pcRef.current.close();
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    
    stopTimer();
    setState('idle');
    setPeer(null);
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    wsRef.current = null;
    pcRef.current = null;
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoOff(!videoTrack.enabled);
      }
    }
  };

  const flipCamera = async () => {
    // Basic flip logic for mobile
    if (mode !== 'video' || !localStreamRef.current) return;
    // Implementation would require stopping the track and getting a new one with facingMode: 'environment'
    console.log("Camera flip not fully implemented yet");
  };

  return (
    <VoiceCallCtx.Provider value={{
      state, mode, peer, error, muted, videoOff, durationSec,
      localStreamRef, remoteStreamRef,
      startCall, answerCall, declineCall, endCall, toggleMute, toggleVideo, flipCamera
    }}>
      {children}
    </VoiceCallCtx.Provider>
  );
}

export const useVoiceCall = () => useContext(VoiceCallCtx);
