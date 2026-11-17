const fs = require('fs');
const file = 'src/components/CommunityFeed.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!code.includes('getCommunityPosts')) {
  code = "import { getCommunityPosts } from '../lib/api';\n" + code;
}

// 2. Replace the Supabase Fetch Block (Exact Match)
const oldFetch = `    const [postRes, muteRes] = await Promise.all([
      supabase
        .from('community_posts')
        .select('id, author_id, content, image_path, image_paths, created_at, pinned_until, reshared_from_type, reshared_from_id, reshared_from_snapshot, reshared_include_original, is_announcement, announcement_title')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('user_mutes').select('muted_id').eq('muter_id', session.user.id),
    ])`;

const newFetch = `    // META-SCALE: Fetch posts from Cloudflare API
    const postData = await getCommunityPosts([communityId], session.user.id);
    const muteRes = await supabase.from('user_mutes').select('muted_id').eq('muter_id', session.user.id);
    
    // Mock the Supabase response structure so the rest of the code doesn't break
    const postRes = { data: postData, error: null };`;

if (code.includes(oldFetch)) {
  code = code.replace(oldFetch, newFetch);
  console.log("✅ SUCCESS: Replaced Supabase fetch with Cloudflare API");
} else {
  console.log("❌ ERROR: Could not find the exact fetch block.");
}

// 3. Fix the Image Mapping (Ensure image_paths array is created)
const oldEnrich = `          return {
            id: r.id,
            author_id: r.author_id,
            content: r.content,
            image_url: imageUrl,`;

const newEnrich = `          // FIX: Ensure image_paths array is created from the single image_path
          const finalPaths = Array.isArray(r.image_paths) && r.image_paths.length > 0 
            ? r.image_paths 
            : (r.image_path ? [r.image_path] : []);

          return {
            id: r.id,
            author_id: r.author_id,
            content: r.content,
            image_url: imageUrl,
            image_paths: finalPaths, // Pass the array to the UI`;

if (code.includes(oldEnrich)) {
  code = code.replace(oldEnrich, newEnrich);
  console.log("✅ SUCCESS: Fixed image mapping to include image_paths array");
} else {
  console.log("⚠️ WARNING: Could not find the exact enrich return block.");
}

fs.writeFileSync(file, code);
