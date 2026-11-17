const fs = require('fs');
const file = 'src/screens/EditProfile.jsx';
let code = fs.readFileSync(file, 'utf8');

// Ensure uploadMedia is imported
if (!code.includes('uploadMedia')) {
  code = "import { uploadMedia } from '../lib/api';\n" + code;
}

// The exact block we need to replace
const oldCoverBlock = `const path = \`covers/\${myId}/\${crypto.randomUUID()}.jpg\`
        const { error: covErr } = await supabase.storage
          .from('profile-photos')
          .upload(path, coverFile, { upsert: false, contentType: 'image/jpeg' })
        if (covErr) { setSaving(false); setError(covErr.message); return }
        coverPath = path`;

const newCoverBlock = `// META-SCALE: Upload cover to Telegram via Cloudflare
        const path = await uploadMedia(coverFile);
        coverPath = path;`;

if (code.includes(oldCoverBlock)) {
  code = code.replace(oldCoverBlock, newCoverBlock);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: EditProfile.jsx cover photo upload patched!");
} else {
  // Fallback if spacing is slightly different
  const regex = /const path = \`covers\/[\s\S]*?coverPath = path/;
  if (regex.test(code)) {
    code = code.replace(regex, newCoverBlock);
    fs.writeFileSync(file, code);
    console.log("✅ SUCCESS: Cover photo patched (Regex fallback)!");
  } else {
    console.log("❌ ERROR: Could not find the exact cover photo block.");
  }
}
