const fs = require('fs');

// --- PATCH ONBOARDING.JSX ---
let onboard = fs.readFileSync('src/screens/Onboarding.jsx', 'utf8');
if (!onboard.includes('uploadMedia')) {
  onboard = "import { uploadMedia } from '../lib/api';\n" + onboard;
}
// Look for the upload block (Line 306)
const onboardRegex = /const\s+path\s*=\s*`[^`]*`[\s\S]*?const\s*\{\s*error:\s*uErr\s*\}\s*=\s*await\s*supabase\.storage[\s\S]*?if\s*\(uErr\)\s*\{[^}]*\}/;
if (onboardRegex.test(onboard)) {
  onboard = onboard.replace(onboardRegex, `const path = await uploadMedia(photoFile);`);
  fs.writeFileSync('src/screens/Onboarding.jsx', onboard);
  console.log("✅ SUCCESS: Onboarding profile photo patched!");
} else {
  console.log("❌ Onboarding patch failed. Line 306 needs manual review.");
}

// --- PATCH EDITPROFILE.JSX (Profile Photos) ---
let editProfile = fs.readFileSync('src/screens/EditProfile.jsx', 'utf8');
// Look for the upload block (Line 224)
const editProfileRegex = /const\s+path\s*=\s*`[^`]*`[\s\S]*?const\s*\{\s*error:\s*upErr\s*\}\s*=\s*await\s*supabase\.storage[\s\S]*?if\s*\(upErr\)\s*\{[^}]*\}/;
if (editProfileRegex.test(editProfile)) {
  editProfile = editProfile.replace(editProfileRegex, `const path = await uploadMedia(f);`);
  console.log("✅ SUCCESS: EditProfile profile photo patched!");
} else {
  console.log("❌ EditProfile patch failed. Line 224 needs manual review.");
}

// --- PATCH EDITPROFILE.JSX (Remove/Delete - Line 271) ---
// Since Telegram is free, we don't need to delete from storage. We just remove the Supabase call.
const removeRegex = /await\s*supabase\.storage\.from\('profile-photos'\)\.remove\([^)]+\)/;
if (removeRegex.test(editProfile)) {
  editProfile = editProfile.replace(removeRegex, `// META-SCALE: Telegram files are unlimited, skipping delete`);
  console.log("✅ SUCCESS: Removed unnecessary Supabase delete call!");
}

fs.writeFileSync('src/screens/EditProfile.jsx', editProfile);
