const fs = require('fs');

// ── 1. REPAIR Messages.jsx (Remove orphaned finally) ──
const msgPath = 'src/screens/Messages.jsx';
let msg = fs.readFileSync(msgPath, 'utf8');
// Replace the broken finally block with a simple setLoading(false)
msg = msg.replace(/\}\s*finally\s*\{\s*setLoading\(false\)\s*\}/g, 'setLoading(false)');
fs.writeFileSync(msgPath, msg);
console.log('✅ Messages.jsx: Syntax repaired');

// ── 2. REPAIR PostComposer.jsx (Remove broken JSX injection) ──
const pcPath = 'src/components/PostComposer.jsx';
let pc = fs.readFileSync(pcPath, 'utf8');
// Target the exact broken block and replace it with the correct return statement
pc = pc.replace(
  /return \(\s*<div>\s*\{communityId\s*&&\s*\(\s*<div[^>]*>\s*Posting to Community\s*<\/div>\s*\)\}\)\s*=>\s*clearTimeout\(t\)/g, 
  'return () => clearTimeout(t)'
);
fs.writeFileSync(pcPath, pc);
console.log('✅ PostComposer.jsx: Syntax repaired');
