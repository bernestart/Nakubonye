const fs = require('fs');
const file = 'src/components/CommunityChat.jsx';
let code = fs.readFileSync(file, 'utf8');

// The exact block from lines 199-208
const oldChannelBlock = `    const ch = supabase
      .channel('community-chat-' + communityId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_messages', filter: \`community_id=eq.\${communityId}\` }, (payload) => {
        setMessages((cur) => {
          if (cur.find(m => m.id === payload.new.id)) return cur;
          return [...cur, payload.new];
        });
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }`;

// The new Cloudflare WebSocket connection
const newWsBlock = `    // META-SCALE: Cloudflare Durable Object WebSocket
    const wsUrl = \`wss://nakubonye.bernestart.workers.dev/api/ws/\${communityId}\`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const newMsg = JSON.parse(event.data);
        // Only add if it's not already in the list (prevent duplicates)
        setMessages((cur) => {
          if (cur.some(m => m.id === newMsg.id)) return cur;
          return [...cur, newMsg];
        });
      } catch (e) {
        console.error("WebSocket message parse error:", e);
      }
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);

    return () => { ws.close(); }`;

// We use a simpler replace that ignores spacing differences
const regex = /const\s+ch\s*=\s*supabase\s*\.channel\('community-chat-'[\s\S]*?return\s*\(\)\s*=>\s*\{\s*supabase\.removeChannel\(ch\)\s*\}/;

if (regex.test(code)) {
  code = code.replace(regex, newWsBlock);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Supabase Realtime replaced with Cloudflare WebSockets!");
} else {
  console.log("❌ ERROR: Could not find the exact Supabase channel block.");
}
