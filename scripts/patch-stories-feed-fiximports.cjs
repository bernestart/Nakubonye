#!/usr/bin/env node
// T2 Stories — fix authFetch import. src/lib/authFetch.js is a SIDE-EFFECT module
// (it patches window.fetch). It exports nothing. So we:
//   1. convert  import { authFetch } from "…/authFetch"  →  import "…/authFetch"
//   2. replace authFetch(  →  fetch(   (window.fetch is already patched)
// Anchor-checked, idempotent, backs up to .bak2.

'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fp = (r) => path.join(ROOT, r);
const DRY = process.argv.includes('--dry-run');

const BAD_IMPORT = /^import\s*\{\s*authFetch\s*\}\s*from\s*["']\.\.\/lib\/authFetch["'];?\s*$/m;
const GOOD_IMPORT = 'import "../lib/authFetch";   // side-effect: patches window.fetch to attach Bearer token';

const targets = ['src/components/StoriesRow.jsx', 'src/components/StoryComposer.jsx'];
let changed = 0;

for (const rel of targets) {
  const p = fp(rel);
  if (!fs.existsSync(p)) { console.error('❌ missing', rel); process.exit(1); }
  let src = fs.readFileSync(p, 'utf8');
  const before = src;

  // 1) fix the import
  if (BAD_IMPORT.test(src)) {
    src = src.replace(BAD_IMPORT, GOOD_IMPORT);
  } else if (!src.includes('import "../lib/authFetch"')) {
    console.error(`❌ ${rel}: no authFetch import line found — aborting.`);
    process.exit(1);
  }

  // 2) authFetch(  →  fetch(   — window.fetch is patched to add the token
  src = src.replace(/\bauthFetch\s*\(/g, 'fetch(');

  if (src === before) { console.log(`✓ ${rel}: already correct`); continue; }
  if (DRY) { console.log(`[dry-run] WOULD fix ${rel}`); continue; }
  const bak = p + '.bak2';
  if (!fs.existsSync(bak)) fs.copyFileSync(p, bak);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, src);
  fs.renameSync(tmp, p);
  console.log(`✅ ${rel}: import + call sites fixed`);
  changed++;
}

console.log(changed ? `\n🎉 ${changed} file(s) fixed. next: npm run build` : '\nℹ️  nothing to change.');
