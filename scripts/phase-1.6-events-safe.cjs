const fs = require('fs');
const p = 'src/screens/Feed.jsx';

if (!fs.existsSync(p)) {
  console.error('❌ ABORT: Feed.jsx not found.');
  process.exit(1);
}

let lines = fs.readFileSync(p, 'utf8').split('\n');
let changesMade = 0;

// Process line by line
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // 1. Impressions
  if (line.includes("await supabase.from('feed_impressions').upsert(")) {
    // Replace this line with the fetch call
    lines[i] = "              fetch(`${API_BASE_URL}/api/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'impression', postId: post.id, userId: myId }) }).catch(() => {});";
    
    // Find the end of the upsert object (look for the next line that starts with "});" or "})")
    let j = i + 1;
    while (j < lines.length && !lines[j].trim().startsWith('});') && !lines[j].trim().startsWith('})')) {
      j++;
    }
    // If we found the end, delete all the lines between the start and the end
    if (j < lines.length) {
      lines.splice(i + 1, j - i); // Keep the new line at i, delete the rest of the object
    }
    changesMade++;
  }

  // 2. Clicks
  if (line.includes("await supabase.from('feed_clicks').upsert(")) {
    lines[i] = "      fetch(`${API_BASE_URL}/api/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'click', postId: post.id, userId: myId }) }).catch(() => {});";
    
    let j = i + 1;
    while (j < lines.length && !lines[j].trim().startsWith('});') && !lines[j].trim().startsWith('})')) {
      j++;
    }
    if (j < lines.length) {
      lines.splice(i + 1, j - i);
    }
    changesMade++;
  }

  // 3. Notifications
  if (line.includes('await supabase.from("notifications").insert({')) {
    lines[i] = "      fetch(`${API_BASE_URL}/api/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'notification', postId: postId, userId: myId, targetUserId: authorId, action: 'like' }) }).catch(() => {});";
    
    let j = i + 1;
    while (j < lines.length && !lines[j].trim().startsWith('});') && !lines[j].trim().startsWith('})')) {
      j++;
    }
    if (j < lines.length) {
      lines.splice(i + 1, j - i);
    }
    changesMade++;
  }
}

if (changesMade > 0) {
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
  console.log(`✅ Safely patched ${changesMade} event blocks without breaking brackets.`);
} else {
  console.log('⚠️ No event targets found.');
}
