const fs = require('fs');

// --- PATCH 1: Chat.jsx (Direct Messages) ---
let chat = fs.readFileSync('src/screens/Chat.jsx', 'utf8');
const oldChatWs = `    const channel = supabase
      .channel('chat-' + conversationId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conversationId },
        (payload) => {
          const m = payload.new
          setMessages((cur) => cur.some((x) => x.id === m.id) ? cur : [...cur, m])
          if (m.sender_id !== myId) {
            supabase.from('conversation_reads').upsert(
              { conversation_id: conversationId, user_id: myId, last_read_at: new Date().toISOString() },
              { onConflict: 'conversation_id,user_id' }
            )
          }
        })
    return () => { supabase.removeChannel(channel) }`;

const newChatWs = `    // META-SCALE: Cloudflare WebSocket for Direct Messages
    const ws = new WebSocket(\`wss://nakubonye.bernestart.workers.dev/api/ws/dm-\${conversationId}\`);
    
    ws.onmessage = (event) => {
      try {
        const m = JSON.parse(event.data);
        setMessages((cur) => cur.some((x) => x.id === m.id) ? cur : [...cur, m]);
        if (m.sender_id !== myId) {
          // Mark as read (can still use Supabase for this, or migrate later)
          supabase.from('conversation_reads').upsert(
            { conversation_id: conversationId, user_id: myId, last_read_at: new Date().toISOString() },
            { onConflict: 'conversation_id,user_id' }
          );
        }
      } catch (e) { console.error("WS Error", e); }
    };
    
    return () => { ws.close(); }`;

if (chat.includes(oldChatWs)) {
  chat = chat.replace(oldChatWs, newChatWs);
  fs.writeFileSync('src/screens/Chat.jsx', chat);
  console.log("✅ SUCCESS: Chat.jsx upgraded to WebSockets!");
} else {
  console.log("⚠️ Chat.jsx exact block not found. Spacing might differ.");
}

// --- PATCH 2: GroupChat.jsx (Groups) ---
let groupChat = fs.readFileSync('src/screens/GroupChat.jsx', 'utf8');
// We will use a regex here because the group block might have an UPDATE listener too
const groupRegex = /const ch = supabase\s*\.channel\("group-" \+ groupId\)[\s\S]*?return \(\) => \{ supabase\.removeChannel\(ch\) \}/;

const newGroupWs = `// META-SCALE: Cloudflare WebSocket for Groups
    const ws = new WebSocket(\`wss://nakubonye.bernestart.workers.dev/api/ws/group-\${groupId}\`);
    
    ws.onmessage = (event) => {
      try {
        const m = JSON.parse(event.data);
        setMessages((cur) => cur.some((x) => x.id === m.id) ? cur : [...cur, m]);
      } catch (e) { console.error("WS Error", e); }
    };
    
    return () => { ws.close(); }`;

if (groupRegex.test(groupChat)) {
  groupChat = groupChat.replace(groupRegex, newGroupWs);
  fs.writeFileSync('src/screens/GroupChat.jsx', groupChat);
  console.log("✅ SUCCESS: GroupChat.jsx upgraded to WebSockets!");
} else {
  console.log("⚠️ GroupChat.jsx exact block not found.");
}
