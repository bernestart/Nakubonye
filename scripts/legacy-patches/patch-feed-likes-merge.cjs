const fs = require('fs');
const file = 'src/screens/Feed.jsx';
let code = fs.readFileSync(file, 'utf8');

const target = `    setMyReactions(myLikedIds)
    setReactionCounts(counts)`;

const replacement = `    // FIX: Merge Cloudflare likes_count into the local map
    list.forEach((p) => {
      if (typeof p.likes_count !== 'undefined') {
        const k = p._source + ":" + p.id;
        counts.set(k, p.likes_count);
      }
    });

    setMyReactions(myLikedIds)
    setReactionCounts(counts)`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Feed.jsx now merges Cloudflare likes!");
} else {
  console.log("❌ ERROR: Could not find the exact target block. Check line 634 manually.");
}
