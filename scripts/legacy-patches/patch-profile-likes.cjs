const fs = require('fs');
const file = 'src/screens/ProfileView.jsx';
let code = fs.readFileSync(file, 'utf8');

// Look for the mapping we just fixed earlier
const oldMapStr = `.map((p) => ({ ...p, _source: 'personal', author_id: p.user_id }))`;
const newMapStr = `.map((p) => ({ ...p, _source: 'personal', author_id: p.user_id, likes_count: p.likes_count || 0 }))`;

if (code.includes(oldMapStr)) {
  code = code.replace(oldMapStr, newMapStr);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: ProfileView.jsx now reads likes_count!");
} else {
  // Fallback if the exact string is slightly different
  const oldMapFallback = `.map((p) => ({ ...p, _source: 'personal' }))`;
  const newMapFallback = `.map((p) => ({ ...p, _source: 'personal', author_id: p.user_id, likes_count: p.likes_count || 0 }))`;
  if (code.includes(oldMapFallback)) {
    code = code.replace(oldMapFallback, newMapFallback);
    fs.writeFileSync(file, code);
    console.log("✅ SUCCESS: ProfileView.jsx patched (fallback)");
  } else {
    console.log("❌ ERROR: Could not find the mapping line in ProfileView.jsx.");
  }
}
