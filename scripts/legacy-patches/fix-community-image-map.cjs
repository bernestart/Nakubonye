const fs = require('fs');
const file = 'src/components/CommunityFeed.jsx';
let code = fs.readFileSync(file, 'utf8');

// We target the exact line where the image URL is assigned in the return object
const targetLine = `image_url: imageUrl,`;
const replacementLine = `image_url: imageUrl,
            image_paths: Array.isArray(r.image_paths) && r.image_paths.length > 0 ? r.image_paths : (r.image_path ? [r.image_path] : []),`;

if (code.includes(targetLine)) {
  // We only replace the FIRST occurrence to be safe (inside the map function)
  code = code.replace(targetLine, replacementLine);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Added image_paths array directly to the mapped object!");
} else {
  console.log("❌ ERROR: Could not find 'image_url: imageUrl,'. Please check line 110.");
}
