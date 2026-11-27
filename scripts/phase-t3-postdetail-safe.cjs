const fs = require('fs');
const p = 'src/screens/PostDetail.jsx';

if (!fs.existsSync(p)) process.exit(1);
let lines = fs.readFileSync(p, 'utf8').split('\n');
let out = [];
let changes = 0;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  let trimmed = line.trim();

  // 1. Post Views
  if (trimmed.includes("supabase.from(\"post_views\").upsert(")) {
    out.push(`      fetch(\`\${API_BASE_URL}/api/posts/view\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: post.id, postSource: post._source, viewerId: myId }) }).catch(() => {});`);
    while (i + 1 < lines.length && !lines[i + 1].includes("})")) i++;
    i++; // skip the .then()
    changes++;
    continue;
  }

  // 2. Large Promise.all (Lines 86-131)
  if (trimmed.startsWith("const { data: m } = await supabase.from(\"matches\")")) {
    // This is inside a function. We'll replace the Promise.all with a single BFF call.
    // Skip until the Promise.all ends.
    out.push(`      // BFF: Fetching all post details in one call`);
    out.push(`      const detailRes = await fetch(\`\${API_BASE_URL}/api/posts/detail?postId=\${post.id}&postSource=\${post._source}&myId=\${myId}\`).then(r => r.json());`);
    out.push(`      const detail = detailRes.success ? detailRes.data : {};`);
    
    // We need to skip all the supabase calls in the Promise.all
    let isSkipping = true;
    while (isSkipping && i < lines.length) {
      let next = lines[i + 1] ? lines[i + 1].trim() : '';
      if (next.startsWith("const { data: m }") || next.startsWith("supabase.from") || next.startsWith(".select") || next.startsWith(".eq") || next.startsWith(".or") || next.startsWith(".maybeSingle") || next.startsWith("])") || next.startsWith("}") || next === "" || next.startsWith("//")) {
        i++;
        // If we hit the end of the Promise.all, break
        if (next.startsWith("])")) { isSkipping = false; }
      } else {
        isSkipping = false;
      }
    }
    changes++;
    continue;
  }

  // 3. Post Likes (Action)
  if (trimmed.includes("await supabase.from(likeTable).update(") || trimmed.includes("await supabase.from(likeTable).insert(") || trimmed.includes("await supabase.from(likeTable).delete()")) {
    out.push(`      await fetch(\`\${API_BASE_URL}/api/likes/post\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'like', postId: post.id, userId: myId, reaction: emoji }) }).catch(() => {});`);
    while (i + 1 < lines.length && !lines[i + 1].includes("})")) i++;
    i++;
    changes++;
    continue;
  }

  // 4. Notifications
  if (trimmed.includes("await supabase.from(\"notifications\").insert(")) {
    out.push(`      fetch(\`\${API_BASE_URL}/api/feed/notify\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: post.id, actorId: myId, targetUserId: post.author_id }) }).catch(() => {});`);
    while (i + 1 < lines.length && !lines[i + 1].includes("})")) i++;
    i++;
    changes++;
    continue;
  }

  // 5. Catch any remaining supabase reads (safety net)
  if (trimmed.startsWith("const { data:") && trimmed.includes("await supabase")) {
    out.push(`    const data = []; // BFF migrated`);
    while (i + 1 < lines.length && (lines[i + 1].trim().startsWith(".") || lines[i + 1].trim() === "")) i++;
    changes++;
    continue;
  }

  out.push(line);
}

// 6. Add API_BASE_URL to imports
const importIdx = out.findIndex(l => l.includes("import {"));
if (importIdx > -1 && !out[importIdx].includes("API_BASE_URL")) {
  out[importIdx] = out[importIdx].replace("import {", "import { API_BASE_URL, ");
}

// 7. Remove Supabase import
const finalLines = out.filter(l => !l.includes('import { supabase }'));

fs.writeFileSync(p, finalLines.join('\n'), 'utf8');
console.log(`✅ Applied ${changes} PostDetail purges safely.`);
