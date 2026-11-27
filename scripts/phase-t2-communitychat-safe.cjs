const fs = require('fs');
const p = 'src/components/CommunityChat.jsx';

if (!fs.existsSync(p)) process.exit(1);
let s = fs.readFileSync(p, 'utf8');
let changes = 0;

// 1. Fetch Community State (Clears, Mutes, Timer) - Lines 114-116
const stateRegex = /const \[clearRes, muteRes, commRes\] = await Promise\.all\(\[[\s\S]*?\]\)/;
if (s.match(stateRegex)) {
  const newState = `const stateRes = await fetch(\`\${API_BASE_URL}/api/community/state?communityId=\${communityId}&myId=\${myId}\`).then(r => r.json());
      const boot = stateRes.success ? stateRes.data : {};
      const clearRes = { data: { cleared_at: boot.clearedAt } };
      const muteRes = { data: boot.isMuted ? { community_id: communityId } : null };
      const commRes = { data: { disappearing_timer_seconds: boot.timerSeconds } };`;
  s = s.replace(stateRegex, newState);
  changes++;
} else {
  // Fallback if the Promise.all is formatted differently
  s = s.replace('supabase.from("community_clears").select("cleared_at").eq("community_id", communityId).eq("user_id", myId).maybeSingle()', 'fetch(`${API_BASE_URL}/api/community/state?communityId=${communityId}&myId=${myId}`).then(r => r.json()).then(d => ({ data: { cleared_at: d.data?.clearedAt } }))');
  s = s.replace('supabase.from("community_mutes").select("community_id").eq("community_id", communityId).eq("user_id", myId).maybeSingle()', 'fetch(`${API_BASE_URL}/api/community/state?communityId=${communityId}&myId=${myId}`).then(r => r.json()).then(d => ({ data: d.data?.isMuted ? { community_id: communityId } : null }))');
  s = s.replace('supabase.from("communities").select("disappearing_timer_seconds").eq("id", communityId).maybeSingle()', 'fetch(`${API_BASE_URL}/api/community/state?communityId=${communityId}&myId=${myId}`).then(r => r.json()).then(d => ({ data: { disappearing_timer_seconds: d.data?.timerSeconds } }))');
  changes++;
}

// 2. Typing Indicator
const typingIdx = s.indexOf('const ch = supabase.channel("ctyping-" + communityId)');
if (typingIdx > -1) {
  const endIdx = s.indexOf('typingChannelRef.current = null }', typingIdx) + 'typingChannelRef.current = null }'.length;
  const newTyping = `const typingInterval = setInterval(async () => {
      try { const res = await fetch(\`\${API_BASE_URL}/api/typing/check?roomId=\${communityId}&userId=\${myId}\`); const d = await res.json(); setOtherTyping(d.isTyping || false); } catch (e) {}
    }, 2000);
    return () => { clearInterval(typingInterval); typingChannelRef.current = null }`;
  s = s.slice(0, typingIdx) + newTyping + s.slice(endIdx);
  changes++;
}

// 3. Media Upload (Supabase Storage -> Telegram via Worker)
const mediaIdx = s.indexOf('const { error: upErr } = await supabase.storage');
if (mediaIdx > -1) {
  const endIdx = s.indexOf('const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path)');
  if (endIdx > -1) {
    const endOfPub = s.indexOf('\n', endIdx) + 1;
    const newMedia = `const path = await uploadMedia(attachment);
    if (!path) { setError("Upload failed"); return; }
    const pub = { publicUrl: path };`;
    s = s.slice(0, mediaIdx) + newMedia + s.slice(endOfPub);
    changes++;
  }
}

// 4. RPC (Highlight Message)
s = s.replace("const { data, error: err } = await supabase.rpc('highlight_community_message', { p_message_id: messageId })", 
  "const res = await fetch(`${API_BASE_URL}/api/community/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'highlight', messageId, communityId, userId: myId }) }).then(r => r.json());\n    const err = res.success ? null : { message: res.error };");

