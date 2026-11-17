const fs = require('fs');
const p = 'src/screens/Chat.jsx';
let s = fs.readFileSync(p, 'utf8');
function apply(find, replace, label) {
  if (!s.includes(find)) { console.error('❌', label); console.error(JSON.stringify(find.slice(0,120))); process.exit(1); }
  s = s.replace(find, replace);
  console.log('✅', label);
}

apply(
`import { Capacitor } from '@capacitor/core'`,
`import { Capacitor } from '@capacitor/core'
import { PrivacyScreen } from '@capacitor-community/privacy-screen'

// Serialized privacy-screen toggle — one native call at a time to avoid the
// Android race that can leave FLAG_SECURE stuck after disable().
let __privacyOp = Promise.resolve()
function setPrivacyScreen(on) {
  __privacyOp = __privacyOp
    .then(() => (on ? PrivacyScreen.enable() : PrivacyScreen.disable()))
    .catch(() => {})
  return __privacyOp
}`,
'import + serializer');

apply(
`  const [viewOnceActive, setViewOnceActive] = useState(null)`,
`  const [viewOnceActive, setViewOnceActive] = useState(null)

  // View-once only: enable FLAG_SECURE while the modal is open, disable on close.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    setPrivacyScreen(!!viewOnceActive)
  }, [viewOnceActive])`,
'view-once effect');

fs.writeFileSync(p, s);
console.log('✅ Chat.jsx patched');
