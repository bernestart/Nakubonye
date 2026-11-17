const fs = require('fs');

// --- PATCH 1: Chat.jsx Send (Direct Messages) ---
let chat = fs.readFileSync('src/screens/Chat.jsx', 'utf8');
const oldChatSend = `const { data: inserted, error: sendErr } = await supabase.from('messages').insert(finalPayload).select().single();`;

const newChatSend = `// META-SCALE: Send to Cloudflare/Neon
    let inserted = null;
    let sendErr = null;
    try {
      const res = await fetch("https://nakubonye.bernestart.workers.dev/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload)
      });
      const json = await res.json();
      if (json.success) { inserted = json.data; } else { sendErr = new Error(json.error); }
    } catch (err) { sendErr = err; }`;

if (chat.includes(oldChatSend)) {
  chat = chat.replace(oldChatSend, newChatSend);
  fs.writeFileSync('src/screens/Chat.jsx', chat);
  console.log("✅ SUCCESS: Chat.jsx send patched to Cloudflare!");
}

// --- PATCH 2: GroupChat.jsx Send ---
let groupChat = fs.readFileSync('src/screens/GroupChat.jsx', 'utf8');
const oldGroupSend = `const { data: inserted, error: sendErr } = await supabase.from('group_messages').insert(payload).select().single()`;

const newGroupSend = `// META-SCALE: Send to Cloudflare/Neon
    let inserted = null;
    let sendErr = null;
    try {
      const res = await fetch("https://nakubonye.bernestart.workers.dev/api/group/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) { inserted = json.data; } else { sendErr = new Error(json.error); }
    } catch (err) { sendErr = err; }`;

if (groupChat.includes(oldGroupSend)) {
  groupChat = groupChat.replace(oldGroupSend, newGroupSend);
  fs.writeFileSync('src/screens/GroupChat.jsx', groupChat);
  console.log("✅ SUCCESS: GroupChat.jsx send patched to Cloudflare!");
}
