const fs = require('fs');
const path = 'src/components/chat/useVoiceRecorder.js';
if (!fs.existsSync(path)) { console.log('File not found'); process.exit(1); }
let content = fs.readFileSync(path, 'utf8');
// Insert permission check before getUserMedia
const permBlock = `
    // Native permission request for Android
    if (Capacitor.isNativePlatform()) {
      const { Permissions } = await import('@capacitor/core');
      const status = await Permissions.query({ name: 'microphone' });
      if (status.state === 'denied') {
        alert('Microphone permission is denied. Go to Settings > Apps > Nakubonye > Permissions and allow Microphone.');
        return;
      }
      if (status.state === 'prompt' || status.state === 'prompt-with-rationale') {
        const req = await Permissions.request({ name: 'microphone' });
        if (req.state !== 'granted') {
          alert('Microphone permission is required to record voice notes.');
          return;
        }
      }
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
`;
// Replace the existing getUserMedia line with permission-wrapped version
content = content.replace(
  /const stream = await navigator\.mediaDevices\.getUserMedia\(\{ audio: true \}\);/,
  permBlock.trim()
);
// Ensure Capacitor import exists
if (!content.includes("import { Capacitor }")) {
  content = `import { Capacitor } from '@capacitor/core';\n` + content;
}
fs.writeFileSync(path, content);
console.log('✅ Native microphone permission request added.');
