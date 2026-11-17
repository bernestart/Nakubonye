const fs = require('fs');
const file = 'src/screens/ProfileView.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Fix the data access (handle both array directly and old .data object)
const oldDataStr = `const personal = (personalRes.data || [])`;
const newDataStr = `const personal = (Array.isArray(personalRes) ? personalRes : (personalRes.data || []))`;

if (code.includes(oldDataStr)) {
  code = code.replace(oldDataStr, newDataStr);
  console.log("✅ Patched data access");
}

// 2. Add author_id mapping so the UI knows who posted
const oldMapStr = `.map((p) => ({ ...p, _source: 'personal' }))`;
const newMapStr = `.map((p) => ({ ...p, _source: 'personal', author_id: p.user_id }))`;

if (code.includes(oldMapStr)) {
  code = code.replace(oldMapStr, newMapStr);
  console.log("✅ Patched author_id mapping");
}

fs.writeFileSync(file, code);
console.log("🎉 SUCCESS: ProfileView.jsx is fixed!");
