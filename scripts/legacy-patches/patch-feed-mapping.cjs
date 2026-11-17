const fs = require('fs');
const file = 'src/screens/Feed.jsx';
let code = fs.readFileSync(file, 'utf8');

const oldMapping = `const personalRows = (rankedRows || []).map(r => ({
      id: r.post_id,
      user_id: r.user_id,`;

const newMapping = `const personalRows = (rankedRows || []).map(r => ({
      id: r.post_id,
      user_id: r.user_id,
      author_id: r.user_id, // FIX: Map user_id to author_id for the UI
      _source: "post",      // FIX: Tell the UI this is a regular post`;

if (code.includes(oldMapping)) {
  code = code.replace(oldMapping, newMapping);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Mapping fixed! Author ID and Source added.");
} else {
  console.log("❌ ERROR: Could not find the mapping block. Check line 283 manually.");
}
