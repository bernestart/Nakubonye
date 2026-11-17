const fs = require('fs');
const path = 'src/components/chat/useVoiceRecorder.js';
if (!fs.existsSync(path)) { console.log('File not found'); process.exit(1); }
let content = fs.readFileSync(path, 'utf8');
const newLogic = `
    let mime = '';
    if (window.MediaRecorder) {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus';
      else if (MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';
      else if (MediaRecorder.isTypeSupported('audio/mp4')) mime = 'audio/mp4';
    }
    const options = mime ? { mimeType: mime } : {};
    const mr = new MediaRecorder(stream, options);
`;
// Replace the existing MediaRecorder instantiation block
content = content.replace(/const mime = MediaRecorder\.isTypeSupported[\s\S]*?const mr = new MediaRecorder\(stream[^)]*\);/, newLogic.trim());
// Also fix the Blob fallback
content = content.replace(/type: mr\.mimeType \|\| "audio\/webm"/g, 'type: mr.mimeType || "audio/webm"');
fs.writeFileSync(path, content);
console.log('✅ Voice MIME logic fixed: prefers webm/opus, falls back safely.');
