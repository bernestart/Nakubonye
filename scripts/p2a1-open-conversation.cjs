const fs=require('fs');
const CODE=String.raw`      if (path === "/api/conversations/open" && request.method === "POST") {
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
      }`;
const CLIENT=`import { API_BASE_URL } from './api'

// Find or create the canonical DM conversation between the signed-in user and another user.
// The Worker (Neon) decides; identity comes from the session token, never from the client.
export async function findOrCreateConversation(otherUserId) {
  if (!otherUserId) return null
  const token = localStorage.getItem('auth_token')
  if (!token) return null
  try {
    const res = await fetch(\`\${API_BASE_URL}/api/conversations/open\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ otherUserId: String(otherUserId) })
    })
    const json = await res.json().catch(() => null)
    if (json && json.success && json.id != null) return Number(json.id)
    console.warn('open conversation failed', json && json.error)
  } catch (e) { console.warn('open conversation failed', e) }
  return null
}
`;
let w=fs.readFileSync('backend/_worker.js','utf8');
let c=fs.readFileSync('src/lib/conversations.js','utf8');
const fails=[];
if(w.includes('/api/conversations/open'))fails.push('worker already patched');
if(!w.includes('getSessionUser'))fails.push('Phase 1 not applied');
const r=/\n( {6})\/\/ WEBSOCKET ROUTE \(Real-Time Chat\)/;
if(!r.test(w))fails.push('worker anchor WEBSOCKET ROUTE');
if((c.match(/^export /gm)||[]).length!==1||!c.includes('export async function findOrCreateConversation'))fails.push('conversations.js has other exports; paste it to me');
if(fails.length){console.log('ABORTED, nothing written:\n'+fails.join('\n'));process.exit(1);}
w=w.replace(r,m=>'\n'+CODE+m);
fs.writeFileSync('backend/_worker.js',w);
fs.writeFileSync('src/lib/conversations.js',CLIENT);
console.log('APPLIED: backend/_worker.js, src/lib/conversations.js');
