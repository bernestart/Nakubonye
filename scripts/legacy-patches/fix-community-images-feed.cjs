const fs = require('fs');
const file = 'src/screens/Feed.jsx';
let code = fs.readFileSync(file, 'utf8');

// The exact line we found in your terminal
const target = `communityPosts = (rows || []).map((r) => ({ ...r, _source: "community" }))`;

const replacement = `communityPosts = (rows || []).map((r) => {
          // FIX: Ensure image_path is converted to image_paths array for the UI
          const paths = Array.isArray(r.image_paths) && r.image_paths.length > 0 
            ? r.image_paths 
            : (r.image_path ? [r.image_path] : []);
          return { ...r, _source: "community", image_paths: paths };
        });`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Feed.jsx community images mapped perfectly!");
} else {
  console.log("❌ ERROR: Still could not find the exact line.");
}
