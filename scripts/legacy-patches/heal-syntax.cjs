const fs = require('fs');

// --- FIX 1: Chat.jsx (Duplicate path) ---
let chat = fs.readFileSync('src/screens/Chat.jsx', 'utf8');
// Fix duplicate const path = ... const path = await uploadMedia(...)
chat = chat.replace(/const\s+path\s*=\s*`[^`]+`;\s*\n\s*const\s+path\s*=\s*await\s+uploadMedia\(([^)]+)\);/g, 'const path = await uploadMedia($1);');
chat = chat.replace(/const\s+path\s*=\s*"[^"]+";\s*\n\s*const\s+path\s*=\s*await\s+uploadMedia\(([^)]+)\);/g, 'const path = await uploadMedia($1);');
fs.writeFileSync('src/screens/Chat.jsx', chat);
console.log("✅ Fixed Chat.jsx duplicates");

// --- FIX 2: CommunityChat.jsx (Broken path and async) ---
let commChat = fs.readFileSync('src/components/CommunityChat.jsx', 'utf8');

// A. Fix the mangled voice note upload block
const brokenBlock = `let path = ""; setError(upErr.message); return }
    const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path)`;
const fixedBlock = `const path = await uploadMedia(result.blob);
    const pub = { publicUrl: path };`;

if (commChat.includes(brokenBlock)) {
  commChat = commChat.replace(brokenBlock, fixedBlock);
  console.log("✅ Fixed mangled voice note block in CommunityChat.jsx");
} else {
  // Fallback if spacing is different
  commChat = commChat.replace(/let\s+path\s*=\s*"";\s*setError\(upErr\.message\);\s*return\s*\}[\s\S]*?const\s*\{\s*data:\s*pub\s*\}\s*=\s*supabase\s*\.storage\s*\.from\("chat-media"\)\s*\.getPublicUrl\(path\)/g, `const path = await uploadMedia(result.blob);\n    const pub = { publicUrl: path };`);
  console.log("✅ Fixed mangled voice note block (fallback)");
}

// B. Fix the missing 'async' keyword
// The error is at: const { error: err } = await supabase.from("community_messages").insert(voicePayload)
// We will find the function that holds this line and add 'async' if it's missing.
const functionRegex = /const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*\{/g;
let match;
let hasAsyncError = false;

// Let's just find the function containing the insert and fix it
const insertIndex = commChat.indexOf('await supabase.from("community_messages").insert(voicePayload)');
if (insertIndex !== -1) {
  // Look backwards for the function definition
  const beforeInsert = commChat.slice(0, insertIndex);
  const lastFuncMatch = beforeInsert.lastIndexOf('const sendVoiceNote');
  const lastFuncMatch2 = beforeInsert.lastIndexOf('const handleSend');
  
  if (lastFuncMatch !== -1) {
     // Add async if it's missing
     commChat = commChat.replace(/const\s+sendVoiceNote\s*=\s*\(/g, 'const sendVoiceNote = async (');
  } else if (lastFuncMatch2 !== -1) {
     commChat = commChat.replace(/const\s+handleSend\s*=\s*\(/g, 'const handleSend = async (');
  } else {
     // Generic fallback for any function with await
     commChat = commChat.replace(/const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*\{\s*if\s*\(!recording\)/g, 'const $1 = async ($2) => {\n    if (!recording)');
     commChat = commChat.replace(/const\s+(\w+)\s*=\s*async\s*\(([^)]*)\)\s*=>\s*\{\s*if\s*\(!recording\)/g, 'const $1 = async ($2) => {\n    if (!recording)');
  }
  console.log("✅ Ensured voice note function is async");
}

fs.writeFileSync('src/components/CommunityChat.jsx', commChat);
console.log("🎉 Syntax Healing Complete! Run 'npm run build' to test.");
