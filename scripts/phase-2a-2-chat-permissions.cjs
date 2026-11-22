const fs = require('fs');
const p = 'src/screens/Chat.jsx';

if (!fs.existsSync(p)) process.exit(1);
let s = fs.readFileSync(p, 'utf8');

// 1. Replace the block checking permissions
// We match the specific Promise.all block from your audit
const permRegex = /const \{ data: allowed \} = await supabase\.rpc\('can_send_message', \{[\s\S]*?\}\);/g;
const newPerm = `const permRes = await fetch(\`\${API_BASE_URL}/api/chat/permissions?sender=\${uid}&recipient=\${otherId}\`).then(r => r.json());
      const allowed = permRes.success ? permRes.data.canSendDirect : false;`;
s = s.replace(permRegex, newPerm);

// 2. Replace the initial direct/request checks
const directRegex = /supabase\.rpc\('can_send_message_direct', \{ sender: uid, recipient: otherId \}\),\s*supabase\.rpc\('can_send_message_request', \{ sender: uid, recipient: otherId \}\),/g;
const newDirect = `fetch(\`\${API_BASE_URL}/api/chat/permissions?sender=\${uid}&recipient=\${otherId}\`).then(r => r.json()).then(d => ({ data: d.data?.canSendDirect })),\n        Promise.resolve({ data: true }),`;
s = s.replace(directRegex, newDirect);

// 3. Replace can_see_online
const onlineRegex = /const \{ data \} = await supabase\.rpc\('can_see_online', \{[\s\S]*?\}\);/g;
const newOnline = `const permOnline = await fetch(\`\${API_BASE_URL}/api/chat/permissions?sender=\${uid}&recipient=\${otherId}\`).then(r => r.json());\n        const data = permOnline.data?.canSeeOnline;`;
s = s.replace(onlineRegex, newOnline);

// 4. Remove the Supabase import
s = s.replace('import { supabase } from "../lib/supabase"\n', '');
s = s.replace('import { supabase } from "../lib/supabase"', '');

fs.writeFileSync(p, s, 'utf8');
console.log('✅ Chat.jsx permissions fully migrated to Worker.');
