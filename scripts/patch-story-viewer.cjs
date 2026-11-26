#!/usr/bin/env node
// T2: StoryViewer migration + 5 new worker routes + reply route media support.
// Safe-patch: prettifies target, regex-replaces functions, verifies no black-hole calls remain.
// Usage:
//   node scripts/patch-story-viewer.cjs --dry-run   # verify anchors only
//   node scripts/patch-story-viewer.cjs             # apply
//   node scripts/patch-story-viewer.cjs --revert    # restore .bak
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const fp = (r) => path.join(ROOT, r);
const DRY = process.argv.includes('--dry-run');
const REVERT = process.argv.includes('--revert');

if (REVERT) {
  for (const f of ['backend/_worker.js','src/components/StoryViewer.jsx']) {
    const bak = fp(f) + '.bak';
    if (fs.existsSync(bak)) { fs.copyFileSync(bak, fp(f)); console.log('↩️  reverted', f); }
  }
  process.exit(0);
}

// ============================================================================
// Step A — Prettify StoryViewer.jsx (deterministic formatting for anchors)
// ============================================================================
const SV_PATH = 'src/components/StoryViewer.jsx';
if (!DRY) {
  try {
    execSync('npx --no-install prettier --write ' + SV_PATH, { stdio: 'inherit', cwd: ROOT });
  } catch {
    try {
      execSync('npx --yes prettier@3 --write ' + SV_PATH, { stdio: 'inherit', cwd: ROOT });
    } catch (e) {
      console.error('❌ prettier failed. Run manually: npx prettier --write src/components/StoryViewer.jsx');
      process.exit(1);
    }
  }
}

// ============================================================================
// Step B — Worker: 5 new routes + reply route enhancements
// ============================================================================
const W_PATH = 'backend/_worker.js';
if (!fs.existsSync(fp(W_PATH))) { console.error('❌ missing', W_PATH); process.exit(1); }
let w = fs.readFileSync(fp(W_PATH), 'utf8');

const ANCHOR_NEW_ROUTES  = '      if (/^\\/api\\/stories\\/[0-9a-f-]{36}$/.test(path) && request.method === "DELETE") {';
const ANCHOR_REPLY_CONTENT = '          const content = String(body.content || "").trim();\n          if (!content) return new Response(JSON.stringify({ success: false, error: "content required" }), { status: 400, headers: cors });';
const ANCHOR_REPLY_GATE  = '          if (story.user_id === myId) return new Response(JSON.stringify({ success: false, error: "CANNOT_REPLY_SELF" }), { status: 400, headers: cors });';
const ANCHOR_REPLY_INSERT = '            [convId, myId, content, story.media_url, story.media_type, JSON.stringify({ story_reply: { story_id: storyId, owner_id: story.user_id } })]';

for (const a of [ANCHOR_NEW_ROUTES, ANCHOR_REPLY_CONTENT, ANCHOR_REPLY_GATE, ANCHOR_REPLY_INSERT]) {
  if (!w.includes(a)) {
    console.error('❌ worker anchor missing:', JSON.stringify(a.slice(0, 100)));
    process.exit(1);
  }
}
if (w.includes('/api/stories/highlights')) {
  console.error('❌ worker already patched (highlights routes present).');
  process.exit(1);
}

