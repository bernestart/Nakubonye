const fs = require('fs'), path = require('path');

// ── 1. FIX AndroidManifest keyboard behavior ──
const mf = 'android/app/src/main/AndroidManifest.xml';
let m = fs.readFileSync(mf, 'utf8');
if (m.includes('windowSoftInputMode')) {
  console.log('⏭  windowSoftInputMode already present');
} else {
  const from = 'android:launchMode="singleTask"';
  const to   = 'android:launchMode="singleTask"\n                                        android:windowSoftInputMode="adjustResize"';
  if (!m.includes(from)) { console.error('❌ activity anchor not found'); process.exit(1); }
  m = m.replace(from, to);
  fs.writeFileSync(mf, m, 'utf8');
  console.log('✅ Manifest patched: adjustResize');
}

// ── 2. MOVE .bak files out of src/ ──
const backupDir = path.join(process.env.HOME, 'nakubonye-backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
let moved = 0;
function sweep(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { sweep(full); continue; }
    if (/\.(bak|bak\d*|broken\.bak|pre-audience|ghostfix|p1-.*)$/i.test(e.name) || e.name.includes('.bak.')) {
      const dest = path.join(backupDir, e.name + '__' + Date.now());
      fs.renameSync(full, dest);
      console.log('  📦', full, '→ backups/');
      moved++;
    }
  }
}
sweep('src');
console.log(`\n✅ ${moved} backup files moved to ${backupDir}`);

// ── 3. VERIFY ──
console.log('\n=== VERIFY ===');
const final = fs.readFileSync(mf, 'utf8');
if (final.includes('android:windowSoftInputMode="adjustResize"')) console.log('✅ Manifest adjustResize confirmed');
else { console.error('❌ Manifest verify failed'); process.exit(1); }

let leftover = 0;
(function chk(d){ if(!fs.existsSync(d))return; for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name); if(e.isDirectory())chk(f); else if(/\.bak/i.test(e.name))leftover++;} })('src');
console.log(leftover === 0 ? '✅ Zero .bak files left in src/' : `⚠️  ${leftover} .bak files remain in src/`);
