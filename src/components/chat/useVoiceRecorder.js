import { CapacitorAudioRecorder } from '@capgo/capacitor-audio-recorder';
import { Capacitor } from '@capacitor/core';
import { useRef, useState, useCallback, useEffect } from 'react';

const isNative = Capacitor.isNativePlatform();

export function useVoiceRecorder({ maxSeconds = 300 } = {}) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [waveform, setWaveform] = useState([]);
  const [locked, setLocked] = useState(false);

  const timerRef = useRef(null);
  const ampPollRef = useRef(null);
  const startTimeRef = useRef(null);
  const startYRef = useRef(0);
  const maxSecondsRef = useRef(maxSeconds);

  useEffect(() => { maxSecondsRef.current = maxSeconds; }, [maxSeconds]);

  const start = useCallback(async () => {
    if (recording) return false;

    try {
      // Try to start directly. If OS already granted, this works instantly.
      await CapacitorAudioRecorder.startRecording();
    } catch (e) {
      // If it fails, request permission and retry once.
      try {
        const perm = await CapacitorAudioRecorder.requestPermissions();
        if (perm.microphone !== 'granted') {
          alert('Please enable Microphone access in your phone Settings.');
          return false;
        }
        await CapacitorAudioRecorder.startRecording();
      } catch (e2) {
        console.error('Recording failed after request:', e2);
        return false;
      }
    }

    setRecording(true);
    setPaused(false);
    setLocked(false);
    setSeconds(0);
    setWaveform([]);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setSeconds(elapsed);
      if (elapsed >= maxSecondsRef.current) {
        stopInternal({ send: true }).catch(() => {});
      }
    }, 500);

    ampPollRef.current = setInterval(async () => {
      try {
        const { value } = await CapacitorAudioRecorder.getCurrentAmplitude();
        if (typeof value === 'number') {
          setWaveform((w) => [...w.slice(-59), value]);
        }
      } catch { /* ignore */ }
    }, 80);

    return true;
  }, [recording]);

  const pause = useCallback(async () => {
    if (!recording || paused) return;
    try { await CapacitorAudioRecorder.pauseRecording(); } catch (e) { console.error(e); }
    clearInterval(timerRef.current);
    clearInterval(ampPollRef.current);
    setPaused(true);
  }, [recording, paused]);

  const resume = useCallback(async () => {
    if (!recording || !paused) return;
    try { await CapacitorAudioRecorder.resumeRecording(); } catch (e) { console.error(e); return; }
    setPaused(false);
    startTimeRef.current = Date.now() - seconds * 1000;

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setSeconds(elapsed);
      if (elapsed >= maxSecondsRef.current) stopInternal({ send: true }).catch(() => {});
    }, 500);

    ampPollRef.current = setInterval(async () => {
      try {
        const { value } = await CapacitorAudioRecorder.getCurrentAmplitude();
        if (typeof value === 'number') setWaveform((w) => [...w.slice(-59), value]);
      } catch { /* ignore */ }
    }, 80);
  }, [recording, paused, seconds]);

  async function stopInternal({ send = true, maxBytes = 10 * 1024 * 1024 } = {}) {
    clearInterval(timerRef.current);
    clearInterval(ampPollRef.current);
    const duration = seconds;

    let result = null;
    try {
      result = await CapacitorAudioRecorder.stopRecording();
    } catch (e) {
      console.error('stopRecording failed:', e);
    }

    setRecording(false);
    setPaused(false);
    setLocked(false);
    setSeconds(0);
    setWaveform([]);

    if (!send || !result) return null;

    let blob;
    let mimeType = 'audio/aac';

    if (result.blob) {
      blob = result.blob;
      mimeType = blob.type || 'audio/webm';
    } else if (result.uri) {
      const fileUri = Capacitor.convertFileSrc(result.uri);
      const resp = await fetch(fileUri);
      blob = await resp.blob();
      mimeType = blob.type || 'audio/aac';
    } else {
      console.warn('No audio data returned');
      return null;
    }

    if (blob.size > maxBytes) throw new Error('Voice note too large');
    return { blob, duration, waveform: [], mimeType };
  }

  const stop = useCallback(stopInternal, [seconds]);

  const cancel = useCallback(async () => {
    clearInterval(timerRef.current);
    clearInterval(ampPollRef.current);
    try { await CapacitorAudioRecorder.cancelRecording(); } catch (e) { console.error(e); }
    setRecording(false);
    setPaused(false);
    setLocked(false);
    setSeconds(0);
    setWaveform([]);
  }, []);

  const setTouchStart = useCallback((e) => {
    startYRef.current = e.touches?.[0]?.clientY ?? e.clientY;
  }, []);

  const checkSlideCancel = useCallback((e) => {
    const y = e.touches?.[0]?.clientY ?? e.clientY;
    return startYRef.current - y > 80;
  }, []);

  return {
    recording, paused, seconds, waveform, locked,
    start, pause, resume, stop, cancel,
    setTouchStart, checkSlideCancel,
  };
}
