#!/usr/bin/env node
// P2: Search migration. Inline UNION replaces missing search_content RPC.
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const fp = (r) => path.join(ROOT, r);
const DRY = process.argv.includes('--dry-run');
const REVERT = process.argv.includes('--revert');

const W_PATH = 'backend/_worker.js';
const S_PATH = 'src/screens/Search.jsx';

if (REVERT) {
  for (const p of [W_PATH, S_PATH]) {
    const bak = fp(p) + '.bak';
    if (fs.existsSync(bak)) { fs.copyFileSync(bak, fp(p)); console.log('↩️  reverted', p); }
  }
  process.exit(0);
}

try {
  const st = execSync(`git status --porcelain ${W_PATH} ${S_PATH}`, { cwd: ROOT, encoding: 'utf8' }).trim();
  if (st) { console.error('❌ Uncommitted diffs — aborting.\n' + st); process.exit(1); }
} catch {}

let w = fs.readFileSync(fp(W_PATH), 'utf8');
let s = fs.readFileSync(fp(S_PATH), 'utf8');

// ============ WORKER ROUTES ============
const W_ANCHOR = '      if (path === "/api/search" && request.method === "GET") {';
const W_CATCH_ALL = '      return new Response(JSON.stringify({ success: true, message: "Nakubonye API Gateway is Live" }), { headers: { ...cors, "Content-Type": "application/json" } });';

if (w.includes('/api/search/suggestions')) { console.error('❌ worker already patched'); process.exit(1); }

