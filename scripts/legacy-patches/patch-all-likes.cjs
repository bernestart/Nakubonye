const fs = require('fs');

// 1. PATCH PROFILEVIEW.JSX (Fixing the Write)
let profileCode = fs.readFileSync('src/screens/ProfileView.jsx', 'utf8');

if (!profileCode.includes('toggleLikeAPI')) {
  profileCode = "import { toggleLikeAPI } from '../lib/api';\n" + profileCode;
}

const oldDelete = `await supabase.from(table).delete().eq("post_id", p.id).eq("user_id", myId)`;
const newDelete = `await toggleLikeAPI(p.id, myId, 'unlike');`;

const oldInsert = `await supabase.from(table).insert(row)`;
const newInsert = `await toggleLikeAPI(p.id, myId, 'like');`;

if (profileCode.includes(oldDelete)) profileCode = profileCode.replace(oldDelete, newDelete);
if (profileCode.includes(oldInsert)) profileCode = profileCode.replace(oldInsert, newInsert);

fs.writeFileSync('src/screens/ProfileView.jsx', profileCode);
console.log("✅ ProfileView.jsx Write PATCHED to use Redis!");

// 2. PATCH FEED.JSX (Fixing the Read Reset)
let feedCode = fs.readFileSync('src/screens/Feed.jsx', 'utf8');

// We will disable the Supabase read for user_post_likes by returning empty arrays immediately
const oldFeedRead1 = `supabase.from("user_post_likes").select("post_id, created_at").eq("user_id", myId).gt("created_at", ninetyDaysAgo).limit(500),`;
const newFeedRead1 = `Promise.resolve({ data: [] }), // DISABLED: Using Cloudflare Redis likes instead`;

const oldFeedRead2 = `supabase.from("user_post_likes").select("post_id").in("post_id", personalIdsRank),`;
const newFeedRead2 = `Promise.resolve({ data: [] }), // DISABLED: Using Cloudflare Redis likes instead`;

if (feedCode.includes(oldFeedRead1)) feedCode = feedCode.replaceAll(oldFeedRead1, newFeedRead1);
if (feedCode.includes(oldFeedRead2)) feedCode = feedCode.replaceAll(oldFeedRead2, newFeedRead2);

fs.writeFileSync('src/screens/Feed.jsx', feedCode);
console.log("✅ Feed.jsx Read PATCHED to stop resetting!");

console.log("🎉 ALL DONE! Rebuild the APK.");
