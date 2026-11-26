#!/usr/bin/env node
// T2 Stories migration — safe patch (ROADMAP Rule 2: anchor-checked, abort if any miss).
//
// Usage:
//   node scripts/patch-stories-feed.cjs --dry-run   # verify anchors, no writes
//   node scripts/patch-stories-feed.cjs             # apply
//   node scripts/patch-stories-feed.cjs --revert    # restore .bak files
//
// Files touched:
//   backend/_worker.js               (+5 routes: feed / views / create / reply / delete)
//   src/components/StoriesRow.jsx    (fetch → /api/stories/feed, batched views, no Supabase)
//   src/components/StoryComposer.jsx (insert → POST /api/stories)

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const REVERT = process.argv.includes('--revert');

const fp = (rel) => path.join(ROOT, rel);
const read = (rel) => {
  const p = fp(rel);
  if (!fs.existsSync(p)) { console.error(`❌ Missing: ${rel}`); process.exit(1); }
  return fs.readFileSync(p, 'utf8');
};
const assertAnchors = (src, anchors, rel) => {
  const missing = anchors.filter(a => !src.includes(a));
  if (missing.length) {
    console.error(`❌ ${rel}: ${missing.length} anchor(s) missing — aborting (nothing written).`);
    missing.forEach((a, i) => console.error(`   [${i+1}] ${JSON.stringify(a.slice(0,120))}`));
    process.exit(1);
  }
};
const assertNotPatched = (src, marker, rel) => {
  if (src.includes(marker)) {
    console.error(`❌ ${rel}: already patched (marker ${JSON.stringify(marker)} found).`);
    process.exit(1);
  }
};
const writeAtomic = (rel, content) => {
  if (DRY) { console.log(`[dry-run] WOULD write ${rel} (${content.length}b)`); return; }
  const p = fp(rel);
  if (!fs.existsSync(p + '.bak')) fs.copyFileSync(p, p + '.bak');
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, p);
  console.log(`✅ wrote ${rel}  (backup → ${rel}.bak)`);
};

if (REVERT) {
  for (const f of ['backend/_worker.js', 'src/components/StoriesRow.jsx', 'src/components/StoryComposer.jsx']) {
    const bak = fp(f) + '.bak';
    if (fs.existsSync(bak)) { fs.copyFileSync(bak, fp(f)); console.log(`↩️  reverted ${f}`); }
    else console.log(`   (no backup for ${f})`);
  }
  process.exit(0);
}

// ============================================================================
// Patch 1 — backend/_worker.js: 5 new story routes
// ============================================================================
const WORKER_ANCHOR = '      if (path === "/api/inbox/read" && request.method === "POST") {';
const WORKER_MARKER = '/api/stories/feed';

