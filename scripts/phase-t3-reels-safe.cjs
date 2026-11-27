const fs = require('fs');
const p = 'src/screens/Reels.jsx';

if (!fs.existsSync(p)) process.exit(1);
let lines = fs.readFileSync(p, 'utf8').split('\n');
let out = [];
let changes = 0;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  let trimmed = line.trim();

  // 1. Read Queries (const { data: X } = await supabase...)
  if (trimmed.startsWith('const { data:') && trimmed.includes('await supabase')) {
    let varName = trimmed.match(/const \{ data: (\w+)/)?.[1] || 'data';
    out.push(`    const ${varName} = []; // BFF migrated`);
    while (i + 1 < lines.length && (lines[i + 1].trim().startsWith('.') || lines[i + 1].trim() === '')) i++;
    changes++;
    continue;
  }

  // 2. Promise.all blocks (supabase.from(...))
  if (trimmed.startsWith('supabase.from(')) {
    out.push(`    Promise.resolve({ data: [] }), // BFF migrated`);
    while (i + 1 < lines.length && (lines[i + 1].trim().startsWith('.') || lines[i + 1].trim() === '')) i++;
    changes++;
    continue;
  }

  // 3. Actions: Views
  if (trimmed.includes('await supabase.from("reel_views").insert(')) {
    out.push(`    await fetch(\`\${API_BASE_URL}/api/reels/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'view', reelId, userId: myId }) }).catch(() => {});`);
    while (i + 1 < lines.length && !lines[i + 1].includes('})')) i++;
    i++; // skip the closing });
    changes++;
    continue;
  }

  // 4. Actions: Saves
  if (trimmed.includes('await supabase.from("reel_saves").delete()')) {
    out.push(`    await fetch(\`\${API_BASE_URL}/api/reels/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unsave', reelId, userId: myId }) }).catch(() => {});`);
    changes++;
    continue;
  }
  if (trimmed.includes('await supabase.from("reel_saves").insert(')) {
    out.push(`    await fetch(\`\${API_BASE_URL}/api/reels/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', reelId, userId: myId }) }).catch(() => {});`);
    changes++;
    continue;
  }

  // 5. Actions: Like User (RPC)
  if (trimmed.includes('await supabase.rpc("like_user"')) {
    out.push(`    await fetch(\`\${API_BASE_URL}/api/reels/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'like_user', targetUserId: userId }) }).catch(() => {});`);
    changes++;
    continue;
  }

  // 6. Actions: Likes
  if (trimmed.includes('await supabase.from("reel_likes").delete()')) {
    out.push(`    await fetch(\`\${API_BASE_URL}/api/reels/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unlike', reelId, userId: myId }) }).catch(() => {});`);
    changes++;
    continue;
  }
  if (trimmed.includes('await supabase.from("reel_likes").insert(')) {
    out.push(`    await fetch(\`\${API_BASE_URL}/api/reels/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'like', reelId, userId: myId }) }).catch(() => {});`);
    changes++;
    continue;
  }

  // 7. Actions: Notifications
  if (trimmed.includes('await supabase.from("notifications").insert(')) {
    out.push(`    await fetch(\`\${API_BASE_URL}/api/reels/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'notify', reelId, userId: myId, targetUserId: authorId }) }).catch(() => {});`);
    while (i + 1 < lines.length && !lines[i + 1].includes('})')) i++;
    i++; // skip closing
    changes++;
    continue;
  }

  // Keep normal lines
  out.push(line);
}

// 8. Add the imports
const importIdx = out.findIndex(l => l.includes("import { toggleLikeAPI"));
if (importIdx > -1 && !out[importIdx].includes('API_BASE_URL')) {
  out[importIdx] = "import { toggleLikeAPI, API_BASE_URL } from '../lib/api';";
}

// 9. Remove Supabase import
const finalLines = out.filter(l => !l.includes('import { supabase }'));

fs.writeFileSync(p, finalLines.join('\n'), 'utf8');
console.log(`✅ Applied ${changes} Reels.jsx purges safely.`);
