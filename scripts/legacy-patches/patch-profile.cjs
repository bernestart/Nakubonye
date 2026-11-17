const fs = require('fs');
const file = 'src/screens/ProfileView.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add the import if it's missing
if (!code.includes('import { getUserPosts }')) {
  code = "import { getUserPosts } from '../lib/api';\n" + code;
}

// 2. Replace the exact Supabase query with our new API call
const oldQueryRegex = /supabase\.from\('user_posts'\)[\s\S]*?\.limit\(60\),/;
const newQuery = `getUserPosts(userId),`;

if (code.match(oldQueryRegex)) {
  code = code.replace(oldQueryRegex, newQuery);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: ProfileView.jsx has been patched!");
} else {
  console.log("❌ ERROR: Could not find the exact user_posts query to replace.");
}
