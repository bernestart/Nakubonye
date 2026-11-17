const fs = require('fs');
const path = require('path');

// The new URL format for Cloudflare
const getCFUrl = (pathVar) => `\`https://nakubonye.bernestart.workers.dev/api/media/\${${pathVar}}\``;

// 1. Patch PostComposer (Reshare preview)
let composer = fs.readFileSync('src/components/PostComposer.jsx', 'utf8');
composer = composer.replace(/supabase\.storage\.from\("community-media"\)\.getPublicUrl\(([^)]+)\)\.data\?\.publicUrl/g, (match, p1) => getCFUrl(p1));
fs.writeFileSync('src/components/PostComposer.jsx', composer);

// 2. Patch CommunityFeed
let commFeed = fs.readFileSync('src/components/CommunityFeed.jsx', 'utf8');
commFeed = commFeed.replace(/supabase\.storage\.from\('community-media'\)\.getPublicUrl\(([^)]+)\)\.data\?\.publicUrl/g, (match, p1) => getCFUrl(p1));
fs.writeFileSync('src/components/CommunityFeed.jsx', commFeed);

// 3. Patch Feed.jsx
let feed = fs.readFileSync('src/screens/Feed.jsx', 'utf8');
feed = feed.replace(/supabase\.storage\.from\("community-media"\)\.getPublicUrl\(([^)]+)\)\.data\?\.publicUrl/g, (match, p1) => getCFUrl(p1));
fs.writeFileSync('src/screens/Feed.jsx', feed);

// 4. Patch PostDetail.jsx
let detail = fs.readFileSync('src/screens/PostDetail.jsx', 'utf8');
detail = detail.replace(/supabase\.storage\.from\("community-media"\)\.getPublicUrl\(([^)]+)\)\.data\?\.publicUrl/g, (match, p1) => getCFUrl(p1));
fs.writeFileSync('src/screens/PostDetail.jsx', detail);

console.log("✅ SUCCESS: All image URLs updated to use the Cloudflare Media Proxy!");
