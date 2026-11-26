#!/usr/bin/env node
// T2: Discover migration. Adds 3 worker routes, rewrites Discover.jsx (0 supabase).
// Requires: migration 2026-11-26-discover-v2 already run in Neon.
// Usage: --dry-run | (no flag) apply | --revert
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fp = (r) => path.join(ROOT, r);
const DRY = process.argv.includes('--dry-run');
const REVERT = process.argv.includes('--revert');

const FILES = { worker: 'backend/_worker.js', discover: 'src/screens/Discover.jsx' };

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

// ============ PATCH 1 — Worker: 3 routes inserted before /api/discover DELETE anchor ============
const W_ANCHOR = '      if (/^\\/api\\/stories\\/[0-9a-f-]{36}$/.test(path) && request.method === "DELETE") {';
if (!src.worker.includes(W_ANCHOR)) { console.error('❌ worker anchor missing'); process.exit(1); }
if (src.worker.includes('/api/discover/profiles')) { console.error('❌ worker already patched'); process.exit(1); }

const DISCOVER_ROUTES = String.raw`      // T2: Discover — server-side filtered feed (Redis 60s cache)
      if (path === "/api/discover/profiles" && request.method === "GET") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 50);
        const flags = ["sameCity","sharedInterests","sameCountry","verifiedOnly","onlineOnly"].map(k => url.searchParams.get(k) === "1");
        const communityId = url.searchParams.get("communityId");
        try {
          const cacheKey = "discover:profiles:" + myId + ":" + limit + ":" + flags.join(",") + ":" + (communityId || "");
          try {
            const cached = await redisCommand(["GET", cacheKey]);
            if (cached && cached.result) return new Response(cached.result, { headers: { ...cors, "Content-Type": "application/json", "X-Cache": "HIT" } });
          } catch {}
          const r = await queryDatabase(
            "SELECT * FROM get_discover_profiles($1::uuid, $2::int, $3::boolean, $4::boolean, $5::boolean, $6::boolean, $7::boolean, $8::bigint)",
            [myId, limit, flags[0], flags[1], flags[2], flags[3], flags[4], communityId ? Number(communityId) : null]
          );
          const rows = r.rows || [];
          const ids = rows.map(x => x.id);
          let storySet = new Set();
          if (ids.length) {
            const sRes = await queryDatabase(
              "SELECT DISTINCT user_id FROM stories WHERE expires_at > NOW() AND user_id = ANY($1::uuid[])",
              [ids]
            ).catch(() => ({ rows: [] }));
            storySet = new Set((sRes.rows || []).map(x => String(x.user_id)));
          }
          const data = rows.map(x => {
            let age = null;
            if (x.date_of_birth) {
              const dob = new Date(x.date_of_birth);
              const diff = Date.now() - dob.getTime();
              age = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
            }
            return {
              id: x.id, display_name: x.display_name, username: x.username,
              age, date_of_birth: x.date_of_birth, city: x.city, country: x.country,
              bio: x.bio, is_verified: !!x.is_verified,
              primary_photo: x.primary_photo, last_seen_at: x.last_seen_at,
              is_boosted: !!x.is_boosted, hasStory: storySet.has(String(x.id)),
              _canSeeLocation: true, _canSeeOnline: true,
            };
          });
          const payload = JSON.stringify({ success: true, data });
          try { await redisCommand(["SETEX", cacheKey, 60, payload]); } catch {}
          return new Response(payload, { headers: { ...cors, "Content-Type": "application/json", "X-Cache": "MISS" } });
        } catch (err) {
          console.error("[DISCOVER/PROFILES]", err.message);
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
      // T2: Discover swipe — records swipe + calls like_user/decline_like + returns match card
      if (path === "/api/discover/swipe" && request.method === "POST") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        try {
          const body = await request.json();
          const targetId = String(body.targetId || "");
          const action = String(body.action || "");
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) return new Response(JSON.stringify({ success: false, error: "BAD_TARGET" }), { status: 400, headers: cors });
          if (myId === targetId) return new Response(JSON.stringify({ success: false, error: "SELF_ACTION" }), { status: 400, headers: cors });
          if (!["like","pass"].includes(action)) return new Response(JSON.stringify({ success: false, error: "BAD_ACTION" }), { status: 400, headers: cors });
          await queryDatabase(
            "INSERT INTO swipes (swiper_id, target_id, action) VALUES ($1::uuid, $2::uuid, $3) ON CONFLICT (swiper_id, target_id) DO UPDATE SET action = EXCLUDED.action",
            [myId, targetId, action]
          );
          try { await redisCommand(["DEL", "discover:profiles:" + myId + ":20:false,false,false,false,false:"]); } catch {}
          if (action === "like") {
            const lr = await queryDatabase("SELECT like_user($1::uuid, $2::uuid) AS result", [myId, targetId]);
            const result = lr.rows[0]?.result || {};
            let match_card = null;
            if (result && result.matched) {
              const cr = await queryDatabase(
                "SELECT p.id, p.display_name, p.username, p.is_verified, p.last_seen_at, (SELECT storage_path FROM profile_photos WHERE user_id = p.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) AS primary_photo FROM profiles p WHERE p.id = $1::uuid",
                [targetId]
              );
              match_card = cr.rows[0] || null;
            }
            return new Response(JSON.stringify({ success: true, data: { ...result, match_card } }), { headers: { ...cors, "Content-Type": "application/json" } });
          }
          await queryDatabase("SELECT decline_like($1::uuid, $2::uuid)", [myId, targetId]).catch(() => {});
          return new Response(JSON.stringify({ success: true, data: { matched: false } }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          console.error("[DISCOVER/SWIPE]", err.message);
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
      // T2: Undo swipe
      if (/^\/api\/discover\/swipe\/[0-9a-f-]{36}$/.test(path) && request.method === "DELETE") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        const targetId = path.split("/")[4];
        try {
          await queryDatabase("DELETE FROM swipes WHERE swiper_id = $1::uuid AND target_id = $2::uuid", [myId, targetId]);
          try { await redisCommand(["DEL", "discover:profiles:" + myId + ":20:false,false,false,false,false:"]); } catch {}
          return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
`;

