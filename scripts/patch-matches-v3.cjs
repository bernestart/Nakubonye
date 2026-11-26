#!/usr/bin/env node
// T2: Matches migration v3 — FIXED deleteUseEffect regex + esbuild parse validation.
// Usage: --dry-run | (no flag) apply | --revert
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const fp = (r) => path.join(ROOT, r);
const DRY = process.argv.includes('--dry-run');
const REVERT = process.argv.includes('--revert');

const W_PATH = 'backend/_worker.js';
const M_PATH = 'src/screens/Matches.jsx';

if (REVERT) {
  for (const p of [W_PATH, M_PATH]) {
    const bak = fp(p) + '.bak';
    if (fs.existsSync(bak)) { fs.copyFileSync(bak, fp(p)); console.log('↩️  reverted', p); }
  }
  process.exit(0);
}

// Pre-flight: both files must match HEAD (no uncommitted diffs)
try {
  const st = execSync(`git status --porcelain ${W_PATH} ${M_PATH}`, { cwd: ROOT, encoding: 'utf8' }).trim();
  if (st) { console.error('❌ Uncommitted diffs before patch — aborting.\n' + st + '\nRun: git checkout ' + W_PATH + ' ' + M_PATH); process.exit(1); }
} catch {}

let w = fs.readFileSync(fp(W_PATH), 'utf8');
let m = fs.readFileSync(fp(M_PATH), 'utf8');

// ============ Worker routes ============
const W_ANCHOR = '      if (/^\\/api\\/stories\\/[0-9a-f-]{36}$/.test(path) && request.method === "DELETE") {';
if (!w.includes(W_ANCHOR)) { console.error('❌ worker anchor missing'); process.exit(1); }
if (w.includes('/api/matches/data')) { console.error('❌ worker already patched'); process.exit(1); }

