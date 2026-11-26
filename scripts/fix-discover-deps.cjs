#!/usr/bin/env node
// Fix: patch-discover.cjs brace counter stopped at useCallback body `}`, leaving the
// original `, [deps])` tail — creating a duplicate dep array.
'use strict';
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'src/screens/Discover.jsx');
const src = fs.readFileSync(p, 'utf8');
const PAT = /(\},\s*\[session\?\.user\?\.id,[^\]]*\])\s*,\s*\[session\?\.user\?\.id,[^\]]*\]\)/g;
const m = src.match(PAT);
if (!m) { console.log('✓ no duplicate deps — nothing to do'); process.exit(0); }
const out = src.replace(PAT, '$1)');
fs.copyFileSync(p, p + '.bak3');
fs.writeFileSync(p, out);
console.log('✅ fixed', m.length, 'duplicate dep array(s) in Discover.jsx');
