const fs=require('fs');
const CODE=String.raw`      if (path === "/api/username/available" && request.method === "GET") {
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
        const MIN_AGE = 18; // product decision: set to 13 for a general social network
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
      }`;
let w=fs.readFileSync('backend/_worker.js','utf8');
const fails=[];
if(w.includes('/api/profile/bootstrap'))fails.push('already patched');
if(!w.includes('getSessionUser'))fails.push('Phase 1 not applied');
const r=/\n( {6})\/\/ WEBSOCKET ROUTE \(Real-Time Chat\)/;
if(!r.test(w))fails.push('anchor WEBSOCKET ROUTE not found');
if(fails.length){console.log('ABORTED, nothing written:\n'+fails.join('\n'));process.exit(1);}
w=w.replace(r,m=>'\n'+CODE+m);
fs.writeFileSync('backend/_worker.js',w);
fs.appendFileSync('ROADMAP.md','\n## P1.6 SIGNUP WIZARD (before P2a-2)\nMeta-style one-question-per-screen create-account flow: name, birthday, gender, email, password, OTP code, username (live availability), photo, follow suggestions, welcome. Resumable: signed-in user without a profile row is routed to the wizard. Worker routes done: GET /api/username/available, POST /api/profile/bootstrap (session id only, server-side age gate MIN_AGE, birthday immutable). Next: wizard + Meta-style login UI, profile gate in App routing, Cloudflare Turnstile, rate limits (P1f).\n');
console.log('APPLIED: backend/_worker.js, ROADMAP.md');
