const fs=require('fs');
const CODE=String.raw`
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
`;
let s=fs.readFileSync('backend/_worker.js','utf8');
if(s.includes('[MEMBER]')){console.log('ABORTED: already patched');process.exit(1);}
if(!s.includes('getSessionUser')){console.log('ABORTED: Phase 1 not applied');process.exit(1);}
const r=/(if \(ENFORCE\) return deny\(403, "IDENTITY_MISMATCH"\);\s*break;\s*\}\s*\}\n)/;
if(!r.test(s)){console.log('ABORTED: anchor not found, nothing written');process.exit(1);}
s=s.replace(r,(m)=>m+CODE);
fs.writeFileSync('backend/_worker.js',s);
console.log('APPLIED: backend/_worker.js');
