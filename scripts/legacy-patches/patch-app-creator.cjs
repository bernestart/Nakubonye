const fs = require('fs');
const p = 'src/App.jsx';
let s = fs.readFileSync(p, 'utf8');
function apply(find, replace, label) {
  if (!s.includes(find)) { console.error('❌', label); console.error(JSON.stringify(find.slice(0,150))); process.exit(1); }
  s = s.replace(find, replace);
  console.log('✅', label);
}

apply(
`import Notifications from './screens/Notifications'`,
`import Notifications from './screens/Notifications'
import CreatorMode from './screens/CreatorMode'`,
'import CreatorMode');

apply(
`        <Route path="/settings/content-audience" element={<Guard><ContentAudience /></Guard>} />`,
`        <Route path="/settings/content-audience" element={<Guard><ContentAudience /></Guard>} />
        <Route path="/settings/creator" element={<Guard><CreatorMode /></Guard>} />`,
'route /settings/creator');

fs.writeFileSync(p, s);
console.log('✅ App.jsx patched');
