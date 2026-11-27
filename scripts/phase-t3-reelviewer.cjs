const fs = require('fs');
const p = 'src/components/ReelViewer.jsx';

if (!fs.existsSync(p)) process.exit(1);
let s = fs.readFileSync(p, 'utf8');
let changes = 0;

// 1. Add API_BASE_URL import
if (!s.includes('API_BASE_URL')) {
  s = s.replace(
    "import { supabase } from '../lib/supabase'",
    "import { supabase } from '../lib/supabase';\nimport { API_BASE_URL } from '../lib/api';"
  );
}

// 2. Replace the massive Promise.all load block
const loadStart = s.indexOf("supabase.from(\"profiles\").select(\"id, display_name, username, is_verified\").eq(\"id\", reel.user_id).maybeSingle()");
if (loadStart > -1) {
  // Find the end of the Promise.all array
  const loadEndMarker = "supabase.from(\"reel_saves\").select(\"reel_id\", { count: \"exact\", head: true }).eq(\"reel_id\", reel.id),";
  const loadEnd = s.indexOf(loadEndMarker, loadStart) + loadEndMarker.length;
  
  if (loadEnd > loadStart) {
    // Find the actual const [a, b, c] = await Promise.all([ ... ]) wrapper
    const promiseAllStart = s.lastIndexOf("const [", loadStart);
    const promiseAllEnd = s.indexOf("])", loadEnd) + 2;
    
    if (promiseAllStart > -1 && promiseAllEnd > promiseAllStart) {
      const newLoad = `const detailRes = await fetch(\`\${API_BASE_URL}/api/reels/detail?reelId=\${reel.id}&myId=\${myId}&userId=\${reel.user_id}\`).then(r => r.json());
        const detail = detailRes.success ? detailRes.data : {};
        const profRes = { data: detail.author };
        const photoRes = { data: { storage_path: detail.authorPhoto } };
        const likedRes = { data: detail.isLiked ? { reel_id: reel.id } : null };
        const savedRes = { data: detail.isSaved ? { reel_id: reel.id } : null };
        const likeCntRes = { count: detail.likeCount };
        const cmtCntRes = { count: detail.commentCount };
        const saveCntRes = { count: detail.saveCount };`;
        
      s = s.slice(0, promiseAllStart) + newLoad + s.slice(promiseAllEnd);
      changes++;
    }
  }
}

// 3. Replace Views
const viewTarget = `await supabase.from("reel_views").insert({ reel_id: reel.id, user_id: myId, watch_seconds: 3 })`;
if (s.includes(viewTarget)) {
  s = s.replace(viewTarget, `await fetch(\`\${API_BASE_URL}/api/reels/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'view', reelId: reel.id, userId: myId }) })`);
  changes++;
}

// 4. Replace Likes
const likeIns = `if (next) await supabase.from("reel_likes").insert({ reel_id: reel.id, user_id: myId })`;
const likeDel = `else      await supabase.from("reel_likes").delete().eq("reel_id", reel.id).eq("user_id", myId)`;
if (s.includes(likeIns)) {
  s = s.replace(likeIns, `if (next) await fetch(\`\${API_BASE_URL}/api/reels/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'like', reelId: reel.id, userId: myId }) })`);
  changes++;
}
if (s.includes(likeDel)) {
  s = s.replace(likeDel, `else await fetch(\`\${API_BASE_URL}/api/reels/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unlike', reelId: reel.id, userId: myId }) })`);
  changes++;
}

// 5. Replace Saves
const saveIns = `if (next) await supabase.from("reel_saves").insert({ reel_id: reel.id, user_id: myId })`;
const saveDel = `else      await supabase.from("reel_saves").delete().eq("reel_id", reel.id).eq("user_id", myId)`;
if (s.includes(saveIns)) {
  s = s.replace(saveIns, `if (next) await fetch(\`\${API_BASE_URL}/api/reels/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', reelId: reel.id, userId: myId }) })`);
  changes++;
}
if (s.includes(saveDel)) {
  s = s.replace(saveDel, `else await fetch(\`\${API_BASE_URL}/api/reels/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unsave', reelId: reel.id, userId: myId }) })`);
  changes++;
}

// 6. Replace RPC
const rpcTarget = `await supabase.rpc("like_user", { target_user_id: reel.user_id })`;
if (s.includes(rpcTarget)) {
  s = s.replace(rpcTarget, `await fetch(\`\${API_BASE_URL}/api/reels/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'like_user', targetUserId: reel.user_id }) })`);
  changes++;
}

// 7. Remove Supabase import
s = s.replace('import { supabase } from "../lib/supabase"\n', '');
s = s.replace('import { supabase } from "../lib/supabase"', '');

fs.writeFileSync(p, s, 'utf8');
console.log(`✅ Applied ${changes} ReelViewer purges safely.`);
