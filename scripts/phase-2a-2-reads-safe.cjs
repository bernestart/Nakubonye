const fs = require('fs');
const p = 'src/screens/Messages.jsx';

if (!fs.existsSync(p)) process.exit(1);
let s = fs.readFileSync(p, 'utf8');

// 1. Ensure API_BASE_URL is imported
if (!s.includes('API_BASE_URL')) {
  s = s.replace(
    'import { supabase } from "../lib/supabase"',
    'import { API_BASE_URL } from "../lib/api";\nimport { supabase } from "../lib/supabase"'
  );
}

// 2. Replace group_reads upsert with exact match
const groupUpsertRegex = /await supabase\.from\("group_reads"\)\.upsert\(\s*groupRows,\s*\{\s*onConflict:\s*"group_id,user_id"\s*\}\s*\)/g;
const groupFetch = `fetch(\`\${API_BASE_URL}/api/inbox/read\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'group', rows: groupRows }) }).catch(() => {})`;
s = s.replace(groupUpsertRegex, groupFetch);

// 3. Replace conversation_reads upsert with exact match
const convUpsertRegex = /await supabase\.from\("conversation_reads"\)\.upsert\(\s*dmRows,\s*\{\s*onConflict:\s*"conversation_id,user_id"\s*\}\s*\)/g;
const convFetch = `fetch(\`\${API_BASE_URL}/api/inbox/read\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'dm', rows: dmRows }) }).catch(() => {})`;
s = s.replace(convUpsertRegex, convFetch);

fs.writeFileSync(p, s, 'utf8');
console.log('✅ Safe exact-match replacement applied.');
