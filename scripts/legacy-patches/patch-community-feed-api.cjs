const fs = require('fs');
const file = 'src/components/CommunityFeed.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add the API import
if (!code.includes('getCommunityPosts')) {
  if (code.includes("import { supabase")) {
    code = "import { getCommunityPosts } from '../lib/api';\n" + code;
  } else {
    code = "import { getCommunityPosts } from '../lib/api';\n" + code;
  }
}

// 2. Replace the Supabase fetch with Cloudflare API fetch
// We use a regex to catch the Supabase query, regardless of exact spacing
const supabaseFetchRegex = /supabase\s*\.from\(['"]community_posts['"]\)\s*\.select\([\s\S]*?\.limit\(30\)/; 

// If we can't find the exact limit, let's look for the surrounding block
const fallbackRegex = /const \{ data: postsData, error \} = await supabase[\s\S]*?\.from\(['"]community_posts['"]\)[\s\S]*?\.eq\(['"]community_id['"], communityId\)[\s\S]*?\.order\(['"]created_at['"], \{ ascending: false \}\)/;

// The new fetch block
const newFetchBlock = `const rows = await getCommunityPosts([communityId], session.user.id);\n      const postsData = rows;\n      const error = null;`;

if (code.match(supabaseFetchRegex)) {
  code = code.replace(supabaseFetchRegex, newFetchBlock);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: CommunityFeed.jsx now fetches from Cloudflare API!");
} else if (code.match(fallbackRegex)) {
  code = code.replace(fallbackRegex, newFetchBlock);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: CommunityFeed.jsx patched via fallback!");
} else {
  // If we still can't find it, we need to see the exact lines
  console.log("❌ ERROR: Could not auto-patch CommunityFeed.jsx. We need manual review.");
}
