const fs = require('fs');

// Fix Chat.jsx
let chat = fs.readFileSync('src/screens/Chat.jsx', 'utf8');
// This regex finds the duplicate path declarations and merges them
chat = chat.replace(/const\s+path\s*=\s*`[^`]+`;\s*\n\s*const\s+path\s*=\s*await\s+uploadMedia\(([^)]+)\);/g, 'const path = await uploadMedia($1);');
chat = chat.replace(/const\s+path\s*=\s*"[^"]+";\s*\n\s*const\s+path\s*=\s*await\s+uploadMedia\(([^)]+)\);/g, 'const path = await uploadMedia($1);');
fs.writeFileSync('src/screens/Chat.jsx', chat);
console.log("✅ Fixed duplicate path in Chat.jsx");
