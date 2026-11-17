const fs = require('fs');
const file = 'src/components/CommunityChat.jsx';
let code = fs.readFileSync(file, 'utf8');

// The exact block from line 198 to 208
const regex = /const\s+ch\s*=\s*supabase[\s\S]*?\.channel\('community-chat-'\s*\+\s*communityId\)[\s\S]*?\.subscribe\(\)\s*return\s*\(\)\s*=>\s*\{\s*supabase\.removeChannel\(ch\)\s*\}/;

const newWsCode = `// META-SCALE: Cloudflare WebSocket Connection
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

if (regex.test(code)) {
  code = code.replace(regex, newWsCode);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Frontend WebSocket wired up perfectly!");
} else {
  console.log("❌ ERROR: Could not match the exact block. Let's use a line-by-line approach.");
}
