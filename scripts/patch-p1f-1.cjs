#!/usr/bin/env node
// P1f-1 (roadmap line 36): rate limits + upload auth. Idempotency/Turnstile/Zod → P1f-2.
// Anchor-checked. Aborts if any route's shape is unexpected. Idempotent.
// Usage: --dry-run | (no flag) apply | --revert
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fp = (r) => path.join(ROOT, r);
const DRY = process.argv.includes('--dry-run');
const REVERT = process.argv.includes('--revert');

const W_PATH = 'backend/_worker.js';
if (!fs.existsSync(fp(W_PATH))) { console.error('❌ missing', W_PATH); process.exit(1); }

if (REVERT) {
  const bak = fp(W_PATH) + '.bak';
  if (fs.existsSync(bak)) { fs.copyFileSync(bak, fp(W_PATH)); console.log('↩️  reverted', W_PATH); }
  process.exit(0);
}

let src = fs.readFileSync(fp(W_PATH), 'utf8');
const before = src;

// Helper: inject a rate-limit block right after `const myId = String(me.id);`
// in the route identified by `headerRegex`. Aborts if header or myId missing.
function injectRateLimit(headerRegex, keyName, limit, windowSec, label) {
  if (src.includes(`rl:${keyName}:`)) {
    console.log(`✓ ${label}: rate limit already present (rl:${keyName}:)`);
    return true;
  }
  const m = src.match(headerRegex);
  if (!m) { console.error(`❌ ${label}: route header not found — aborting.`); return false; }
  const headerEnd = m.index + m[0].length;
  const window30k = src.slice(headerEnd, headerEnd + 3000);
  const myIdAnchor = 'const myId = String(me.id);';
  const myIdOff = window30k.indexOf(myIdAnchor);
  if (myIdOff === -1) { console.error(`❌ ${label}: "${myIdAnchor}" not found within 3KB after route — aborting.`); return false; }
  const insertAt = headerEnd + myIdOff + myIdAnchor.length;
  const snippet = `\n          {\n            const rl = await redisCommand(["INCR", "rl:${keyName}:" + myId]);\n            if (rl.result === 1) await redisCommand(["EXPIRE", "rl:${keyName}:" + myId, ${windowSec}]);\n            if (rl.result > ${limit}) return new Response(JSON.stringify({ success: false, error: "RATE_LIMITED" }), { status: 429, headers: cors });\n          }`;
  src = src.slice(0, insertAt) + snippet + src.slice(insertAt);
  console.log(`✅ ${label}: rate limit ${limit}/${windowSec}s inserted`);
  return true;
}

// === Rate limits on 6 currently-open routes ===
const routes = [
  {
    header: /if \(path === "\/api\/stories" && request\.method === "POST"\) \{/,
    key: 'stories', limit: 10, windowSec: 60, label: 'POST /api/stories',
  },
  {
    header: /if \(path === "\/api\/stories\/views" && request\.method === "POST"\) \{/,
    key: 'storiesviews', limit: 200, windowSec: 60, label: 'POST /api/stories/views',
  },
  {
    header: /if \(\/\^\\\/api\\\/stories\\\/\[0-9a-f-\]\{36\}\\\/reply\$\/\.test\(path\) && request\.method === "POST"\) \{/,
    key: 'storiesreply', limit: 30, windowSec: 60, label: 'POST /api/stories/:id/reply',
  },
  {
    header: /if \(path === "\/api\/stories\/highlights" && request\.method === "POST"\) \{/,
    key: 'storieshighlight', limit: 20, windowSec: 60, label: 'POST /api/stories/highlights',
  },
  {
    header: /if \(path === "\/api\/discover\/swipe" && request\.method === "POST"\) \{/,
    key: 'swipe', limit: 60, windowSec: 60, label: 'POST /api/discover/swipe',
  },
  {
    header: /if \(path === "\/api\/profile\/actions" && request\.method === "POST"\) \{/,
    key: 'profileaction', limit: 60, windowSec: 60, label: 'POST /api/profile/actions',
  },
];
for (const r of routes) {
  if (!injectRateLimit(r.header, r.key, r.limit, r.windowSec, r.label)) process.exit(1);
}

// === Upload auth — defensive insert if missing ===
{
  const header = /if \(path === "\/api\/upload" && request\.method === "POST"\) \{/;
  const m = src.match(header);
  if (!m) {
    console.error('❌ POST /api/upload: route header not found — aborting.');
    process.exit(1);
  }
  const headerEnd = m.index + m[0].length;
  const block = src.slice(headerEnd, headerEnd + 1500);
  if (block.includes('getSessionUser')) {
    console.log('✓ POST /api/upload: session check already present');
  } else {
    // Insert immediately after the opening brace: require session
    const insert = `\n        {\n          const me = await getSessionUser(request, env, url);\n          if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });\n        }`;
    src = src.slice(0, headerEnd) + insert + src.slice(headerEnd);
    console.log('✅ POST /api/upload: session check inserted');
  }
}

// === Verify: no unintended secondary changes ===
if (src === before) {
  console.log('\nℹ️  no changes — everything already patched.');
  process.exit(0);
}

if (DRY) {
  console.log('\n[dry-run] 7 routes ready — nothing written.');
  process.exit(0);
}

const p = fp(W_PATH);
if (!fs.existsSync(p + '.bak')) fs.copyFileSync(p, p + '.bak');
fs.writeFileSync(p + '.tmp', src);
fs.renameSync(p + '.tmp', p);
console.log('\n🎉 P1f-1 applied. 7 routes hardened.');
console.log('   next:  npm run build && git add -A && git commit -m "P1f-1: rate limits + upload auth" && git push');
console.log('   revert: node scripts/patch-p1f-1.cjs --revert');
