const fs = require('fs'), path = require('path'), ROOT = process.cwd();
const checks = [
  { file: 'src/lib/useSafeArea.js', contains: ['export function useSafeArea', "setProperty('--safe-top'"] },
  { file: 'src/App.jsx', contains: ["from './lib/useSafeArea'", 'useSafeArea();'] },
  { file: 'src/index.css', contains: ['--safe-top: 32px'] },
  { file: 'src/screens/CommunityView.jsx', contains: ["minHeight: 'calc(64px + var(--safe-top, 32px))'"] },
  { file: 'src/screens/GroupChat.jsx',     contains: ["minHeight: 'calc(64px + var(--safe-top, 32px))'"] },
  { file: 'src/screens/Chat.jsx',          contains: ["minHeight: 'calc(64px + var(--safe-top, 32px))'"] },
  { file: 'src/screens/Notifications.jsx', contains: ["minHeight: 'calc(64px + var(--safe-top, 32px))'"] },
  { file: 'src/screens/Messages.jsx',      contains: ["paddingTop: 'var(--safe-top, 32px)'"] },
];
let pass = 0, fail = 0;
for (const c of checks) {
  const p = path.join(ROOT, c.file);
  if (!fs.existsSync(p)) { console.log('❌ MISSING:', c.file); fail++; continue; }
  const txt = fs.readFileSync(p, 'utf8');
  const miss = c.contains.filter(s => !txt.includes(s));
  if (miss.length) { console.log('❌ FAIL:', c.file); miss.forEach(m=>console.log('     missing:',m)); fail++; }
  else { console.log('✅ PASS:', c.file); pass++; }
}
console.log('\n' + '='.repeat(60) + `\nPass: ${pass} | Fail: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
