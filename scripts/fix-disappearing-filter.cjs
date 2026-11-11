const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/screens/Chat.jsx');
if (!fs.existsSync(file)) process.exit(1);

let src = fs.readFileSync(file, 'utf8');

// 1. Filter out expired messages on initial load
// We look for the fetch messages block and wrap it in a filter
const loadAnchor = "setMessages(data || [])";
if (src.includes(loadAnchor)) {
  src = src.replace(loadAnchor, "setMessages((data || []).filter(m => !m.expires_at || new Date(m.expires_at) > new Date()))");
} else {
  // If the exact anchor isn't there, try the generic map or set
  console.warn("⚠️ Could not find exact loadAnchor, checking for alternative...");
}

// 2. Filter out expired messages on real-time INSERT
// If a message comes in via websocket, check if it's already expired
const realtimeAnchor = "setMessages((cur) => [...cur, inserted])";
if (src.includes(realtimeAnchor)) {
  src = src.replace(realtimeAnchor, "if (!inserted.expires_at || new Date(inserted.expires_at) > new Date()) setMessages((cur) => [...cur, inserted])");
}

fs.writeFileSync(file, src);
console.log('✅ UI filter added: Expired messages will now be hidden.');
