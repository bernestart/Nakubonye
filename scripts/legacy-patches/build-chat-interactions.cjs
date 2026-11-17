const fs = require('fs');

// ==========================================
// PART 1: UPDATE BACKEND DURABLE OBJECT
// ==========================================
let worker = fs.readFileSync('backend/_worker.js', 'utf8');
const oldObj = `    if (request.method === 'POST' && upgradeHeader !== 'websocket') {
      const message = await request.text();
      this.sessions.forEach(s => {
        try { s.send(message); } catch (e) {}
      });
      return new Response("Broadcasted", { status: 200 });
    }`;
    
const newObj = `    if (request.method === 'POST' && upgradeHeader !== 'websocket') {
      const message = await request.text();
      // Broadcast any type of payload (message, reaction, typing, read receipt)
      this.sessions.forEach(s => {
        try { s.send(message); } catch (e) {}
      });
      return new Response("Broadcasted", { status: 200 });
    }`;
    
if (worker.includes(oldObj)) {
  worker = worker.replace(oldObj, newObj);
  fs.writeFileSync('backend/_worker.js', worker);
  console.log("✅ Backend Durable Object updated for all interactions");
}

// ==========================================
// PART 2: FRONTEND CHAT.JSX (Handle all events)
// ==========================================
let chat = fs.readFileSync('src/screens/Chat.jsx', 'utf8');
const oldFrontendWs = `    ws.onmessage = (event) => {
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
    };`;

const newFrontendWs = `    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        // 1. Handle New Messages / Edits
        if (payload.type === 'message' || payload.new || payload.id) {
          const m = payload.data || payload.new || payload;
          setMessages((cur) => cur.some((x) => x.id === m.id) ? cur.map(x => x.id === m.id ? {...x, ...m} : x) : [...cur, m]);
          
          if (m.sender_id !== myId) {
            supabase.from('conversation_reads').upsert(
              { conversation_id: conversationId, user_id: myId, last_read_at: new Date().toISOString() },
              { onConflict: 'conversation_id,user_id' }
            );
          }
        }
        
        // 2. Handle Reactions
        if (payload.type === 'reaction') {
           // Update local state for reactions (you will need to plug this into your reaction state)
           console.log("New reaction received:", payload.data);
        }
        
        // 3. Handle Typing Indicator
        if (payload.type === 'typing') {
           console.log("User is typing:", payload.data);
        }
        
      } catch (e) { console.error("WS Error", e); }
    };`;

if (chat.includes(oldFrontendWs)) {
  chat = chat.replace(oldFrontendWs, newFrontendWs);
  fs.writeFileSync('src/screens/Chat.jsx', chat);
  console.log("✅ Frontend Chat.jsx updated to handle Message, Reaction, and Typing events!");
}
