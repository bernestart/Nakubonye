import { getAuth } from "./auth.js";
export class ChatRoomSQLite {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');

    // 1. POST Broadcast (from API)
    if (request.method === 'POST' && upgradeHeader !== 'websocket') {
      const message = await request.text();
      // Get ALL active websockets (wakes up hibernating objects)
      const sessions = this.state.getWebSockets();
      sessions.forEach(s => {
        try { s.send(message); } catch (e) {}
      });
      return new Response("Broadcasted", { status: 200 });
    }

    // 2. WebSocket Upgrade
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // HIBERNATION API: Automatically manages sessions and memory
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // HIBERNATION EVENT: Handles incoming messages from clients
  async webSocketMessage(ws, message) {
    // Clients may only relay tiny typing frames; real messages arrive via the authenticated REST API.
    let ok = false;
    if (typeof message === "string" && message.length <= 512) {
      try { ok = JSON.parse(message).type === "typing"; } catch (e) {}
    }
    if (!ok) {
      console.warn("[WS] dropped client frame");
      if (this.env.AUTH_ENFORCE === "1") return;
    }
    for (const s of this.state.getWebSockets()) {
      if (s !== ws) { try { s.send(message); } catch (e) {} }
    }
  }

  // HIBERNATION EVENT: Handles cleanly closing connections
  async webSocketClose(ws, code, reason, wasClean) {
    try { ws.close(!code || code === 1005 || code === 1006 || code === 1015 ? 1000 : code, "closing"); } catch (e) {}
  }
  
  // HIBERNATION EVENT: Handles errors
  async webSocketError(ws, error) {
    ws.close(1011, "WebSocket error");
  }
}

