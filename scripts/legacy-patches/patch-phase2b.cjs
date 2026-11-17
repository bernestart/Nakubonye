const fs = require('fs'), path = require('path');

// 1. DELETE dead useVoiceRecorder (components/chat/ is the live one)
const dead = 'src/lib/useVoiceRecorder.js';
if (fs.existsSync(dead)) { fs.unlinkSync(dead); console.log('✅ Deleted dead:', dead); }
else console.log('⏭  Already gone:', dead);

// 2. VERIFY CreateGroup 2a patch landed
const cg = fs.readFileSync('src/screens/CreateGroup.jsx', 'utf8');
if (cg.includes("paddingTop: 'var(--safe-top, 32px)'")) console.log('✅ CreateGroup header OK (2a verified)');
else console.warn('⚠️  CreateGroup header NOT patched — rerun patch-phase2a.cjs');

// 3. GLOBAL REPLACE env() → var() across screens + components
const dirs = ['src/screens', 'src/components'];
const skip = new Set(['src/lib/useSafeArea.js']);
let files = 0, total = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { walk(full); continue; }
    if (!/\.(jsx?|tsx?)$/.test(e.name)) continue;
    if (skip.has(full)) continue;
    const before = fs.readFileSync(full, 'utf8');
    const after = before
      .replaceAll('env(safe-area-inset-top)',    'var(--safe-top, 32px)')
      .replaceAll('env(safe-area-inset-bottom)', 'var(--safe-bottom, 8px)');
    if (after !== before) {
      const n = (before.match(/env\(safe-area-inset-(top|bottom)\)/g) || []).length;
      fs.writeFileSync(full, after, 'utf8');
      console.log(`  ✓ ${full}  (${n} replacements)`);
      files++; total += n;
    }
  }
}
dirs.forEach(walk);
console.log(`\n✅ ${files} files, ${total} replacements`);

// 4. VERIFY — no bare env() remains in screens/components
console.log('\n=== VERIFY ===');
const issues = [];
function verify(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { verify(full); continue; }
    if (!/\.(jsx?|tsx?)$/.test(e.name)) continue;
    if (/env\(safe-area-inset-(top|bottom)\)/.test(fs.readFileSync(full, 'utf8'))) issues.push(full);
  }
}
dirs.forEach(verify);
if (!issues.length) console.log('✅ Zero bare env(safe-area-inset-*) in screens/components');
else { console.log('⚠️  Remaining:'); issues.forEach(f => console.log('   ', f)); }