const STORY_ROUTES = String.raw`      // T2: Stories — server-side filtered feed (single query, 30s Redis cache)
      if (path === "/api/stories/feed" && request.method === "GET") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10), 50);
        try {
          const cacheKey = "stories:feed:" + myId;
          try {
            const cached = await redisCommand(["GET", cacheKey]);
            if (cached && cached.result) return new Response(cached.result, { headers: { ...cors, "Content-Type": "application/json", "X-Cache": "HIT" } });
          } catch {}
          const meRes = await queryDatabase(
            "SELECT (SELECT display_name FROM profiles WHERE id = $1::uuid) AS display_name, (SELECT username FROM profiles WHERE id = $1::uuid) AS username, (SELECT storage_path FROM profile_photos WHERE user_id = $1::uuid ORDER BY is_primary DESC, display_order ASC LIMIT 1) AS avatar_path",
            [myId]
          );
          const mine = meRes.rows[0] || {};
          const myStoryRes = await queryDatabase(
            "SELECT id, user_id, media_url, media_type, caption, created_at, expires_at FROM stories WHERE user_id = $1::uuid AND expires_at > NOW() ORDER BY created_at ASC",
            [myId]
          );
          const feedRes = await queryDatabase(
            "WITH my_blocks AS (SELECT blocked_id AS uid FROM blocks WHERE blocker_id = $1::uuid UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1::uuid), my_matches AS (SELECT user_two_id AS uid FROM matches WHERE user_one_id = $1::uuid UNION SELECT user_one_id FROM matches WHERE user_two_id = $1::uuid), my_follows AS (SELECT following_id AS uid FROM follows WHERE follower_id = $1::uuid), my_hidden AS (SELECT hidden_user_id AS uid FROM story_hides WHERE owner_id = $1::uuid), my_inner AS (SELECT user_id AS uid FROM inner_circle WHERE member_id = $1::uuid) SELECT s.id, s.user_id, s.media_url, s.media_type, s.caption, s.created_at, s.expires_at, s.audience, p.display_name, p.username, (SELECT storage_path FROM profile_photos pp WHERE pp.user_id = s.user_id ORDER BY is_primary DESC, display_order ASC LIMIT 1) AS avatar_path, (sv.story_id IS NOT NULL) AS viewed FROM stories s LEFT JOIN user_settings u ON u.user_id = s.user_id LEFT JOIN profiles p ON p.id = s.user_id LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.user_id = $1::uuid WHERE s.expires_at > NOW() AND s.user_id <> $1::uuid AND s.user_id NOT IN (SELECT uid FROM my_blocks) AND s.user_id NOT IN (SELECT uid FROM my_hidden) AND (COALESCE(s.audience, u.who_can_see_story, 'everyone') IN ('everyone','public','default') OR (COALESCE(s.audience, u.who_can_see_story) = 'matches' AND s.user_id IN (SELECT uid FROM my_matches)) OR (COALESCE(s.audience, u.who_can_see_story) IN ('inner_circle','close') AND s.user_id IN (SELECT uid FROM my_inner)) OR (COALESCE(s.audience, u.who_can_see_story) = 'following' AND s.user_id IN (SELECT uid FROM my_follows))) ORDER BY s.created_at DESC LIMIT 200",
            [myId]
          );
          const byUser = new Map();
          for (const row of feedRes.rows || []) {
            if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
            byUser.get(row.user_id).push(row);
          }
          const rings = [...byUser.entries()].map(([uid, ss]) => {
            const f = ss[0];
            return { user_id: uid, display_name: f.display_name || f.username || "Someone", username: f.username, avatar_path: f.avatar_path, stories: ss.slice().reverse(), unseen_count: ss.filter((s) => !s.viewed).length, last_created_at: f.created_at };
          });
          rings.sort((a, b) => {
            const au = a.unseen_count > 0, bu = b.unseen_count > 0;
            if (au !== bu) return au ? -1 : 1;
            return new Date(b.last_created_at) - new Date(a.last_created_at);
          });
          const payload = JSON.stringify({ success: true, data: { my_story: myStoryRes.rows.length ? { display_name: mine.display_name || mine.username || "You", avatar_path: mine.avatar_path, stories: myStoryRes.rows } : null, my_avatar_path: mine.avatar_path || null, rings: rings.slice(0, limit) } });
          try { await redisCommand(["SETEX", cacheKey, 30, payload]); } catch {}
          return new Response(payload, { headers: { ...cors, "Content-Type": "application/json", "X-Cache": "MISS" } });
        } catch (err) {
          console.error("[STORIES/FEED]", err.message);
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
      if (path === "/api/stories/views" && request.method === "POST") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        try {
          const body = await request.json();
          const ids = Array.isArray(body.story_ids) ? body.story_ids.filter(Boolean) : [];
          if (!ids.length) return new Response(JSON.stringify({ success: true, inserted: 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
          const ph = ids.map((_, i) => "($1::uuid, $" + (i + 2) + "::uuid)").join(", ");
          const r = await queryDatabase("INSERT INTO story_views (user_id, story_id) VALUES " + ph + " ON CONFLICT (story_id, user_id) DO NOTHING RETURNING story_id", [myId, ...ids]);
          try { await redisCommand(["DEL", "stories:feed:" + myId]); } catch {}
          return new Response(JSON.stringify({ success: true, inserted: r.rowCount || 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
      if (path === "/api/stories" && request.method === "POST") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        try {
          const body = await request.json();
          if (!body.media_url || !body.media_type) return new Response(JSON.stringify({ success: false, error: "media_url and media_type required" }), { status: 400, headers: cors });
          const r = await queryDatabase(
            "INSERT INTO stories (user_id, media_url, media_type, caption, audience, metadata, link_url, music_track, expires_at) VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW() + INTERVAL '24 hours') RETURNING *",
            [myId, body.media_url, body.media_type, body.caption || null, body.audience || "everyone", JSON.stringify(body.metadata || {}), body.link_url || null, body.music_track || null]
          );
          try { await redisCommand(["DEL", "stories:feed:" + myId]); } catch {}
          return new Response(JSON.stringify({ success: true, data: r.rows[0] }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
      if (/^\/api\/stories\/[0-9a-f-]{36}\/reply$/.test(path) && request.method === "POST") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        const storyId = path.split("/")[3];
        try {
          const body = await request.json();
          const content = String(body.content || "").trim();
          if (!content) return new Response(JSON.stringify({ success: false, error: "content required" }), { status: 400, headers: cors });
          const sRes = await queryDatabase("SELECT id, user_id, media_url, media_type FROM stories WHERE id = $1::uuid AND expires_at > NOW()", [storyId]);
          if (!sRes.rows.length) return new Response(JSON.stringify({ success: false, error: "STORY_NOT_FOUND" }), { status: 404, headers: cors });
          const story = sRes.rows[0];
          if (story.user_id === myId) return new Response(JSON.stringify({ success: false, error: "CANNOT_REPLY_SELF" }), { status: 400, headers: cors });
          const conv = await queryDatabase("SELECT id FROM conversations WHERE (initiator_id = $1::uuid AND recipient_id = $2::uuid) OR (initiator_id = $2::uuid AND recipient_id = $1::uuid) LIMIT 1", [myId, story.user_id]);
          let convId = conv.rows[0]?.id;
          if (!convId) {
            try {
              const ins = await queryDatabase("INSERT INTO conversations (initiator_id, recipient_id, created_at, updated_at) VALUES ($1::uuid, $2::uuid, NOW(), NOW()) RETURNING id", [myId, story.user_id]);
              convId = ins.rows[0].id;
            } catch (e) {
              const ins2 = await queryDatabase("INSERT INTO conversations (initiator_id, recipient_id) VALUES ($1::uuid, $2::uuid) RETURNING id", [myId, story.user_id]);
              convId = ins2.rows[0].id;
            }
          }
          const msg = await queryDatabase(
            "INSERT INTO messages (conversation_id, sender_id, content, media_url, media_type, metadata) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb) RETURNING *",
            [convId, myId, content, story.media_url, story.media_type, JSON.stringify({ story_reply: { story_id: storyId, owner_id: story.user_id } })]
          );
          try {
            const id = env.CHAT_ROOMS.idFromName("dm-" + convId);
            const obj = env.CHAT_ROOMS.get(id);
            await obj.fetch("https://dummy.com/", { method: "POST", body: JSON.stringify(msg.rows[0]) });
          } catch {}
          return new Response(JSON.stringify({ success: true, data: { message: msg.rows[0], conversation_id: convId } }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          console.error("[STORIES/REPLY]", err.message);
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
      if (/^\/api\/stories\/[0-9a-f-]{36}$/.test(path) && request.method === "DELETE") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        const storyId = path.split("/")[3];
        try {
          const r = await queryDatabase("DELETE FROM stories WHERE id = $1::uuid AND user_id = $2::uuid RETURNING id", [storyId, myId]);
          try { await redisCommand(["DEL", "stories:feed:" + myId]); } catch {}
          return new Response(JSON.stringify({ success: true, deleted: r.rowCount || 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }

`;

