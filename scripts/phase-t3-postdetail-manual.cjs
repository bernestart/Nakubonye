const fs = require('fs');
const p = 'src/screens/PostDetail.jsx';

if (!fs.existsSync(p)) process.exit(1);
let s = fs.readFileSync(p, 'utf8');
let changes = 0;

// 1. Add API_BASE_URL import
if (!s.includes('API_BASE_URL')) {
  s = s.replace(
    "import { useAuth }",
    "import { API_BASE_URL } from '../lib/api';\nimport { useAuth }"
  );
}

// 2. Replace Post Views
const viewStart = s.indexOf("supabase.from(\"post_views\").upsert(");
if (viewStart > -1) {
  const viewEnd = s.indexOf(".then(() => {})", viewStart) + ".then(() => {})".length;
  const newView = `fetch(\`\${API_BASE_URL}/api/posts/view\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: post.id, postSource: post._source, viewerId: myId }) }).catch(() => {})`;
  s = s.slice(0, viewStart) + newView + s.slice(viewEnd);
  changes++;
}

// 3. Replace the massive data fetching block
// We start from `const authorId = row.author_id || row.user_id;`
// and replace everything down to `setCommentCount(cmtCnt || 0);`
const loadStart = s.indexOf("const authorId = row.author_id || row.user_id;");
if (loadStart > -1) {
  const loadEndMarker = "setCommentCount(cmtCnt || 0);";
  const loadEnd = s.indexOf(loadEndMarker, loadStart) + loadEndMarker.length;
  
  if (loadEnd > loadStart) {
    const newLoad = `const authorId = row.author_id || row.user_id;
        
        // BFF: Fetch all details in one call
        const detailRes = await fetch(\`\${API_BASE_URL}/api/posts/detail?postId=\${id}&postSource=\${source}&myId=\${myId}\`).then(r => r.json());
        if (cancelled) return;

        if (detailRes.success) {
          const d = detailRes.data;
          setAuthor(d.author || null);
          setAuthorPhoto(d.authorPhoto ? publicPhotoUrl(d.authorPhoto) : "");
          setCommunity(d.community || null);
          setLiked(!!d.isLiked);
          if (d.myReaction) setMyEmoji(d.myReaction);
          setLikeCount(d.likeCount || 0);
          setCommentCount(d.commentCount || 0);
        }
        setLoading(false)`;
    
    s = s.slice(0, loadStart) + newLoad + s.slice(loadEnd);
    changes++;
  }
}

// 4. Replace Like Actions
// Update Reaction
const updateLikeTarget = `await supabase.from(likeTable).update({ reaction: emoji }).eq("post_id", post.id).eq("user_id", myId)`;
if (s.includes(updateLikeTarget)) {
  s = s.replace(updateLikeTarget, `await fetch(\`\${API_BASE_URL}/api/likes/post\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', postId: post.id, userId: myId, reaction: emoji }) })`);
  changes++;
}

// Insert Like & Notification
const insertLikeTarget = `await supabase.from(likeTable).insert(row)`;
if (s.includes(insertLikeTarget)) {
  s = s.replace(insertLikeTarget, `await fetch(\`\${API_BASE_URL}/api/likes/post\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'like', postId: post.id, userId: myId, reaction: useEmoji }) })`);
  changes++;
}

const notifyTargetRegex = /await supabase\.from\("notifications"\)\.insert\(\{[\s\S]*?\}\);/g;
if (s.match(notifyTargetRegex)) {
  s = s.replace(notifyTargetRegex, `await fetch(\`\${API_BASE_URL}/api/feed/notify\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: post.id, actorId: myId, targetUserId: targetId, action: useEmoji === "❤️" ? "loved your post" : "reacted to your post" }) });`);
  changes++;
}

// Delete Like
const deleteLikeTarget = `await supabase.from(likeTable).delete().eq("post_id", post.id).eq("user_id", myId)`;
if (s.includes(deleteLikeTarget)) {
  s = s.replace(deleteLikeTarget, `await fetch(\`\${API_BASE_URL}/api/likes/post\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unlike', postId: post.id, userId: myId }) })`);
  changes++;
}

// 5. Remove Supabase import entirely
s = s.replace('import { supabase } from "../lib/supabase"\n', '');
s = s.replace('import { supabase } from "../lib/supabase"', '');

fs.writeFileSync(p, s, 'utf8');
console.log(`✅ Applied ${changes} PostDetail purges safely.`);
