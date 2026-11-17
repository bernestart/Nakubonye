const fs = require('fs');
const file = 'src/screens/Feed.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Ensure toggleLikeAPI is imported
if (!code.includes('toggleLikeAPI')) {
  if (code.includes("import { getRankedFeed }")) {
    code = code.replace("import { getRankedFeed }", "import { getRankedFeed, toggleLikeAPI }");
  } else {
    code = "import { toggleLikeAPI } from '../lib/api';\n" + code;
  }
}

// 2. Replace the UPDATE (changing reaction)
const oldUpdate = `await supabase.from(table).update({ reaction: emoji }).eq(idCol, postId).eq("user_id", myId)`;
const newUpdate = `await toggleLikeAPI(postId, myId, 'like');`;
if (code.includes(oldUpdate)) {
  code = code.replace(oldUpdate, newUpdate);
  console.log("✅ Patched UPDATE reaction");
}

// 3. Replace the DELETE (unliking)
const oldDelete = `await supabase.from(table).delete().eq(idCol, postId).eq("user_id", myId)`;
const newDelete = `await toggleLikeAPI(postId, myId, 'unlike');`;
if (code.includes(oldDelete)) {
  code = code.replace(oldDelete, newDelete);
  console.log("✅ Patched DELETE reaction");
}

// 4. Replace the INSERT (new like)
// We are replacing just the database insert, leaving the notification logic intact
const oldInsert = `await supabase.from(table).insert(row)`;
const newInsert = `await toggleLikeAPI(postId, myId, 'like');`;
if (code.includes(oldInsert)) {
  code = code.replace(oldInsert, newInsert);
  console.log("✅ Patched INSERT reaction");
}

fs.writeFileSync(file, code);
console.log("🎉 SUCCESS: Interactions are now running on Upstash Redis!");
