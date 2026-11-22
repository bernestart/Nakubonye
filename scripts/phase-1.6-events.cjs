const fs = require('fs');
const p = 'src/screens/Feed.jsx';

if (!fs.existsSync(p)) {
  console.error('❌ ABORT: Feed.jsx not found.');
  process.exit(1);
}

let s = fs.readFileSync(p, 'utf8');
let changed = false;

// 1. Patch Impressions (around line 157)
const impressionTarget = `await supabase.from('feed_impressions').upsert(`;
if (s.includes(impressionTarget)) {
  // Find the end of the block
  const endIdx = s.indexOf('});', s.indexOf(impressionTarget));
  if (endIdx !== -1) {
    const replacement = `fetch(\`\${API_BASE_URL}/api/events\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'impression', postId: post.id, userId: myId }) }).catch(() => {});`;
    // We only replace the start of the call and let the rest of the block be swallowed
    // Actually, it's safer to just replace the exact string if we know it. 
    // Let's use a safe regex that only matches up to the closing brace of the upsert.
    s = s.replace(/await supabase\.from\('feed_impressions'\)\.upsert\([\s\S]*?\}\);/g, replacement);
    changed = true;
  }
}

// 2. Patch Clicks (around line 177)
const clickTarget = `await supabase.from('feed_clicks').upsert(`;
if (s.includes(clickTarget)) {
  const replacement = `fetch(\`\${API_BASE_URL}/api/events\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'click', postId: post.id, userId: myId }) }).catch(() => {});`;
  s = s.replace(/await supabase\.from\('feed_clicks'\)\.upsert\([\s\S]*?\}\);/g, replacement);
  changed = true;
}

// 3. Patch Notifications (around line 1197)
const notifTarget = `await supabase.from("notifications").insert({`;
if (s.includes(notifTarget)) {
  const replacement = `fetch(\`\${API_BASE_URL}/api/events\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'notification', postId: postId, userId: myId, targetUserId: authorId, action: 'like' }) }).catch(() => {});`;
  s = s.replace(/await supabase\.from\("notifications"\)\.insert\(\{[\s\S]*?\}\);/g, replacement);
  changed = true;
}

if (changed) {
  fs.writeFileSync(p, s, 'utf8');
  console.log('✅ Phase 1.6 Events patch applied successfully.');
} else {
  console.log('⚠️ No event targets found. (Maybe already migrated?)');
}
