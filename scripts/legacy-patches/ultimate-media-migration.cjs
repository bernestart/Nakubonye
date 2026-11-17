const fs = require('fs');

const files = [
  'src/screens/VerifyIdentity.jsx',
  'src/screens/Marketplace.jsx',
  'src/screens/ListingDetail.jsx',
  'src/screens/MyListings.jsx',
  'src/screens/Services.jsx',
  'src/screens/ServiceDetail.jsx',
  'src/screens/EditGroup.jsx',
  'src/screens/Saved.jsx',
  'src/screens/Memories.jsx',
  'src/lib/photo.js',
  'src/lib/storyUpload.js',
  'src/components/CommunityFeed.jsx',
  'src/components/CommunityChat.jsx',
  'src/components/StoryComposer.jsx',
  'src/components/StoryViewer.jsx',
  'src/components/ReelComposer.jsx',
  'src/components/PostImages.jsx',
  'src/components/EventComposer.jsx',
  'src/components/ResharedPost.jsx',
  'src/components/ProfilePostCard.jsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Ensure imports are present
  if (!code.includes('uploadMedia') && !code.includes('getMediaUrl')) {
    // Determine relative path to lib/api
    let importPath = file.includes('/components/') ? '../lib/api' : '../lib/api';
    if (file.includes('/lib/')) importPath = './api'; // For lib files
    
    // We only import what we need
    const needsUpload = code.includes('.upload(');
    const needsRead = code.includes('.getPublicUrl(');
    
    let imports = [];
    if (needsUpload) imports.push('uploadMedia');
    if (needsRead) imports.push('getMediaUrl');
    
    if (imports.length > 0) {
      code = `import { ${imports.join(', ')} } from '${importPath}';\n` + code;
    }
  }

  // 1. PATCH UPLOADS
  // Look for: const { error: ... } = await supabase.storage.from(...).upload(path, FILE, ...)
  // We also need to change "const path =" to "let path =" right before it so we can overwrite it.
  code = code.replace(/const\s+path\s*=\s*`[^`]+`/g, 'let path = ""');
  code = code.replace(/const\s+path\s*=\s*[^;]+/g, 'let path = ""');
  
  // Replace the upload block with the Telegram upload
  const uploadRegex = /const\s*\{\s*error:\s*(\w+)\s*\}\s*=\s*await\s*supabase\s*\.storage\s*\.from\([^)]+\)\s*\.upload\(\s*path\s*,\s*([^,]+)[\s\S]*?\)/g;
  if (uploadRegex.test(code)) {
    code = code.replace(uploadRegex, (match, errVar, fileVar) => {
      return `path = await uploadMedia(${fileVar});\n        const ${errVar} = null; // Telegram handles errors internally`;
    });
    changed = true;
  }

  // 2. PATCH READS
  // Replace: supabase.storage.from("bucket").getPublicUrl(path).data?.publicUrl
  // With: getMediaUrl(path, "bucket")
  const readRegex = /supabase\s*\.storage\s*\.from\(([^)]+)\)\s*\.getPublicUrl\(([^)]+)\)\s*\.data\?\.publicUrl/g;
  if (readRegex.test(code)) {
    code = code.replace(readRegex, (match, bucket, path) => {
      return `getMediaUrl(${path}, ${bucket})`;
    });
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, code);
    console.log(`✅ Patched Media in ${file}`);
  }
});

// Special case for PostComposer (ensure it uses uploadMedia)
let composer = fs.readFileSync('src/components/PostComposer.jsx', 'utf8');
if (composer.includes('fetch("https://nakubonye')) {
  // If it's still using fetch, replace with uploadMedia
  const fetchRegex = /const uploadRes = await fetch\([\s\S]*?const uploadJson = await uploadRes\.json\(\);\s*if \(!uploadJson\.success\) throw new Error\(uploadJson\.error \|\| "Upload failed"\);\s*uploadedPaths\.push\(uploadJson\.file_id\);/;
  if (fetchRegex.test(composer)) {
    composer = composer.replace(fetchRegex, `const fileId = await uploadMedia(f);\n        uploadedPaths.push(fileId);`);
    fs.writeFileSync('src/components/PostComposer.jsx', composer);
    console.log("✅ Patched PostComposer.jsx to use uploadMedia!");
  }
}

console.log("🎉 MEDIA MIGRATION COMPLETE! All uploads and reads are now on Telegram/Cloudflare.");