// 5. Reactions
const reactDel = `await supabase.from("community_message_reactions").delete().eq("message_id", messageId).eq("user_id", myId)`;
const reactUpd = `await supabase.from("community_message_reactions").update({ reaction: emoji }).eq("message_id", messageId).eq("user_id", myId)`;
const reactIns = `await supabase.from("community_message_reactions").insert({ message_id: messageId, user_id: myId, reaction: emoji })`;
const reactGet = `const { data } = await supabase.from("community_message_reactions").select("message_id, user_id, reaction").eq("message_id", messageId)`;

if (s.includes(reactDel)) { s = s.replace(reactDel, `await fetch(\`\${API_BASE_URL}/api/community/reactions\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", messageId, userId: myId }) })`); changes++; }
if (s.includes(reactUpd)) { s = s.replace(reactUpd, `await fetch(\`\${API_BASE_URL}/api/community/reactions\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", messageId, userId: myId, reaction: emoji }) })`); changes++; }
if (s.includes(reactIns)) { s = s.replace(reactIns, `await fetch(\`\${API_BASE_URL}/api/community/reactions\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "insert", messageId, userId: myId, reaction: emoji }) })`); changes++; }
if (s.includes(reactGet)) { s = s.replace(reactGet, `const { data } = await fetch(\`\${API_BASE_URL}/api/community/reactions\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get", messageId }) }).then(r => r.json())`); changes++; }

// 6. View Once
const viewOnceTarget = `await supabase.from("community_messages").update({ viewed_by: nextViewedBy }).eq("id", m.id)`;
if (s.includes(viewOnceTarget)) {
  s = s.replace(viewOnceTarget, `await fetch(\`\${API_BASE_URL}/api/community/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'view_once', messageId: m.id, viewedBy: nextViewedBy, communityId, userId: myId }) });`);
  changes++;
}

// 7. Mutes & Clears
const muteDel = `await supabase.from("community_mutes").delete().eq("community_id", communityId).eq("user_id", myId)`;
const muteIns = `await supabase.from("community_mutes").insert({ community_id: communityId, user_id: myId })`;
const clearTarget = `await supabase.from("community_clears").upsert(`;
if (s.includes(muteDel)) { s = s.replace(muteDel, `await fetch(\`\${API_BASE_URL}/api/community/action\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unmute", communityId, userId: myId }) });`); changes++; }
if (s.includes(muteIns)) { s = s.replace(muteIns, `await fetch(\`\${API_BASE_URL}/api/community/action\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mute", communityId, userId: myId }) });`); changes++; }
if (s.includes(clearTarget)) {
  s = s.replace(/await supabase\.from\("community_clears"\)\.upsert\([\s\S]*?\)/g, `await fetch(\`\${API_BASE_URL}/api/community/action\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear", communityId, userId: myId }) })`);
  changes++;
}

// 8. Pins
const unpinTarget = `await supabase.from("community_pinned_messages").delete().eq("community_id", communityId)`;
if (s.includes(unpinTarget)) { s = s.replace(unpinTarget, `await fetch(\`\${API_BASE_URL}/api/community/action\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unpin", communityId, userId: myId }) })`); changes++; }
const pinTarget = `await supabase.from("community_pinned_messages").upsert({`;
if (s.includes(pinTarget)) {
  s = s.replace(/await supabase\.from\("community_pinned_messages"\)\.upsert\([\s\S]*?\)/g, `await fetch(\`\${API_BASE_URL}/api/community/action\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pin", communityId, userId: myId, pinData: { messageId } }) })`);
  changes++;
}

// 9. Remove Supabase import
s = s.replace('import { supabase } from "../lib/supabase"\n', '');
s = s.replace('import { supabase } from "../lib/supabase"', '');

fs.writeFileSync(p, s, 'utf8');
console.log(`✅ Applied ${changes} CommunityChat purges.`);