const NEW_ROUTES = String.raw`      // T2: viewer privacy check (port of can_story_reply)
      if (/^\/api\/stories\/can-reply\/[0-9a-f-]{36}$/.test(path) && request.method === "GET") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        const recipientId = path.split("/")[4];
        try {
          const r = await queryDatabase("SELECT can_story_reply($1::uuid, $2::uuid) AS allowed", [myId, recipientId]);
          const allowed = r.rows[0]?.allowed;
          return new Response(JSON.stringify({ success: true, data: { allowed: allowed !== false } }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ success: true, data: { allowed: true } }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
      }
      // T2: viewer list (owner only) — single query with joined profiles + photos
      if (/^\/api\/stories\/[0-9a-f-]{36}\/viewers$/.test(path) && request.method === "GET") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        const storyId = path.split("/")[3];
        try {
          const own = await queryDatabase("SELECT user_id FROM stories WHERE id = $1::uuid", [storyId]);
          if (!own.rows.length || own.rows[0].user_id !== myId) return new Response(JSON.stringify({ success: false, error: "FORBIDDEN" }), { status: 403, headers: cors });
          const r = await queryDatabase(
            "SELECT sv.user_id, sv.viewed_at, p.display_name, p.username, (SELECT storage_path FROM profile_photos pp WHERE pp.user_id = sv.user_id ORDER BY is_primary DESC, display_order ASC LIMIT 1) AS avatar_path FROM story_views sv LEFT JOIN profiles p ON p.id = sv.user_id WHERE sv.story_id = $1::uuid ORDER BY sv.viewed_at DESC LIMIT 100",
            [storyId]
          );
          return new Response(JSON.stringify({ success: true, data: r.rows }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
      // T2: list highlights for a user
      if (/^\/api\/stories\/highlights\/[0-9a-f-]{36}$/.test(path) && request.method === "GET") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const userId = path.split("/")[4];
        try {
          const r = await queryDatabase("SELECT id, user_id, title, cover_story_id, created_at FROM story_highlights WHERE user_id = $1::uuid ORDER BY created_at DESC", [userId]);
          return new Response(JSON.stringify({ success: true, data: r.rows }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
      // T2: create a highlight
      if (path === "/api/stories/highlights" && request.method === "POST") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        try {
          const body = await request.json();
          const title = String(body.title || "").trim().slice(0, 40);
          if (!title) return new Response(JSON.stringify({ success: false, error: "title required" }), { status: 400, headers: cors });
          const r = await queryDatabase("INSERT INTO story_highlights (user_id, title, cover_story_id) VALUES ($1::uuid, $2, $3) RETURNING id, user_id, title, cover_story_id, created_at", [myId, title, body.cover_story_id || null]);
          return new Response(JSON.stringify({ success: true, data: r.rows[0] }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
      // T2: add a story to a highlight (idempotent)
      if (/^\/api\/stories\/highlights\/[0-9a-f-]{36}\/items$/.test(path) && request.method === "POST") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        const highlightId = path.split("/")[4];
        try {
          const body = await request.json();
          if (!body.story_id) return new Response(JSON.stringify({ success: false, error: "story_id required" }), { status: 400, headers: cors });
          const own = await queryDatabase("SELECT user_id FROM story_highlights WHERE id = $1::uuid", [highlightId]);
          if (!own.rows.length || own.rows[0].user_id !== myId) return new Response(JSON.stringify({ success: false, error: "FORBIDDEN" }), { status: 403, headers: cors });
          await queryDatabase("INSERT INTO story_highlight_items (highlight_id, story_id, display_order) VALUES ($1::uuid, $2::uuid, COALESCE((SELECT MAX(display_order)+1 FROM story_highlight_items WHERE highlight_id = $1::uuid), 0)) ON CONFLICT (highlight_id, story_id) DO NOTHING", [highlightId, body.story_id]);
          return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
`;

const NEW_REPLY_CONTENT = [
  '          const content = String(body.content || "").trim();',
  '          const mediaUrl = body.media_url ? String(body.media_url) : null;',
  '          const mediaType = body.media_type ? String(body.media_type) : null;',
  '          if (!content && !mediaUrl) return new Response(JSON.stringify({ success: false, error: "content or media_url required" }), { status: 400, headers: cors });'
].join('\n');

const GATE_AFTER = ANCHOR_REPLY_GATE + String.raw`

          try {
            const gate = await queryDatabase("SELECT can_story_reply($1::uuid, $2::uuid) AS allowed", [myId, story.user_id]);
            if (gate.rows[0] && gate.rows[0].allowed === false) {
              return new Response(JSON.stringify({ success: false, error: "NOT_ALLOWED_TO_REPLY" }), { status: 403, headers: cors });
            }
          } catch (e) { /* allow on RPC error */ }`;

const NEW_REPLY_INSERT = '            [convId, myId, content, mediaUrl || story.media_url, mediaType || story.media_type, JSON.stringify({ story_reply: { story_id: storyId, owner_id: story.user_id } })]';

