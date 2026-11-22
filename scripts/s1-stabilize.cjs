const fs=require('fs');
const fails=[],notes=[];
let w=fs.readFileSync('backend/_worker.js','utf8');
let c=fs.readFileSync('src/screens/Chat.jsx','utf8');
const STRICT=String.raw`      // ===== S1: STRICT ROUTES (always need a session; ids must equal the session user) =====
      const STRICT_ROUTES = ["/api/messages/action", "/api/chat/state", "/api/inbox/bootstrap", "/api/inbox/read", "/api/inbox/action"];
      if (path === "/api/chat/permissions" && !authUser) return deny(401, "UNAUTHENTICATED");
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
`;
const ACTION=String.raw`      if (path === "/api/messages/action" && request.method === "POST") {
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
          } else return out(400, { success: false, error: "BAD_ACTION" });
          return out(200, { success: true });
        } catch (err) {
          console.error("[messages/action] " + String((err && err.message) || "").slice(0, 160));
          return out(500, { success: false, error: "ACTION_FAILED" });
        }
      }
`;
if(/\bsupabase\./.test(c)&&!/import[^;\n]*supabase[^;\n]*from/.test(c)){c="import { supabase } from '../lib/supabase'\n"+c;notes.push('Chat.jsx: supabase import restored (stop-gap until its last calls are moved)');}
else notes.push('Chat.jsx: import already fine');
const n=(w.match(/await req\.json\(\)/g)||[]).length;
if(n){w=w.replace(/await req\.json\(\)/g,()=>'await request.json()');notes.push('Worker: fixed '+n+' x req.json()');}
const left=[...new Set(w.match(/\breq\.[A-Za-z]+/g)||[])];
if(left.length)notes.push('WARNING other req. uses remain: '+left.join(', '));
const aLine='const authUser = await getSessionUser(request, env, url);\n';
if(w.includes('STRICT_ROUTES'))notes.push('strict gate already present');
else if(w.split(aLine).length!==2)fails.push('gate anchor (const authUser line) not found exactly once');
else{w=w.replace(aLine,()=>aLine+STRICT);notes.push('Worker: strict gate added');}
const rAct=/ *if \(path === "\/api\/messages\/action" && request\.method === "POST"\) \{[\s\S]*?\n      \}\n/;
const m=rAct.exec(w);
if(w.includes('[messages/action]'))notes.push('messages/action already replaced');
else if(!m||m[0].length>2500)fails.push('messages/action block not found or unexpectedly large');
else{w=w.replace(rAct,()=>ACTION);notes.push('Worker: messages/action rewritten');}
const adopt='path === "/api/conversations/adopt" && request.method === "POST"';
if(w.includes(adopt)){w=w.replace(adopt,()=>'path === "/api/conversations/adopt-disabled" && request.method === "POST"');notes.push('Worker: adopt disabled');}
else notes.push('adopt route not found (already disabled?)');
if(fails.length){console.log('ABORTED, nothing written:\n'+fails.join('\n'));process.exit(1);}
fs.writeFileSync('backend/_worker.js',w);fs.writeFileSync('src/screens/Chat.jsx',c);
fs.appendFileSync('ROADMAP.md','\n## S1 STABILIZE (2026-11-22) after audit of DeepSeek patches\ngit log is the source of truth. Found: Chat.jsx used supabase without import (crash) -> import restored as stop-gap; /api/inbox/action used undefined req -> fixed; new routes (inbox/*, chat/*, messages/action) now always require a session and ids must equal the session user; messages/action rewritten (participant check, array_append); conversations/adopt disabled (use /api/conversations/open). DO NOT run the profile BFF script (route name collides with POST /api/profile/bootstrap; SELECT * leaks lat/long and private settings). Next: move remaining supabase calls in Chat.jsx and Messages.jsx, then profile screen via new /api/profile/view with column whitelist + block + visibility checks.\n');
console.log('APPLIED:\n- '+notes.join('\n- '));
