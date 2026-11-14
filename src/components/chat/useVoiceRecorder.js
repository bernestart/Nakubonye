import { useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [waveform, setWaveform] = useState([]);
  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      
      // Determine supported MIME
      let mime = '';
      if (MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';
      else if (MediaRecorder.isTypeSupported('audio/mp4')) mime = 'audio/mp4';
      else if (MediaRecorder.isTypeSupported('audio/aac')) mime = 'audio/aac';

      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(100);
      
      mediaRecorderRef.current = mr;
      setRecording(true);
      setSeconds(0);
      
      // Fake waveform for UI
      setWaveform(Array.from({ length: 30 }, () => Math.random() * 0.8 + 0.2));
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (err) {
      console.error('Mic error:', err);
      alert('Microphone access denied or not supported.');
    }
  }

  async function stop({ send = true } = {}) {
    const mr = mediaRecorderRef.current;
    if (!mr) return null;
    
    clearInterval(timerRef.current);
    const duration = seconds;
    
    return new Promise((resolve) => {
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        setRecording(false);
        resolve({ blob, duration, waveform, mimeType: mr.mimeType || 'audio/webm' });
      };
      mr.stop();
    });
  }

  return { recording, seconds, waveform, start, stop };
}