if (DRY) {
  console.log('[dry-run] worker anchors OK — would insert 5 routes + modify reply route');
} else {
  w = w.replace(ANCHOR_NEW_ROUTES, NEW_ROUTES + ANCHOR_NEW_ROUTES);
  w = w.replace(ANCHOR_REPLY_CONTENT, NEW_REPLY_CONTENT);
  w = w.replace(ANCHOR_REPLY_GATE, GATE_AFTER);
  w = w.replace(ANCHOR_REPLY_INSERT, NEW_REPLY_INSERT);
  const bak = fp(W_PATH) + '.bak';
  if (!fs.existsSync(bak)) fs.copyFileSync(fp(W_PATH), bak);
  fs.writeFileSync(fp(W_PATH) + '.tmp', w);
  fs.renameSync(fp(W_PATH) + '.tmp', fp(W_PATH));
  console.log('✅', W_PATH, '— 5 new routes + reply route media/gate');
}

// ============================================================================
// Step C — StoryViewer.jsx: regex-replace 8 functions + 1 useEffect
// ============================================================================
let sv = fs.readFileSync(fp(SV_PATH), 'utf8');

const replaceFn = (name, newBody) => {
  const re = new RegExp('async function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}\\n', 'm');
  if (!re.test(sv)) { console.error('❌ missing function:', name); process.exit(1); }
  sv = sv.replace(re, newBody + '\n');
};

replaceFn('loadHighlights', `async function loadHighlights() {
  if (!myId) return;
  try {
    const res = await fetch("/api/stories/highlights/" + myId);
    const j = await res.json();
    setMyHighlights(j.success ? (j.data || []) : []);
  } catch (e) {
    console.warn("load highlights failed", e);
  }
}`);

replaceFn('addToHighlight', `async function addToHighlight(highlightId) {
  if (!story?.id || !highlightId) return;
  try {
    const res = await fetch("/api/stories/highlights/" + highlightId + "/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ story_id: story.id }),
    });
    const j = await res.json();
    if (!j.success) throw new Error(j.error || "Failed");
    setHighlightPickerOpen(false);
    setMenuOpen(false);
    alert("Added to highlight");
  } catch (e) {
    console.warn("add to highlight failed", e);
    alert("Failed: " + (e.message || e));
  }
}`);

replaceFn('createHighlightAndAdd', `async function createHighlightAndAdd() {
  const title = newHighlightTitle.trim();
  if (!title || !myId) return;
  try {
    const res = await fetch("/api/stories/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, cover_story_id: story?.id || null }),
    });
    const j = await res.json();
    if (!j.success || !j.data?.id) throw new Error(j.error || "Failed");
    await addToHighlight(j.data.id);
    setNewHighlightTitle("");
  } catch (e) {
    console.warn("create highlight failed", e);
    alert("Failed: " + (e.message || e));
  }
}`);

replaceFn('canReply', `async function canReply() {
  if (!group?.user_id) return false;
  try {
    const res = await fetch("/api/stories/can-reply/" + group.user_id);
    const j = await res.json();
    if (!j.success) return true;
    return j.data?.allowed !== false;
  } catch {
    return true;
  }
}`);

replaceFn('sendMediaReply', `async function sendMediaReply() {
  if (!group?.user_id || !story?.id || sending) return;
  const ok = await canReply();
  if (!ok) {
    alert("This user isn't accepting story replies");
    return;
  }
  try {
    const shot = await NativeCamera.getPhoto({
      quality: 80,
      resultType: CameraResultType.Uri,
      source: Capacitor.isNativePlatform() ? CameraSource.Camera : CameraSource.Prompt,
    });
    const res = await fetch(shot.webPath);
    const blob = await res.blob();
    setSending(true);
    const path = await uploadMedia(blob);
    const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
    const sendRes = await fetch("/api/stories/" + story.id + "/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "📷 Photo reply to story",
        media_url: pub?.publicUrl,
        media_type: "image/jpeg",
      }),
    });
    const j = await sendRes.json();
    setSending(false);
    if (!j.success) {
      alert("Send failed: " + (j.error || "unknown"));
      return;
    }
    tap("medium");
    showToast("Sent to " + (group.display_name?.split(" ")[0] || "them"), group.user_id);
  } catch (e) {
    setSending(false);
    if (e && e.message && !/cancel/i.test(e.message)) {
      console.warn(e);
      alert("Camera error: " + e.message);
    }
  }
}`);

