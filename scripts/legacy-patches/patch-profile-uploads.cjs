const fs = require('fs');

// --- PATCH ONBOARDING.JSX ---
let onboard = fs.readFileSync('src/screens/Onboarding.jsx', 'utf8');
if (!onboard.includes('uploadMedia')) {
  onboard = "import { uploadMedia } from '../lib/api';\n" + onboard;
}

const oldOnboard = `const ext = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
          const path = \`\${userId}/\${crypto.randomUUID()}.\${ext}\`
          const { error: uErr } = await supabase.storage
            .from('profile-photos')
            .upload(path, photoFile, { upsert: false, contentType: photoFile.type })
          if (uErr) { setBusy(false); setError(uErr.message); return }`;

const newOnboard = `// META-SCALE: Upload to Telegram
          const path = await uploadMedia(photoFile);`;

if (onboard.includes(oldOnboard)) {
  onboard = onboard.replace(oldOnboard, newOnboard);
  fs.writeFileSync('src/screens/Onboarding.jsx', onboard);
  console.log("✅ SUCCESS: Onboarding.jsx profile photo upload patched!");
}

// --- PATCH EDITPROFILE.JSX (Profile Photos) ---
let editProfile = fs.readFileSync('src/screens/EditProfile.jsx', 'utf8');
if (!editProfile.includes('uploadMedia')) {
  editProfile = "import { uploadMedia } from '../lib/api';\n" + editProfile;
}

const oldEditProfile = `const ext = f.name.split('.').pop()?.toLowerCase() || 'jpg'
          const path = \`\${myId}/\${crypto.randomUUID()}.\${ext}\`
          const { error: upErr } = await supabase.storage
            .from('profile-photos')
            .upload(path, f, { upsert: false, contentType: f.type })
          if (upErr) { setError(upErr.message); continue }`;

const newEditProfile = `// META-SCALE: Upload to Telegram
          const path = await uploadMedia(f);`;

if (editProfile.includes(oldEditProfile)) {
  editProfile = editProfile.replace(oldEditProfile, newEditProfile);
  fs.writeFileSync('src/screens/EditProfile.jsx', editProfile);
  console.log("✅ SUCCESS: EditProfile.jsx profile photos upload patched!");
}

fs.writeFileSync('src/screens/EditProfile.jsx', editProfile); // Ensure save