const ROUTES = String.raw`      // T2: Matches aggregate — 4 queries + 1 mutual-count + Redis 30s cache
      if (path === "/api/matches/data" && request.method === "GET") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        const markSeen = url.searchParams.get("markSeen") === "1";
        try {
          const cacheKey = "matches:data:" + myId;
          try {
            const cached = await redisCommand(["GET", cacheKey]);
            if (cached && cached.result) return new Response(cached.result, { headers: { ...cors, "Content-Type": "application/json", "X-Cache": "HIT" } });
          } catch {}
          const calcAge = (dob) => dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
          const [matchesRes, likesRes, sentRes, suggestedRes] = await Promise.all([
            queryDatabase("SELECT m.id AS match_id, m.created_at AS matched_at, CASE WHEN m.user_one_id = $1::uuid THEN m.user_two_id ELSE m.user_one_id END AS user_id, p.display_name, p.username, p.is_verified, (to_jsonb(p)->>'city') AS city, (to_jsonb(p)->>'country') AS country, (to_jsonb(p)->>'date_of_birth')::date AS date_of_birth, (SELECT storage_path FROM profile_photos pp WHERE pp.user_id = p.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) AS photo_path FROM matches m JOIN profiles p ON p.id = (CASE WHEN m.user_one_id = $1::uuid THEN m.user_two_id ELSE m.user_one_id END) WHERE m.user_one_id = $1::uuid OR m.user_two_id = $1::uuid ORDER BY m.created_at DESC LIMIT 100", [myId]),
            queryDatabase("SELECT l.user_id AS liker_id, l.created_at AS liked_at, p.display_name, p.username, p.is_verified, (to_jsonb(p)->>'city') AS city, (to_jsonb(p)->>'country') AS country, (to_jsonb(p)->>'date_of_birth')::date AS date_of_birth, (SELECT storage_path FROM profile_photos pp WHERE pp.user_id = p.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) AS photo_path FROM likes l JOIN profiles p ON p.id = l.user_id WHERE l.liked_user_id = $1::uuid AND NOT EXISTS (SELECT 1 FROM matches m WHERE (m.user_one_id = $1::uuid AND m.user_two_id = l.user_id) OR (m.user_two_id = $1::uuid AND m.user_one_id = l.user_id)) ORDER BY l.created_at DESC LIMIT 60", [myId]),
            queryDatabase("SELECT l.liked_user_id AS target_id, l.created_at AS sent_at, p.display_name, p.username, p.is_verified, (to_jsonb(p)->>'city') AS city, (to_jsonb(p)->>'country') AS country, (to_jsonb(p)->>'date_of_birth')::date AS date_of_birth, (SELECT storage_path FROM profile_photos pp WHERE pp.user_id = p.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) AS photo_path FROM likes l JOIN profiles p ON p.id = l.liked_user_id WHERE l.user_id = $1::uuid AND NOT EXISTS (SELECT 1 FROM matches m WHERE (m.user_one_id = $1::uuid AND m.user_two_id = l.liked_user_id) OR (m.user_two_id = $1::uuid AND m.user_one_id = l.liked_user_id)) ORDER BY l.created_at DESC LIMIT 60", [myId]),
            queryDatabase("SELECT p.id AS user_id, p.display_name, p.username, p.is_verified, (to_jsonb(p)->>'city') AS city, (SELECT COUNT(DISTINCT f2.follower_id) FROM follows f1 JOIN follows f2 ON f1.follower_id = f2.following_id WHERE f1.following_id = p.id AND f2.follower_id = $1::uuid) AS mutual_count, (SELECT storage_path FROM profile_photos pp WHERE pp.user_id = p.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) AS photo_path FROM profiles p WHERE p.id <> $1::uuid AND p.id NOT IN (SELECT liked_user_id FROM likes WHERE user_id = $1::uuid) AND p.id NOT IN (SELECT target_id FROM swipes WHERE swiper_id = $1::uuid) AND p.id NOT IN (SELECT user_id FROM likes WHERE liked_user_id = $1::uuid) AND NOT EXISTS (SELECT 1 FROM matches m WHERE (m.user_one_id = $1::uuid AND m.user_two_id = p.id) OR (m.user_two_id = $1::uuid AND m.user_one_id = p.id)) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1::uuid AND b.blocked_id = p.id) OR (b.blocker_id = p.id AND b.blocked_id = $1::uuid)) ORDER BY mutual_count DESC NULLS LAST, p.last_seen_at DESC NULLS LAST LIMIT 40", [myId]).catch(() => ({ rows: [] })),
          ]);
          const matches = (matchesRes.rows || []).map(r => ({ match_id: r.match_id, user_id: r.user_id, display_name: r.display_name, username: r.username, is_verified: !!r.is_verified, city: r.city, country: r.country, age: calcAge(r.date_of_birth), photo_url: r.photo_path || null, matched_at: r.matched_at }));
          const likes = (likesRes.rows || []).map(r => ({ user_id: r.liker_id, display_name: r.display_name, username: r.username, is_verified: !!r.is_verified, city: r.city, country: r.country, age: calcAge(r.date_of_birth), photo_url: r.photo_path || null, liked_at: r.liked_at }));
          const sent = (sentRes.rows || []).map(r => ({ user_id: r.target_id, display_name: r.display_name, username: r.username, is_verified: !!r.is_verified, city: r.city, country: r.country, age: calcAge(r.date_of_birth), photo_url: r.photo_path || null, sent_at: r.sent_at }));
          const suggested = (suggestedRes.rows || []).map(r => ({ user_id: r.user_id, display_name: r.display_name, username: r.username, is_verified: !!r.is_verified, city: r.city, mutuals: Number(r.mutual_count) || 0, photo_url: r.photo_path || null }));
          const mutuals = {};
          const allIds = [...new Set([...likes.map(x => String(x.user_id)), ...sent.map(x => String(x.user_id))])];
          if (allIds.length) {
            const myFollowsRes = await queryDatabase("SELECT following_id FROM follows WHERE follower_id = $1::uuid LIMIT 500", [myId]).catch(() => ({ rows: [] }));
            const mySet = (myFollowsRes.rows || []).map(r => String(r.following_id));
            if (mySet.length) {
              const mr = await queryDatabase("SELECT following_id, COUNT(*) AS c FROM follows WHERE following_id = ANY($1::uuid[]) AND follower_id = ANY($2::uuid[]) GROUP BY following_id", [allIds, mySet]).catch(() => ({ rows: [] }));
              for (const r of (mr.rows || [])) mutuals[String(r.following_id)] = Number(r.c);
            }
          }
          if (markSeen) {
            await queryDatabase("UPDATE matches SET seen_at = NOW() WHERE (user_one_id = $1::uuid OR user_two_id = $1::uuid) AND seen_at IS NULL", [myId]).catch(() => {});
          }
          const payload = JSON.stringify({ success: true, data: { matches, likes, sent, suggested, mutuals } });
          try { await redisCommand(["SETEX", cacheKey, 30, payload]); } catch {}
          return new Response(payload, { headers: { ...cors, "Content-Type": "application/json", "X-Cache": "MISS" } });
        } catch (err) {
          console.error("[MATCHES/DATA]", err.message);
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
      // T2: Cancel a sent like
      if (/^\/api\/matches\/like\/[0-9a-f-]{36}$/.test(path) && request.method === "DELETE") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        const targetId = path.split("/")[4];
        try {
          await queryDatabase("DELETE FROM likes WHERE user_id = $1::uuid AND liked_user_id = $2::uuid", [myId, targetId]).catch(() => {});
          await queryDatabase("DELETE FROM swipes WHERE swiper_id = $1::uuid AND target_id = $2::uuid AND action = 'like'", [myId, targetId]).catch(() => {});
          try { await redisCommand(["DEL", "matches:data:" + myId]); } catch {}
          return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
`;
w = w.replace(W_ANCHOR, ROUTES + W_ANCHOR);