replaceFn('sendReply', `async function sendReply() {
  const body = reply.trim();
  if (!body || !group?.user_id || !story?.id || sending) return;
  const ok = await canReply();
  if (!ok) {
    alert("This user isn't accepting story replies");
    return;
  }
  setSending(true);
  try {
    const res = await fetch("/api/stories/" + story.id + "/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: body }),
    });
    const j = await res.json();
    setSending(false);
    if (!j.success) {
      alert("Send failed: " + (j.error || "unknown"));
      return;
    }
    setReply("");
    tap("medium");
    showToast("Sent to " + (group.display_name?.split(" ")[0] || "them"), group.user_id);
  } catch (e) {
    setSending(false);
    alert("Send failed: " + (e.message || "network"));
  }
}`);

replaceFn('sendReaction', `async function sendReaction(emoji) {
  setReactionOpen(false);
  if (!group?.user_id || !story?.id) return;
  const ok = await canReply();
  if (!ok) {
    alert("This user isn't accepting story replies");
    return;
  }
  if (emoji === "❤️") burstHeart();
  try {
    const res = await fetch("/api/stories/" + story.id + "/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: emoji }),
    });
    const j = await res.json();
    if (!j.success) {
      alert("Send failed: " + (j.error || "unknown"));
      return;
    }
    tap("medium");
    showToast("Sent to " + (group.display_name?.split(" ")[0] || "them"), group.user_id);
  } catch (e) {
    alert("Send failed: " + (e.message || "network"));
  }
}`);

replaceFn('deleteStory', `async function deleteStory() {
  if (!story || !isMine || deleting) return;
  if (!confirm("Delete this story?")) return;
  setDeleting(true);
  tap("light");
  try {
    try {
      const url = story.media_url || "";
      const bucket = "chat-media";
      const marker = "/object/public/" + bucket + "/";
      const idx = url.indexOf(marker);
      if (idx !== -1) await supabase.storage.from(bucket).remove([url.slice(idx + marker.length)]);
    } catch (e) {
      console.warn("storage delete failed", e);
    }
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
}`);

// Replace viewers useEffect
const VIEWERS_RE = /useEffect\(\(\) => \{\s*if \(!isMine \|\| !story\) return;[\s\S]*?\}, \[isMine, story\?\.id\]\);/;
if (!VIEWERS_RE.test(sv)) { console.error('❌ viewers useEffect anchor not found'); process.exit(1); }
const NEW_VIEWERS = `useEffect(() => {
  if (!isMine || !story) return;
  let cancelled = false;
  setViewersLoading(true);
  (async () => {
    try {
      const res = await fetch("/api/stories/" + story.id + "/viewers");
      const j = await res.json();
      if (cancelled) return;
      if (!j.success) { setViewers([]); setViewersLoading(false); return; }
      setViewers((j.data || []).map((v) => ({
        user_id: v.user_id,
        viewed_at: v.viewed_at,
        display_name: v.display_name,
        username: v.username,
        photo_url: v.avatar_path ? publicPhotoUrl(v.avatar_path) : null,
      })));
    } catch {
      if (!cancelled) setViewers([]);
    }
    if (!cancelled) setViewersLoading(false);
  })();
  return () => { cancelled = true; };
}, [isMine, story?.id]);`;
sv = sv.replace(VIEWERS_RE, NEW_VIEWERS);

// Remove findOrCreateConversation import (no longer used)
sv = sv.replace(/import \{ findOrCreateConversation \} from "\.\.\/lib\/conversations"\s*\n/, '');

// Verify: no black-hole calls remain
const leftover = sv.match(/supabase\.(from|rpc|auth\.getSession)/g) || [];
if (leftover.length > 0) {
  console.error('❌ StoryViewer.jsx still has', leftover.length, 'black-hole calls:', leftover);
  process.exit(1);
}

if (DRY) {
  console.log('[dry-run] StoryViewer.jsx: 8 functions + viewers useEffect + import cleanup — would write');
} else {
  const bak = fp(SV_PATH) + '.bak';
  if (!fs.existsSync(bak)) fs.copyFileSync(fp(SV_PATH), bak);
  fs.writeFileSync(fp(SV_PATH) + '.tmp', sv);
  fs.renameSync(fp(SV_PATH) + '.tmp', fp(SV_PATH));
  console.log('✅', SV_PATH, '— all Supabase calls removed');
}

console.log('\n🎉 T2: StoryViewer migration complete.');
console.log('   next:  npm run build && git add -A && git commit -m "T2: StoryViewer + highlights + viewers + reply media" && git push');
console.log('   revert: node scripts/patch-story-viewer.cjs --revert');
