#!/usr/bin/env node
// T2: fully remove Supabase storage from the Stories pipeline. Telegram-only media.
// Safest possible: brace-counted function replacement (not regex), pre-flight report,
// .bak backup, abort if any anchor misses, --dry-run / --revert.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fp = (r) => path.join(ROOT, r);
const DRY = process.argv.includes('--dry-run');
const REVERT = process.argv.includes('--revert');

const FILES = {
  api: 'src/lib/api.js',
  storyUpload: 'src/lib/storyUpload.js',
  composer: 'src/components/StoryComposer.jsx',
  viewer: 'src/components/StoryViewer.jsx',
};

if (REVERT) {
  for (const rel of Object.values(FILES)) {
    const bak = fp(rel) + '.bak';
    if (fs.existsSync(bak)) { fs.copyFileSync(bak, fp(rel)); console.log('↩️  reverted', rel); }
  }
  process.exit(0);
}

const src = {};
for (const [k, rel] of Object.entries(FILES)) {
  if (!fs.existsSync(fp(rel))) { console.error('❌ missing', rel); process.exit(1); }
  src[k] = fs.readFileSync(fp(rel), 'utf8');
}

// --- report current state ---
console.log('=== current supabase refs ===');
for (const [k, rel] of Object.entries(FILES)) {
  const n = (src[k].match(/supabase\./g) || []).length;
  console.log(`  ${rel}: ${n}`);
}

// Brace-counted function replacer (robust against nested braces, minified or prettified)
function replaceFunction(text, namePattern, newBody) {
  const re = new RegExp(namePattern);
  const m = text.match(re);
  if (!m) return { ok: false, reason: 'header not found' };
  const start = m.index;
  let i = m.index + m[0].length - 1;
  let depth = 0;
  // Advance through the header to find the first '{'
  while (i < text.length && text[i] !== '{') i++;
  if (i >= text.length) return { ok: false, reason: 'opening brace not found' };
  depth = 1;
  while (i < text.length - 1 && depth > 0) {
    i++;
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
  }
  if (depth !== 0) return { ok: false, reason: 'unbalanced braces' };
  return { ok: true, out: text.slice(0, start) + newBody + text.slice(i + 1) };
}

// ============ PATCH 1: api.js — drop Supabase fallback in getMediaUrl ============
const API_OLD = 'return supabase.storage.from(bucket).getPublicUrl(path).data?.publicUrl;';
const API_NEW = 'return null; // no Supabase fallback — legacy non-Telegram path unresolvable';
if (src.api.includes(API_OLD)) {
  src.api = src.api.replace(API_OLD, API_NEW);
  console.log('✅ api.js: getMediaUrl supabase fallback removed');
} else if (src.api.includes(API_NEW)) {
  console.log('✓ api.js: already patched');
} else {
  console.error('❌ api.js: getMediaUrl anchor missing — aborting.');
  process.exit(1);
}
if (!/supabase\./.test(src.api)) {
  src.api = src.api.replace(/^import[^\n]*supabase[^\n]*\n/gm, '');
  console.log('   + supabase import removed from api.js');
}

// ============ PATCH 2: storyUpload.js — delegate to Telegram via uploadMedia ============
const SU_NEW = `export async function uploadStoryMedia(blobOrBuffer, ext, contentType, myId) {
  // T2: stories use the same Telegram proxy as chat — no Supabase storage.
  const { uploadMedia } = await import("./api");
  const blob = blobOrBuffer instanceof Blob ? blobOrBuffer : new Blob([blobOrBuffer], { type: contentType || "image/jpeg" });
  return uploadMedia(blob); // returns Telegram file_id
}`;
if (/Telegram proxy as chat/.test(src.storyUpload)) {
  console.log('✓ storyUpload.js: already patched');
} else {
  const r = replaceFunction(
    src.storyUpload,
    'export\\s+async\\s+function\\s+uploadStoryMedia\\s*\\([^)]*\\)\\s*',
    SU_NEW
  );
  if (!r.ok) { console.error('❌ storyUpload.js: uploadStoryMedia (' + r.reason + ') — aborting.'); process.exit(1); }
  src.storyUpload = r.out;
  console.log('✅ storyUpload.js: uploadStoryMedia → uploadMedia (Telegram)');
}
if (!/supabase\./.test(src.storyUpload)) {
  src.storyUpload = src.storyUpload.replace(/^import[^\n]*supabase[^\n]*\n/gm, '');
  console.log('   + supabase import removed from storyUpload.js');
}