src.worker = src.worker.replace(W_ANCHOR, DISCOVER_ROUTES + W_ANCHOR);

// ============ PATCH 2 — Discover.jsx ============
const D = src.discover;
// brace-counted function replacer
function replaceFn(text, headerRegex, newBody) {
  const m = text.match(headerRegex);
  if (!m) return { ok: false };
  const start = m.index;
  let i = start + m[0].length - 1;
  while (i < text.length && text[i] !== '{') i++;
  if (i >= text.length) return { ok: false };
  let depth = 1;
  while (i < text.length - 1 && depth > 0) {
    i++;
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
  }
  if (depth !== 0) return { ok: false };
  return { ok: true, out: text.slice(0, start) + newBody + text.slice(i + 1) };
}

// 2a: drop supabase import
if (!D.includes(`import { supabase } from '../lib/supabase'`)) {
  console.error('❌ Discover.jsx: supabase import anchor missing'); process.exit(1);
}

// 2b: delete decorateLocationVisibility (top-level)
let r1 = replaceFn(D, /async function decorateLocationVisibility\s*\([^)]*\)\s*/, '');
if (!r1.ok) { console.error('❌ decorateLocationVisibility not found'); process.exit(1); }
let d2 = r1.out.replace(/^\n\n/, '\n');
// 2c: delete decorateOnlineVisibility
let r2 = replaceFn(d2, /async function decorateOnlineVisibility\s*\([^)]*\)\s*/, '');
if (!r2.ok) { console.error('❌ decorateOnlineVisibility not found'); process.exit(1); }
d2 = r2.out.replace(/^\n\n/, '\n');

// 2d: replace load function body
const NEW_LOAD = `const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true); setError('')
    try {
      const qs = new URLSearchParams({ limit: '20' })
      if (sameCity) qs.set('sameCity', '1')
      if (sharedInterests) qs.set('sharedInterests', '1')
      if (sameCountry) qs.set('sameCountry', '1')
      if (verifiedOnly) qs.set('verifiedOnly', '1')
      if (onlineOnly) qs.set('onlineOnly', '1')
      if (communityId) qs.set('communityId', communityId)
      const res = await fetch('/api/discover/profiles?' + qs.toString())
      const j = await res.json()
      if (!j.success) { setError(j.error || 'Failed to load'); setLoading(false); return }
      const list = (j.data || []).map((r) => ({
        ...r,
        photo_url: r.primary_photo ? publicPhotoUrl(r.primary_photo) : null,
      }))
      setCards(list)
    } catch (e) {
      setError(e.message || 'Network error')
    }
    setLoading(false)
  }, [session?.user?.id, sameCity, sharedInterests, sameCountry, verifiedOnly, onlineOnly, communityId])`;
const r3 = replaceFn(d2, /const load = useCallback\s*\([^)]*\)\s*=>\s*/, NEW_LOAD);
if (!r3.ok) { console.error('❌ load() not found'); process.exit(1); }
d2 = r3.out;

// 2e: delete the realtime match-celebration useEffect
const REAL_ANCHOR = /  \/\/ Realtime: celebrate any new match involving me[\s\S]*?  \}, \[session\?\.user\?\.id\]\)\n/;
if (!REAL_ANCHOR.test(d2)) { console.error('❌ realtime block anchor missing'); process.exit(1); }
d2 = d2.replace(REAL_ANCHOR, '');

