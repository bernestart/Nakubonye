const fs = require('fs');
const vrPath = 'src/components/chat/useVoiceRecorder.js';
let vr = fs.readFileSync(vrPath, 'utf8');

// Replace the strict MediaRecorder instantiation with a safe fallback
const oldMimeLogic = /const mime = MediaRecorder\.isTypeSupported\("audio\/mp4"\)[\s\S]*?const mr = new MediaRecorder\(stream, \{ mimeType: mime \}\);/;
const newMimeLogic = `let mime = '';
    if (MediaRecorder.isTypeSupported("audio/mp4")) mime = "audio/mp4";
    else if (MediaRecorder.isTypeSupported("audio/aac")) mime = "audio/aac";
    else if (MediaRecorder.isTypeSupported("audio/webm")) mime = "audio/webm";
    
    // Only pass options if we found a supported mime, otherwise let the device choose
    const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);`;

if (vr.match(oldMimeLogic)) {
  vr = vr.replace(oldMimeLogic, newMimeLogic);
  fs.writeFileSync(vrPath, vr);
  console.log('✅ useVoiceRecorder.js: MIME fallback made bulletproof');
} else {
  console.log('⚠️ Could not find MIME logic. Checking file manually...');
}
