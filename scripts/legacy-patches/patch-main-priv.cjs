const fs = require('fs');
const p = 'src/main.jsx';
let s = fs.readFileSync(p, 'utf8');
function apply(find, replace, label) {
  if (!s.includes(find)) { console.error('❌', label); console.error(JSON.stringify(find.slice(0,120))); process.exit(1); }
  s = s.replace(find, replace);
  console.log('✅', label);
}

apply(
`import { cacheFcmToken, bindDeviceToken } from './lib/deviceToken.js'`,
`import { cacheFcmToken, bindDeviceToken } from './lib/deviceToken.js'
import { PrivacyScreen } from '@capacitor-community/privacy-screen'`,
'import PrivacyScreen');

apply(
`// ---------- Native system bars ----------`,
`// Cold-start safety: force FLAG_SECURE off so a stuck enable from a prior
// session can't block screenshots everywhere in the app.
if (Capacitor.isNativePlatform()) {
  PrivacyScreen.disable().catch(() => {})
}

// ---------- Native system bars ----------`,
'boot disable');

fs.writeFileSync(p, s);
console.log('✅ main.jsx patched');
