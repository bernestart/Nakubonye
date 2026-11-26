#!/usr/bin/env node
// Fix: replaceFn regex must accept optional params — addToHighlight(highlightId).
'use strict';
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'patch-story-viewer.cjs');
const src = fs.readFileSync(p, 'utf8');
const BAD = "const re = new RegExp('async function ' + name + '\\\\(\\\\) \\\\{[\\\\s\\\\S]*?\\\\n  \\\\}\\\\n', 'm');";
const GOOD = "const re = new RegExp('async function ' + name + '\\\\([^)]*\\\\) \\\\{[\\\\s\\\\S]*?\\\\n  \\\\}\\\\n', 'm');";
if (src.includes(GOOD)) { console.log('✓ already fixed'); process.exit(0); }
if (!src.includes(BAD)) { console.error('❌ pattern mismatch — paste output of: grep -n "const re = new RegExp" scripts/patch-story-viewer.cjs'); process.exit(1); }
fs.copyFileSync(p, p + '.bak');
fs.writeFileSync(p, src.replace(BAD, GOOD));
console.log('✅ regex fixed: addToHighlight(highlightId) will match');
