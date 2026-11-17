const fs = require('fs');

// 1. Patch PostDetail.jsx
let detailCode = fs.readFileSync('src/screens/PostDetail.jsx', 'utf8');
const oldDetail = `        if (source === "personal") {
          const { data } = await supabase
            .from("user_posts")
            .select("id, user_id, content, image_path, image_paths, audience, created_at")
            .lte("publish_at", new Date().toISOString())
            .eq("id", id).maybeSingle()
          row = data ? { ...data, _source: "personal", author_id: data.user_id } : null
        } else if (source === "community") {`;

const newDetail = `        if (source === "personal") {
          // META-SCALE: Fetch from Cloudflare
          const res = await fetch(\`https://nakubonye.bernestart.workers.dev/api/posts?id=\${id}\`);
          const json = await res.json();
          if (json.success && json.data) {
            row = { ...json.data, _source: "personal", author_id: json.data.user_id };
          }
        } else if (source === "community") {`;

if (detailCode.includes(oldDetail)) {
  detailCode = detailCode.replace(oldDetail, newDetail);
  fs.writeFileSync('src/screens/PostDetail.jsx', detailCode);
  console.log("✅ SUCCESS: PostDetail.jsx now fetches from Cloudflare!");
} else {
  console.log("❌ ERROR: Could not patch PostDetail.jsx. (String mismatch)");
}

// 2. Patch PostLikesModal.jsx
let likesModalCode = fs.readFileSync('src/components/PostLikesModal.jsx', 'utf8');
const oldLikes = `      const { data: rows } = await supabase
        .from(table)
        .select("user_id, reaction")
        .eq("post_id", postId)
        .order("created_at", { ascending: false })
        .limit(200)`;

const newLikes = `      // META-SCALE: Get User IDs from Cloudflare (Redis), but fetch avatars from Supabase
      let rows = [];
      if (table === "user_post_likes") {
        const res = await fetch(\`https://nakubonye.bernestart.workers.dev/api/likes/list?postId=\${postId}\`);
        const json = await res.json();
        if (json.success && json.data) {
          rows = json.data.map(u => ({ user_id: u.id, reaction: '❤️' }));
        }
      } else {
        const res = await supabase.from(table).select("user_id, reaction").eq("post_id", postId).order("created_at", { ascending: false }).limit(200);
        rows = res.data || [];
      }`;

if (likesModalCode.includes(oldLikes)) {
  likesModalCode = likesModalCode.replace(oldLikes, newLikes);
  fs.writeFileSync('src/components/PostLikesModal.jsx', likesModalCode);
  console.log("✅ SUCCESS: PostLikesModal.jsx now fetches IDs from Cloudflare!");
} else {
  console.log("❌ ERROR: Could not patch PostLikesModal.jsx. (String mismatch)");
}
