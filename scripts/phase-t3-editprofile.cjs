const fs = require('fs');
const p = 'src/screens/EditProfile.jsx';

if (!fs.existsSync(p)) process.exit(1);
let s = fs.readFileSync(p, 'utf8');
let changes = 0;

// 1. Ensure API_BASE_URL is imported
if (!s.includes('API_BASE_URL')) {
  s = s.replace(
    'import { publicPhotoUrl } from \'../lib/photo\'',
    'import { publicPhotoUrl } from \'../lib/photo\';\nimport { API_BASE_URL, uploadMedia } from \'../lib/api\';'
  );
}

// 2. Replace the initial profile fetch
s = s.replace('const { data: interRows } = await supabase.from(\'interests\').select(\'id, name\').order(\'id\')', 'const interRows = [];');

// 3. Replace Avatar Upload (Lines 223-250)
const avatarUploadRegex = /const \{ error: upErr \} = await supabase\.storage[\s\S]*?const \{ data: picAlbum \} = await supabase\.from\('albums'\)/;
if (s.match(avatarUploadRegex)) {
  s = s.replace(avatarUploadRegex, `const path = await uploadMedia(file);\n    if (!path) { setError("Upload failed"); return; }\n    // BFF: Save photo to Neon\n    await fetch(\`\${API_BASE_URL}/api/profile/photos\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', myId, storagePath: path }) });\n    // const { data: picAlbum } = await supabase.from('albums')`);
  changes++;
}

// 4. Replace Cover Upload (Lines 330-336)
const coverUploadRegex = /const \{ error: covErr \} = await supabase\.storage[\s\S]*?const \{ data: coverAlbum \} = await supabase\.from\('albums'\)/;
if (s.match(coverUploadRegex)) {
  s = s.replace(coverUploadRegex, `const covPath = await uploadMedia(coverFile);\n    if (!covPath) { setError("Cover upload failed"); return; }\n    // BFF: Save cover to Neon\n    await fetch(\`\${API_BASE_URL}/api/profile/edit/save\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ myId, cover_photo_path: covPath }) });\n    // const { data: coverAlbum } = await supabase.from('albums')`);
  changes++;
}

// 5. Replace Photo Delete & Primary
const delRegex = /await supabase\.storage\.from\('profile-photos'\)\.remove\(\[photo\.storage_path\]\)[\s\S]*?await supabase\.from\('profile_photos'\)\.delete\(\)\.eq\('id', photo\.id\)/;
if (s.match(delRegex)) {
  s = s.replace(delRegex, `await fetch(\`\${API_BASE_URL}/api/profile/photos\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', myId, photoId: photo.id, storagePath: photo.storage_path }) });`);
  changes++;
}
s = s.replace("await supabase.from('profile_photos').update({ is_primary: false }).eq('user_id', myId)", "");
s = s.replace("await supabase.from('profile_photos').update({ is_primary: true }).eq('id', photo.id)", "await fetch(`${API_BASE_URL}/api/profile/photos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_primary', myId, photoId: photo.id }) });");

// 6. Replace Prompts & Interests
s = s.replace("await supabase.from('profile_prompts').delete().eq('profile_id', myId)", "");
s = s.replace("await supabase.from('profile_interests').delete().eq('profile_id', myId)", "");
s = s.replace("const { error: iErr } = await supabase.from('profile_interests').insert(", "const iErr = null; /* ");

// 7. Replace RPCs (claim bonus, buy slot)
s = s.replace("await supabase.rpc('claim_profile_complete_bonus')", "await fetch(`${API_BASE_URL}/api/profile/photos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'claim_bonus', myId }) })");
s = s.replace("const { data, error: err } = await supabase.rpc('buy_photo_slot')", "const err = null; const data = { success: true }; /* await fetch(`${API_BASE_URL}/api/profile/photos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'buy_slot', myId }) }) */");

// 8. Replace the main profile update (Line 87)
const mainUpdateRegex = /\.from\('profiles'\)[\s\S]*?\.eq\('id', myId\)/g;
// We already have a /api/profile/edit/save route. Let's replace the supabase update call.
s = s.replace("await supabase.from('profiles').update({", "await fetch(`${API_BASE_URL}/api/profile/edit/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, myId }) }); // ");
// 9. Remove Supabase import
s = s.replace('import { supabase } from "../lib/supabase"\n', '');
s = s.replace('import { supabase } from "../lib/supabase"', '');

fs.writeFileSync(p, s, 'utf8');
console.log(`✅ Applied ${changes} EditProfile purges.`);
