const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
let changes = 0, errors = 0;

function read(p){const f=path.join(ROOT,p);if(!fs.existsSync(f)){console.error('❌ Missing:',p);errors++;return null}return fs.readFileSync(f,'utf8')}
function write(p,c){fs.writeFileSync(path.join(ROOT,p),c,'utf8');changes++}

// 1. CREATE HOOK
const hook = 'src/lib/useSafeArea.js';
if (fs.existsSync(path.join(ROOT, hook))) {
  console.log('⏭  Hook exists:', hook);
} else {
  write(hook, `import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function useSafeArea() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const root = document.documentElement;
    const isAndroid = Capacitor.getPlatform() === 'android';

    function probeEnv(side) {
      const el = document.createElement('div');
      el.style.cssText =
        'position:fixed;top:0;left:0;width:1px;height:0;' +
        'padding-top:env(safe-area-inset-' + side + ',0px);' +
        'visibility:hidden;pointer-events:none;';
      document.body.appendChild(el);
      const h = el.getBoundingClientRect().height;
      document.body.removeChild(el);
      return h;
    }

    const cs = getComputedStyle(root);
    const pluginTop = parseFloat(cs.getPropertyValue('--safe-area-inset-top')) || 0;
    const pluginBottom = parseFloat(cs.getPropertyValue('--safe-area-inset-bottom')) || 0;
    const envTop = probeEnv('top');
    const envBottom = probeEnv('bottom');

    const safeTop = Math.max(envTop, pluginTop, isAndroid ? 32 : 0);
    const safeBottom = Math.max(envBottom, pluginBottom, isAndroid ? 8 : 0);

    root.style.setProperty('--safe-top', safeTop + 'px');
    root.style.setProperty('--safe-bottom', safeBottom + 'px');
    console.log('[useSafeArea]', { isAndroid, envTop, envBottom, pluginTop, pluginBottom, safeTop, safeBottom });
  }, []);
}
`);
  console.log('✅ Created:', hook);
}

// 2. PATCH APP.JSX — import + call
{
  let c = read('src/App.jsx');
  if (c) {
    if (!c.includes("from './lib/useSafeArea'")) {
      const from = "import { useEffect, useState } from 'react'\n";
      const to   = "import { useEffect, useState } from 'react'\nimport { useSafeArea } from './lib/useSafeArea'\n";
      if (c.includes(from)) { c = c.replace(from, to); console.log('  ✓ App.jsx import added'); }
      else { console.error('  ❌ React import line not found'); errors++; }
    } else console.log('  ⏭  App.jsx import already present');

    if (!c.includes('useSafeArea();\n  return (')) {
      const from = 'export default function App() {\n  return (';
      const to   = 'export default function App() {\n  useSafeArea();\n  return (';
      if (c.includes(from)) { c = c.replace(from, to); console.log('  ✓ App.jsx hook call added'); }
      else { console.error('  ❌ App() signature not found'); errors++; }
    } else console.log('  ⏭  App.jsx hook call already present');
    write('src/App.jsx', c);
  }
}

// 3. PATCH INDEX.CSS — :root fallback vars
{
  let c = read('src/index.css');
  if (c) {
    if (!c.includes('--safe-top: 32px')) {
      const i = c.indexOf('}\n', c.indexOf('@theme'));
      if (i > 0) {
        c = c.slice(0, i+2) + '\n:root {\n  --safe-top: 32px;\n  --safe-bottom: 8px;\n}\n' + c.slice(i+2);
        console.log('  ✓ index.css :root fallback added');
      } else { console.error('  ❌ @theme closing brace not found'); errors++; }
    } else console.log('  ⏭  index.css :root already present');
    write('src/index.css', c);
  }
}

// 4. PATCH HEADERS — exact string replacements
const headerPatches = [
  { file: 'src/screens/CommunityView.jsx',
    from: `<header style={{ height: 64, flexShrink: 0, paddingTop: "max(env(safe-area-inset-top), 24px)" }} className="px-3 flex items-center gap-2">`,
    to:   `<header style={{ minHeight: 'calc(64px + var(--safe-top, 32px))', flexShrink: 0, paddingTop: 'var(--safe-top, 32px)' }} className="px-3 flex items-center gap-2">` },
  { file: 'src/screens/GroupChat.jsx',
    from: `<header style={{ height: 64, flexShrink: 0, paddingTop: "max(env(safe-area-inset-top), 24px)" }} className="px-3 flex items-center gap-2">`,
    to:   `<header style={{ minHeight: 'calc(64px + var(--safe-top, 32px))', flexShrink: 0, paddingTop: 'var(--safe-top, 32px)' }} className="px-3 flex items-center gap-2">` },
  { file: 'src/screens/Chat.jsx',
    from: `<header style={{ height: 64, flexShrink: 0, paddingTop: "max(env(safe-area-inset-top), 28px)" }} className="px-3 flex items-center gap-2">`,
    to:   `<header style={{ minHeight: 'calc(64px + var(--safe-top, 32px))', flexShrink: 0, paddingTop: 'var(--safe-top, 32px)' }} className="px-3 flex items-center gap-2">` },
  { file: 'src/screens/Notifications.jsx',
    from: `<header style={{ height: 64, flexShrink: 0, paddingTop: "max(env(safe-area-inset-top), 24px)" }} className="px-3 flex items-center gap-2">`,
    to:   `<header style={{ minHeight: 'calc(64px + var(--safe-top, 32px))', flexShrink: 0, paddingTop: 'var(--safe-top, 32px)' }} className="px-3 flex items-center gap-2">` },
  { file: 'src/screens/Messages.jsx',
    from: `<div className="px-4 pb-3 shrink-0 flex items-center justify-between" style={{ paddingTop: "max(env(safe-area-inset-top), 24px)" }}>`,
    to:   `<div className="px-4 pb-3 shrink-0 flex items-center justify-between" style={{ paddingTop: 'var(--safe-top, 32px)' }}>` },
];
for (const p of headerPatches) {
  let c = read(p.file); if (!c) continue;
  if (c.includes(p.to)) { console.log('  ⏭  Already patched:', p.file); continue; }
  if (!c.includes(p.from)) { console.error('  ❌ Pattern not found:', p.file); errors++; continue; }
  c = c.replace(p.from, p.to); write(p.file, c);
  console.log('  ✓ Patched:', p.file);
}

// 5. REPORT CREATEGROUP.JSX
if (fs.existsSync(path.join(ROOT, 'src/screens/CreateGroup.jsx'))) {
  const lines = fs.readFileSync(path.join(ROOT, 'src/screens/CreateGroup.jsx'), 'utf8').split('\n');
  console.log('\n📋 CreateGroup.jsx header candidates:');
  lines.forEach((line, i) => {
    if (/<header|paddingTop.*safe-area/.test(line)) console.log(`   L${i+1}: ${line.trim()}`);
  });
}

console.log('\n' + '='.repeat(60));
console.log(`Changes: ${changes} | Errors: ${errors}`);
if (errors > 0) { console.log('❌ PATCH INCOMPLETE'); process.exit(1); }
console.log('✅ PHASE 1 PATCH COMPLETE');
