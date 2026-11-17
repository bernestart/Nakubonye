const fs = require('fs');
const file = 'src/components/CommunityChat.jsx';
let code = fs.readFileSync(file, 'utf8');

// Look for the old Supabase channel block and replace it with a WebSocket
const oldRealtime = `    const ch = supabase
      .channel('community-chat-' + communityId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages', filter: \`community_id=eq.\${communityId}\` }, (payload) => {
        setMessages((cur) => {
          if (cur.find(m => m.id === payload.new.id)) return cur;
          return [...cur, payload.new];
        });
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }`;

const newRealtime = `    // META-SCALE: Cloudflare WebSocket Connection
    const ws = new WebSocket(\`wss://nakubonye.bernestart.workers.dev/api/ws/\${communityId}\`);

    ws.onmessage = (event) => {
      try {
        const newMsg = JSON.parse(event.data);
        setMessages((cur) => {
          if (cur.find(m => m.id === newMsg.id)) return cur;
          return [...cur, newMsg];
        });
      } catch (e) { console.error("WS parse error", e); }
    };

    return () => { ws.close(); }`;

if (code.includes(oldRealtime)) {
  code = code.replace(oldRealtime, newRealtime);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Frontend WebSocket wired up!");
} else {
  // If the exact block is not found, we will at least ensure no Supabase crashes
  console.log("⚠️ Could not find exact Supabase channel block. Please run grep -n 'channel' src/components/CommunityChat.jsx");
}