// ============ PATCH 3: StoryComposer.jsx — getPublicUrl → getMediaUrl ============
const COMP_OLD_RE = /const\s*\{\s*data:\s*pub\s*\}\s*=\s*supabase\s*\.\s*storage\s*\.\s*from\([^)]*\)\s*\.\s*getPublicUrl\s*\(\s*path\s*\)/;
const COMP_NEW = 'const pub = { publicUrl: getMediaUrl(path) }';
if (COMP_OLD_RE.test(src.composer)) {
  src.composer = src.composer.replace(COMP_OLD_RE, COMP_NEW);
  console.log('✅ StoryComposer.jsx: getPublicUrl → getMediaUrl');
} else if (src.composer.includes('getMediaUrl(path)')) {
  console.log('✓ StoryComposer.jsx: already patched');
} else {
  console.error('❌ StoryComposer.jsx: getPublicUrl anchor missing — aborting.'); process.exit(1);
}
// Ensure getMediaUrl import
if (!/import[^;]*getMediaUrl[^;]*from[^;]*\/api["']/.test(src.composer)) {
  const impAnchor = 'import { base64ToBlob, uploadStoryMedia } from "../lib/storyUpload"';
  if (src.composer.includes(impAnchor)) {
    src.composer = src.composer.replace(impAnchor, impAnchor + '\nimport { getMediaUrl } from "../lib/api"');
    console.log('   + getMediaUrl import added to StoryComposer.jsx');
  } else {
    console.error('❌ StoryComposer.jsx: cannot anchor getMediaUrl import — aborting.'); process.exit(1);
  }
}
if (!/supabase\./.test(src.composer)) {
  src.composer = src.composer.replace(/^import[^\n]*supabase[^\n]*\n/gm, '');
  console.log('   + supabase import removed from StoryComposer.jsx');
}

// ============ PATCH 4: StoryViewer.jsx ============
// 4a: sendMediaReply — same getPublicUrl fix
if (COMP_OLD_RE.test(src.viewer)) {
  src.viewer = src.viewer.replace(COMP_OLD_RE, COMP_NEW);
  console.log('✅ StoryViewer.jsx: getPublicUrl (reply) → getMediaUrl');
} else if (src.viewer.includes('getMediaUrl(path)')) {
  console.log('✓ StoryViewer.jsx: reply already patched');
} else {
  console.error('❌ StoryViewer.jsx: reply getPublicUrl anchor missing — aborting.'); process.exit(1);
}
// Ensure getMediaUrl import
if (!/import[^;]*getMediaUrl[^;]*from[^;]*\/api["']/.test(src.viewer)) {
  const impAnchor2 = 'import { publicPhotoUrl } from "../lib/photo"';
  if (src.viewer.includes(impAnchor2)) {
    src.viewer = src.viewer.replace(impAnchor2, impAnchor2 + '\nimport { getMediaUrl } from "../lib/api"');
    console.log('   + getMediaUrl import added to StoryViewer.jsx');
  } else {
    console.error('❌ StoryViewer.jsx: cannot anchor getMediaUrl import — aborting.'); process.exit(1);
  }
}

// 4b: deleteStory — remove storage.remove, keep DB delete via /api/stories/:id
const DS_NEW = `async function deleteStory() {
  if (!story || !isMine || deleting) return;
  if (!confirm("Delete this story?")) return;
  setDeleting(true);
  tap("light");
  try {
    // T2: Telegram media (file_id) has no delete API on free tier. Deleting the
    // DB row is sufficient — the file_id becomes unreachable. Media GC deferred to P6 (R2).
    const res = await fetch("/api/stories/" + story.id, { method: "DELETE" });
    const j = await res.json();
    if (!j.success) throw new Error(j.error || "Failed");
    setDeleting(false);
    setMenuOpen(false);
    const list = group?.stories || [];
    if (list.length > 1) {
      onViewed?.(group.user_id, story.id);
      if (storyIdx < list.length - 1) {
        setStoryIdx(storyIdx + 1);
        setProgress(0);
        startRef.current = Date.now();
        accumulatedRef.current = 0;
      } else close();
    } else close();
  } catch (e) {
    console.warn("delete story failed", e);
    setDeleting(false);
  }
}`;
if (src.viewer.includes('Media GC deferred to P6')) {
  console.log('✓ StoryViewer.jsx: deleteStory already patched');
} else {
  const r = replaceFunction(src.viewer, 'async\\s+function\\s+deleteStory\\s*\\([^)]*\\)\\s*', DS_NEW);
  if (!r.ok) { console.error('❌ StoryViewer.jsx: deleteStory (' + r.reason + ') — aborting.'); process.exit(1); }
  src.viewer = r.out;
  console.log('✅ StoryViewer.jsx: deleteStory — storage.remove dropped');
}
if (!/supabase\./.test(src.viewer)) {
  src.viewer = src.viewer.replace(/^import[^\n]*supabase[^\n]*\n/gm, '');
  console.log('   + supabase import removed from StoryViewer.jsx');
}

// ============ Final verify ============
let total = 0;
for (const [k, rel] of Object.entries(FILES)) {
  const n = (src[k].match(/supabase\./g) || []).length;
  if (n > 0) { console.error(`❌ ${rel}: still ${n} supabase refs`); total += n; }
}
if (total > 0) { console.error('\nAborting — nothing written.'); process.exit(1); }

if (DRY) { console.log('\n[dry-run] 4 files ready — nothing written.'); process.exit(0); }

for (const [k, rel] of Object.entries(FILES)) {
  const p = fp(rel);
  if (!fs.existsSync(p + '.bak')) fs.copyFileSync(p, p + '.bak');
  fs.writeFileSync(p + '.tmp', src[k]);
  fs.renameSync(p + '.tmp', p);
  console.log('✅ wrote', rel);
}
console.log('\n🎉 Supabase storage fully removed. Media is 100% Telegram / free-tier.');
console.log('   next:  npm run build && git add -A && git commit -m "T2: drop Supabase storage — Telegram-only media" && git push');
console.log('   revert: node scripts/patch-leave-supabase-storage.cjs --revert');
