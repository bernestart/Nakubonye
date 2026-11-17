const fs = require('fs');
const ppcPath = 'src/components/ProfilePostCard.jsx';
let ppc = fs.readFileSync(ppcPath, 'utf8');

// 1. Fix the single image URL logic
const oldImgLogic = `const imageUrl = post.image_path
    ? supabase.storage.from("community-media").getPublicUrl(post.image_path).data?.publicUrl
    : null;`;

const newImgLogic = `const imageUrl = post.image_url || (post.image_path
    ? supabase.storage.from("community-media").getPublicUrl(post.image_path).data?.publicUrl
    : null);`;

if (ppc.includes(oldImgLogic)) {
  ppc = ppc.replace(oldImgLogic, newImgLogic);
  console.log('✅ ProfilePostCard: Fixed single image fallback');
} else if (ppc.includes('const imageUrl = post.image_path')) {
  // Fallback regex if whitespace is different
  ppc = ppc.replace(/const imageUrl = post\.image_path[\s\S]*?: null;/, newImgLogic);
  console.log('✅ ProfilePostCard: Fixed single image fallback (regex)');
}

// 2. Fix the multiple image paths logic
const oldPathsLogic = `const paths = Array.isArray(post.image_paths) && post.image_paths.length > 0
    ? post.image_paths
    : (post.image_path ? [post.image_path] : []);`;

const newPathsLogic = `const paths = Array.isArray(post.image_paths) && post.image_paths.length > 0
    ? post.image_paths
    : (post.image_path ? [post.image_path] : (post.image_url ? [post.image_url] : []));`;

if (ppc.includes(oldPathsLogic)) {
  ppc = ppc.replace(oldPathsLogic, newPathsLogic);
  console.log('✅ ProfilePostCard: Fixed multiple image fallback');
}

fs.writeFileSync(ppcPath, ppc);
