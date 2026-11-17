const fs = require('fs');
let pass = 0, fail = 0;
function check(name, condition) {
  if (condition) { console.log('✅ PASS:', name); pass++; }
  else { console.log('❌ FAIL:', name); fail++; }
}

// 1. Capacitor Config
const cap = fs.readFileSync(fs.existsSync('capacitor.config.json') ? 'capacitor.config.json' : 'capacitor.config.ts', 'utf8');
check('Native Header: overlaysWebView = false', cap.includes('"overlaysWebView": false'));

// 2. Safe Area
const sa = fs.readFileSync('src/lib/useSafeArea.js', 'utf8');
check('Safe Area: No 32px fallback', !sa.includes('32'));

// 3. Audio MIME
const vr = fs.readFileSync('src/components/chat/useVoiceRecorder.js', 'utf8');
check('Audio: Forces audio/mp4', vr.includes('audio/mp4'));

// 4. TDZ Fix
['src/screens/Feed.jsx', 'src/screens/PostDetail.jsx', 'src/components/CommunityFeed.jsx'].forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  check(`${f}: Lazy loads PostCommentsSheet`, c.includes('lazy(() => import('));
  check(`${f}: Suspense closed correctly`, c.includes('</Suspense>'));
});

// 5. Meta Voice UI
const chats = [
  { path: 'src/screens/Chat.jsx', var: 'voiceRecorder' },
  { path: 'src/screens/GroupChat.jsx', var: 'voice' },
  { path: 'src/components/CommunityChat.jsx', var: 'voice' }
];
chats.forEach(c => {
  const code = fs.readFileSync(c.path, 'utf8');
  check(`${c.path}: Trash outside`, code.includes('shrink-0 text-red-500'));
  check(`${c.path}: Send outside`, code.includes('shrink-0 text-purple-500'));
  check(`${c.path}: Waveform clipped`, code.includes('flex-1 min-w-0 h-6'));
  check(`${c.path}: Map brace`, code.includes(`{${c.var}.waveform`));
  check(`${c.path}: No rogue comments`, !code.includes('{/* Meta-Style Recording Bar */}'));
});

console.log(`\n==============================`);
console.log(`PASS: ${pass} | FAIL: ${fail}`);
if (fail > 0) process.exit(1);
else console.log(`✅ ALL CHECKS PASSED. Ready for Vite Build.`);
