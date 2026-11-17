const fs = require('fs');

// ── 1. DISABLE EDGE-TO-EDGE OVERLAP (Fixes ALL Headers natively) ──
const capPath = fs.existsSync('capacitor.config.json') ? 'capacitor.config.json' : 'capacitor.config.ts';
let cap = fs.readFileSync(capPath, 'utf8');
if (!cap.includes('overlaysWebView')) {
  cap = cap.replace(/"plugins":\s*\{/, `"plugins": {
    "StatusBar": {
      "overlaysWebView": false,
      "style": "DARK"
    },`);
  fs.writeFileSync(capPath, cap);
  console.log('✅ capacitor.config: overlaysWebView = false');
}

// ── 2. REMOVE JS 32px FALLBACK (Since native OS now pushes UI down) ──
const safeAreaPath = 'src/lib/useSafeArea.js';
if (fs.existsSync(safeAreaPath)) {
  let sa = fs.readFileSync(safeAreaPath, 'utf8');
  sa = sa.replace(/isAndroid \? 32 : 0/, '0');
  fs.writeFileSync(safeAreaPath, sa);
  console.log('✅ useSafeArea.js: Removed 32px forced fallback');
}

// ── 3. FORCE AUDIO/MP4 (Fixes audio/webm crash) ──
const vrPath = 'src/components/chat/useVoiceRecorder.js';
if (fs.existsSync(vrPath)) {
  let vr = fs.readFileSync(vrPath, 'utf8');
  vr = vr.replace(
    'const mime = ""; // Let Android WebView pick its native default',
    'const mime = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : MediaRecorder.isTypeSupported("audio/aac") ? "audio/aac" : "audio/webm";'
  );
  vr = vr.replace(
    'new MediaRecorder(stream)',
    'new MediaRecorder(stream, { mimeType: mime })'
  );
  fs.writeFileSync(vrPath, vr);
  console.log('✅ useVoiceRecorder.js: Forced audio/mp4');
}

// ── 4. LAZY LOAD POSTCOMMENTSSHEET (Fixes TDZ 'u' crash) ──
['src/screens/Feed.jsx', 'src/screens/PostDetail.jsx'].forEach(p => {
  if (fs.existsSync(p)) {
    let f = fs.readFileSync(p, 'utf8');
    if (!f.includes('React.lazy') && !f.includes('lazy(')) {
      f = f.replace(/import\s+PostCommentsSheet\s+from\s+["'].*PostCommentsSheet["'];?/g, `import { lazy, Suspense } from "react";\nconst PostCommentsSheet = lazy(() => import("../components/PostCommentsSheet"));`);
      f = f.replace(/<PostCommentsSheet([\s\S]*?)>/g, `<Suspense fallback={null}><PostCommentsSheet$1>`);
      f = f.replace(/<\/PostCommentsSheet>/g, `</PostCommentsSheet></Suspense>`);
      fs.writeFileSync(p, f);
      console.log('✅ ' + p + ': Lazy-loaded PostCommentsSheet');
    }
  }
});