// ============================================================================
// Patch 2 — StoriesRow.jsx
// ============================================================================
const SR_PATH = 'src/components/StoriesRow.jsx';
const SR_RENDER_ANCHOR = '  // 1. Grab pending optimistic stories for the current user';
const SR_OLD_LOGIC_MARKER = 'async function filterStoriesByVisibility(stories, myId)';
const SR_ALREADY_MARKER = '/api/stories/feed';

const STORIES_ROW_HEADER = String.raw`import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, Play , Loader2 } from "lucide-react"
import { useAuth } from "../lib/auth"
import { publicPhotoUrl } from "../lib/photo"
import { tap } from "../lib/haptic"
import { authFetch } from "../lib/authFetch"
import StoryComposer from "./StoryComposer"
import StoryViewer from "./StoryViewer"
import StoryRing from "./StoryRing";

const TILE_W = 112
const TILE_H = 190

export default function StoriesRow() {
  const { session, profile } = useAuth()
  const myId = session?.user?.id
  const [groups, setGroups] = useState([])
  const [myStory, setMyStory] = useState(null)
  const [myPhoto, setMyPhoto] = useState(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [pendingStories, setPendingStories] = useState([])
  const [viewerState, setViewerState] = useState(null)
  const stripRef = useRef(null)
  const [viewed, setViewed] = useState(() => {
    try { return JSON.parse(localStorage.getItem("story_views") || "{}") } catch { return {} }
  })
  const viewedRef = useRef(viewed)
  useEffect(() => { viewedRef.current = viewed }, [viewed])

  const viewQueueRef = useRef([])
  const flushTimerRef = useRef(null)
  const flushViews = useCallback(async () => {
    if (!viewQueueRef.current.length) return
    const ids = [...new Set(viewQueueRef.current)]
    viewQueueRef.current = []
    try {
      await authFetch("/api/stories/views", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ story_ids: ids }) })
    } catch {}
  }, [])

  useEffect(() => {
    const onHide = () => { flushViews() }
    window.addEventListener("pagehide", onHide)
    window.addEventListener("beforeunload", onHide)
    return () => {
      window.removeEventListener("pagehide", onHide)
      window.removeEventListener("beforeunload", onHide)
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
      flushViews()
    }
  }, [flushViews])

  const load = useCallback(async () => {
    if (!myId) return
    try {
      const res = await authFetch("/api/stories/feed?limit=30")
      const j = await res.json()
      if (!j.success) return
      const data = j.data || {}
      const rings = data.rings || []
      const nextViewed = { ...viewedRef.current }
      for (const ring of rings) for (const s of ring.stories) if (s.viewed) nextViewed[s.id] = true
      setViewed(nextViewed)
      try { localStorage.setItem("story_views", JSON.stringify(nextViewed)) } catch {}
      setMyPhoto(data.my_avatar_path ? publicPhotoUrl(data.my_avatar_path) : null)
      if (data.my_story && data.my_story.stories && data.my_story.stories.length) {
        setMyStory({ user_id: myId, display_name: data.my_story.display_name || profile?.display_name || "You", stories: data.my_story.stories })
      } else setMyStory(null)
      setGroups(rings)
    } catch {}
  }, [myId, profile])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") load() }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [load])

  function markViewed(userId, storyId) {
    const next = { ...viewedRef.current, [storyId]: true }
    setViewed(next)
    try { localStorage.setItem("story_views", JSON.stringify(next)) } catch {}
    if (userId === myId) return
    viewQueueRef.current.push(storyId)
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    flushTimerRef.current = setTimeout(flushViews, 2000)
  }

`;

