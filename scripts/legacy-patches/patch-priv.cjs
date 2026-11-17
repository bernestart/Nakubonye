const fs = require('fs');
const p = 'src/screens/Chat.jsx';
let s = fs.readFileSync(p, 'utf8');

const find = `  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (viewOnceActive) {
      PrivacyScreen.enable().catch(() => {})
    } else {
      PrivacyScreen.disable().catch(() => {})
    }
    return () => { PrivacyScreen.disable().catch(() => {}) }
  }, [viewOnceActive])`;

const replace = `  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    // Serialize privacy-screen calls to prevent a native race where
    // enable() resolves AFTER disable() and leaves FLAG_SECURE stuck on.
    setPrivacyScreen(!!viewOnceActive)
    return () => { setPrivacyScreen(false) }
  }, [viewOnceActive])`;

if (!s.includes(find)) {
  console.error('❌ PrivacyScreen effect anchor not found');
  process.exit(1);
}
s = s.replace(find, replace);

// Insert the serializer helper right after the imports (top of file).
const impAnchor = `import { PrivacyScreen } from '@capacitor-community/privacy-screen'`;
if (!s.includes(impAnchor)) {
  console.error('❌ import anchor not found');
  process.exit(1);
}
s = s.replace(
  impAnchor,
  impAnchor + `

// Serialize privacy-screen calls: each op waits for the previous to settle
// before running. Prevents the enable()/disable() ordering race on Android.
let __privacyOp = Promise.resolve()
function setPrivacyScreen(on) {
  __privacyOp = __privacyOp
    .then(() => (on ? PrivacyScreen.enable() : PrivacyScreen.disable()))
    .catch(() => {})
  return __privacyOp
}`
);

fs.writeFileSync(p, s);
console.log('✅ Chat.jsx patched');