// ============ Matches.jsx transformations ============

function replaceAsyncFn(text, fnName, newBody) {
  const headerRe = new RegExp('async function ' + fnName + '\\([^)]*\\)\\s*\\{', 'm');
  const mm = text.match(headerRe);
  if (!mm) return { ok: false, reason: fnName + ' header not found' };
  const start = mm.index;
  let i = mm.index + mm[0].length - 1, depth = 1;
  while (i < text.length - 1) { i++; if (text[i] === '{') depth++; else if (text[i] === '}') { depth--; if (depth === 0) break; } }
  if (depth !== 0) return { ok: false, reason: fnName + ' unbalanced' };
  return { ok: true, out: text.slice(0, start) + newBody + text.slice(i + 1) };
}

function replaceUseCallback(text, varName, newBody) {
  const headerRe = new RegExp('const ' + varName + ' = useCallback\\(async \\(\\) => \\{', 'm');
  const mm = text.match(headerRe);
  if (!mm) return { ok: false, reason: varName + ' header not found' };
  const start = mm.index;
  let i = mm.index + mm[0].length, depth = 1;
  while (i < text.length) { if (text[i] === '{') depth++; else if (text[i] === '}') { depth--; if (depth === 0) break; } i++; }
  if (depth !== 0) return { ok: false, reason: varName + ' unbalanced' };
  const after = text.slice(i + 1);
  const closer = after.match(/^\s*,\s*\[[^\]]*\]\s*\)/);
  if (!closer) return { ok: false, reason: varName + ' dep array not found' };
  return { ok: true, out: text.slice(0, start) + newBody + text.slice(i + 1 + closer[0].length) };
}

