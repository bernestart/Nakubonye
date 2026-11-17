const fs = require('fs');
const file = 'src/screens/Feed.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Ensure import exists
if (!code.includes('getCommunityPosts')) {
  if (code.includes("import { getRankedFeed")) {
    code = code.replace("import { getRankedFeed", "import { getRankedFeed, getCommunityPosts");
  } else {
    code = "import { getCommunityPosts } from '../lib/api';\n" + code;
  }
}

// 2. Use a bulletproof Regex that ignores spacing/indentation
const regex = /const\s*\{\s*data:\s*rows,\s*error:\s*pErr\s*\}\s*=\s*await\s*supabase[\s\S]*?if\s*\(pErr\)\s*\{\s*setError\(pErr\.message\);\s*setLoading\(false\);\s*return\s*\}/;

const newBlock = `let rows = [];
        try {
          // Pass myId to the API for security verification
          rows = await getCommunityPosts(myCommIds, myId);
        } catch (err) {
          console.error("Community Feed API Error:", err);
        }`;

if (regex.test(code)) {
  code = code.replace(regex, newBlock);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Feed.jsx community posts secured and migrated!");
} else {
  console.log("❌ ERROR: Still could not find the block. Let's check line 240 manually.");
}
