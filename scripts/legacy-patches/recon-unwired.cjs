const fs = require('fs');
const path = require('path');

console.log("=== 1. ROUTING AUDIT (Orphan Screens) ===");
const screens = fs.readdirSync('src/screens').filter(f => f.endsWith('.jsx') && !f.startsWith('_'));
const appContent = fs.readFileSync('src/App.jsx', 'utf8');
let orphans = 0;
screens.forEach(s => {
  const name = s.replace('.jsx', '');
  if (!appContent.includes(`import ${name}`) && !appContent.includes(`./screens/${name}`)) {
    console.log(`  ⚠️ Unrouted Screen: ${s}`);
    orphans++;
  }
});
if (orphans === 0) console.log("  ✅ All screens are routed in App.jsx");

console.log("\n=== 2. DEAD BUTTONS & HANDLERS ===");
const dirs = ['src/screens', 'src/components'];
let deadButtons = 0;
function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) return walk(full);
    if (!full.endsWith('.jsx')) return;
    const code = fs.readFileSync(full, 'utf8');
    if (code.includes('onClick={() => {}}')) {
      console.log(`  ⚠️ Empty onClick in: ${full}`);
      deadButtons++;
    }
  });
}
dirs.forEach(walk);
if (deadButtons === 0) console.log("  ✅ No empty onClick handlers found");

console.log("\n=== 3. UNFINISHED FEATURES (TODOs) ===");
let todos = 0;
function checkTodos(dir) {
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) return checkTodos(full);
    if (!full.endsWith('.jsx') && !full.endsWith('.js')) return;
    const lines = fs.readFileSync(full, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes('TODO') || line.includes('FIXME') || line.includes('Coming soon')) {
        console.log(`  ⚠️ ${full}:${i+1} -> ${line.trim()}`);
        todos++;
      }
    });
  });
}
checkTodos('src/screens');
if (todos === 0) console.log("  ✅ No TODOs found in screens");
