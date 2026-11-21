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
const ROUTE=[
'      if (path === "/api/profile/me" && request.method === "GET") {',
'        const me = await getSessionUser(request, env, url);',
'        const jh = { ...cors, "Content-Type": "application/json" };',
'        if (!me) return new Response(JSON.stringify({ success: false, error: "UNAUTHENTICATED" }), { status: 401, headers: jh });',
'        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(me.id)) return new Response(JSON.stringify({ success: false, error: "LEGACY_ACCOUNT_ID" }), { status: 409, headers: jh });',
'        const data = await queryDatabase("SELECT * FROM profiles WHERE id = $1::uuid LIMIT 1", [me.id]);',
'        return new Response(JSON.stringify({ success: true, data: data.rows[0] || null }), { headers: jh });',
'      }',
''].join('\n');
const FN=[
'  const refreshProfile = async () => {',
"    const t = localStorage.getItem('auth_token');",
'    if (!t) return null;',
'    try {',
'      const res = await fetch(`${API_BASE_URL}/api/profile/me`, { headers: { Authorization: `Bearer ${t}` } });',
'      const json = await res.json();',
'      if (json && json.data) { setProfile(p => ({ ...(p || {}), ...json.data })); return json.data; }',
"    } catch (e) { console.warn('refreshProfile failed', e); }",
'    return null;',
'  };',
''].join('\n');
ed('backend/_worker.js',[
 ['profile/me route',s=>{
   if(s.includes('/api/profile/me'))throw new Error('already patched');
   if(!s.includes('getSessionUser'))throw new Error('Phase 1 not applied');
   const r=/\n( *)if \(path === "\/api\/profile" && request\.method === "POST"\) \{/;
   if(!r.test(s))throw new Error('anchor POST /api/profile');
   return s.replace(r,m=>'\n'+ROUTE.replace(/\n$/,'')+m);
 }],
 ['profile POST uses session id',s=>{
   const a='const params = [body.id, body.display_name,';
   if(!s.includes(a))throw new Error('params anchor');
   return s.replace(a,()=>'const sess = await getSessionUser(request, env, url);\n          const params = [sess ? sess.id : body.id, body.display_name,');
 },true],
]);
ed('src/lib/auth.jsx',[
 ['refreshProfile fn',s=>{
   if(s.includes('const refreshProfile'))throw new Error('already patched');
   const a='  const session = user ? { user, access_token: token } : null;';
   if(!s.includes(a))throw new Error('anchor session');
   return s.replace(a,()=>FN+'\n'+a);
 }],
 ['provider value',s=>{
   const a='signOut, verifyOtp }}';
   if(!s.includes(a))throw new Error('anchor provider value');
   return s.replace(a,()=>'signOut, verifyOtp, refreshProfile }}');
 }],
 ['load profile after session',s=>{
   const r=/setUser\(data\.user\); setProfile\(data\.user\);\n(\s*)\} else \{/;
   if(!r.test(s))throw new Error('anchor effect');
   return s.replace(r,(m,sp)=>'setUser(data.user); setProfile(data.user); refreshProfile();\n'+sp+'} else {');
 }],
]);
if(fails.length){console.log('ABORTED, nothing written:\n'+fails.join('\n'));process.exit(1);}
for(const [p,c] of Object.entries(out))fs.writeFileSync(p,c);
console.log('APPLIED:',Object.keys(out).join(', '));
if(warns.length)console.log('SKIPPED (optional):\n'+warns.join('\n'));