const ROUTES = String.raw`      // P2: Search suggestions (idle state)
      if (path === "/api/search/suggestions" && request.method === "GET") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        try {
          const [postsRes, commPostsRes, peopleRes, commRes] = await Promise.all([
            queryDatabase("SELECT content FROM user_posts WHERE created_at > NOW() - INTERVAL '7 days' LIMIT 200").catch(() => ({ rows: [] })),
            queryDatabase("SELECT content FROM community_posts WHERE created_at > NOW() - INTERVAL '7 days' LIMIT 200").catch(() => ({ rows: [] })),
            queryDatabase("SELECT p.id, p.display_name, p.username, p.is_verified, (to_jsonb(p)->>'city') AS city, (SELECT storage_path FROM profile_photos pp WHERE pp.user_id = p.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) AS photo_path FROM profiles p WHERE p.id <> $1::uuid AND COALESCE(p.is_active, true) = true AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1::uuid AND b.blocked_id = p.id) OR (b.blocker_id = p.id AND b.blocked_id = $1::uuid)) ORDER BY p.last_seen_at DESC NULLS LAST LIMIT 12", [myId]).catch(() => ({ rows: [] })),
            queryDatabase("SELECT id, name, (to_jsonb(c)->>'slug') AS slug, (to_jsonb(c)->>'emoji') AS emoji, (to_jsonb(c)->>'cover_color') AS cover_color, COALESCE((to_jsonb(c)->>'member_count')::int, 0) AS member_count FROM communities c WHERE COALESCE((to_jsonb(c)->>'is_active')::boolean, true) = true ORDER BY member_count DESC NULLS LAST LIMIT 20").catch(() => ({ rows: [] })),
          ]);
          const STOP = new Set(['the','a','an','and','or','to','of','in','is','it','this','that','for','on','with','i','you','my','me','we','be','are','was','has','have','do','does','so','at','as','but','not','from','by','can','no','yes','all','if','just','like','get','got','out','up','about','what','when','how']);
          const counts = new Map();
          [...(postsRes.rows || []), ...(commPostsRes.rows || [])].forEach((row) => {
            const text = (row.content || '').toLowerCase();
            const tags = text.match(/#([a-z0-9_]{2,20})/g) || [];
            tags.forEach((h) => { const k = h.slice(1); counts.set(k, (counts.get(k) || 0) + 2); });
            text.split(/[^a-z0-9_]+/).forEach((word) => {
              if (word.length < 3 || STOP.has(word)) return;
              counts.set(word, (counts.get(word) || 0) + 1);
            });
          });
          const trendingTags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
          return new Response(JSON.stringify({ success: true, data: { trending_tags: trendingTags, suggested_people: peopleRes.rows || [], suggested_communities: commRes.rows || [] } }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
      // P2: Search
      if (path === "/api/search" && request.method === "GET") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        const q = String(url.searchParams.get("q") || "").trim();
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "60", 10), 100);
        if (q.length < 2) return new Response(JSON.stringify({ success: true, data: { people: [], posts: [], reels: [], communities: [], listings: [], services: [] } }), { headers: { ...cors, "Content-Type": "application/json" } });
        try {
          const like = "%" + q + "%";
          const [peopleRes, postsPersRes, postsCommRes, reelsRes, commRes, listRes, servRes] = await Promise.all([
            queryDatabase("SELECT p.id, p.display_name, p.username, p.is_verified, (to_jsonb(p)->>'city') AS city, (SELECT storage_path FROM profile_photos pp WHERE pp.user_id = p.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) AS photo_path FROM profiles p WHERE p.id <> $1::uuid AND (p.display_name ILIKE $2 OR p.username ILIKE $2) AND COALESCE(p.is_active, true) = true AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1::uuid AND b.blocked_id = p.id) OR (b.blocker_id = p.id AND b.blocked_id = $1::uuid)) ORDER BY p.display_name NULLS LAST LIMIT 30", [myId, like]),
            queryDatabase("SELECT id, user_id, content, created_at, (to_jsonb(u)->>'image_path') AS image_path FROM user_posts u WHERE content ILIKE $1 AND COALESCE((to_jsonb(u)->>'publish_at')::timestamptz, NOW()) <= NOW() AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $2::uuid AND b.blocked_id = u.user_id) OR (b.blocker_id = u.user_id AND b.blocked_id = $2::uuid)) ORDER BY created_at DESC LIMIT 20", [like, myId]).catch(() => ({ rows: [] })),
            queryDatabase("SELECT id, author_id, community_id, content, created_at, (to_jsonb(c)->>'image_path') AS image_path FROM community_posts c WHERE content ILIKE $1 AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $2::uuid AND b.blocked_id = c.author_id) OR (b.blocker_id = c.author_id AND b.blocked_id = $2::uuid)) ORDER BY created_at DESC LIMIT 20", [like, myId]).catch(() => ({ rows: [] })),
            queryDatabase("SELECT id, user_id, created_at, (to_jsonb(r)->>'caption') AS caption, (to_jsonb(r)->>'thumbnail_url') AS thumbnail_url, (to_jsonb(r)->>'video_url') AS video_url FROM reels r WHERE (to_jsonb(r)->>'caption') ILIKE $1 AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $2::uuid AND b.blocked_id = r.user_id) OR (b.blocker_id = r.user_id AND b.blocked_id = $2::uuid)) ORDER BY created_at DESC LIMIT 20", [like, myId]).catch(() => ({ rows: [] })),
            queryDatabase("SELECT id, name, (to_jsonb(c)->>'slug') AS slug, (to_jsonb(c)->>'emoji') AS emoji, (to_jsonb(c)->>'cover_color') AS cover_color, COALESCE((to_jsonb(c)->>'member_count')::int, 0) AS member_count FROM communities c WHERE name ILIKE $1 AND COALESCE((to_jsonb(c)->>'is_active')::boolean, true) = true ORDER BY member_count DESC NULLS LAST LIMIT 20", [like]).catch(() => ({ rows: [] })),
            queryDatabase("SELECT id, title, created_at, (to_jsonb(l)->>'price')::numeric AS price, (to_jsonb(l)->>'currency') AS currency, to_jsonb(l)->'image_paths' AS image_paths, (to_jsonb(l)->>'location') AS location FROM listings l WHERE title ILIKE $1 AND COALESCE((to_jsonb(l)->>'status'), 'active') = 'active' ORDER BY created_at DESC LIMIT 20", [like]).catch(() => ({ rows: [] })),
            queryDatabase("SELECT id, title, created_at, (to_jsonb(s)->>'price')::numeric AS price, (to_jsonb(s)->>'currency') AS currency, (to_jsonb(s)->>'duration_minutes')::int AS duration_minutes, to_jsonb(s)->'image_paths' AS image_paths FROM services s WHERE title ILIKE $1 AND COALESCE((to_jsonb(s)->>'is_active')::boolean, true) = true ORDER BY created_at DESC LIMIT 20", [like]).catch(() => ({ rows: [] })),
          ]);
          const mergedPosts = [
            ...(postsPersRes.rows || []).map((p) => ({ ...p, _source: "personal", author_id: p.user_id })),
            ...(postsCommRes.rows || []).map((p) => ({ ...p, _source: "community" })),
          ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
          return new Response(JSON.stringify({ success: true, data: { people: peopleRes.rows || [], posts: mergedPosts, reels: reelsRes.rows || [], communities: commRes.rows || [], listings: listRes.rows || [], services: servRes.rows || [] } }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
`;
w = w.replace(W_CATCH_ALL, ROUTES + '\n' + W_CATCH_ALL);

