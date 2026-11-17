const fs = require('fs');
const file = 'src/components/CommunityChat.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Remove the duplicate 'else' block
const brokenElse = `    } else {
      await supabase.from("community_mutes").delete().eq("community_id", communityId).eq("user_id", myId)
      setIsMuted(false)
    } else {
      await supabase.from("community_mutes").insert({ community_id: communityId, user_id: myId })
      setIsMuted(true)
    }`;

const fixedElse = `    } else {
      await supabase.from("community_mutes").delete().eq("community_id", communityId).eq("user_id", myId)
      setIsMuted(false)
    }`;

if (code.includes(brokenElse)) {
  code = code.replace(brokenElse, fixedElse);
  console.log("✅ Removed duplicate else block in CommunityChat.jsx");
} else {
  console.log("⚠️ Could not find the exact broken else block. Proceeding to async fix.");
}

// 2. Ensure the function containing the insert is 'async'
// The error was at line 443. We will find the function definition just before it.
// It's likely a function like `const sendMessage = (` or `async function sendMessage(`
const beforeInsert = code.substring(0, code.indexOf('await supabase\n      .from(\'community_messages\')'));
const lastFunction = beforeInsert.lastIndexOf('const handleSend');
const lastFunction2 = beforeInsert.lastIndexOf('const sendMessage');

if (lastFunction !== -1 && !code.substring(lastFunction, lastFunction + 30).includes('async')) {
   code = code.replace('const handleSend = (', 'const handleSend = async (');
   console.log("✅ Added async to handleSend");
} else if (lastFunction2 !== -1 && !code.substring(lastFunction2, lastFunction2 + 30).includes('async')) {
   code = code.replace('const sendMessage = (', 'const sendMessage = async (');
   console.log("✅ Added async to sendMessage");
} else {
   // Generic fallback: find the function before the await
   const functionRegex = /const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*\{/g;
   let match;
   while ((match = functionRegex.exec(beforeInsert)) !== null) {
       const funcName = match[1];
       if (code.includes(`const ${funcName} = (`)) {
           code = code.replace(`const ${funcName} = (`, `const ${funcName} = async (`);
           console.log(`✅ Added async to ${funcName}`);
       }
   }
}

fs.writeFileSync(file, code);
console.log("🎉 Syntax fix applied to CommunityChat.jsx!");
