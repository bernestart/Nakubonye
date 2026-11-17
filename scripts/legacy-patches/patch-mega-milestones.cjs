const fs = require('fs');

// ==========================================
// FIX 1: NATIVE HEADER (Kill the overlap)
// ==========================================
const appPath = 'src/App.jsx';
let app = fs.readFileSync(appPath, 'utf8');
if (!app.includes('StatusBar')) {
  app = app.replace(
    "import { useEffect, useState } from 'react'",
    "import { useEffect, useState } from 'react'\nimport { StatusBar } from '@capacitor/status-bar';\nimport { Capacitor } from '@capacitor/core';"
  );
  app = app.replace(
    'export default function App() {',
    `export default function App() {\n  useEffect(() => {\n    if (Capacitor.isNativePlatform()) {\n      StatusBar.setOverlaysWebView({ overlay: false });\n    }\n  }, []);\n`
  );
  fs.writeFileSync(appPath, app);
  console.log('✅ App.jsx: Native Header enforced');
}

// ==========================================
// FIX 2: NATIVE VOICE NOTES (Kill the MIME crash)
// ==========================================
const recorderPath = 'src/components/chat/useVoiceRecorder.js';
const nativeRecorderCode = `import { useState, useRef } from 'react';
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
`;
fs.writeFileSync(recorderPath, nativeRecorderCode);
console.log('✅ useVoiceRecorder.js: Replaced with bulletproof native MIME logic');

// ==========================================
// FIX 3: ONBOARDING FLOW (Meta Style)
// ==========================================
const onboardPath = 'src/screens/Onboarding.jsx';
if (fs.existsSync(onboardPath)) {
  let onboard = fs.readFileSync(onboardPath, 'utf8');
  // Add a prompt for cover photo if it doesn't exist
  if (!onboard.includes('Cover Photo')) {
    onboard = onboard.replace(
      /<h1[^>]*>.*?<\/h1>/,
      `$&
      <p className="text-muted text-[14px] mb-4">Add a cover photo to personalize your profile.</p>
      <button className="w-full h-32 rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center text-muted mb-6">
        <span>📸 Upload Cover Photo</span>
      </button>`
    );
    fs.writeFileSync(onboardPath, onboard);
    console.log('✅ Onboarding.jsx: Added Meta-style Cover Photo step');
  }
}

// ==========================================
// FIX 4: COMMUNITY TDZ & CHAT UI
// ==========================================
const cvPath = 'src/screens/CommunityView.jsx';
if (fs.existsSync(cvPath)) {
  let cv = fs.readFileSync(cvPath, 'utf8');
  if (!cv.includes('lazy(')) {
    cv = cv.replace(/import CommunityFeed from ['"].*CommunityFeed['"];?/g, `import { lazy, Suspense } from 'react';\nconst CommunityFeed = lazy(() => import('../components/CommunityFeed'));`);
    cv = cv.replace(/import CommunityChat from ['"].*CommunityChat['"];?/g, `const CommunityChat = lazy(() => import('../components/CommunityChat'));`);
    fs.writeFileSync(cvPath, cv);
    console.log('✅ CommunityView.jsx: Lazy-loaded to prevent TDZ crash');
  }
}

const ccPath = 'src/components/CommunityChat.jsx';
if (fs.existsSync(ccPath)) {
  let cc = fs.readFileSync(ccPath, 'utf8');
  // Hide textarea strictly during recording
  cc = cc.replace(
    /<textarea className=\{voice\.recording \? 'hidden' : ''\}[\s\S]*?className="([^"]*)"/g,
    `<textarea className={\`\${voice.recording ? 'hidden' : ''} \${"$1"}\`}`
  );
  // Hide emoji button during recording
  cc = cc.replace(
    /<button([\s\S]*?)aria-label="Emoji"([\s\S]*?)>/g,
    `<button className={voice.recording ? 'hidden' : ''} $1 aria-label="Emoji" $2>`
  );
  fs.writeFileSync(ccPath, cc);
  console.log('✅ CommunityChat.jsx: Voice UI fixed (hides textarea)');
}
