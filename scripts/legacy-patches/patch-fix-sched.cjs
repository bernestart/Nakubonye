const fs = require('fs');
const PC = 'src/components/PostComposer.jsx';
let s = fs.readFileSync(PC, 'utf8');

const find = `      const { data: insertedRow, error: insErr } = await supabase.from("user_posts").insert({`;
if (!s.includes(find)) { console.error('❌ insert not found'); process.exit(1); }

const replace = `      const scheduledFor = publishAt && new Date(publishAt).getTime() > Date.now() + 60_000
        ? new Date(publishAt).toISOString()
        : new Date().toISOString()
      const { data: insertedRow, error: insErr } = await supabase.from("user_posts").insert({`;

s = s.replace(find, replace);
fs.writeFileSync(PC, s);
console.log('✅ scheduledFor declaration added');
