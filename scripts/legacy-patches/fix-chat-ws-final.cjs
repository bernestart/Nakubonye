const fs = require('fs');
const file = 'src/screens/Chat.jsx';
let code = fs.readFileSync(file, 'utf8');

// Find the start of the Supabase channel block
const startStr = `const channel = supabase
      .channel('chat-' + conversationId)`;

// Find the end of the block (the cleanup function)
const endStr = `return () => { supabase.removeChannel(channel) }`;

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  // We extract the block before and after
  const beforeBlock = code.substring(0, startIndex);
  const afterBlock = code.substring(endIndex + endStr.length);

  // This is our new Cloudflare WebSocket code
  const newWsBlock = `// META-SCALE: Cloudflare WebSocket for Direct Messages
    const ws = new WebSocket(\`wss://nakubonye.bernestart.workers.dev/api/ws/dm-\${conversationId}\`);
    
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const m = payload.new || payload; // Handle both wrapped and raw payloads
        
        if (m && m.id) {
          setMessages((cur) => cur.some((x) => x.id === m.id) ? cur : [...cur, m]);
          
          if (m.sender_id !== myId) {
            supabase.from('conversation_reads').upsert(
              { conversation_id: conversationId, user_id: myId, last_read_at: new Date().toISOString() },
              { onConflict: 'conversation_id,user_id' }
            );
          }
        }
      } catch (e) { console.error("WS Error", e); }
    };
    
    return () => { ws.close(); }`;

  // Reconstruct the file
  code = beforeBlock + newWsBlock + afterBlock;
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Chat.jsx WebSocket block surgically replaced!");
} else {
  console.log("❌ ERROR: Could not find the start or end of the Supabase channel block.");
}
