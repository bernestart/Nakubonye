const fs = require('fs');
const p = 'src/screens/Messages.jsx';

if (!fs.existsSync(p)) process.exit(1);
let lines = fs.readFileSync(p, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  // Patch DM Reads
  if (lines[i].includes('await supabase.from("conversation_reads").upsert(')) {
    lines[i] = "      fetch(`${API_BASE_URL}/api/inbox/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'dm', id: item.conversationId, userId: uid }) }).catch(() => {});";
    // Remove the following lines belonging to the upsert
    let j = i + 1;
    while (j < lines.length && !lines[j].trim().startsWith('})') && !lines[j].trim().startsWith('});')) j++;
    lines.splice(i + 1, j - i);
  }
  
  // Patch Group Reads
  if (lines[i].includes('await supabase.from("group_reads").upsert(')) {
    lines[i] = "      fetch(`${API_BASE_URL}/api/inbox/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'group', id: item.groupId, userId: uid }) }).catch(() => {});";
    let j = i + 1;
    while (j < lines.length && !lines[j].trim().startsWith('})') && !lines[j].trim().startsWith('});')) j++;
    lines.splice(i + 1, j - i);
  }
}

fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('✅ Messages.jsx Read Receipts patched.');
