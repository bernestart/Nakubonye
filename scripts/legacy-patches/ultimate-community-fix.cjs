const fs = require('fs');

// PATCH 1: PostDetail.jsx
let detailCode = fs.readFileSync('src/screens/PostDetail.jsx', 'utf8');
const oldDetailBlock = /const \{ data \} = await supabase\s*\.from\("community_posts"\)[\s\S]*?row = data \? \{ \.\.\.data, _source: "community" \} : null/;
const newDetailBlock = `const res = await fetch(\`https://nakubonye.bernestart.workers.dev/api/community/posts?id=\${id}\`);
          const json = await res.json();
          if (json.success && json.data) {
            row = { ...json.data, _source: "community", author_id: json.data.author_id };
          }`;

if (detailCode.match(oldDetailBlock)) {
  detailCode = detailCode.replace(oldDetailBlock, newDetailBlock);
  fs.writeFileSync('src/screens/PostDetail.jsx', detailCode);
  console.log("✅ SUCCESS: PostDetail.jsx strictly uses Cloudflare API!");
}

// PATCH 2: Feed.jsx
let feedCode = fs.readFileSync('src/screens/Feed.jsx', 'utf8');
const imageRegex = /<PostImages[\s\S]*?bucket="community-media"/;
const newImages = `<PostImages
                      paths={Array.isArray(p.image_paths) && p.image_paths.length > 0 ? p.image_paths : (p.image_path ? [p.image_path] : [])}
                      alts={p.image_alts || []}
                      bucket="community-media"`;

if (feedCode.match(imageRegex)) {
  feedCode = feedCode.replace(imageRegex, newImages);
  fs.writeFileSync('src/screens/Feed.jsx', feedCode);
  console.log("✅ SUCCESS: Feed.jsx images patched!");
}