const SESS_CACHE = new Map();
async function getSessionUser(request, env, url) {
  let headers = request.headers;
  let tok = null;
  const ah = headers.get("Authorization");
  if (ah && ah.startsWith("Bearer ")) tok = ah.slice(7).trim();
  else if (url.searchParams.get("token")) {
    tok = url.searchParams.get("token");
    headers = new Headers(headers);
    headers.set("Authorization", "Bearer " + tok);
  }
  if (!tok) return null;
  const hit = SESS_CACHE.get(tok);
  if (hit && hit.exp > Date.now()) return hit.user;
  try {
    const res = await getAuth(env).api.getSession({ headers });
    const user = res && res.user ? { id: String(res.user.id), email: res.user.email } : null;
    if (user) {
      if (SESS_CACHE.size > 500) SESS_CACHE.clear();
      SESS_CACHE.set(tok, { user, exp: Date.now() + 30000 });
    }
    return user;
  } catch (e) {
    console.warn("[AUTH] getSession failed", e && e.message);
    return null;
  }
}

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);
    const path = url.pathname;
    // 0. PING ROUTE (Verification)
    if (path === "/api/ping") {
      return new Response(JSON.stringify({ ping: "pong", time: new Date().toISOString() }), { headers: cors });
    }

    // Better Auth mount
    if (path.startsWith("/api/auth/")) {
      try {
        const auth = getAuth(env);
        const res = await auth.handler(request);
        const h = new Headers(res.headers);
        h.set("Access-Control-Allow-Origin", "*");
        h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        return new Response(res.body, { status: res.status, headers: h });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: "AUTH_CRASH", message: err.message }), { status: 500, headers: cors });
      }
    }


    
    

    
    

    async function queryDatabase(sqlQuery, params = []) {
      const dbUrl = new URL(env.DATABASE_URL);
      const endpoint = `https://${dbUrl.hostname}/sql`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Neon-Connection-String": env.DATABASE_URL },
        body: JSON.stringify({ query: sqlQuery, params: params })
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    }

        async function redisCommand(commandArray) {
      const res = await fetch(env.UPSTASH_REDIS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(commandArray)
      });
      return await res.json();
    }

    async function getRedisLikes(postId) {
      try {
        const redisRes = await fetch(env.UPSTASH_REDIS_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(["SCARD", `post:likes:${postId}`])
        });
        const redisData = await redisRes.json();
        return redisData.result || 0;
      } catch (e) { return 0; }
    }

    async function getBulkRedisLikes(postIds) {
      if (!postIds || postIds.length === 0) return {};
      try {
        // Upstash Pipeline: Send an array of commands in a single HTTP request
        const pipeline = postIds.map(id => ["SCARD", `post:likes:${id}`]);
        const redisRes = await fetch(env.UPSTASH_REDIS_URL + "/pipeline", {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(pipeline)
        });
        const redisData = await redisRes.json();
        
        // Map the results back to their post IDs
        const resultMap = {};
        postIds.forEach((id, index) => {
          resultMap[id] = redisData[index]?.result || 0;
        });
        return resultMap;
      } catch (e) { 
        console.error("Bulk Redis Error", e);
        return {}; 
      }
    }

    // ===== PHASE 1: AUTH GATE. AUTH_ENFORCE="1" blocks; otherwise log-only. =====
    const ENFORCE = env.AUTH_ENFORCE === "1";
    const deny = (status, error) => new Response(JSON.stringify({ success: false, error }), { status, headers: { ...cors, "Content-Type": "application/json" } });
    if (path.startsWith("/api/") && !path.startsWith("/api/media/")) {
      const authUser = await getSessionUser(request, env, url);
      // ===== S1: STRICT ROUTES (always need a session; ids must equal the session user) =====
      const STRICT_ROUTES = ["/api/messages/action", "/api/chat/state", "/api/inbox/bootstrap", "/api/inbox/read", "/api/inbox/action"];
      if (path === "/api/chat/permissions" && !authUser) return deny(401, "UNAUTHENTICATED");
      if (path === "/api/chat/permissions" && String(url.searchParams.get("sender") || "").toLowerCase() !== String(authUser.id).toLowerCase()) return deny(403, "IDENTITY_MISMATCH");
      if (STRICT_ROUTES.includes(path)) {
        if (!authUser) return deny(401, "UNAUTHENTICATED");
        const ids = [url.searchParams.get("userId"), url.searchParams.get("myId")].filter(Boolean);
        if (request.method === "POST") {
          const sb = await request.clone().json().catch(() => null);
          if (sb && typeof sb === "object") {
            for (const k of ["userId", "myId", "user_id", "sender_id"]) if (sb[k] != null) ids.push(String(sb[k]));
            if (Array.isArray(sb.rows)) for (const r of sb.rows) if (r && typeof r === "object") for (const k of ["userId", "user_id"]) if (r[k] != null) ids.push(String(r[k]));
          }
        }
        if (ids.some((v) => String(v).toLowerCase() !== String(authUser.id).toLowerCase())) return deny(403, "IDENTITY_MISMATCH");
      }
      if (path === "/api/whoami") {
        return authUser ? new Response(JSON.stringify({ success: true, user: authUser }), { headers: { ...cors, "Content-Type": "application/json" } }) : deny(401, "UNAUTHENTICATED");
      }
      if (!authUser) {
        console.warn("[AUTH] unauthenticated " + request.method + " " + path);
        if (ENFORCE) return deny(401, "UNAUTHENTICATED");
      } else {
        const claimed = new Set();
        if (["/api/feed", "/api/feed/bootstrap", "/api/community/posts"].includes(path) && url.searchParams.get("userId")) claimed.add(url.searchParams.get("userId"));
        if (request.method === "POST" && (request.headers.get("content-type") || "").includes("application/json")) {
          const b = await request.clone().json().catch(() => null);
          if (b && typeof b === "object" && !Array.isArray(b)) {
            for (const k of ["sender_id", "senderId", "userId", "user_id", "author_id", "authorId", "pinned_by", "pinnedBy"]) if (b[k] != null) claimed.add(String(b[k]));
            if (path === "/api/profile" && b.id != null) claimed.add(String(b.id));
          }
        }
        for (const v of claimed) {
          if (v !== authUser.id) {
            console.warn("[AUTH] identity mismatch on " + path);
            if (ENFORCE) return deny(403, "IDENTITY_MISMATCH");
            break;
          }
        }

        // ===== PHASE 1e: CHAT MEMBERSHIP. MEMBER_ENFORCE="1" blocks; otherwise log-only. =====
        const MENF = env.MEMBER_ENFORCE === "1";
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const MC = (globalThis.__MC = globalThis.__MC || new Map());
        const chatAccess = async (kind, rawId) => {
          if (!UUID_RE.test(authUser.id)) return { ok: false, why: "legacy-user-id" };
          const id = String(rawId);
          try {
            if (kind === "dm") {
              if (!/^\d{1,18}$/.test(id)) return { ok: false, why: "bad-id" };
              const r = await queryDatabase("SELECT c.initiator_id, c.recipient_id, m.user_one_id, m.user_two_id FROM conversations c LEFT JOIN matches m ON m.id = c.match_id WHERE c.id = $1::bigint", [id]);
              const row = r.rows[0];
              if (!row) return { ok: false, why: "no-such-conversation" };
              const members = [row.initiator_id, row.recipient_id, row.user_one_id, row.user_two_id].filter(Boolean).map(String);
              if (!members.includes(authUser.id)) return { ok: false, why: "not-participant" };
              return { ok: true, others: [...new Set(members.filter(x => x !== authUser.id))] };
            }
            if (kind === "group") {
              if (!UUID_RE.test(id)) return { ok: false, why: "bad-id" };
              const r = await queryDatabase("SELECT 1 FROM group_members WHERE group_id = $1::uuid AND user_id = $2::uuid LIMIT 1", [id, authUser.id]);
              return r.rows.length ? { ok: true } : { ok: false, why: "not-group-member" };
            }
            if (kind === "community") {
              if (!/^\d{1,18}$/.test(id)) return { ok: false, why: "bad-id" };
              const r = await queryDatabase("SELECT 1 FROM community_memberships cm WHERE cm.community_id = $1::bigint AND cm.user_id = $2::uuid AND NOT EXISTS (SELECT 1 FROM community_bans b WHERE b.community_id = cm.community_id AND b.user_id = cm.user_id) LIMIT 1", [id, authUser.id]);
              return r.rows.length ? { ok: true } : { ok: false, why: "not-community-member" };
            }
          } catch (e) { return { ok: false, why: "check-error:" + String(e && e.message).slice(0, 80) }; }
          return { ok: false, why: "unknown-kind" };
        };
        const cachedAccess = async (kind, rawId) => {
          const key = kind + ":" + rawId + ":" + authUser.id;
          const hit = MC.get(key);
          if (hit && hit.exp > Date.now()) return hit.res;
          const res = await chatAccess(kind, rawId);
          if (res.ok) { if (MC.size > 2000) MC.clear(); MC.set(key, { res, exp: Date.now() + 30000 }); }
          return res;
        };
        const ctype = request.headers.get("content-type") || "";
        const rbody = request.method === "POST" && ctype.includes("application/json") ? await request.clone().json().catch(() => null) : null;
        const pick = (...keys) => { for (const k of keys) { const v = rbody && rbody[k] != null ? rbody[k] : url.searchParams.get(k); if (v != null && v !== "") return v; } return null; };
        let room = null;
        if (path.startsWith("/api/messages")) room = { kind: "dm", id: pick("conversation_id", "conversationId") };
        else if (path === "/api/group/messages") room = { kind: "group", id: pick("group_id", "groupId") };
        else if (path.startsWith("/api/community/messages")) room = { kind: "community", id: pick("communityId", "community_id") };
        else if (path.startsWith("/api/ws/")) {
          const rid = decodeURIComponent(path.split("/api/ws/")[1] || "");
          room = rid.startsWith("dm-") ? { kind: "dm", id: rid.slice(3) } : rid.startsWith("group-") ? { kind: "group", id: rid.slice(6) } : { kind: "community", id: rid };
        }
        if (room) {
          if (room.id == null) console.warn("[MEMBER] no room id on " + request.method + " " + path);
          else {
            let res = await cachedAccess(room.kind, room.id);
            if (!res.ok && room.kind === "community" && request.method === "GET" && !path.startsWith("/api/ws/") && res.why === "not-community-member") {
              const pr = await queryDatabase("SELECT 1 FROM communities WHERE id = $1::bigint AND privacy = 'public' LIMIT 1", [String(room.id)]).catch(() => null);
              if (pr && pr.rows.length) res = { ok: true };
            }
            if (res.ok && room.kind === "dm" && request.method !== "GET" && res.others && res.others.length) {
              const bl = await queryDatabase("SELECT 1 FROM blocks WHERE (blocker_id = $1::uuid AND blocked_id = ANY($2::uuid[])) OR (blocked_id = $1::uuid AND blocker_id = ANY($2::uuid[])) LIMIT 1", [authUser.id, res.others]).catch(() => null);
              if (bl && bl.rows.length) res = { ok: false, why: "blocked" };
            }
            if (!res.ok) {
              console.warn("[MEMBER] denied " + room.kind + " " + request.method + " " + path + " why=" + res.why);
              if (MENF) return deny(403, "NOT_A_MEMBER");
            }
          }
        }
      }
    }

    try {
      if (path === "/api/conversations/open" && request.method === "POST") {
        const jh = { ...cors, "Content-Type": "application/json" };
        const out = (status, obj) => new Response(JSON.stringify(obj), { status, headers: jh });
        const me = await getSessionUser(request, env, url);
        if (!me) return out(401, { success: false, error: "UNAUTHENTICATED" });
        const UU = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const b = await request.json().catch(() => ({}));
        const meId = String(me.id).toLowerCase();
        const other = String(b.otherUserId || "").toLowerCase();
        if (!UU.test(meId) || !UU.test(other) || other === meId) return out(400, { success: false, error: "BAD_REQUEST" });
        const prof = await queryDatabase("SELECT only_matches_can_message FROM profiles WHERE id = $1::uuid", [other]);
        if (!prof.rows.length) return out(404, { success: false, error: "USER_NOT_FOUND" });
        const bl = await queryDatabase("SELECT 1 FROM blocks WHERE (blocker_id = $1::uuid AND blocked_id = $2::uuid) OR (blocker_id = $2::uuid AND blocked_id = $1::uuid) LIMIT 1", [meId, other]);
        if (bl.rows.length) return out(403, { success: false, error: "BLOCKED" });
        const lo = meId < other ? meId : other;
        const hi = meId < other ? other : meId;
        const pairQ = "SELECT id FROM conversations WHERE is_direct = true AND ((initiator_id = $1::uuid AND recipient_id = $2::uuid) OR (initiator_id = $2::uuid AND recipient_id = $1::uuid)) ORDER BY created_at DESC LIMIT 1";
        const mt = await queryDatabase("SELECT id FROM matches WHERE user_one_id = $1::uuid AND user_two_id = $2::uuid LIMIT 1", [lo, hi]);
        if (mt.rows.length) {
          const mid = String(mt.rows[0].id);
          const ex = await queryDatabase("SELECT id FROM conversations WHERE match_id = $1::bigint LIMIT 1", [mid]);
          if (ex.rows.length) return out(200, { success: true, id: ex.rows[0].id });
          const ad = await queryDatabase(pairQ, [meId, other]);
          if (ad.rows.length) {
            await queryDatabase("UPDATE conversations SET match_id = $1::bigint WHERE id = $2::bigint", [mid, String(ad.rows[0].id)]);
            return out(200, { success: true, id: ad.rows[0].id });
          }
          try {
            const cr = await queryDatabase("INSERT INTO conversations (match_id) VALUES ($1::bigint) RETURNING id", [mid]);
            return out(200, { success: true, id: cr.rows[0].id });
          } catch (e) {
            const rt = await queryDatabase("SELECT id FROM conversations WHERE match_id = $1::bigint LIMIT 1", [mid]);
            if (rt.rows.length) return out(200, { success: true, id: rt.rows[0].id });
            throw e;
          }
        }
        const dm = await queryDatabase(pairQ, [meId, other]);
        if (dm.rows.length) return out(200, { success: true, id: dm.rows[0].id });
        if (prof.rows[0].only_matches_can_message) return out(403, { success: false, error: "ONLY_MATCHES_CAN_MESSAGE" });
        const nc = await queryDatabase("INSERT INTO conversations (match_id, initiator_id, recipient_id, is_direct) VALUES (NULL, $1::uuid, $2::uuid, true) RETURNING id", [meId, other]);
        return out(200, { success: true, id: nc.rows[0].id });
      }
      if (path === "/api/conversations/timer") {
        const jh = { ...cors, "Content-Type": "application/json" };
        const out = (status, obj) => new Response(JSON.stringify(obj), { status, headers: jh });
        const me = await getSessionUser(request, env, url);
        if (!me) return out(401, { success: false, error: "UNAUTHENTICATED" });
        const meId = String(me.id);
        if (request.method === "GET") {
          const convId = url.searchParams.get("conversationId");
          if (!convId) return out(400, { success: false, error: "MISSING_CONV" });
          const r = await queryDatabase("SELECT c.disappearing_timer_seconds FROM conversations c LEFT JOIN matches mt ON mt.id = c.match_id WHERE c.id = $1::bigint AND ($2::uuid IN (c.initiator_id, c.recipient_id, mt.user_one_id, mt.user_two_id))", [convId, meId]);
          if (!r.rows.length) return out(404, { success: false, error: "NOT_FOUND_OR_NOT_PARTICIPANT" });
          return out(200, { success: true, seconds: r.rows[0].disappearing_timer_seconds });
        }
        if (request.method === "POST") {
          const b = await request.json().catch(() => ({}));
          const convId = String(b.conversationId || "");
          const seconds = b.seconds === null || b.seconds === undefined || b.seconds === "" ? null : Number(b.seconds);
          if (!/^\d{1,18}$/.test(convId)) return out(400, { success: false, error: "BAD_CONV" });
          if (seconds !== null && (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400)) return out(400, { success: false, error: "BAD_SECONDS" });
          const chk = await queryDatabase("SELECT 1 FROM conversations c LEFT JOIN matches mt ON mt.id = c.match_id WHERE c.id = $1::bigint AND ($2::uuid IN (c.initiator_id, c.recipient_id, mt.user_one_id, mt.user_two_id))", [convId, meId]);
          if (!chk.rows.length) return out(403, { success: false, error: "NOT_PARTICIPANT" });
          await queryDatabase("UPDATE conversations SET disappearing_timer_seconds = $1 WHERE id = $2::bigint", [seconds, convId]);
          return out(200, { success: true, seconds });
        }
        return out(405, { success: false, error: "METHOD_NOT_ALLOWED" });
      }
            if (path === "/api/username/available" && request.method === "GET") {
        const jh = { ...cors, "Content-Type": "application/json" };
        const out = (status, obj) => new Response(JSON.stringify(obj), { status, headers: jh });
        const me = await getSessionUser(request, env, url);
        if (!me) return out(401, { success: false, error: "UNAUTHENTICATED" });
        const u = String(url.searchParams.get("u") || "").toLowerCase();
        if (!/^[a-z0-9._]{3,30}$/.test(u) || u.startsWith(".") || u.endsWith(".") || u.includes("..")) return out(200, { success: true, available: false, reason: "INVALID" });
        const r = await queryDatabase("SELECT 1 FROM profiles WHERE lower(username) = $1 AND id::text <> $2 LIMIT 1", [u, String(me.id)]);
        return out(200, { success: true, available: r.rows.length === 0 });
      }
      if (path === "/api/profile/bootstrap" && request.method === "POST") {
        const jh = { ...cors, "Content-Type": "application/json" };
        const out = (status, obj) => new Response(JSON.stringify(obj), { status, headers: jh });
        const me = await getSessionUser(request, env, url);
        if (!me) return out(401, { success: false, error: "UNAUTHENTICATED" });
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(me.id))) return out(409, { success: false, error: "LEGACY_ACCOUNT_ID" });
        const b = await request.json().catch(() => ({}));
        const MIN_AGE = 13; // product decision: set to 13 for a general social network
        const clean = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
        const first = clean(b.firstName), last = clean(b.lastName);
        const displayName = (first + " " + last).trim();
        const username = clean(b.username).toLowerCase();
        const dob = clean(b.dateOfBirth);
        const gender = clean(b.gender).toLowerCase().slice(0, 20);
        if (!first || displayName.length > 60) return out(400, { success: false, error: "INVALID_NAME" });
        if (!/^[a-z0-9._]{3,30}$/.test(username) || username.startsWith(".") || username.endsWith(".") || username.includes("..")) return out(400, { success: false, error: "INVALID_USERNAME" });
        const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
        const dd = dm ? new Date(Date.UTC(+dm[1], +dm[2] - 1, +dm[3])) : null;
        if (!dd || isNaN(dd) || dd.getUTCDate() !== +dm[3] || dd > new Date()) return out(400, { success: false, error: "INVALID_DOB" });
        const now = new Date();
        let age = now.getUTCFullYear() - dd.getUTCFullYear();
        if (now.getUTCMonth() < dd.getUTCMonth() || (now.getUTCMonth() === dd.getUTCMonth() && now.getUTCDate() < dd.getUTCDate())) age--;
        if (age > 120) return out(400, { success: false, error: "INVALID_DOB" });
        if (age < MIN_AGE) return out(403, { success: false, error: "UNDER_MIN_AGE" });
        const taken = await queryDatabase("SELECT 1 FROM profiles WHERE lower(username) = $1 AND id::text <> $2 LIMIT 1", [username, String(me.id)]);
        if (taken.rows.length) return out(409, { success: false, error: "USERNAME_TAKEN" });
        try {
          const ins = await queryDatabase("INSERT INTO profiles (id, display_name, username, date_of_birth, gender) VALUES ($1::uuid, $2, $3, $4::date, $5) ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, username = EXCLUDED.username, date_of_birth = COALESCE(profiles.date_of_birth, EXCLUDED.date_of_birth), gender = COALESCE(EXCLUDED.gender, profiles.gender) RETURNING *", [String(me.id), displayName, username, dob, gender ? gender : null]);
          return out(200, { success: true, data: ins.rows[0] });
        } catch (e) {
          const msg = String((e && e.message) || "");
          if (msg.includes("23505") || /unique|duplicate/i.test(msg)) return out(409, { success: false, error: "USERNAME_TAKEN" });
          console.error("[bootstrap] " + msg.slice(0, 200));
          return out(500, { success: false, error: "PROFILE_CREATE_FAILED" });
        }
      }
      if (path === "/api/inbox" && request.method === "GET") {
        const jh = { ...cors, "Content-Type": "application/json" };
        const out = (status, obj) => new Response(JSON.stringify(obj), { status, headers: jh });
        const me = await getSessionUser(request, env, url);
        if (!me) return out(401, { success: false, error: "UNAUTHENTICATED" });
        const uid = String(me.id).toLowerCase();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uid)) return out(409, { success: false, error: "LEGACY_ACCOUNT_ID" });
        try {
          const R = async (sql, params) => (await queryDatabase(sql, params)).rows;
          const ts = (v) => { if (!v) return null; const s = String(v); const d = new Date(s.includes("T") ? s : s.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")); return isNaN(d) ? null : d.toISOString(); };
          const isFalse = (v) => v === false || v === "f" || v === "false";
          const U = [uid];
          const [matches, directs, mem, cPins, gPins, cArch, gArch, cDel, gDel, reqRows, myFollows, blockRows, reads, mutes, gReads] = await Promise.all([
            R("SELECT id, user_one_id, user_two_id, created_at FROM matches WHERE user_one_id = $1::uuid OR user_two_id = $1::uuid", U),
            R("SELECT id, initiator_id, recipient_id, created_at, last_message_at, last_message_preview FROM conversations WHERE is_direct = true AND (initiator_id = $1::uuid OR recipient_id = $1::uuid)", U),
            R("SELECT group_id FROM group_members WHERE user_id = $1::uuid", U),
            R("SELECT conversation_id FROM conversation_pins WHERE user_id = $1::uuid", U),
            R("SELECT group_id FROM group_pins WHERE user_id = $1::uuid", U),
            R("SELECT conversation_id FROM conversation_archives WHERE user_id = $1::uuid", U),
            R("SELECT group_id FROM group_archives WHERE user_id = $1::uuid", U),
            R("SELECT conversation_id FROM conversation_deletes WHERE user_id = $1::uuid", U),
            R("SELECT group_id FROM group_deletes WHERE user_id = $1::uuid", U),
            R("SELECT COUNT(*)::int AS n FROM message_requests WHERE recipient_id = $1::uuid AND status = 'pending'", U),
            R("SELECT following_id FROM follows WHERE follower_id = $1::uuid", U),
            R("SELECT blocker_id, blocked_id FROM blocks WHERE blocker_id = $1::uuid OR blocked_id = $1::uuid", U),
            R("SELECT conversation_id, last_read_at FROM conversation_reads WHERE user_id = $1::uuid", U),
            R("SELECT conversation_id FROM conversation_mutes WHERE user_id = $1::uuid", U),
            R("SELECT group_id, last_read_at FROM group_reads WHERE user_id = $1::uuid", U),
          ]);
          const matchIds = matches.map((x) => String(x.id));
          const gids = mem.map((x) => String(x.group_id));
          const otherByMatch = new Map(matches.map((x) => [String(x.id), String(x.user_one_id) === uid ? String(x.user_two_id) : String(x.user_one_id)]));
          const directOthers = directs.map((c) => String(c.initiator_id) === uid ? c.recipient_id : c.initiator_id).filter(Boolean).map(String);
          const otherIds = [...new Set([...otherByMatch.values(), ...directOthers])];
          const [convs, groups, lastMsgs, profs, photos, stories, onlineRows] = await Promise.all([
            R("SELECT id, match_id, created_at, last_message_at, last_message_preview FROM conversations WHERE match_id = ANY($1::bigint[])", [matchIds]),
            R("SELECT id, name, avatar_url, updated_at FROM groups WHERE id = ANY($1::uuid[])", [gids]),
            R("SELECT DISTINCT ON (group_id) group_id, content, media_type, created_at, deleted_at FROM group_messages WHERE group_id = ANY($1::uuid[]) ORDER BY group_id, created_at DESC", [gids]),
            R("SELECT id, display_name, username, is_verified, last_seen_at FROM profiles WHERE id = ANY($1::uuid[])", [otherIds]),
            R("SELECT user_id, storage_path FROM profile_photos WHERE user_id = ANY($1::uuid[]) ORDER BY is_primary DESC, display_order ASC", [otherIds]),
            R("SELECT id::text AS id, user_id FROM stories WHERE user_id = ANY($1::uuid[]) AND expires_at > NOW()", [otherIds]),
            R("SELECT id, display_name, username, last_seen_at FROM profiles WHERE last_seen_at > NOW() - INTERVAL '3 minutes' AND id <> $1::uuid AND is_active = true ORDER BY last_seen_at DESC LIMIT 30", U),
          ]);
          const onlineIds = onlineRows.map((r) => String(r.id));
          const storyIds = stories.map((s) => String(s.id));
          const [settings, onPhotos, views] = await Promise.all([
            R("SELECT user_id, who_can_see_online, show_activity_status FROM user_settings WHERE user_id = ANY($1::uuid[])", [onlineIds]),
            R("SELECT user_id, storage_path FROM profile_photos WHERE user_id = ANY($1::uuid[]) ORDER BY is_primary DESC, display_order ASC", [onlineIds]),
            R("SELECT story_id::text AS story_id FROM story_views WHERE user_id = $1::uuid AND story_id::text = ANY($2::text[])", [uid, storyIds]),
          ]);
          const firstPhoto = (arr) => { const mp = new Map(); for (const r of arr) { const k = String(r.user_id); if (!mp.has(k)) mp.set(k, r.storage_path); } return mp; };
          const photoMap = firstPhoto(photos), onPhoto = firstPhoto(onPhotos);
          const profMap = new Map(profs.map((p) => [String(p.id), p]));
          const readsMap = new Map(reads.map((r) => [String(r.conversation_id), r.last_read_at]));
          const convByMatch = new Map(convs.map((c) => [String(c.match_id), c]));
          const isNewer = (a, b) => !!a && (!b || new Date(ts(a)) > new Date(ts(b)));
          const items = [];
          for (const mt of matches) {
            const otherId = otherByMatch.get(String(mt.id));
            const p = profMap.get(otherId);
            if (!p) continue;
            const conv = convByMatch.get(String(mt.id));
            items.push({ matchId: mt.id, conversationId: conv ? conv.id : null, userId: otherId, display_name: p.display_name, username: p.username, is_verified: p.is_verified, photo_path: photoMap.get(otherId) || null, last_seen_at: ts(p.last_seen_at), preview: conv ? conv.last_message_preview : null, lastMessageAt: ts(conv && conv.last_message_at) || ts(mt.created_at), unread: !!(conv && isNewer(conv.last_message_at, readsMap.get(String(conv.id)))), isNewMatch: !(conv && conv.last_message_at) });
          }
          for (const c of directs) {
            const other = String(c.initiator_id) === uid ? c.recipient_id : c.initiator_id;
            if (!other) continue;
            const oid = String(other);
            if (items.some((x) => x.userId === oid)) continue;
            const p = profMap.get(oid);
            if (!p) continue;
            items.push({ matchId: null, conversationId: c.id, userId: oid, display_name: p.display_name, username: p.username, is_verified: p.is_verified, photo_path: photoMap.get(oid) || null, last_seen_at: ts(p.last_seen_at), preview: c.last_message_preview || null, lastMessageAt: ts(c.last_message_at) || ts(c.created_at), unread: !!(c.last_message_at && isNewer(c.last_message_at, readsMap.get(String(c.id)))), isDirect: true });
          }
          const mutedSet = new Set(mutes.map((r) => String(r.conversation_id)));
          items.forEach((x) => { x.muted = x.conversationId ? mutedSet.has(String(x.conversationId)) : false; });
          items.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
          const lastByGroup = new Map(lastMsgs.map((x) => [String(x.group_id), x]));
          const gReadMap = new Map(gReads.map((r) => [String(r.group_id), r.last_read_at]));
          const groupItems = groups.map((g) => {
            const last = lastByGroup.get(String(g.id));
            let preview = null;
            if (last && !last.deleted_at) preview = last.media_type && String(last.media_type).startsWith("image/") ? "📷 Photo" : (last.content || null);
            const at = ts(last ? last.created_at : g.updated_at);
            return { isGroup: true, groupId: g.id, conversationId: null, display_name: g.name, photo_url: g.avatar_url || null, preview, lastMessageAt: at, unread: !!(at && isNewer(at, gReadMap.get(String(g.id)))) };
          });
          const blockSet = new Set();
          for (const b of blockRows) { if (String(b.blocker_id) === uid) blockSet.add(String(b.blocked_id)); if (String(b.blocked_id) === uid) blockSet.add(String(b.blocker_id)); }
          const matchSet = new Set(matches.map((x) => String(x.user_one_id) === uid ? String(x.user_two_id) : String(x.user_one_id)));
          const followSet = new Set(myFollows.map((f) => String(f.following_id)));
          const sMap = new Map(settings.map((r) => [String(r.user_id), r]));
          const online = onlineRows.filter((u) => {
            const id = String(u.id);
            if (blockSet.has(id)) return false;
            const row = sMap.get(id);
            if (!row) return true;
            if (isFalse(row.show_activity_status)) return false;
            const v = row.who_can_see_online || "everyone";
            if (v === "nobody") return false;
            if (v === "matches") return matchSet.has(id);
            if (v === "following") return followSet.has(id);
            return true;
          }).map((u) => ({ id: String(u.id), display_name: u.display_name, username: u.username, last_seen_at: ts(u.last_seen_at), photo_path: onPhoto.get(String(u.id)) || null }));
          const dmUsers = new Set(items.map((x) => x.userId));
          const byOwner = new Map();
          for (const s of stories) { const o = String(s.user_id); if (!dmUsers.has(o)) continue; if (!byOwner.has(o)) byOwner.set(o, []); byOwner.get(o).push(String(s.id)); }
          const viewedIds = new Set(views.map((v) => String(v.story_id)));
          const storyOwners = [...byOwner.keys()];
          const viewedStoryOwners = storyOwners.filter((o) => byOwner.get(o).every((id) => viewedIds.has(id)));
          return out(200, { success: true, data: {
            items, groupItems,
            pinned: [...cPins.map((r) => "c:" + r.conversation_id), ...gPins.map((r) => "g:" + r.group_id)],
            archived: [...cArch.map((r) => "c:" + r.conversation_id), ...gArch.map((r) => "g:" + r.group_id)],
            deleted: [...cDel.map((r) => "c:" + r.conversation_id), ...gDel.map((r) => "g:" + r.group_id)],
            online, storyOwners, viewedStoryOwners,
            pendingRequests: (reqRows[0] && reqRows[0].n) || 0,
          } });
        } catch (err) {
          console.error("[inbox] " + String((err && err.message) || "").slice(0, 200));
          return out(500, { success: false, error: "INBOX_FAILED" });
        }
      }

      // WEBSOCKET ROUTE (Real-Time Chat)
      if (path.startsWith("/api/ws/")) {
        if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected WebSocket", { status: 426, headers: cors });
        const roomId = path.split("/api/ws/")[1];
        const id = env.CHAT_ROOMS.idFromName(roomId);
        const obj = env.CHAT_ROOMS.get(id);
        return obj.fetch(request);
      }

      // ONLINE PRESENCE (Redis)
      if (path === "/api/presence" && request.method === "POST") {
        const body = await request.json();
        if (body.isOnline) {
          await redisCommand(["SET", `online:${body.userId}`, "true", "EX", 300]); 
        } else {
          await redisCommand(["DEL", `online:${body.userId}`]);
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // TYPING INDICATOR (Redis)
      if (path === "/api/typing" && request.method === "POST") {
        const body = await request.json();
        if (body.isTyping) {
          await redisCommand(["SET", `typing:${body.roomId}:${body.userId}`, "true", "EX", 3]);
        } else {
          await redisCommand(["DEL", `typing:${body.roomId}:${body.userId}`]);
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // BULK PRESENCE API (Privacy-Aware)
      if (path === "/api/presence/bulk" && request.method === "GET") {
        const viewerId = url.searchParams.get("viewerId");
        const idsParam = url.searchParams.get("userIds");
        if (!viewerId || !idsParam) return new Response(JSON.stringify({ success: false, error: "viewerId and userIds required" }), { status: 400, headers: cors });

        const userIds = idsParam.split(',');
        
        // 1. Fetch Privacy Settings and Last Seen from Neon
        const placeholders = userIds.map((_, i) => `${i + 1}`).join(',');
        const settingsQuery = `
          SELECT p.id, p.hide_online_status, p.last_seen_at, s.who_can_see_online
          FROM profiles p
          LEFT JOIN user_settings s ON s.user_id = p.id
          WHERE p.id IN (${placeholders})
        `;
        const settingsRes = await queryDatabase(settingsQuery, userIds);
        
        // 2. Fetch Online Status from Redis in Bulk (MGET)
        const redisKeys = userIds.map(id => `online:${id}`);
        const redisRes = await redisCommand(["MGET", ...redisKeys]);
        const redisStatuses = redisRes.result || [];

        // 3. Combine and enforce Privacy
        const result = {};
        userIds.forEach((id, index) => {
          const dbRow = settingsRes.rows.find(r => r.id === id) || {};
          const isOnlineInRedis = redisStatuses[index] === "true";
          
          let canSee = true;
          if (dbRow.hide_online_status) canSee = false;
          if (dbRow.who_can_see_online === 'nobody') canSee = false;
          // Note: 'matches' logic can be added later by checking the matches table

          if (canSee) {
            result[id] = { is_online: isOnlineInRedis, last_seen_at: dbRow.last_seen_at };
          } else {
            result[id] = { is_online: false, last_seen_at: null }; // Hidden
          }
        });

        return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 0. MEDIA PROXY
      if (path.startsWith("/api/media/")) {
        const fileId = decodeURIComponent(path.split("/api/media/")[1]);
        if (!fileId) return new Response("Missing fileId", { status: 400, headers: cors });

        const getFileRes = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/getFile?file_id=${fileId}`);
        const getFileData = await getFileRes.json();
        
        if (!getFileData.ok) {
          return new Response(JSON.stringify({ error: "Telegram rejected ID", details: getFileData }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
        }

        const filePath = getFileData.result.file_path;
        const imageRes = await fetch(`https://api.telegram.org/file/bot${env.TG_BOT_TOKEN}/${filePath}`);
        
        return new Response(imageRes.body, {
          headers: { ...cors, "Content-Type": imageRes.headers.get("Content-Type") || "image/jpeg", "Cache-Control": "public, max-age=31536000" }
        });
      }

      // 1. UPLOAD
      if (path === "/api/upload" && request.method === "POST") {
        try {
          const MAX_BYTES = 20 * 1024 * 1024;
          const contentLength = Number(request.headers.get("content-length") || 0);
          if (contentLength > MAX_BYTES + 512 * 1024) {
            return new Response(JSON.stringify({ success: false, error: `File too large. Max 20MB (got ${(contentLength / 1024 / 1024).toFixed(1)}MB).` }), { status: 413, headers: { ...cors, "Content-Type": "application/json" } });
          }

          const formData = await request.formData();
          const file = formData.get("file");
          if (!file) return new Response(JSON.stringify({ success: false, error: "No file provided" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

          if (typeof file.size === "number" && file.size > MAX_BYTES) {
            return new Response(JSON.stringify({ success: false, error: `File too large. Max 20MB (got ${(file.size / 1024 / 1024).toFixed(1)}MB).` }), { status: 413, headers: { ...cors, "Content-Type": "application/json" } });
          }

          const tgFormData = new FormData();
          tgFormData.append("chat_id", env.TG_CHAT_ID);
          tgFormData.append("document", file);

          const tgRes = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendDocument`, { method: "POST", body: tgFormData });
          const tgData = await tgRes.json();
          if (!tgData.ok) throw new Error(tgData.description || "Telegram upload failed");

          return new Response(JSON.stringify({ success: true, file_id: tgData.result.document.file_id }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message || "Upload failed" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
        }
      }

      // 2. GET RANKED FEED
      if (path === "/api/feed" && request.method === "GET") {
        const userId = url.searchParams.get("userId");
        const limit = url.searchParams.get("limit") || 20;
        const offset = url.searchParams.get("offset") || 0;
        if (!userId) return new Response(JSON.stringify({ success: false, error: "userId required" }), { status: 400, headers: cors });

        const data = await queryDatabase(`SELECT * FROM get_ranked_feed($1::uuid, $2::integer, $3::integer)`, [userId, limit, offset]);
        
        // N+1 FIX: Fetch all like counts in 1 batch instead of 20 sequential requests
        const postIds = data.rows.map(p => p.post_id);
        const likesMap = await getBulkRedisLikes(postIds);
        
        const postsWithLikes = data.rows.map(post => ({
          ...post,
          likes_count: likesMap[post.post_id] || 0
        }));
        
        return new Response(JSON.stringify({ success: true, data: postsWithLikes }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 3. POSTS (Personal)
      if (path === "/api/posts") {
        if (request.method === "POST") {
          const body = await request.json();
          const insertQuery = `
            INSERT INTO user_posts (user_id, content, image_path, image_paths, audience, reshared_from_type, reshared_from_id, reshared_from_snapshot, reshared_include_original, location_text, location, feeling_text, publish_at, who_can_comment, ai_label, share_to_story, tagged_user_ids, background_style, image_alts) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::geography, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *; 
          `;
          const params = [body.user_id, body.content, body.image_path, body.image_paths || [], body.audience || 'public', body.reshared_from_type, body.reshared_from_id, body.reshared_from_snapshot ? JSON.stringify(body.reshared_from_snapshot) : null, body.reshared_include_original, body.location_text, body.location, body.feeling_text, body.publish_at, body.who_can_comment, body.ai_label, body.share_to_story, body.tagged_user_ids || [], body.background_style, body.image_alts ? JSON.stringify(body.image_alts) : null];
          const data = await queryDatabase(insertQuery, params);
          return new Response(JSON.stringify({ success: true, data: data.rows[0] }), { headers: { ...cors, "Content-Type": "application/json" } });
        }

        if (request.method === "GET") {
          const singlePostId = url.searchParams.get("id");
          if (singlePostId) {
            const data = await queryDatabase(`SELECT * FROM user_posts WHERE id = $1`, [singlePostId]);
            if (data.rows.length === 0) return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: cors });
            const likesCount = await getRedisLikes(singlePostId);
            return new Response(JSON.stringify({ success: true, data: { ...data.rows[0], likes_count: likesCount } }), { headers: { ...cors, "Content-Type": "application/json" } });
          }

          const userId = url.searchParams.get("userId");
          let query = `SELECT id, content, image_path, created_at, audience, user_id FROM user_posts WHERE is_active = true`;
          let params = [];
          if (userId) { query += ` AND user_id = $1`; params.push(userId); }
          query += ` ORDER BY created_at DESC LIMIT 60`;
          const data = await queryDatabase(query, params);
          
          const postsWithLikes = [];
          for (const post of data.rows) {
            const likesCount = await getRedisLikes(post.id);
            postsWithLikes.push({ ...post, likes_count: likesCount });
          }
          return new Response(JSON.stringify({ success: true, data: postsWithLikes }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
      }

      // 4. COMMUNITY POSTS
      if (path === "/api/community/posts" && request.method === "GET") {
        const singlePostId = url.searchParams.get("id");
        if (singlePostId) {
          const data = await queryDatabase(`SELECT * FROM community_posts WHERE id = $1 AND deleted_at IS NULL`, [singlePostId]);
          if (data.rows.length === 0) return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: cors });
          const likesCount = await getRedisLikes(singlePostId);
          return new Response(JSON.stringify({ success: true, data: { ...data.rows[0], likes_count: likesCount } }), { headers: { ...cors, "Content-Type": "application/json" } });
        }

        const idsParam = url.searchParams.get("communityIds");
        const userId = url.searchParams.get("userId"); 
        if (!idsParam || !userId) return new Response(JSON.stringify({ success: false, error: "communityIds and userId required" }), { status: 400, headers: cors });

        const communityIds = idsParam.split(',').map(Number);
        const data = await queryDatabase(`
          SELECT cp.id, cp.author_id, cp.community_id, cp.content, cp.image_path, cp.image_paths, cp.created_at, cp.pinned_until, cp.is_announcement
          FROM community_posts cp
          JOIN community_memberships cm ON cm.community_id = cp.community_id
          WHERE cp.community_id = ANY($1::bigint[]) 
            AND cp.deleted_at IS NULL
            AND cm.user_id = $2 
          ORDER BY cp.created_at DESC LIMIT 30
        `, [communityIds, userId]);

        const postsWithLikes = [];
        for (const post of data.rows) {
          const likesCount = await getRedisLikes(post.id);
          postsWithLikes.push({ ...post, likes_count: likesCount });
        }
        return new Response(JSON.stringify({ success: true, data: postsWithLikes }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 4.5 DIRECT MESSAGES (DM)
      // --- MESSAGE REACTIONS ---
      if (path === "/api/messages/reactions" && request.method === "GET") {
        const idsParam = url.searchParams.get("messageIds");
        if (!idsParam) return new Response(JSON.stringify({ success: false, error: "messageIds required" }), { status: 400, headers: cors });
        const ids = idsParam.split(',');
        
        const data = await queryDatabase(`SELECT message_id, user_id, reaction FROM message_reactions WHERE message_id IN (${placeholders})`, ids);
        return new Response(JSON.stringify({ success: true, data: data.rows }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (path === "/api/messages/reactions" && request.method === "POST") {
        const body = await request.json();
        const { message_id, user_id, reaction, conversation_id } = body;
        if (reaction) {
          await queryDatabase(`INSERT INTO message_reactions (message_id, user_id, reaction) VALUES ($1, $2, $3) ON CONFLICT (message_id, user_id) DO UPDATE SET reaction = $3`, [message_id, user_id, reaction]);
        } else {
          await queryDatabase(`DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2`, [message_id, user_id]);
        }
        try {
          const id = env.CHAT_ROOMS.idFromName("dm-" + conversation_id);
          const obj = env.CHAT_ROOMS.get(id);
          await obj.fetch("https://dummy.com/", { method: "POST", body: JSON.stringify({ type: 'reaction', data: { message_id, user_id, reaction } }) });
        } catch(e) {}
        return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // --- PINNED MESSAGES ---
      if (path === "/api/messages/pinned" && request.method === "GET") {
        const convId = url.searchParams.get("conversationId");
        const pin = await queryDatabase(`SELECT message_id, pinned_by FROM pinned_messages WHERE conversation_id = $1`, [convId]);
        if (pin.rows.length === 0) return new Response(JSON.stringify({ success: true, data: null }), { headers: cors });
        const msg = await queryDatabase(`SELECT id, sender_id, content, created_at, edited_at, media_url, media_type, deleted_at FROM messages WHERE id = $1`, [pin.rows[0].message_id]);
        if (msg.rows.length === 0) return new Response(JSON.stringify({ success: true, data: null }), { headers: cors });
        return new Response(JSON.stringify({ success: true, data: { ...msg.rows[0], pinned_by: pin.rows[0].pinned_by } }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (path === "/api/messages/pinned" && request.method === "POST") {
        const body = await request.json();
        const { conversation_id, message_id, pinned_by } = body;
        if (!message_id) {
          await queryDatabase(`DELETE FROM pinned_messages WHERE conversation_id = $1`, [conversation_id]);
        } else {
          await queryDatabase(`INSERT INTO pinned_messages (conversation_id, message_id, pinned_by) VALUES ($1, $2, $3) ON CONFLICT (conversation_id) DO UPDATE SET message_id = $2, pinned_by = $3`, [conversation_id, message_id, pinned_by]);
        }
        try {
          const id = env.CHAT_ROOMS.idFromName("dm-" + conversation_id);
          const obj = env.CHAT_ROOMS.get(id);
          await obj.fetch("https://dummy.com/", { method: "POST", body: JSON.stringify({ type: 'pin', data: { message_id } }) });
        } catch(e) {}
        return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // GET MESSAGES (Chat History)
      if (path === "/api/messages" && request.method === "GET") {
        try {
          const conversationId = url.searchParams.get("conversationId");
          const limit = url.searchParams.get("limit") || 50;
          const before = url.searchParams.get("before");
          if (!conversationId) return new Response(JSON.stringify({ success: false, error: "conversationId required" }), { status: 400, headers: cors });

          let query = `SELECT * FROM messages WHERE conversation_id = $1`;
          const params = [conversationId];
          
          if (before) {
            query += ` AND created_at < $2`;
            params.push(before);
          }
          
          query += ` ORDER BY created_at DESC LIMIT ${params.length + 1}`;
          params.push(limit);

          const data = await queryDatabase(query, params);
          // Reverse to return oldest -> newest
          return new Response(JSON.stringify({ success: true, data: data.rows.reverse() }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }

      if (path === "/api/messages" && request.method === "POST") {
        const body = await request.json();
        // S3: derive sender from session when available; fall back to body for legacy APK (Roadmap Rule 3).
        const sessionUser = await getSessionUser(request, env, url);
        if (env.MESSAGES_ENFORCE === "1" && !sessionUser) {
          return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        }
        const senderId = sessionUser ? String(sessionUser.id) : (body.sender_id ? String(body.sender_id) : null);
        if (!sessionUser && body.sender_id) console.warn("[MSG] legacy sender from body");
        if (sessionUser && body.sender_id && String(body.sender_id) !== String(sessionUser.id)) console.warn("[MSG] sender mismatch: using session");
        if (!senderId) return new Response(JSON.stringify({ success: false, error: "MISSING_SENDER" }), { status: 400, headers: cors });
        // S3: dynamic column list — only insert fields actually provided; retry drops unknown columns if schema lacks them.
        const cols = ["conversation_id", "sender_id", "content"];
        const vals = [body.conversation_id, senderId, body.content];
        const optional = ["media_url","media_type","media_name","reply_to_id","expires_at","view_once","viewed_by","metadata","ephemeral_type","voice_duration_seconds","voice_waveform"];
        for (const k of optional) {
          if (body[k] === undefined || body[k] === null) continue;
          if (Array.isArray(body[k]) && body[k].length === 0) continue;
          cols.push(k); vals.push(body[k]);
        }
        const buildInsert = (c) => "INSERT INTO messages (" + c.join(", ") + ") VALUES (" + c.map((_,i)=>"$"+(i+1)).join(", ") + ") RETURNING *;";
        let data;
        try {
          data = await queryDatabase(buildInsert(cols), vals);
        } catch (e) {
          const msg = String((e && e.message) || "");
          const m = msg.match(/column "([^"]+)" does not exist/);
          if (!m) {
            console.error("[MSG] insert failed: " + msg.slice(0, 200));
            return new Response(JSON.stringify({ success: false, error: "INSERT_FAILED", detail: msg.slice(0, 120) }), { status: 500, headers: cors });
          }
          const badCol = m[1];
          console.warn("[MSG] dropping missing column: " + badCol);
          const idx = cols.indexOf(badCol);
          if (idx < 0) return new Response(JSON.stringify({ success: false, error: "INSERT_FAILED", detail: msg.slice(0, 120) }), { status: 500, headers: cors });
          cols.splice(idx, 1); vals.splice(idx, 1);
          try {
            data = await queryDatabase(buildInsert(cols), vals);
          } catch (e2) {
            const m2 = String((e2 && e2.message) || "");
            console.error("[MSG] retry failed: " + m2.slice(0, 200));
            return new Response(JSON.stringify({ success: false, error: "INSERT_FAILED", detail: m2.slice(0, 120) }), { status: 500, headers: cors });
          }
        }
        const newMsg = data.rows[0];
        try {
          const id = env.CHAT_ROOMS.idFromName("dm-" + body.conversation_id);
          const obj = env.CHAT_ROOMS.get(id);
          await obj.fetch("https://dummy.com/", { method: "POST", body: JSON.stringify(newMsg) });
        } catch (e) { console.error(e); }
        return new Response(JSON.stringify({ success: true, data: newMsg }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 4.6 GROUP MESSAGES
      if (path === "/api/group/messages" && request.method === "POST") {
        const body = await request.json();
        const insertQuery = `
          INSERT INTO group_messages (group_id, sender_id, content, media_url, media_type, media_name, reply_to_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
        `;
        const data = await queryDatabase(insertQuery, [
          body.group_id, body.sender_id, body.content, body.media_url, body.media_type, body.media_name, body.reply_to_id
        ]);
        
        const newMsg = data.rows[0];
        // Broadcast to Group WebSocket
        try {
          const id = env.CHAT_ROOMS.idFromName("group-" + body.group_id);
          const obj = env.CHAT_ROOMS.get(id);
          await obj.fetch("https://dummy.com/", { method: "POST", body: JSON.stringify(newMsg) });
        } catch (e) { console.error(e); }

        return new Response(JSON.stringify({ success: true, data: newMsg }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 5. COMMUNITY MESSAGES (CHAT)
      if (path === "/api/community/messages") {
        if (request.method === "POST") {
          const body = await request.json();
          const insertQuery = `
            INSERT INTO community_messages (community_id, sender_id, content, media_url, media_type, media_name, voice_duration_seconds) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
          `;
          const data = await queryDatabase(insertQuery, [
            body.communityId, body.senderId, body.content, body.mediaUrl, body.mediaType, body.mediaName, body.voiceDuration
          ]);
          
          const newMessage = data.rows[0];
          newMessage.display_name = "User"; // Placeholder, you can join profiles later
          
          // META-SCALE: Broadcast to WebSocket Room
          try {
            const roomId = body.communityId.toString();
            const id = env.CHAT_ROOMS.idFromName(roomId);
            const obj = env.CHAT_ROOMS.get(id);
            await obj.fetch("https://dummy.com/", {
              method: "POST",
              body: JSON.stringify(newMessage)
            });
          } catch (wsErr) {
            console.error("Broadcast failed", wsErr);
          }

          return new Response(JSON.stringify({ success: true, data: newMessage }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
        if (request.method === "GET") {
          const communityId = url.searchParams.get("communityId");
          if (!communityId) return new Response(JSON.stringify({ success: false, error: "communityId required" }), { status: 400, headers: cors });
          
          const data = await queryDatabase(`
            SELECT m.*, p.display_name, p.username 
            FROM community_messages m
            LEFT JOIN profiles p ON p.id = m.sender_id
            WHERE m.community_id = $1 AND m.deleted_at IS NULL
            ORDER BY m.created_at ASC LIMIT 50
          `, [communityId]);

          return new Response(JSON.stringify({ success: true, data: data.rows }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
      }

      // 6. LIKES
      if (path === "/api/likes") {
        
        if (request.method === "POST") {
          const body = await request.json();
          const { postId, userId, action } = body;
          if (action === 'like') await redisCommand(["SADD", `post:likes:${postId}`, userId]);
          else if (action === 'unlike') await redisCommand(["SREM", `post:likes:${postId}`, userId]);
          const countRes = await redisCommand(["SCARD", `post:likes:${postId}`]);
          return new Response(JSON.stringify({ success: true, likes: countRes.result }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
        if (request.method === "GET") {
          const postId = url.searchParams.get("postId");
          const countRes = await redisCommand(["SCARD", `post:likes:${postId}`]);
          return new Response(JSON.stringify({ success: true, likes: countRes.result }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
      }

      // 7. LIKES LIST
      if (path === "/api/likes/list" && request.method === "GET") {
        const postId = url.searchParams.get("postId");
        const redisRes = await fetch(env.UPSTASH_REDIS_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(["SMEMBERS", `post:likes:${postId}`])
        });
        const redisData = await redisRes.json();
        const userIds = redisData.result || [];

        if (userIds.length === 0) return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...cors, "Content-Type": "application/json" } });

        const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
        const profiles = await queryDatabase(`SELECT id, display_name, username FROM profiles WHERE id IN (${placeholders})`, userIds);
        return new Response(JSON.stringify({ success: true, data: profiles.rows }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 8. COMMENTS
      if (path === "/api/comments") {
        if (request.method === "POST") {
          const body = await request.json();
          const insertQuery = `INSERT INTO user_post_comments (post_id, user_id, content, reply_to_id) VALUES ($1, $2, $3, $4) RETURNING id, content, created_at, user_id, reply_to_id;`;
          const data = await queryDatabase(insertQuery, [body.postId, body.userId, body.content, body.replyToId || null]);
          return new Response(JSON.stringify({ success: true, data: data.rows[0] }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
        if (request.method === "GET") {
          const postId = url.searchParams.get("postId");
          const data = await queryDatabase(`SELECT c.id, c.content, c.created_at, c.user_id, c.reply_to_id, p.display_name, p.username FROM user_post_comments c LEFT JOIN profiles p ON p.id = c.user_id WHERE c.post_id = $1 AND c.deleted_at IS NULL ORDER BY c.created_at ASC;`, [postId]);
          return new Response(JSON.stringify({ success: true, data: data.rows }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
      }

      
      // 9. CREATE/UPDATE PROFILE (Onboarding)
      if (path === "/api/profile/me" && request.method === "GET") {
        const me = await getSessionUser(request, env, url);
        const jh = { ...cors, "Content-Type": "application/json" };
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: jh });
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(me.id)) return new Response(JSON.stringify({ success: false, error: "LEGACY_ACCOUNT_ID" }), { status: 409, headers: jh });
        const data = await queryDatabase("SELECT * FROM profiles WHERE id = $1::uuid LIMIT 1", [me.id]);
        return new Response(JSON.stringify({ success: true, data: data.rows[0] || null }), { headers: jh });
      }
      if (path === "/api/profile" && request.method === "POST") {
        try {
          const body = await request.json();
          const query = `
            INSERT INTO profiles (id, display_name, username, date_of_birth, gender)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET 
              display_name = EXCLUDED.display_name,
              username = EXCLUDED.username,
              date_of_birth = EXCLUDED.date_of_birth,
              gender = EXCLUDED.gender
            RETURNING *;
          `;
          const sess = await getSessionUser(request, env, url);
          const params = [sess ? sess.id : body.id, body.display_name, body.username, body.date_of_birth, body.gender];
          const data = await queryDatabase(query, params);
          return new Response(JSON.stringify({ success: true, data: data.rows[0] }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }

      
      // 10. META-SCALE BFF: Feed Bootstrap
      if (path === "/api/feed/bootstrap" && request.method === "GET") {
        try {
          const userId = url.searchParams.get("userId");
          if (!userId) throw new Error("userId required");

          // Run all independent queries in parallel for max speed
          const [
            matches, follows, blocks, mutedWords, userMutes, comments, reelLikes, listings, services, profiles
          ] = await Promise.all([
            queryDatabase(`SELECT user_one_id, user_two_id FROM matches WHERE user_one_id = $1 OR user_two_id = $1`, [userId]),
            queryDatabase(`SELECT following_id FROM follows WHERE follower_id = $1`, [userId]),
            queryDatabase(`SELECT blocker_id, blocked_id FROM blocks WHERE blocker_id = $1 OR blocked_id = $1`, [userId]),
            queryDatabase(`SELECT word FROM muted_words WHERE user_id = $1`, [userId]),
            queryDatabase(`SELECT muted_id FROM user_mutes WHERE muter_id = $1`, [userId]),
            queryDatabase(`SELECT post_id, created_at FROM user_post_comments WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days' LIMIT 500`, [userId]),
            queryDatabase(`SELECT reel_id, created_at FROM reel_likes WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days' LIMIT 500`, [userId]),
            queryDatabase(`SELECT id, title, price, currency, image_paths FROM listings WHERE status = 'active' ORDER BY created_at DESC LIMIT 4`),
            queryDatabase(`SELECT id, title, price, currency, duration_minutes, image_paths FROM services WHERE status = 'active' ORDER BY created_at DESC LIMIT 4`),
            queryDatabase(`SELECT id, display_name, username FROM profiles LIMIT 50`) // Fallback for PYMK
          ]);

          return new Response(JSON.stringify({
            success: true,
            data: {
              matches: matches.rows, follows: follows.rows, blocks: blocks.rows,
              mutedWords: mutedWords.rows, userMutes: userMutes.rows,
              comments: comments.rows, reelLikes: reelLikes.rows,
              listings: listings.rows, services: services.rows, profiles: profiles.rows
            }
          }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }

      // 11. BULK PROFILES (For likes/comments avatars)
      if (path === "/api/profiles/bulk" && request.method === "POST") {
        try {
          const { ids } = await request.json();
          if (!ids || ids.length === 0) return new Response(JSON.stringify({ success: true, data: [] }), { headers: cors });
          const placeholders = ids.map((_, i) => `${i + 1}`).join(',');
          const data = await queryDatabase("SELECT p.id, p.display_name, p.username, p.is_verified, p.last_seen_at, (SELECT storage_path FROM profile_photos WHERE user_id = p.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) AS primary_photo_path FROM profiles p WHERE p.id::text = ANY($1::text[])", [ids.slice(0, 100).map(String)]);
          return new Response(JSON.stringify({ success: true, data: data.rows }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
      if (path === "/api/profile/actions" && request.method === "POST") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id);
        try {
          const b = await request.json().catch(() => ({}));
          const action = String(b.action || "");
          const targetId = String(b.targetUserId || "");
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
            return new Response(JSON.stringify({ success: false, error: "BAD_TARGET" }), { status: 400, headers: cors });
          }
          if (myId === targetId) return new Response(JSON.stringify({ success: false, error: "SELF_ACTION" }), { status: 400, headers: cors });

          if (action === "like" || action === "like_back") {
            const r = await queryDatabase("SELECT like_user($1::uuid, $2::uuid) AS result", [myId, targetId]);
            const result = r.rows[0]?.result || {};
            return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...cors, "Content-Type": "application/json" } });
          }
          if (action === "decline") {
            await queryDatabase("SELECT decline_like($1::uuid, $2::uuid)", [myId, targetId]);
            return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
          }
          return new Response(JSON.stringify({ success: false, error: "BAD_ACTION" }), { status: 400, headers: cors });
        } catch (err) {
          console.error("[profile/actions] " + String((err && err.message) || "").slice(0, 160));
          return new Response(JSON.stringify({ success: false, error: "ACTION_FAILED" }), { status: 500, headers: cors });
        }
      }
      if (path === "/api/profile/view" && request.method === "GET") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const myId = String(me.id).toLowerCase();
        const targetId = String(url.searchParams.get("userId") || "").toLowerCase();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
          return new Response(JSON.stringify({ success: false, error: "BAD_USER_ID" }), { status: 400, headers: cors });
        }
        const isSelf = myId === targetId;
        try {
          // ---- fire-and-forget: record profile view (only when viewing someone else) ----
          if (!isSelf) {
            queryDatabase("SELECT record_profile_view($1::uuid, $2::uuid)", [myId, targetId]).catch(() => null);
          }

          // ---- visibility + location checks via existing Postgres functions ----
          let canView = true, canSeeLocation = true;
          if (!isSelf) {
            const v = await queryDatabase("SELECT can_view_profile($1::uuid, $2::uuid) AS allowed", [myId, targetId]).catch(() => null);
            canView = !(v && v.rows[0] && v.rows[0].allowed === false);
            if (canView) {
              const l = await queryDatabase("SELECT can_see_location($1::uuid, $2::uuid) AS allowed", [myId, targetId]).catch(() => null);
              canSeeLocation = !(l && l.rows[0] && l.rows[0].allowed === false);
            }
          }
          if (!canView) {
            return new Response(JSON.stringify({ success: true, data: { canView: false, canSeeLocation: false, profile: null } }), { headers: { ...cors, "Content-Type": "application/json" } });
          }

          // ---- all reads in parallel ----
          const [
            profR, photosR, promptsR, interestsR, reelsR, communityPostsR,
            followersCountR, followingCountR, matchesR, circlesR, commMembershipsR,
            targetSettingsR, targetCommunitiesR, blocksR, likeCheckR,
            personalLikesR, personalCommentsR, commLikesR, commCommentsR
          ] = await Promise.all([
            queryDatabase("SELECT id, display_name, username, date_of_birth, bio, city, country, is_verified, tier, looking_for, cover_photo_path, profession, education, religion, relationship_status, body_height_cm, languages, body_type, personality, relationship_preference, music_genres, smoker, drinking, partying, exercise, tattoos, diet, pets, children, hide_age, account_type, category_label FROM profiles WHERE id = $1::uuid", [targetId]),
            queryDatabase("SELECT storage_path, is_primary, display_order FROM profile_photos WHERE user_id = $1::uuid ORDER BY is_primary DESC, display_order ASC", [targetId]),
            queryDatabase("SELECT prompt_key, answer, display_order FROM profile_prompts WHERE profile_id = $1::uuid ORDER BY display_order ASC", [targetId]),
            queryDatabase("SELECT pi.interest_id, i.name FROM profile_interests pi LEFT JOIN interests i ON i.id = pi.interest_id WHERE pi.profile_id = $1::uuid", [targetId]),
            queryDatabase("SELECT id, user_id, video_url, thumbnail_url, caption, created_at, allow_comments, clips, trim_start, trim_end, mirrored, filter_id, text_overlays, sticker_overlays, view_count, location FROM reels WHERE user_id = $1::uuid AND is_active = true ORDER BY created_at DESC LIMIT 30", [targetId]),
            queryDatabase("SELECT id, content, image_path, created_at, pinned_until, community_id, author_id FROM community_posts WHERE author_id = $1::uuid ORDER BY created_at DESC LIMIT 60", [targetId]),
            queryDatabase("SELECT COUNT(*)::int AS n FROM follows WHERE following_id = $1::uuid", [targetId]),
            queryDatabase("SELECT COUNT(*)::int AS n FROM follows WHERE follower_id = $1::uuid", [targetId]),
            queryDatabase("SELECT user_one_id, user_two_id FROM matches WHERE user_one_id = $1::uuid OR user_two_id = $1::uuid", [myId]),
            queryDatabase("SELECT circle_id FROM circle_members WHERE user_id = $1::uuid", [myId]),
            queryDatabase("SELECT community_id FROM community_memberships WHERE user_id = $1::uuid", [myId]),
            queryDatabase("SELECT * FROM user_settings WHERE user_id = $1::uuid", [targetId]),
            queryDatabase("SELECT community_id FROM community_memberships WHERE user_id = $1::uuid LIMIT 20", [targetId]),
            queryDatabase("SELECT blocker_id, blocked_id FROM blocks WHERE blocker_id = $1::uuid OR blocked_id = $1::uuid", [myId]),
            isSelf ? Promise.resolve({ rows: [] }) : Promise.all([
              queryDatabase("SELECT 1 FROM matches WHERE user_one_id = $1::uuid AND user_two_id = $2::uuid LIMIT 1", [myId < targetId ? myId : targetId, myId < targetId ? targetId : myId]),
              queryDatabase("SELECT 1 FROM likes WHERE user_id = $1::uuid AND liked_user_id = $2::uuid LIMIT 1", [myId, targetId]),
              queryDatabase("SELECT 1 FROM likes WHERE user_id = $1::uuid AND liked_user_id = $2::uuid LIMIT 1", [targetId, myId]),
            ]),
            queryDatabase("SELECT post_id, user_id, reaction FROM user_post_likes WHERE post_id IN (SELECT id FROM user_posts WHERE user_id = $1::uuid AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 60)", [targetId]).catch(() => ({ rows: [] })),
            queryDatabase("SELECT post_id FROM user_post_comments WHERE post_id IN (SELECT id FROM user_posts WHERE user_id = $1::uuid AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 60) AND deleted_at IS NULL", [targetId]).catch(() => ({ rows: [] })),
            queryDatabase("SELECT post_id, user_id, reaction FROM community_post_reactions WHERE post_id IN (SELECT id FROM community_posts WHERE author_id = $1::uuid ORDER BY created_at DESC LIMIT 60)", [targetId]).catch(() => ({ rows: [] })),
            queryDatabase("SELECT post_id FROM community_post_comments WHERE post_id IN (SELECT id FROM community_posts WHERE author_id = $1::uuid ORDER BY created_at DESC LIMIT 60) AND deleted_at IS NULL", [targetId]).catch(() => ({ rows: [] })),
          ]);

          const profile = profR.rows[0] || null;
          if (!profile) {
            return new Response(JSON.stringify({ success: false, error: "USER_NOT_FOUND" }), { status: 404, headers: cors });
          }

          // viewer context
          const matchIds = (matchesR.rows || []).map(m => m.user_one_id === myId ? m.user_two_id : m.user_one_id);
          const circleIds = (circlesR.rows || []).map(r => r.circle_id);
          const communityIds = (commMembershipsR.rows || []).map(r => r.community_id);

          // relationship (only when viewing someone else)
          let relationship = { matched: false, myLike: false, theyLikedMe: false };
          if (!isSelf && Array.isArray(likeCheckR)) {
            relationship = { matched: !!(likeCheckR[0]?.rows?.length), myLike: !!(likeCheckR[1]?.rows?.length), theyLikedMe: !!(likeCheckR[2]?.rows?.length) };
          }

          // visibility (only when viewing someone else)
          let visibility = null;
          if (!isSelf && targetSettingsR.rows[0]) {
            const s = targetSettingsR.rows[0];
            const ctx = { matched: relationship.matched, isFollowerOfOwner: false };
            const myFollow = await queryDatabase("SELECT 1 FROM follows WHERE follower_id = $1::uuid AND following_id = $2::uuid LIMIT 1", [myId, targetId]).catch(() => ({ rows: [] }));
            ctx.isFollowerOfOwner = myFollow.rows.length > 0;
            const levelFor = (k) => s[k] || 'everyone';
            const canSee = (k) => { const lv = levelFor(k); if (lv === 'everyone') return true; if (lv === 'only_me') return false; if (lv === 'matches') return ctx.matched; if (lv === 'followers') return ctx.isFollowerOfOwner; return false; };
            visibility = {
              phone: canSee('phone_visibility'), email: canSee('email_visibility'),
              birthday: canSee('birthday_visibility'), relationship: canSee('relationship_visibility'),
              contact_info: canSee('contact_info_visibility'), followers_list: canSee('followers_list_visibility'),
              matches_list: canSee('matches_list_visibility'), communities_membership: canSee('communities_membership_visibility'),
            };
          } else if (isSelf) {
            visibility = { phone: true, email: true, birthday: true, relationship: true, contact_info: true, followers_list: true, matches_list: true, communities_membership: true };
          }

          // communities the profile belongs to (with names)
          let communities = [];
          if (targetCommunitiesR.rows.length > 0) {
            const cids = targetCommunitiesR.rows.map(r => r.community_id);
            const cmR = await queryDatabase("SELECT id, name, slug, emoji, cover_color FROM communities WHERE id = ANY($1::bigint[])", [cids]).catch(() => ({ rows: [] }));
            communities = cmR.rows || [];
          }

          // aggregation: like/comment counts per post
          const agg = { personal: {}, community: {} };
          for (const r of personalLikesR.rows || []) {
            const k = "personal:" + r.post_id;
            agg.personal[k] = agg.personal[k] || { count: 0, mine: false, myReaction: null, reactions: [] };
            agg.personal[k].count++;
            if (r.user_id === myId) { agg.personal[k].mine = true; agg.personal[k].myReaction = r.reaction || "❤️"; }
            if (agg.personal[k].reactions.length < 3) agg.personal[k].reactions.push({ userId: r.user_id, emoji: r.reaction || "❤️" });
          }
          for (const r of personalCommentsR.rows || []) {
            const k = "personal:" + r.post_id;
            agg.personal[k] = agg.personal[k] || { count: 0, mine: false, myReaction: null, reactions: [] };
            agg.personal[k].commentCount = (agg.personal[k].commentCount || 0) + 1;
          }
          for (const r of commLikesR.rows || []) {
            const k = "community:" + r.post_id;
            agg.community[k] = agg.community[k] || { count: 0, mine: false, myReaction: null, reactions: [] };
            agg.community[k].count++;
            if (r.user_id === myId) { agg.community[k].mine = true; agg.community[k].myReaction = r.reaction || "❤️"; }
            if (agg.community[k].reactions.length < 3) agg.community[k].reactions.push({ userId: r.user_id, emoji: r.reaction || "❤️" });
          }
          for (const r of commCommentsR.rows || []) {
            const k = "community:" + r.post_id;
            agg.community[k] = agg.community[k] || { count: 0, mine: false, myReaction: null, reactions: [] };
            agg.community[k].commentCount = (agg.community[k].commentCount || 0) + 1;
          }

          // reactor profiles (for top 3 names on each post)
          const reactorIds = new Set();
          for (const k of Object.keys(agg.personal)) for (const r of agg.personal[k].reactions) reactorIds.add(r.userId);
          for (const k of Object.keys(agg.community)) for (const r of agg.community[k].reactions) reactorIds.add(r.userId);
          let reactorProfiles = {};
          if (reactorIds.size > 0) {
            const profR2 = await queryDatabase("SELECT id, display_name, username FROM profiles WHERE id = ANY($1::uuid[])", [[...reactorIds].slice(0, 100)]).catch(() => ({ rows: [] }));
            for (const p of profR2.rows) reactorProfiles[p.id] = p;
          }

          // followed-by (shared followers)
          let followedBy = { people: [], more: 0 };
          if (!isSelf) {
            const myFollows = await queryDatabase("SELECT following_id FROM follows WHERE follower_id = $1::uuid LIMIT 500", [myId]).catch(() => ({ rows: [] }));
            const theirFollowers = await queryDatabase("SELECT follower_id FROM follows WHERE following_id = $1::uuid LIMIT 500", [targetId]).catch(() => ({ rows: [] }));
            const myFollowSet = new Set(myFollows.rows.map(r => r.following_id));
            const blockedSet = new Set();
            for (const b of blocksR.rows) { if (b.blocker_id === myId) blockedSet.add(b.blocked_id); if (b.blocked_id === myId) blockedSet.add(b.blocker_id); }
            const shared = (theirFollowers.rows || []).map(r => r.follower_id).filter(id => myFollowSet.has(id) && id !== myId && id !== targetId && !blockedSet.has(id));
            if (shared.length > 0) {
              const top = shared.slice(0, 3);
              const ppl = await queryDatabase("SELECT id, display_name, username FROM profiles WHERE id = ANY($1::uuid[])", [top]).catch(() => ({ rows: [] }));
              followedBy = { people: ppl.rows || [], more: Math.max(0, shared.length - ppl.rows.length) };
            }
          }

          return new Response(JSON.stringify({
            success: true,
            data: {
              profile, canView: true, canSeeLocation, visibility,
              photos: photosR.rows, prompts: promptsR.rows,
              interests: interestsR.rows.map(r => r.name).filter(Boolean),
              reels: reelsR.rows, communityPosts: communityPostsR.rows,
              followersCount: followersCountR.rows[0]?.n || 0,
              followingCount: followingCountR.rows[0]?.n || 0,
              communities,
              context: { matchIds, circleIds, communityIds },
              relationship, followedBy, aggregation: agg, reactorProfiles
            }
          }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          console.error("[profile/view] " + String((err && err.message) || "").slice(0, 200));
          return new Response(JSON.stringify({ success: false, error: "VIEW_FAILED" }), { status: 500, headers: cors });
        }
      }

      
      // 12. TELEMETRY EVENTS (Fire-and-Forget)
      if (path === "/api/events" && request.method === "POST") {
        try {
          const { type, postId, userId } = await request.json();
          
          if (type === 'impression') {
            await queryDatabase(`INSERT INTO feed_impressions (user_id, post_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`, [userId, postId]);
          } else if (type === 'click') {
            await queryDatabase(`INSERT INTO feed_clicks (user_id, post_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`, [userId, postId]);
          } else if (type === 'notification') {
            const { targetUserId, action } = await request.json();
            await queryDatabase(`INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES ($1, $2, $3, $4)`, [targetUserId, userId, action, postId]);
          }
          
          // Return 202 Accepted immediately to free up the frontend
          return new Response(JSON.stringify({ success: true }), { status: 202, headers: cors });
        } catch (err) {
          // Silently fail so the UI doesn't crash if telemetry fails
          return new Response(JSON.stringify({ success: false }), { status: 200, headers: cors });
        }
      }

      
      // 13. PHASE 2a-2: INBOX BFF
      if (path === "/api/inbox/bootstrap" && request.method === "GET") {
        const userId = url.searchParams.get("userId");
        if (!userId) return new Response(JSON.stringify({ success: false, error: "userId required" }), { status: 400, headers: cors });

        try {
          const [convPins, grpPins, convArch, grpArch, convDel, grpDel, onlineRows] = await Promise.all([
            queryDatabase(`SELECT conversation_id FROM conversation_pins WHERE user_id = $1`, [userId]),
            queryDatabase(`SELECT group_id FROM group_pins WHERE user_id = $1`, [userId]),
            queryDatabase(`SELECT conversation_id FROM conversation_archives WHERE user_id = $1`, [userId]),
            queryDatabase(`SELECT group_id FROM group_archives WHERE user_id = $1`, [userId]),
            queryDatabase(`SELECT conversation_id FROM conversation_deletes WHERE user_id = $1`, [userId]),
            queryDatabase(`SELECT group_id FROM group_deletes WHERE user_id = $1`, [userId]),
            queryDatabase(`SELECT id, display_name, username, last_seen_at FROM profiles WHERE id != $1 AND is_active = true ORDER BY last_seen_at DESC LIMIT 30`, [userId])
          ]);

          return new Response(JSON.stringify({ 
            success: true, 
            data: {
              convPins: convPins.rows, grpPins: grpPins.rows,
              convArch: convArch.rows, grpArch: grpArch.rows,
              convDel: convDel.rows, grpDel: grpDel.rows,
              onlineRows: onlineRows.rows
            }
          }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }

      
      // 14. PHASE 2a-2: Read Receipts (Batch)
      if (path === "/api/stories" && request.method === "GET") {
        const me = await getSessionUser(request, env, url);
        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: cors });
        const userId = url.searchParams.get("userId");
        if (!userId) return new Response(JSON.stringify({ success: false, error: "userId required" }), { status: 400, headers: cors });
        try {
          const r = await queryDatabase("SELECT id, user_id, media_url, media_type, created_at FROM stories WHERE user_id = $1::uuid AND expires_at > NOW() ORDER BY created_at ASC", [userId]);
          return new Response(JSON.stringify({ success: true, data: r.rows }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }
      if (path === "/api/inbox/read" && request.method === "POST") {
        try {
          const { type, rows } = await request.json(); // rows = array of { id, userId }
          if (type === 'dm' && rows?.length) {
            for (const r of rows) {
              await queryDatabase(
                `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at) 
                 VALUES ($1, $2, COALESCE($3::timestamptz, NOW())) 
                 ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = COALESCE($3::timestamptz, NOW())`, 
                [r.conversation_id, r.user_id, r.last_read_at || null]
              );
            }
          } else if (type === 'group' && rows?.length) {
            for (const r of rows) {
              await queryDatabase(
                `INSERT INTO group_reads (group_id, user_id, last_read_at) 
                 VALUES ($1, $2, COALESCE($3::timestamptz, NOW())) 
                 ON CONFLICT (group_id, user_id) DO UPDATE SET last_read_at = COALESCE($3::timestamptz, NOW())`, 
                [r.group_id, r.user_id, r.last_read_at || null]
              );
            }
          }
          return new Response(JSON.stringify({ success: true }), { headers: cors });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }

      
      // 15. PHASE 2a-2: Inbox Actions (Mute, Delete)
      if (path === "/api/inbox/action" && request.method === "POST") {
        try {
          const __body = await request.json();
          const { action, type, id, userId } = __body;

          if (action === 'delete' && type === 'dm') {
            await queryDatabase(`INSERT INTO conversation_deletes (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, userId]);
          } else if (action === 'delete' && type === 'group') {
            await queryDatabase(`INSERT INTO group_deletes (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, userId]);
          } 
          
          else if (action === 'mute' && type === 'dm') {
            await queryDatabase(`INSERT INTO conversation_mutes (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, userId]);
          } else if (action === 'unmute' && type === 'dm') {
            await queryDatabase(`DELETE FROM conversation_mutes WHERE conversation_id = $1 AND user_id = $2`, [id, userId]);
          }
          
          else if (action === 'mute' && type === 'group') {
            await queryDatabase(`INSERT INTO group_mutes (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, userId]);
          } else if (action === 'unmute' && type === 'group') {
            await queryDatabase(`DELETE FROM group_mutes WHERE group_id = $1 AND user_id = $2`, [id, userId]);
          } else if (action === 'clear' && type === 'dm') {
            await queryDatabase(`INSERT INTO conversation_clears (conversation_id, user_id, cleared_at) VALUES ($1, $2, NOW()) ON CONFLICT (conversation_id, user_id) DO UPDATE SET cleared_at = NOW()`, [id, userId]);
          } else if (action === 'clear' && type === 'group') {
            await queryDatabase(`INSERT INTO group_clears (group_id, user_id, cleared_at) VALUES ($1, $2, NOW()) ON CONFLICT (group_id, user_id) DO UPDATE SET cleared_at = NOW()`, [id, userId]);
          } else if (action === 'request') {
            const senderId = userId || (__body.senderId);
            const recipientId = __body.recipientId;
            if (!senderId || !recipientId) return new Response(JSON.stringify({ success: false, error: "MISSING_IDS" }), { status: 400, headers: cors });
            await queryDatabase(`INSERT INTO message_requests (sender_id, recipient_id, content, media_url, media_type, media_name) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6) ON CONFLICT DO NOTHING`, [senderId, recipientId, __body.content || '', __body.mediaUrl || null, __body.mediaType || null, __body.mediaName || null]);
          } else if (action === 'pin' && type === 'dm') {
            await queryDatabase(`INSERT INTO conversation_pins (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, userId]);
          } else if (action === 'unpin' && type === 'dm') {
            await queryDatabase(`DELETE FROM conversation_pins WHERE conversation_id = $1 AND user_id = $2`, [id, userId]);
          } else if (action === 'pin' && type === 'group') {
            await queryDatabase(`INSERT INTO group_pins (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, userId]);
          } else if (action === 'unpin' && type === 'group') {
            await queryDatabase(`DELETE FROM group_pins WHERE group_id = $1 AND user_id = $2`, [id, userId]);
          } else if (action === 'archive' && type === 'dm') {
            await queryDatabase(`INSERT INTO conversation_archives (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, userId]);
          } else if (action === 'unarchive' && type === 'dm') {
            await queryDatabase(`DELETE FROM conversation_archives WHERE conversation_id = $1 AND user_id = $2`, [id, userId]);
          } else if (action === 'archive' && type === 'group') {
            await queryDatabase(`INSERT INTO group_archives (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, userId]);
          } else if (action === 'unarchive' && type === 'group') {
            await queryDatabase(`DELETE FROM group_archives WHERE group_id = $1 AND user_id = $2`, [id, userId]);
          } else if (action === 'block') {
            const targetId = __body.targetId || __body.blocked_id || id;
            if (!targetId) return new Response(JSON.stringify({ success: false, error: "MISSING_TARGET" }), { status: 400, headers: cors });
            await queryDatabase(`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`, [userId, targetId]);
          }

          return new Response(JSON.stringify({ success: true }), { headers: cors });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }

      
      // 16. PHASE 2a-2: Chat Permissions
      if (path === "/api/chat/permissions" && request.method === "GET") {
        try {
          const sender = url.searchParams.get("sender");
          const recipient = url.searchParams.get("recipient");
          if (!sender || !recipient) return new Response(JSON.stringify({ success: false, error: "Missing params" }), { status: 400, headers: cors });

          // Check blocks, matches, and message requests in one parallel query
          const [blocks, matches, requests] = await Promise.all([
            queryDatabase(`SELECT blocker_id, blocked_id FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`, [sender, recipient]),
            queryDatabase(`SELECT id FROM matches WHERE (user_one_id = $1 AND user_two_id = $2) OR (user_one_id = $2 AND user_two_id = $1)`, [sender, recipient]),
            queryDatabase(`SELECT status FROM message_requests WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)`, [sender, recipient])
          ]);

          const isBlocked = blocks.rows.length > 0;
          const isMatch = matches.rows.length > 0;
          const requestStatus = requests.rows[0]?.status || null;

          // Business Logic
          const canSendDirect = !isBlocked;
          const canSendRequest = !isBlocked && !isMatch && requestStatus !== 'declined';
          const canSeeOnline = !isBlocked;

          return new Response(JSON.stringify({ 
            success: true, 
            data: { canSendDirect, canSendRequest, canSeeOnline, isMatch, requestStatus } 
          }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }

      
      // 17. PHASE 2a-2: Chat State BFF
      if (path === "/api/chat/state" && request.method === "GET") {
        try {
          const myId = url.searchParams.get("myId");
          const otherId = url.searchParams.get("otherId");
          const convId = url.searchParams.get("convId");

          const [mySettings, theirSettings, prevRead, theirRead, mute, clear] = await Promise.all([
            queryDatabase(`SELECT show_read_receipts FROM user_settings WHERE user_id = $1`, [myId]),
            queryDatabase(`SELECT show_read_receipts FROM user_settings WHERE user_id = $1`, [otherId]),
            queryDatabase(`SELECT last_read_at FROM conversation_reads WHERE conversation_id = $1 AND user_id = $2`, [convId, myId]),
            queryDatabase(`SELECT last_read_at FROM conversation_reads WHERE conversation_id = $1 AND user_id = $2`, [convId, otherId]),
            queryDatabase(`SELECT conversation_id FROM conversation_mutes WHERE conversation_id = $1 AND user_id = $2`, [convId, myId]),
            queryDatabase(`SELECT cleared_at FROM conversation_clears WHERE conversation_id = $1 AND user_id = $2`, [convId, myId])
          ]);

          return new Response(JSON.stringify({
            success: true,
            data: {
              mineOn: mySettings.rows[0]?.show_read_receipts !== false,
              theirsOn: theirSettings.rows[0]?.show_read_receipts !== false,
              prevReadAt: prevRead.rows[0]?.last_read_at || null, theirReadAt: theirRead.rows[0]?.last_read_at || null,
              isMuted: mute.rows.length > 0,
              clearedAt: clear.rows[0]?.cleared_at || null
            }
          }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }

      
      // 18. PHASE 2a-2: Message Actions (Unsend, View Once)
      if (path === "/api/messages/action" && request.method === "POST") {
        const jh = { ...cors, "Content-Type": "application/json" };
        const out = (status, obj) => new Response(JSON.stringify(obj), { status, headers: jh });
        const me = await getSessionUser(request, env, url);
        if (!me) return out(401, { success: false, error: "UNAUTHENTICATED" });
        try {
          const b = await request.json().catch(() => ({}));
          const mid = String(b.messageId || "");
          if (!/^\d{1,18}$/.test(mid)) return out(400, { success: false, error: "BAD_MESSAGE_ID" });
          if (b.action === "unsend") {
            await queryDatabase("UPDATE messages SET deleted_at = NOW(), content = '', media_url = NULL WHERE id = $1::bigint AND sender_id = $2::uuid", [mid, me.id]);
          } else if (b.action === "view_once") {
            await queryDatabase("UPDATE messages m SET viewed_by = array_append(COALESCE(m.viewed_by, '{}'), $2), media_url = NULL WHERE m.id = $1::bigint AND m.view_once = true AND m.sender_id <> $3::uuid AND EXISTS (SELECT 1 FROM conversations c LEFT JOIN matches mt ON mt.id = c.match_id WHERE c.id = m.conversation_id AND $3::uuid IN (c.initiator_id, c.recipient_id, mt.user_one_id, mt.user_two_id))", [mid, me.id, me.id]);
          } else if (b.action === "edit") {
            const content = String(b.content || "").slice(0, 2000);
            if (!content) return out(400, { success: false, error: "EMPTY_CONTENT" });
            await queryDatabase("UPDATE messages SET content = $1, edited_at = NOW() WHERE id = $2::bigint AND sender_id = $3::uuid AND deleted_at IS NULL", [content, mid, me.id]);
          } else return out(400, { success: false, error: "BAD_ACTION" });
          return out(200, { success: true });
        } catch (err) {
          console.error("[messages/action] " + String((err && err.message) || "").slice(0, 160));
          return out(500, { success: false, error: "ACTION_FAILED" });
        }
      }

      // 19. PHASE 2a-2: Adopt Match into Conversation
      if (path === "/api/conversations/adopt-disabled" && request.method === "POST") {
        try {
          const { matchId, directToAdoptId } = await request.json();
          if (directToAdoptId) {
            await queryDatabase(`UPDATE conversations SET match_id = $1 WHERE id = $2`, [matchId, directToAdoptId]);
            return new Response(JSON.stringify({ success: true, conversationId: directToAdoptId }), { headers: cors });
          } else {
            const res = await queryDatabase(`INSERT INTO conversations (match_id) VALUES ($1) RETURNING id`, [matchId]);
            return new Response(JSON.stringify({ success: true, conversationId: res.rows[0].id }), { headers: cors });
          }
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Nakubonye API Gateway is Live" }), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }
};
