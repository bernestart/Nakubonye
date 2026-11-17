const fs = require('fs');
const file = 'src/components/PostComposer.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add import if missing
if (!code.includes('import { createPost }')) {
  code = "import { createPost } from '../lib/api';\n" + code;
}

// 2. Match the exact Supabase block and replace it
const regex = /const\s*\{\s*data:\s*insertedRow,\s*error:\s*insErr\s*\}\s*=\s*await\s*supabase\.from\("user_posts"\)\.insert\(([\s\S]*?)\)\.select\("id"\)\.single\(\);?\s*if\s*\(insErr\)\s*throw\s*new\s*Error\(insErr\.message\);?/;

if (regex.test(code)) {
  code = code.replace(regex, `const payload = $1;
      const apiRes = await createPost(payload);
      if (!apiRes.success) throw new Error(apiRes.error);
      const insertedRow = apiRes.data;`);
      
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: PostComposer.jsx safely patched!");
} else {
  console.log("❌ ERROR: Could not find the exact Supabase insert block. No changes made.");
}
