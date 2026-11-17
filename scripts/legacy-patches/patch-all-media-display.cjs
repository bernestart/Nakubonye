const fs = require('fs');

const filesToPatch = [
  'src/screens/Search.jsx',
  'src/screens/ProfileView.jsx',
  'src/screens/Feed.jsx',
  'src/components/CommunityFeed.jsx'
];

filesToPatch.forEach(file => {
  let code = fs.readFileSync(file, 'utf8');
  
  // 1. Add import if missing
  if (!code.includes('getMediaUrl')) {
    code = "import { getMediaUrl } from '../lib/api';\n" + code;
  }

  // 2. Regex replace all Supabase getPublicUrl calls
  // Matches: supabase.storage.from("bucket").getPublicUrl(path).data?.publicUrl
  const regex = /supabase\s*\.storage\s*\.from\(([^)]+)\)\s*\.getPublicUrl\(([^)]+)\)\s*\.data\?\.publicUrl/g;
  
  // We use a replacement function to pass the bucket and path correctly
  code = code.replace(regex, (match, bucket, path) => {
    return `getMediaUrl(${path}, ${bucket})`;
  });

  fs.writeFileSync(file, code);
  console.log(`✅ Patched display URLs in ${file}`);
});
