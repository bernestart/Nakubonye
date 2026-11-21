const fs=require('fs');
const out={},fails=[],warns=[];
function ed(p,steps){
  let s=fs.readFileSync(p,'utf8');
  for(const [name,fn,soft] of steps){
    try{const n=fn(s);if(n===s)throw new Error('no change');s=n;}
    catch(e){(soft?warns:fails).push(p+' :: '+name+' :: '+e.message);}
  }
  out[p]=s;
}
const HELPER=`
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
`;
const GATE=`
    // ===== PHASE 1: AUTH GATE. AUTH_ENFORCE="1" blocks; otherwise log-only. =====
    const ENFORCE = env.AUTH_ENFORCE === "1";
    const deny = (status, error) => new Response(JSON.stringify({ success: false, error }), { status, headers: { ...cors, "Content-Type": "application/json" } });
    if (path.startsWith("/api/") && !path.startsWith("/api/media/")) {
      const authUser = await getSessionUser(request, env, url);
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
      }
    }
`;
const DOMSG=`async webSocketMessage(ws, message) {
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
`;
ed('backend/_worker.js',[
 ['session helper',s=>{if(s.includes('getSessionUser'))throw new Error('already patched');const a='\nexport default {';if(!s.includes(a))throw new Error('anchor export default');return s.replace(a,()=>HELPER+a);}],
 ['auth gate',s=>{const r=/\n    try \{\n      \/\/ WEBSOCKET ROUTE \(Real-Time Chat\)/;if(!r.test(s))throw new Error('anchor try/WEBSOCKET');return s.replace(r,m=>GATE+m);}],
 ['ws upgrade only',s=>{const a='const roomId = path.split("/api/ws/")[1];';if(!s.includes(a))throw new Error('anchor roomId');return s.replace(a,()=>'if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected WebSocket", { status: 426, headers: cors });\n        '+a);}],
 ['do close fix',s=>{const a='ws.close(code, "Durable Object is closing WebSocket");';if(!s.includes(a))throw new Error('anchor close');return s.replace(a,()=>'try { ws.close(!code || code === 1005 || code === 1006 || code === 1015 ? 1000 : code, "closing"); } catch (e) {}');}],
 ['do message filter',s=>{const r=/async webSocketMessage\(ws, message\) \{[\s\S]*?\n  \}\n/;if(!r.test(s))throw new Error('anchor webSocketMessage');return s.replace(r,()=>DOMSG);}],
 ['profiles/bulk placeholders',s=>{
   const a='const placeholders = ids.map((_, i) => `${i + 1}`).join(\',\');';
   const b='queryDatabase(`SELECT id, display_name, username FROM profiles WHERE id IN (${placeholders})`, ids)';
   if(!s.includes(a)||!s.includes(b))throw new Error('not matching (maybe already correct)');
   return s.replace(a,()=>'').replace(b,()=>'queryDatabase("SELECT id, display_name, username FROM profiles WHERE id::text = ANY($1::text[])", [ids.slice(0, 100).map(String)])');
 },true],
]);
const wsRe=/new WebSocket\(`(wss:\/\/nakubonye\.bernestart\.workers\.dev\/api\/ws\/[^`]*)`\)/g;
for(const f of ['src/screens/Chat.jsx','src/screens/GroupChat.jsx','src/components/CommunityChat.jsx'])
 ed(f,[['ws token',s=>{if(!wsRe.test(s))throw new Error('WS url anchor');wsRe.lastIndex=0;return s.replace(wsRe,(m,u)=>'new WebSocket(`'+u+'?token=${encodeURIComponent(localStorage.getItem("auth_token") || "")}`)');}]]);
const entry=['src/main.jsx','src/main.js','src/index.jsx'].find(f=>fs.existsSync(f));
if(!entry)fails.push('no entry file (main.jsx) found');
else ed(entry,[['authFetch import',s=>{if(s.includes('authFetch'))throw new Error('already patched');return 'import "./lib/authFetch.js";\n'+s;}]]);
ed('ROADMAP.md',[['r2 line',s=>s.replace('P6 Media to R2','P6 Media hardening on Telegram (edge cache, client thumbnails); R2 later when a payment method exists'),true]]);
out['src/lib/authFetch.js']=`import { API_BASE_URL } from "./api";

const nativeFetch = window.fetch.bind(window);

window.fetch = (input, init) => {
  try {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input && input.url;
    if (url && url.startsWith(API_BASE_URL)) {
      const token = localStorage.getItem("auth_token");
      if (token) {
        const req = new Request(input, init);
        if (!req.headers.has("Authorization")) req.headers.set("Authorization", "Bearer " + token);
        return nativeFetch(req);
      }
    }
  } catch (e) { /* fall through to plain fetch */ }
  return nativeFetch(input, init);
};
`;
if(fails.length){console.log('ABORTED, nothing written:\n'+fails.join('\n'));process.exit(1);}
for(const [p,c] of Object.entries(out))fs.writeFileSync(p,c);
console.log('APPLIED:',Object.keys(out).join(', '));
if(warns.length)console.log('SKIPPED (optional):\n'+warns.join('\n'));
