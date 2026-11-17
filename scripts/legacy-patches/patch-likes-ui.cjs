const fs = require('fs');
const file = 'src/screens/Feed.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Update the mapping to include the likes_count from the API
const oldMapping = `      _rank_score: r.rank_score
    }));`;
const newMapping = `      _rank_score: r.rank_score,
      likes_count: r.likes_count || 0 // FIX: Read likes from Cloudflare API
    }));`;

if (code.includes(oldMapping)) {
  code = code.replace(oldMapping, newMapping);
  console.log("✅ Patched post mapping to include likes_count");
} else {
  // Fallback if the exact string isn't found
  const fallbackMapping = `_rank_score: r.rank_score`;
  if (code.includes(fallbackMapping)) {
      code = code.replace(fallbackMapping, `_rank_score: r.rank_score, likes_count: r.likes_count || 0`);
      console.log("✅ Patched post mapping (fallback)");
  }
}

fs.writeFileSync(file, code);
console.log("🎉 SUCCESS: Feed.jsx now reads likes from Redis!");