// *** FIXED *** — trailing whitespace limited to horizontal only
function deleteUseEffect(text, marker) {
  const idx = text.indexOf(marker);
  if (idx === -1) return { ok: false, reason: 'marker not found: ' + marker };
  const before = text.slice(0, idx);
  const ueIdx = before.lastIndexOf('useEffect(');
  if (ueIdx === -1) return { ok: false, reason: 'no useEffect header for ' + marker };
  let i = ueIdx, depth = 0, opened = false;
  while (i < text.length) {
    if (text[i] === '{') { depth++; opened = true; }
    else if (text[i] === '}') { depth--; if (opened && depth === 0) break; }
    i++;
  }
  if (depth !== 0) return { ok: false, reason: 'unbalanced useEffect for ' + marker };
  const after = text.slice(i + 1);
  const closer = after.match(/^\s*,\s*\[[^\]]*\]\s*\)[ \t]*;?/);
  if (!closer) return { ok: false, reason: 'no dep array for ' + marker };
  let deleteStart = ueIdx;
  while (deleteStart > 0 && /\s/.test(text[deleteStart - 1])) deleteStart--;
  return { ok: true, out: text.slice(0, deleteStart) + text.slice(i + 1 + closer[0].length) };
}

// 2a. load useCallback
const NEW_LOAD = `const load = useCallback(async () => {
    if (!session?.user?.id) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/matches/data?markSeen=1')
      const j = await res.json()
      if (!j.success) { setError(j.error || 'Failed to load'); setLoading(false); return }
      const d = j.data || {}
      setMatches((d.matches || []).map(x => ({ ...x, photo_url: x.photo_url ? publicPhotoUrl(x.photo_url) : null })))
      setLikes((d.likes || []).map(x => ({ ...x, photo_url: x.photo_url ? publicPhotoUrl(x.photo_url) : null })))
      setSentLikes((d.sent || []).map(x => ({ ...x, photo_url: x.photo_url ? publicPhotoUrl(x.photo_url) : null })))
      setSuggested((d.suggested || []).map(x => ({ ...x, photo_url: x.photo_url ? publicPhotoUrl(x.photo_url) : null })))
      setMutuals(d.mutuals || {})
    } catch (e) {
      setError(e.message || 'Network error')
    }
    setLoading(false)
  }, [session?.user?.id])`;
const r1 = replaceUseCallback(m, 'load', NEW_LOAD);
if (!r1.ok) { console.error('❌ load:', r1.reason); process.exit(1); }
m = r1.out;

// 2b–2e. Delete 4 useEffects
for (const [marker, label] of [
  ['get_suggested_people', 'suggested useEffect'],
  ['mutualRows', 'mutuals useEffect'],
  ['seen_at', 'seen_at useEffect'],
  ['matches-rt-', 'realtime useEffect'],
]) {
  const rr = deleteUseEffect(m, marker);
  if (!rr.ok) { console.error('❌ ' + label + ':', rr.reason); process.exit(1); }
  m = rr.out;
}

// 2f. handleLikeBack
const NEW_LIKEBACK = `async function handleLikeBack(userId) {
    if (busy[userId]) return
    setBusy((b) => ({ ...b, [userId]: true }))
    tap('medium')
    try {
      const res = await fetch('/api/profile/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', targetUserId: userId }),
      })
      const j = await res.json()
      setBusy((b) => ({ ...b, [userId]: false }))
      if (!j.success) { setError(j.error || 'Failed'); return }
      await load()
      if (j.data?.matched) setActiveTab('matches')
    } catch (e) {
      setBusy((b) => ({ ...b, [userId]: false }))
      setError(e.message || 'Network error')
    }
  }`;
const h1 = replaceAsyncFn(m, 'handleLikeBack', NEW_LIKEBACK);
if (!h1.ok) { console.error('❌ handleLikeBack:', h1.reason); process.exit(1); }
m = h1.out;

// 2g. handleDecline
const NEW_DECLINE = `async function handleDecline(userId) {
    if (busy[userId]) return
    setBusy((b) => ({ ...b, [userId]: true }))
    tap('light')
    try {
      const res = await fetch('/api/profile/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', targetUserId: userId }),
      })
      const j = await res.json()
      setBusy((b) => ({ ...b, [userId]: false }))
      if (!j.success) { setError(j.error || 'Failed'); return }
      setLikes((prev) => prev.filter((x) => x.user_id !== userId))
    } catch (e) {
      setBusy((b) => ({ ...b, [userId]: false }))
      setError(e.message || 'Network error')
    }
  }`;