// 2f: replace recordSwipe / handlePass / handleLike / handleUndo
const r4 = replaceFn(d2, /async function recordSwipe\s*\([^)]*\)\s*/, `async function recordSwipe() { /* handled server-side in /api/discover/swipe */ }`);
if (!r4.ok) { console.error('❌ recordSwipe not found'); process.exit(1); }
d2 = r4.out;

const NEW_PASS = `async function handlePass() {
    if (busy) return
    const card = cards[0]; if (!card) return
    tap('light'); setBusy(true)
    setCards((c) => c.slice(1))
    setUndoStack((s) => [...s, { card, action: 'pass' }])
    try {
      await fetch('/api/discover/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: card.id, action: 'pass' }),
      })
    } catch {}
    setBusy(false)
  }`;
const r5 = replaceFn(d2, /async function handlePass\s*\([^)]*\)\s*/, NEW_PASS);
if (!r5.ok) { console.error('❌ handlePass not found'); process.exit(1); }
d2 = r5.out;

const NEW_LIKE = `async function handleLike() {
    if (busy) return
    const card = cards[0]; if (!card) return
    tap('medium'); setBusy(true)
    setCards((c) => c.slice(1))
    setUndoStack((s) => [...s, { card, action: 'like' }])
    try {
      const res = await fetch('/api/discover/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: card.id, action: 'like' }),
      })
      const j = await res.json()
      if (!j.success) {
        setError(j.error || 'Swipe failed')
        setCards((c) => [card, ...c])
        setUndoStack((st) => st.slice(0, -1))
        setBusy(false)
        return
      }
      if (j.data?.denied) {
        setCards((c) => [card, ...c])
        setUndoStack((st) => st.slice(0, -1))
        setError(j.data.reason || "This user isn't accepting new requests")
        setBusy(false)
        return
      }
      if (j.data?.matched && j.data.match_card) {
        tap('match')
        setMatchModal({
          ...j.data.match_card,
          photo_url: publicPhotoUrl(j.data.match_card.primary_photo),
        })
      }
    } catch (e) {
      setError(e.message || 'Network error')
      setCards((c) => [card, ...c])
      setUndoStack((st) => st.slice(0, -1))
    }
    setBusy(false)
  }`;
const r6 = replaceFn(d2, /async function handleLike\s*\([^)]*\)\s*/, NEW_LIKE);
if (!r6.ok) { console.error('❌ handleLike not found'); process.exit(1); }
d2 = r6.out;

const NEW_UNDO = `async function handleUndo() {
    if (busy) return
    const top = undoStack[undoStack.length - 1]
    if (!top) return
    tap('light'); setBusy(true)
    setUndoStack((s) => s.slice(0, -1))
    setCards((c) => [top.card, ...c])
    try {
      await fetch('/api/discover/swipe/' + top.card.id, { method: 'DELETE' })
    } catch {}
    setBusy(false)
  }`;
const r7 = replaceFn(d2, /async function handleUndo\s*\([^)]*\)\s*/, NEW_UNDO);
if (!r7.ok) { console.error('❌ handleUndo not found'); process.exit(1); }
d2 = r7.out;

// 2g: remove supabase import line
d2 = d2.replace(/^import \{ supabase \} from '\.\.\/lib\/supabase'\s*\n/m, '');

// 2h: verify no supabase refs left
if (/supabase\./.test(d2)) { console.error('❌ Discover.jsx still has supabase refs after patch'); process.exit(1); }

src.discover = d2;

// ============ WRITE ============
if (DRY) {
  console.log('[dry-run] all anchors OK — nothing written.');
  console.log('  ✓ worker: 3 new routes (/api/discover/profiles, /swipe, /swipe/:id DELETE)');
  console.log('  ✓ Discover.jsx: 2 decorators deleted, load/handleLike/handlePass/handleUndo rewritten');
  console.log('  ✓ Discover.jsx: realtime block removed, supabase import removed');
  process.exit(0);
}

for (const [k, rel] of Object.entries(FILES)) {
  const p = fp(rel);
  if (!fs.existsSync(p + '.bak')) fs.copyFileSync(p, p + '.bak');
  fs.writeFileSync(p + '.tmp', src[k]);
  fs.renameSync(p + '.tmp', p);
  console.log('✅ wrote', rel);
}
console.log('\n🎉 Discover patched.');
console.log('   1) run migration in Neon (see scripts/migrations/2026-11-26-discover-v2.sql)');
console.log('   2) npm run build');
console.log('   3) git add -A && git commit -m "T2: discover to Neon worker (3 routes, 0 supabase)" && git push');
console.log('   revert: node scripts/patch-discover.cjs --revert');
