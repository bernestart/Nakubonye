const fs = require('fs');
let pass = 0, fail = 0;

function check(name, condition) {
  if (condition) { console.log('✅ PASS:', name); pass++; }
  else { console.log('❌ FAIL:', name); fail++; }
}

// 1. Check Capacitor Config (Native Header Fix)
const cap = fs.readFileSync(fs.existsSync('capacitor.config.json') ? 'capacitor.config.json' : 'capacitor.config.ts', 'utf8');
check('Native Header: overlaysWebView = false', cap.includes('"overlaysWebView": false'));

// 2. Check useSafeArea (No 32px conflict)
const sa = fs.readFileSync('src/lib/useSafeArea.js', 'utf8');
check('Safe Area: No forced 32px fallback', sa.includes('isAndroid ? 0 : 0') || sa.includes('isAndroid ? 0'));

// 3. Check Voice Recorder (Audio MIME Fix)
const vr = fs.readFileSync('src/components/chat/useVoiceRecorder.js', 'utf8');
check('Audio: Forces audio/mp4', vr.includes('audio/mp4'));

// 4. Check TDZ Fix (Lazy Loading)
['src/screens/Feed.jsx', 'src/screens/PostDetail.jsx'].forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  check(`${f}: Lazy loads PostCommentsSheet`, c.includes('lazy(() => import("../components/PostCommentsSheet"))'));
  check(`${f}: Suspense closed correctly`, c.includes('</Suspense>'));
});
const cv = fs.readFileSync('src/screens/CommunityView.jsx', 'utf8');
check('CommunityView.jsx: Lazy loads PostCommentsSheet', cv.includes('lazy(() => import("../components/PostCommentsSheet"))'));

// 5. Check Meta Voice UI (Structure & Syntax)
const chats = [
  { path: 'src/screens/Chat.jsx', var: 'voiceRecorder' },
  { path: 'src/screens/GroupChat.jsx', var: 'voice' },
  { path: 'src/components/CommunityChat.jsx', var: 'voice' }
];

chats.forEach(c => {
  const code = fs.readFileSync(c.path, 'utf8');
  check(`${c.path}: Trash is outside (shrink-0 text-red-500)`, code.includes('shrink-0 text-red-500'));
  check(`${c.path}: Send is outside (shrink-0 text-purple-500)`, code.includes('shrink-0 text-purple-500'));
  check(`${c.path}: Waveform is clipped (flex-1 min-w-0 h-6)`, code.includes('flex-1 min-w-0 h-6'));
  check(`${c.path}: Map has opening brace {${c.var}.waveform`, code.includes(`{${c.var}.waveform`));
  check(`${c.path}: No rogue JSX comments`, !code.includes('{/* Meta-Style Recording Bar */}'));
});

console.log(`\n==============================`);
console.log(`PASS: ${pass} | FAIL: ${fail}`);
if (fail > 0) {
  console.log(`❌ AUDIT FAILED. DO NOT BUILD.`);
  process.exit(1);
} else {
  console.log(`✅ ALL CHECKS PASSED. Ready for Vite Build.`);
}