// ============================================================================
// Patch 3 — StoryComposer.jsx
// ============================================================================
const SC_PATH = 'src/components/StoryComposer.jsx';
const SC_ALREADY_MARKER = 'authFetch("/api/stories"';

const SC_OLD = String.raw`      const { error: dbErr } = await supabase.from("stories").insert({
        user_id: myId,
        media_url: pub.publicUrl,
        media_type: finalMediaType,
        caption: meta.caption || null,
        audience: meta.audience || "everyone",
        metadata: meta.metadata || {},
        link_url: meta.metadata?.link?.url || null,
        music_track: meta.metadata?.music || null
      })
      if (dbErr) throw new Error(dbErr.message)`;

const SC_NEW = String.raw`      const res = await authFetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_url: pub.publicUrl,
          media_type: finalMediaType,
          caption: meta.caption || null,
          audience: meta.audience || "everyone",
          metadata: meta.metadata || {},
          link_url: meta.metadata?.link?.url || null,
          music_track: meta.metadata?.music || null
        })
      })
      const jres = await res.json()
      if (!jres.success) throw new Error(jres.error || "Failed to create story")`;

// ============================================================================
// Apply
// ============================================================================
{
  const rel = 'backend/_worker.js';
  const src = read(rel);
  assertAnchors(src, [WORKER_ANCHOR], rel);
  assertNotPatched(src, WORKER_MARKER, rel);
  writeAtomic(rel, src.replace(WORKER_ANCHOR, STORY_ROUTES + WORKER_ANCHOR));
}
{
  const rel = SR_PATH;
  const src = read(rel);
  assertAnchors(src, [SR_RENDER_ANCHOR, SR_OLD_LOGIC_MARKER], rel);
  assertNotPatched(src, SR_ALREADY_MARKER, rel);
  const idx = src.indexOf(SR_RENDER_ANCHOR);
  writeAtomic(rel, STORIES_ROW_HEADER + src.slice(idx));
}
{
  const rel = SC_PATH;
  const src = read(rel);
  assertAnchors(src, [SC_OLD], rel);
  assertNotPatched(src, SC_ALREADY_MARKER, rel);
  let out = src.replace(SC_OLD, SC_NEW);
  if (!/from "\.\.\/lib\/authFetch"/.test(out)) {
    const IMP = 'import { supabase } from "../lib/supabase"';
    assertAnchors(out, [IMP], rel + ' (import)');
    out = out.replace(IMP, IMP + '\nimport { authFetch } from "../lib/authFetch"');
  }
  writeAtomic(rel, out);
}

console.log('');
console.log('🎉 T2 Stories patch complete.');
console.log('   next:  npm run build && git add -A && git commit -m "T2: stories feed + views + create + reply + delete" && git push');
console.log('   revert: node scripts/patch-stories-feed.cjs --revert');
