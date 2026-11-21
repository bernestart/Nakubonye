const fs = require('fs');
const p = 'src/screens/Messages.jsx';

if (!fs.existsSync(p)) process.exit(1);
let s = fs.readFileSync(p, 'utf8');

// 1. Kill the Supabase Realtime channel cleanup
s = s.replace('return () => { if (debounce) clearTimeout(debounce); supabase.removeChannel(ch) }', 'return () => { if (debounce) clearTimeout(debounce); }');

// 2. Replace conversation_deletes
s = s.replace(
  'await supabase.from("conversation_deletes").insert({ conversation_id: item.conversationId, user_id: uid })',
  'await fetch(`${API_BASE_URL}/api/inbox/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", type: "dm", id: item.conversationId, userId: uid }) })'
);

// 3. Replace group mutes (delete and insert)
s = s.replace(
  'await supabase.from("group_mutes").delete().eq("group_id", item.groupId).eq("user_id", uid)',
  'await fetch(`${API_BASE_URL}/api/inbox/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unmute", type: "group", id: item.groupId, userId: uid }) })'
);
s = s.replace(
  'await supabase.from("group_mutes").insert({ group_id: item.groupId, user_id: uid })',
  'await fetch(`${API_BASE_URL}/api/inbox/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mute", type: "group", id: item.groupId, userId: uid }) })'
);

// 4. Replace conversation mutes (delete and insert)
s = s.replace(
  'await supabase.from("conversation_mutes").delete().eq("conversation_id", item.conversationId).eq("user_id", uid)',
  'await fetch(`${API_BASE_URL}/api/inbox/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unmute", type: "dm", id: item.conversationId, userId: uid }) })'
);
s = s.replace(
  'await supabase.from("conversation_mutes").insert({ conversation_id: item.conversationId, user_id: uid })',
  'await fetch(`${API_BASE_URL}/api/inbox/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mute", type: "dm", id: item.conversationId, userId: uid }) })'
);

// 5. Remove the Supabase import entirely from this file
s = s.replace('import { supabase } from "../lib/supabase"\n', '');
s = s.replace('import { supabase } from "../lib/supabase"', '');

fs.writeFileSync(p, s, 'utf8');
console.log('✅ Messages.jsx completely purged of Supabase.');
