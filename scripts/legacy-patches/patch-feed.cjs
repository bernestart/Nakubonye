const fs = require('fs');
const file = 'src/screens/Feed.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add import if it's not there
if (!code.includes('import { getRankedFeed }')) {
  code = "import { getRankedFeed } from '../lib/api';\n" + code;
}

// 2. Find the exact Supabase RPC block
const regex = /const\s*\{\s*data:\s*rankedRows,\s*error:\s*rpcErr\s*\}\s*=\s*await\s*supabase\.rpc\('get_ranked_feed',\s*\{[\s\S]*?\}\);/;

if (regex.test(code)) {
  code = code.replace(regex, `
    let rankedRows = [];
    try {
      rankedRows = await getRankedFeed(myId);
    } catch (err) {
      console.error("Feed API Error:", err);
    }
  `);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Feed.jsx has been patched to use Cloudflare API!");
} else {
  console.log("❌ ERROR: Could not find the exact RPC block. No changes made.");
}
