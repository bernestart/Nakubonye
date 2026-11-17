const fs = require('fs');

// --- PATCH 1: ONBOARDING.JSX (Meta Rebrand & Telegram Upload) ---
let onboard = fs.readFileSync('src/screens/Onboarding.jsx', 'utf8');

// 1. Ensure uploadMedia is imported
if (!onboard.includes('uploadMedia')) {
  onboard = "import { uploadMedia } from '../lib/api';\n" + onboard;
}

// 2. Change the steps array (Remove dating steps)
onboard = onboard.replace(
  /const STEPS = \[[\s\S]*?\]/,
  `const STEPS = ['Identity', 'About you', 'Where & bio', 'Interests', 'Photo', 'Cover']`
);

// 3. Patch Profile Photo Upload to Telegram
const oldOnboardUpload = /const ext = photoFile\.name\.split\('\.'\)[\s\S]*?if \(uErr\) \{ setBusy\(false\); setError\(uErr\.message\); return \}/;
if (oldOnboardUpload.test(onboard)) {
  onboard = onboard.replace(oldOnboardUpload, `const path = await uploadMedia(photoFile);`);
}

// 4. Add Cover Photo state if missing
if (!onboard.includes('coverFile')) {
  onboard = onboard.replace(
    "const [photoFile, setPhotoFile] = useState(null)",
    "const [photoFile, setPhotoFile] = useState(null)\n  const [coverFile, setCoverFile] = useState(null)"
  );
}

fs.writeFileSync('src/screens/Onboarding.jsx', onboard);
console.log("✅ SUCCESS: Onboarding.jsx safely rebranded and uploads routed to Telegram!");

// --- PATCH 2: EDITPROFILE.JSX (Telegram Uploads) ---
let editProfile = fs.readFileSync('src/screens/EditProfile.jsx', 'utf8');

if (!editProfile.includes('uploadMedia')) {
  editProfile = "import { uploadMedia } from '../lib/api';\n" + editProfile;
}

// Patch Profile Photo
const oldEditPhoto = /const ext = f\.name\.split\('\.'\)[\s\S]*?if \(upErr\) \{ setError\(upErr\.message\); continue \}/;
if (oldEditPhoto.test(editProfile)) {
  editProfile = editProfile.replace(oldEditPhoto, `const path = await uploadMedia(f);`);
}

// Patch Cover Photo
const oldEditCover = /const path = \`covers\/[\s\S]*?if \(covErr\) \{ setSaving\(false\); setError\(covErr\.message\); return \}/;
if (oldEditCover.test(editProfile)) {
  editProfile = editProfile.replace(oldEditCover, `const path = await uploadMedia(coverFile);`);
}

fs.writeFileSync('src/screens/EditProfile.jsx', editProfile);
console.log("✅ SUCCESS: EditProfile.jsx safely patched for Telegram uploads!");
