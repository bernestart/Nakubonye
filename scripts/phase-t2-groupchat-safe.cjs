const fs = require('fs');
const p = 'src/screens/GroupChat.jsx';

if (!fs.existsSync(p)) process.exit(1);
let lines = fs.readFileSync(p, 'utf8').split('\n');
let changes = 0;

// 1. Fix Typing Indicator (Find the useEffect block)
const typingIdx = lines.findIndex(l => l.includes('const ch = supabase.channel("gtyping-" + groupId)'));
if (typingIdx > -1) {
  // Find the end of this useEffect block
  let endIdx = typingIdx + 1;
  while (endIdx < lines.length && !lines[endIdx].includes('typingChannelRef.current = null }')) endIdx++;
  if (endIdx < lines.length) {
    const newTyping = [
      `    const typingInterval = setInterval(async () => {`,
      `      try { const res = await fetch(\`\${API_BASE_URL}/api/typing/check?roomId=group-\${groupId}&userId=\${myId}\`); const d = await res.json(); setOtherTyping(d.isTyping || false); } catch (e) {}`,
      `    }, 2000);`,
      `    return () => { clearInterval(typingInterval); typingChannelRef.current = null }`
    ];
    lines.splice(typingIdx, endIdx - typingIdx + 1, ...newTyping);
    changes++;
  }
}

// 2. Replace Read Receipts
const readIdx = lines.findIndex(l => l.includes('supabase.from("group_reads").upsert('));
if (readIdx > -1) {
  // The upsert usually spans multiple lines. Let's find the closing `)`
  let endIdx = readIdx + 1;
  while (endIdx < lines.length && !lines[endIdx].trim().endsWith(')')) endIdx++;
  if (endIdx < lines.length) {
    lines.splice(readIdx, endIdx - readIdx + 1, 
      `    fetch(\`\${API_BASE_URL}/api/group/read\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId, userId: myId }) }).catch(() => {});`
    );
    changes++;
  }
}

// 3. Replace View Once
const viewOnceIdx = lines.findIndex(l => l.includes('await supabase.from("group_messages").update({ viewed_by: nextViewedBy }).eq("id", m.id)'));
if (viewOnceIdx > -1) {
  lines[viewOnceIdx] = `    await fetch(\`\${API_BASE_URL}/api/group/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'view_once', messageId: m.id, viewedBy: nextViewedBy }) });`;
  changes++;
}

// 4. Replace Unsend
const unsendIdx = lines.findIndex(l => l.includes('await supabase.from("group_messages").update({ deleted_at: new Date().toISOString(), content: "", media_url: null }).eq("id", id).eq("sender_id", myId)'));
if (unsendIdx > -1) {
  lines[unsendIdx] = `    await fetch(\`\${API_BASE_URL}/api/group/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unsend', groupId, userId: myId, messageId: id }) });`;
  changes++;
}

// 5. Replace Mutes
const muteDelIdx = lines.findIndex(l => l.includes('await supabase.from("group_mutes").delete().eq("group_id", groupId).eq("user_id", myId)'));
if (muteDelIdx > -1) { lines[muteDelIdx] = `    await fetch(\`\${API_BASE_URL}/api/group/action\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unmute", groupId, userId: myId }) });`; changes++; }

const muteInsIdx = lines.findIndex(l => l.includes('await supabase.from("group_mutes").insert({ group_id: groupId, user_id: myId })'));
if (muteInsIdx > -1) { lines[muteInsIdx] = `    await fetch(\`\${API_BASE_URL}/api/group/action\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mute", groupId, userId: myId }) });`; changes++; }

// 6. Replace Clear Chat
const clearIdx = lines.findIndex(l => l.includes('await supabase.from("group_clears").upsert('));
if (clearIdx > -1) {
  let endIdx = clearIdx + 1;
  while (endIdx < lines.length && !lines[endIdx].trim().endsWith(')')) endIdx++;
  if (endIdx < lines.length) {
    lines.splice(clearIdx, endIdx - clearIdx + 1, `    await fetch(\`\${API_BASE_URL}/api/group/action\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear", groupId, userId: myId }) });`);
    changes++;
  }
}

// 7. Replace Leave Group
const leaveIdx = lines.findIndex(l => l.includes('await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", myId)'));
if (leaveIdx > -1) { lines[leaveIdx] = `    await fetch(\`\${API_BASE_URL}/api/group/action\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "leave", groupId, userId: myId }) });`; changes++; }

// 8. Replace Pin/Unpin
const unpinIdx = lines.findIndex(l => l.includes('await supabase.from("group_pinned_messages").delete().eq("group_id", groupId)'));
if (unpinIdx > -1) { lines[unpinIdx] = `    await fetch(\`\${API_BASE_URL}/api/group/action\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unpin", groupId }) });`; changes++; }

const pinIdx = lines.findIndex(l => l.includes('await supabase.from("group_pinned_messages").upsert({'));
if (pinIdx > -1) {
  let endIdx = pinIdx + 1;
  while (endIdx < lines.length && !lines[endIdx].trim().endsWith(')')) endIdx++;
  if (endIdx < lines.length) {
    lines.splice(pinIdx, endIdx - pinIdx + 1, `    await fetch(\`\${API_BASE_URL}/api/group/action\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pin", groupId, userId: myId, pinData: { messageId } }) });`);
    changes++;
  }
}

// 9. Reactions
const reactDelIdx = lines.findIndex(l => l.includes('await supabase.from("group_message_reactions").delete()'));
if (reactDelIdx > -1) { lines[reactDelIdx] = `    await fetch(\`\${API_BASE_URL}/api/group/reactions\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", messageId, userId: myId }) });`; changes++; }

const reactUpdIdx = lines.findIndex(l => l.includes('await supabase.from("group_message_reactions").update('));
if (reactUpdIdx > -1) { lines[reactUpdIdx] = `    await fetch(\`\${API_BASE_URL}/api/group/reactions\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", messageId, userId: myId, reaction: emoji }) });`; changes++; }

const reactInsIdx = lines.findIndex(l => l.includes('await supabase.from("group_message_reactions").insert('));
if (reactInsIdx > -1) { lines[reactInsIdx] = `    await fetch(\`\${API_BASE_URL}/api/group/reactions\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "insert", messageId, userId: myId, reaction: emoji }) });`; changes++; }

const reactGetIdx = lines.findIndex(l => l.includes('const { data } = await supabase.from("group_message_reactions").select('));
if (reactGetIdx > -1) { lines[reactGetIdx] = `    const { data } = await fetch(\`\${API_BASE_URL}/api/group/reactions\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get", messageId }) }).then(r => r.json());`; changes++; }

// 10. Remove Supabase import
const finalLines = lines.filter(l => !l.includes('import { supabase }'));

fs.writeFileSync(p, finalLines.join('\n'), 'utf8');
console.log(`✅ Applied ${changes} GroupChat purges safely.`);
