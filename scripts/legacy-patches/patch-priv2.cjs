const fs = require('fs');
const p = 'src/screens/Chat.jsx';
let s = fs.readFileSync(p, 'utf8');

// 1. Remove the plugin import
const importLine = `import { PrivacyScreen } from '@capacitor-community/privacy-screen'\n`;
if (!s.includes(importLine)) { console.error('❌ import line not found'); process.exit(1); }
s = s.replace(importLine, '');

// 2. Remove the serializer helper
const helperBlock = `
// Serialize privacy-screen calls: each op waits for the previous to settle
// before running. Prevents the enable()/disable() ordering race on Android.
let __privacyOp = Promise.resolve()
function setPrivacyScreen(on) {
  __privacyOp = __privacyOp
    .then(() => (on ? PrivacyScreen.enable() : PrivacyScreen.disable()))
    .catch(() => {})
  return __privacyOp
}`;
if (!s.includes(helperBlock)) { console.error('❌ helper block not found'); process.exit(1); }
s = s.replace(helperBlock, '');

// 3. Replace the effect with a no-op (view-once protects via overlay only)
const effectBlock = `  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    // Serialize privacy-screen calls to prevent a native race where
    // enable() resolves AFTER disable() and leaves FLAG_SECURE stuck on.
    setPrivacyScreen(!!viewOnceActive)
    return () => { setPrivacyScreen(false) }
  }, [viewOnceActive])`;
const effectNew = `  // NOTE: native FLAG_SECURE toggling was removed — @capacitor-community/
  // privacy-screen left FLAG_SECURE stuck ON across the app after view-once
  // closed. View-once is now protected by the full-screen overlay only.`;
if (!s.includes(effectBlock)) { console.error('❌ effect block not found'); process.exit(1); }
s = s.replace(effectBlock, effectNew);

fs.writeFileSync(p, s);
console.log('✅ PrivacyScreen usage removed from Chat.jsx');
