const fs = require('fs');

// --- PATCH 1: PostDetail.jsx (Fix "Post Not Found") ---
let detailCode = fs.readFileSync('src/screens/PostDetail.jsx', 'utf8');
const oldCommunityDetail = `        } else if (source === "community") {
          const { data } = await supabase
            .from("community_posts")
            .select("id, author_id, community_id, content, image_path, image_paths, created_at")
            .eq("id", id).maybeSingle()
          row = data ? { ...data, _source: "community" } : null
        }`;

const newCommunityDetail = `        } else if (source === "community") {
          // META-SCALE: Fetch Community Post from Cloudflare
          const res = await fetch(\`https://nakubonye.bernestart.workers.dev/api/community/posts?id=\${id}\`);
          const json = await res.json();
          if (json.success && json.data) {
            row = { ...json.data, _source: "community", author_id: json.data.author_id };
          }
        }`;

if (detailCode.includes(oldCommunityDetail)) {
  detailCode = detailCode.replace(oldCommunityDetail, newCommunityDetail);
  fs.writeFileSync('src/screens/PostDetail.jsx', detailCode);
  console.log("✅ SUCCESS: PostDetail.jsx now fetches Community Posts from Cloudflare!");
} else {
  console.log("❌ ERROR: Could not patch PostDetail.jsx community block.");
}

// --- PATCH 2: Feed.jsx (Fix Community Image Rendering) ---
let feedCode = fs.readFileSync('src/screens/Feed.jsx', 'utf8');
// Look for the PostImages component to see how it's rendering
const oldImages = `<PostImages
                      paths={paths}
                      alts={p.image_alts || []}
                      bucket="community-media"`;

// We want to ensure paths correctly falls back to image_paths from the API
const newImages = `<PostImages
                      paths={Array.isArray(p.image_paths) && p.image_paths.length > 0 ? p.image_paths : (p.image_path ? [p.image_path] : [])}
                      alts={p.image_alts || []}
                      bucket="community-media"`;

if (feedCode.includes(oldImages)) {
  feedCode = feedCode.replace(oldImages, newImages);
  fs.writeFileSync('src/screens/Feed.jsx', feedCode);
  console.log("✅ SUCCESS: Feed.jsx Community Images patched to read from API arrays!");
} else {
  // Let's try a regex fallback to catch different spacing
  const imgRegex = /<PostImages\s+paths=\{paths\}\s+alts=\{p\.image_alts \|\| \[\]\}\s+bucket="community-media"/;
  if (imgRegex.test(feedCode)) {
    feedCode = feedCode.replace(imgRegex, newImages);
    fs.writeFileSync('src/screens/Feed.jsx', feedCode);
    console.log("✅ SUCCESS: Feed.jsx Community Images patched (Regex fallback)!");
  } else {
    console.log("⚠️ WARNING: Could not find <PostImages> block in Feed.jsx. Images might still be missing.");
  }
}