const h2 = replaceAsyncFn(m, 'handleDecline', NEW_DECLINE);
if (!h2.ok) { console.error('❌ handleDecline:', h2.reason); process.exit(1); }
m = h2.out;

// 2h. handleCancelSent
const NEW_CANCEL = `async function handleCancelSent(userId) {
    if (busy[userId]) return
    setBusy((b) => ({ ...b, [userId]: true }))
    tap('light')
    try {
      const res = await fetch('/api/matches/like/' + userId, { method: 'DELETE' })
      const j = await res.json()
      setBusy((b) => ({ ...b, [userId]: false }))
      if (!j.success) { setError(j.error || 'Failed'); return }
      setSentLikes((prev) => prev.filter((x) => x.user_id !== userId))
    } catch (e) {
      setBusy((b) => ({ ...b, [userId]: false }))
      setError(e.message || 'Network error')
    }
  }`;
const h3 = replaceAsyncFn(m, 'handleCancelSent', NEW_CANCEL);
if (!h3.ok) { console.error('❌ handleCancelSent:', h3.reason); process.exit(1); }
m = h3.out;

// 2i. Suggested inline like_user
const RPC_LITERAL = `await supabase.rpc('like_user', { target_user_id: u.user_id })`;
const RPC_REPLACE = `await fetch('/api/profile/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'like', targetUserId: u.user_id }) }).then(r => r.json()).then(j => ({ error: j.success ? null : { message: j.error || 'Failed' } }))`;
if (!m.includes(RPC_LITERAL)) { console.error('❌ suggested inline rpc anchor missing'); process.exit(1); }
m = m.replace(RPC_LITERAL, RPC_REPLACE);

// 2j. Drop supabase import
m = m.replace(/^import \{ supabase \} from '\.\.\/lib\/supabase'\s*\n/m, '');

if (/supabase\./.test(m)) {
  console.error('❌ Matches.jsx still has supabase refs:', m.match(/supabase\.[a-z]+/g));
  process.exit(1);
}

// ============ PARSE VALIDATION ============
try { fs.mkdirSync('.tmpcheck', { recursive: true }); } catch {}
const tmpPath = '.tmpcheck/_matches_check.jsx';
fs.writeFileSync(tmpPath, m);
try {
  execSync(`npx --yes esbuild@0.20.0 ${tmpPath} --outfile=.tmpcheck/_matches_out.js`, { stdio: 'pipe' });
  console.log('✅ JSX parse check passed');
} catch (e) {
  console.error('❌ JSX parse check FAILED — not writing.');
  console.error((e.stderr && e.stderr.toString()) || e.message);
  try { fs.unlinkSync(tmpPath); } catch {}
  try { fs.unlinkSync('.tmpcheck/_matches_out.js'); } catch {}
  process.exit(1);
}
try { fs.unlinkSync(tmpPath); } catch {}
try { fs.unlinkSync('.tmpcheck/_matches_out.js'); } catch {}

if (DRY) {
  console.log('[dry-run] all anchors OK + parse OK — nothing written.');
  process.exit(0);
}

for (const [p, content] of [[W_PATH, w], [M_PATH, m]]) {
  const full = fp(p);
  fs.copyFileSync(full, full + '.bak');
  fs.writeFileSync(full + '.tmp', content);
  fs.renameSync(full + '.tmp', full);
  console.log('✅ wrote', p);
}
console.log('\n🎉 Matches patched + parse-verified.');
console.log('   next: npm run build && git add -A && git commit -m "T2: matches to Neon (basic, cached 30s)" && git push');
console.log('   revert: node scripts/patch-matches-v3.cjs --revert');
