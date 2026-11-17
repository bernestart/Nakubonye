const fs = require('fs'), path = require('path');
const file = 'src/screens/CreateGroup.jsx';
const full = path.join(process.cwd(), file);
const from = `<header style={{ height: 52, flexShrink: 0 }} className="px-3 flex items-center gap-2">`;
const to   = `<header style={{ minHeight: 'calc(52px + var(--safe-top, 32px))', flexShrink: 0, paddingTop: 'var(--safe-top, 32px)' }} className="px-3 flex items-center gap-2">`;

let c = fs.readFileSync(full, 'utf8');
if (c.includes(to)) { console.log('⏭  Already patched'); process.exit(0); }
if (!c.includes(from)) { console.error('❌ Pattern not found'); process.exit(1); }
c = c.replace(from, to);
fs.writeFileSync(full, c, 'utf8');
console.log('✅ CreateGroup.jsx header patched');

// Verify
const after = fs.readFileSync(full, 'utf8');
if (after.includes("paddingTop: 'var(--safe-top, 32px)'")) console.log('✅ Verify PASS');
else { console.error('❌ Verify FAIL'); process.exit(1); }
