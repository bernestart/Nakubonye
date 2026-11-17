const fs = require('fs');
const file = 'src/components/PostImages.jsx';
let code = fs.readFileSync(file, 'utf8');

const oldUrlLogic = `  const urls = paths.map((p) => {
    if (typeof p === 'string' && p.startsWith('http')) return p;
    return supabase.storage.from(bucket).getPublicUrl(p).data?.publicUrl;
  }).filter(Boolean)`;

const newUrlLogic = `  const urls = paths.map((p) => {
    if (typeof p === 'string' && p.startsWith('http')) return p;
    // FIX: If it's a Telegram file_id (no slashes), use Cloudflare Proxy
    if (typeof p === 'string' && !p.includes('/')) {
      return \`https://nakubonye.bernestart.workers.dev/api/media/\${p}\`;
    }
    // Otherwise, it's an old Supabase path
    return supabase.storage.from(bucket).getPublicUrl(p).data?.publicUrl;
  }).filter(Boolean)`;

if (code.includes(oldUrlLogic)) {
  code = code.replace(oldUrlLogic, newUrlLogic);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: PostImages.jsx now uses the Cloudflare Media Proxy!");
} else {
  console.log("❌ ERROR: Could not find the exact URL logic block.");
}
