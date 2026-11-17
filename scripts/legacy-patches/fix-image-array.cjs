const fs = require('fs');
const file = 'src/screens/PostDetail.jsx';
let code = fs.readFileSync(file, 'utf8');

// We look for where the row is set in state
const target = `setPost(row)`;

const replacement = `// FIX: Ensure single image_path becomes an array for the UI
        if (row.image_path && (!row.image_paths || row.image_paths.length === 0)) {
          row.image_paths = [row.image_path];
        }
        setPost(row)`;

if (code.includes(target) && !code.includes("Ensure single image_path")) {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: PostDetail.jsx image array fixed!");
} else {
  console.log("⚠️ WARNING: Target not found or already patched.");
}