// ============ FRONTEND TRANSFORMATIONS ============
const RUN_SEARCH_OLD = s.match(/const runSearch = useCallback\(async \(q\) => \{[\s\S]*?\n  \}, \[\]\)/);
if (!RUN_SEARCH_OLD) { console.error('❌ runSearch block not found'); process.exit(1); }
const RUN_SEARCH_NEW = `const runSearch = useCallback(async (q) => {
    const term = q.trim()
    if (term.length < 2) {
      setPeople([]); setPosts([]); setReels([])
      setCommunities([]); setListings([]); setServices([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(\`\${API_BASE_URL}/api/search?q=\` + encodeURIComponent(term) + '&limit=60')
      const j = await res.json()
      if (!j.success) {
        setPeople([]); setPosts([]); setReels([])
        setCommunities([]); setListings([]); setServices([])
        setLoading(false)
        return
      }
      const d = j.data || {}
      setPeople((d.people || []).map((u) => ({ ...u, photo_url: u.photo_path ? publicPhotoUrl(u.photo_path) : null })))
      setPosts(d.posts || [])
      setReels(d.reels || [])
      setCommunities(d.communities || [])
      setListings(d.listings || [])
      setServices(d.services || [])
    } catch (e) {
      console.error('search failed', e)
    }
    setLoading(false)
  }, [])`;
s = s.replace(RUN_SEARCH_OLD[0], RUN_SEARCH_NEW);

const SUGGESTIONS_OLD = s.match(/const loadSuggestions = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[myId, suggestionsLoaded\]\)/);
if (!SUGGESTIONS_OLD) { console.error('❌ loadSuggestions block not found'); process.exit(1); }
const SUGGESTIONS_NEW = `const loadSuggestions = useCallback(async () => {
    if (!myId || suggestionsLoaded) return
    try {
      const res = await fetch(\`\${API_BASE_URL}/api/search/suggestions\`)
      const j = await res.json()
      if (!j.success) return
      const d = j.data || {}
      setTrendingTags(d.trending_tags || [])
      setSuggestedPeople((d.suggested_people || []).map((p) => ({
        ...p,
        _photo: p.photo_path ? publicPhotoUrl(p.photo_path) : null,
        photo_url: p.photo_path ? publicPhotoUrl(p.photo_path) : null,
      })))
      setSuggestedCommunities(d.suggested_communities || [])
      setSuggestionsLoaded(true)
    } catch (e) { console.warn('suggestions failed', e) }
  }, [myId, suggestionsLoaded])`;
s = s.replace(SUGGESTIONS_OLD[0], SUGGESTIONS_NEW);

s = s.replace(/^import \{ supabase \} from "\.\.\/lib\/supabase"\s*\n/m, '');

if (!s.includes('API_BASE_URL')) {
  const importEnd = s.lastIndexOf('import ');
  const insertAt = s.indexOf('\n', importEnd) + 1;
  s = s.slice(0, insertAt) + `import { API_BASE_URL } from '../lib/api';\n` + s.slice(insertAt);
}

if (/supabase\./.test(s)) {
  console.error('❌ Search.jsx still has supabase refs:', s.match(/supabase\.[a-z]+/g));
  process.exit(1);
}

// ============ PARSE VALIDATION ============
try { fs.mkdirSync('.tmpcheck', { recursive: true }); } catch {}
const tmpPath = '.tmpcheck/_search_check.jsx';
fs.writeFileSync(tmpPath, s);
try {
  execSync(`npx --yes esbuild@0.20.0 ${tmpPath} --outfile=.tmpcheck/_search_out.js`, { stdio: 'pipe', cwd: ROOT });
  console.log('✅ JSX parse check passed');
} catch (e) {
  console.error('❌ JSX parse check FAILED — not writing.');
  try { fs.unlinkSync(tmpPath); } catch {}
  try { fs.unlinkSync('.tmpcheck/_search_out.js'); } catch {}
  process.exit(1);
}
try { fs.unlinkSync(tmpPath); } catch {}
try { fs.unlinkSync('.tmpcheck/_search_out.js'); } catch {}

if (DRY) {
  console.log('[dry-run] all anchors OK + parse OK — nothing written.');
  process.exit(0);
}

for (const [p, content] of [[W_PATH, w], [S_PATH, s]]) {
  const full = fp(p);
  fs.copyFileSync(full, full + '.bak');
  fs.writeFileSync(full + '.tmp', content);
  fs.renameSync(full + '.tmp', full);
  console.log('✅ wrote', p);
}
