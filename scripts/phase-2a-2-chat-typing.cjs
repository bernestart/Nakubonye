const fs = require('fs');
const p = 'src/screens/Chat.jsx';

if (!fs.existsSync(p)) process.exit(1);
let s = fs.readFileSync(p, 'utf8');

// 1. Ensure API_BASE_URL is imported
if (!s.includes('API_BASE_URL')) {
  s = s.replace(
    'import { supabase } from "../lib/supabase"',
    'import { API_BASE_URL } from "../lib/api";\nimport { supabase } from "../lib/supabase"'
  );
}

// 2. Replace Typing Indicator (Supabase Channel -> Redis API)
const oldTyping = `    const ch = supabase.channel('typing-' + conversationId)
    ch.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload.payload.userId !== myId) {
        setOtherTyping(payload.payload.isTyping)
      }
    }).subscribe()
    typingChannelRef.current = ch
    return () => { supabase.removeChannel(ch); typingChannelRef.current = null }`;

// Since we don't know the exact line indentation, we use a regex that spans the block
const typingRegex = /const ch = supabase\.channel\('typing-' \+ conversationId\)[\s\S]*?return \(\) => \{ supabase\.removeChannel\(ch\); typingChannelRef\.current = null \}/g;

const newTyping = `    // META-SCALE: Typing Indicator via Cloudflare Redis
    const typingInterval = setInterval(async () => {
      try {
        const res = await fetch(\`\${API_BASE_URL}/api/typing/check?roomId=dm-\${conversationId}&userId=\${otherId}\`);
        const data = await res.json();
        setOtherTyping(data.isTyping || false);
      } catch (e) {}
    }, 2000);

    return () => { clearInterval(typingInterval); typingChannelRef.current = null }`;

s = s.replace(typingRegex, newTyping);

// 3. Replace Read Receipts (Use the new /api/inbox/read route)
// We match the upsert block for conversation_reads
const readReceiptRegex = /await supabase\.from\('conversation_reads'\)\.upsert\(\s*\{[\s\S]*?\}\s*,\s*\{[\s\S]*?\}\s*\)/g;
const newReadReceipt = `await fetch(\`\${API_BASE_URL}/api/inbox/read\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'dm', rows: [{ conversation_id: conversationId, user_id: myId }] }) }).catch(() => {})`;

s = s.replace(readReceiptRegex, newReadReceipt);

fs.writeFileSync(p, s, 'utf8');
console.log('✅ Chat.jsx Typing and Read Receipts patched.');
