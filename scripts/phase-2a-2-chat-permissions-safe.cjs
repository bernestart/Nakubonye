const fs = require('fs');
const p = 'src/screens/Chat.jsx';

if (!fs.existsSync(p)) process.exit(1);
let lines = fs.readFileSync(p, 'utf8').split('\n');

// 1. Ensure API_BASE_URL is imported
const importIdx = lines.findIndex(l => l.includes('import { supabase }'));
if (importIdx > -1 && !lines[importIdx].includes('API_BASE_URL')) {
  lines.splice(importIdx, 0, 'import { API_BASE_URL } from "../lib/api";');
}

// 2. Patch the Direct/Request Permissions block
const directIdx = lines.findIndex(l => l.includes("const [directRes, reqRes] = await Promise.all(["));
if (directIdx > -1) {
  let endIdx = directIdx + 1;
  while (endIdx < lines.length && !lines[endIdx].includes("])")) endIdx++;
  
  lines.splice(directIdx, endIdx - directIdx + 1, 
    `      const permRes = await fetch(\`\${API_BASE_URL}/api/chat/permissions?sender=\${uid}&recipient=\${otherId}\`).then(r => r.json());`,
    `      const direct = permRes.success ? permRes.data.canSendDirect === true : false;`,
    `      const request = permRes.success ? permRes.data.canSendRequest === true : false;`
  );
  
  // Remove the old variable assignments
  const oldDirectIdx = lines.findIndex(l => l.includes("const direct = directRes.data === true"));
  if (oldDirectIdx > -1) lines.splice(oldDirectIdx, 2); // remove direct & request lines
}

// 3. Patch the Can See Online block
const onlineIdx = lines.findIndex(l => l.includes("await supabase.rpc('can_see_online'"));
if (onlineIdx > -1) {
  let endIdx = onlineIdx + 1;
  while (endIdx < lines.length && !lines[endIdx].includes("})")) endIdx++;
  
  // Replace the rpc call with the fetch
  lines.splice(onlineIdx, endIdx - onlineIdx + 1, 
    `      const permOnline = await fetch(\`\${API_BASE_URL}/api/chat/permissions?sender=\${session.user.id}&recipient=\${otherId}\`).then(r => r.json());`,
    `      const data = permOnline.success ? permOnline.data : {};`
  );
}

// 4. Fix the data extraction for online
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("setCanSeeOnline(data !== false)")) {
    lines[i] = "      setCanSeeOnline(data.canSeeOnline !== false);";
  }
}

// 5. Remove the Supabase import entirely
lines = lines.filter(l => !l.includes('import { supabase }'));

fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('✅ Chat.jsx permissions fully migrated to Worker (safe line-by-line).');
