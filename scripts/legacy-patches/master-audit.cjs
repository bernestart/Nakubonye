const fs = require('fs');
const { execSync } = require('child_process');
let pass = 0, fail = 0;

function check(name, condition, details = '') {
  if (condition) { console.log('✅ PASS:', name); pass++; }
  else { console.log('❌ FAIL:', name, details); fail++; }
}

console.log('--- 1. NATIVE ANDROID CONFIG ---');
const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
check('Manifest: adjustResize enabled', manifest.includes('windowSoftInputMode="adjustResize"'));
check('Manifest: Bluetooth perms', manifest.includes('BLUETOOTH_CONNECT'));

const capPath = fs.existsSync('capacitor.config.json') ? 'capacitor.config.json' : 'capacitor.config.ts';
const cap = fs.readFileSync(capPath, 'utf8');
check('Capacitor: overlaysWebView = false', cap.includes('"overlaysWebView": false'));

console.log('\n--- 2. SAFE AREA & HEADERS ---');
const sa = fs.readFileSync('src/lib/useSafeArea.js', 'utf8');
check('Safe Area: No 32px hardcoded fallback', !sa.includes('32'));
check('Safe Area: Injects --safe-top variable', sa.includes("setProperty('--safe-top'"));

console.log('\n--- 3. VOICE RECORDER MIME (No WebM Crash) ---');
const vr = fs.readFileSync('src/components/chat/useVoiceRecorder.js', 'utf8');
check('Audio: Forces audio/mp4', vr.includes('audio/mp4'));

console.log('\n--- 4. TDZ CRASH (Lazy Loading PostCommentsSheet) ---');
const filesWithComments = execSync('grep -rl "PostCommentsSheet" src/').toString().trim().split('\n');
filesWithComments.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  const isImport = code.includes('import PostCommentsSheet from');
  const isLazy = code.includes('lazy(() => import(');
  const hasSuspense = code.includes('<Suspense');
  
  if (isImport) check(`${file}: Uses lazy loading`, isLazy);
  if (code.includes('<PostCommentsSheet')) check(`${file}: Wrapped in Suspense`, hasSuspense);
});

console.log('\n--- 5. META VOICE UI LOCKDOWN ---');
const chats = [
  { path: 'src/screens/Chat.jsx', var: 'voiceRecorder' },
  { path: 'src/screens/GroupChat.jsx', var: 'voice' },
  { path: 'src/components/CommunityChat.jsx', var: 'voice' }
];
chats.forEach(c => {
  const code = fs.readFileSync(c.path, 'utf8');
  check(`${c.path}: Trash outside (shrink-0)`, code.includes('shrink-0 text-red-500'));
  check(`${c.path}: Send outside (shrink-0)`, code.includes('shrink-0 text-purple-500'));
  check(`${c.path}: Waveform clipped (min-w-0)`, code.includes('flex-1 min-w-0 h-6'));
  check(`${c.path}: No rogue JSX comments`, !code.includes('{/* Meta-Style Recording Bar */}'));
  check(`${c.path}: Map syntax correct`, code.includes(`{${c.var}.waveform`));
});

console.log('\n==============================================');
console.log(`TOTAL: PASS ${pass} | FAIL ${fail}`);
if (fail > 0) {
  console.log('❌ AUDIT FAILED. FIX ERRORS BEFORE BUILDING.');
  process.exit(1);
} else {
  console.log('✅ ZERO BUG AUDIT PASSED. READY FOR PRODUCTION BUILD.');
}
