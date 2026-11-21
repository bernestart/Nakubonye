const fs = require('fs');
const p = 'src/screens/Chat.jsx';

if (!fs.existsSync(p)) process.exit(1);
let s = fs.readFileSync(p, 'utf8');
let changes = 0;

// 1. Patch Send Message (Replace Supabase Insert with API)
const sendMsgTarget = `const { data: inserted, error: sendErr } = await supabase
                                .from('messages')
                                .insert(payload)
                                .select('id, sender_id, content, created_at, edited_at, media_url, media_type, media_name, reply_to_id, deleted_at, metadata, view_once, viewed_by')
                                .single()`;
const sendMsgReplace = `let inserted = null;
        let sendErr = null;
        try {
          const res = await fetch(\`\${API_BASE_URL}/api/messages\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          const json = await res.json();
          if (json.success) inserted = json.data;
          else sendErr = { message: json.error || "Failed to send" };
        } catch (e) { sendErr = { message: e.message }; }`;

if (s.includes(sendMsgTarget)) { s = s.replace(sendMsgTarget, sendMsgReplace); changes++; }

// 2. Patch Toggle Mute (Reuse /api/inbox/action)
const muteTarget = `if (isMuted) {
                                await supabase.from('conversation_mutes').delete().eq('conversation_id', conversationId).eq('user_id', myId)
                        setIsMuted(false)
                         } else {
                                      await supabase.from('conversation_mutes').insert({ conversation_id: conversationId, user_id: myId })
                                setIsMuted(true)
                          }`;
const muteReplace = `if (isMuted) {
            await fetch(\`\${API_BASE_URL}/api/inbox/action\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unmute", type: "dm", id: conversationId, userId: myId }) });
            setIsMuted(false);
        } else {
            await fetch(\`\${API_BASE_URL}/api/inbox/action\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mute", type: "dm", id: conversationId, userId: myId }) });
            setIsMuted(true);
        }`;
if (s.includes(muteTarget)) { s = s.replace(muteTarget, muteReplace); changes++; }

// 3. Patch Clear Chat
const clearTarget = `await supabase.from('conversation_clears').upsert(
                                        { conversation_id: conversationId, user_id: myId, cleared_at: now },
                    { onConflict: 'conversation_id,user_id' }
                                             )`;
const clearReplace = `await fetch(\`\${API_BASE_URL}/api/inbox/action\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear", type: "dm", id: conversationId, userId: myId }) });`;
if (s.includes(clearTarget)) { s = s.replace(clearTarget, clearReplace); changes++; }

// 4. Patch Unsend Message
const unsendTarget = `const { error: err } = await supabase
         .from('messages')
                           .update({ deleted_at: new Date().toISOString(), content: '', media_url: null })
         .eq('id', messageId).eq('sender_id', myId)`;
const unsendReplace = `let err = null;
        try {
          const res = await fetch(\`\${API_BASE_URL}/api/messages/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unsend', messageId, userId: myId }) });
          const json = await res.json();
          if (!json.success) err = { message: json.error };
        } catch (e) { err = { message: e.message }; }`;
if (s.includes(unsendTarget)) { s = s.replace(unsendTarget, unsendReplace); changes++; }

// 5. Patch View Once
const viewOnceTarget = `await supabase.from("messages").update({ viewed_by: nextViewedBy, media_url: null }).eq("id", m.id)`;
const viewOnceReplace = `await fetch(\`\${API_BASE_URL}/api/messages/action\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "view_once", messageId: m.id, viewedBy: nextViewedBy }) });`;
if (s.includes(viewOnceTarget)) { s = s.replace(viewOnceTarget, viewOnceReplace); changes++; }

// 6. Remove Supabase Storage Delete (Telegram doesn't have this, just skip it for now)
s = s.replace(/await supabase\.storage\.from\("chat-media"\)\.remove\(\[[\s\S]*?\]\)/g, '// Media deletion handled by Worker later');

// 7. Patch Match Adoption
const adoptTarget = `await supabase.from('conversations').update({ match_id: match.id }).eq('id', directToAdopt.id)`;
const adoptReplace = `await fetch(\`\${API_BASE_URL}/api/conversations/adopt\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId: match.id, directToAdoptId: directToAdopt.id }) });`;
if (s.includes(adoptTarget)) { s = s.replace(adoptTarget, adoptReplace); changes++; }

// 8. Remove Supabase Import entirely
s = s.replace('import { supabase } from "../lib/supabase"\n', '');
s = s.replace('import { supabase } from "../lib/supabase"', '');

fs.writeFileSync(p, s, 'utf8');
console.log(`✅ Applied ${changes} final Supabase purges to Chat.jsx.`);
