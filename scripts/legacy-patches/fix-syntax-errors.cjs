const fs = require('fs');

// --- FIX 1: CommunityView.jsx (Duplicate Suspense) ---
let commView = fs.readFileSync('src/screens/CommunityView.jsx', 'utf8');
const duplicateSuspense = 'import { Suspense } from "react";\n';
// If the file has both imports, remove the standalone one
if (commView.includes(duplicateSuspense) && commView.includes('import { lazy, Suspense }')) {
  commView = commView.replace(duplicateSuspense, '');
  fs.writeFileSync('src/screens/CommunityView.jsx', commView);
  console.log("✅ SUCCESS: Removed duplicate Suspense import in CommunityView.jsx!");
}

// --- FIX 2: Onboarding.jsx (Broken Comma/Bracket) ---
let onboard = fs.readFileSync('src/screens/Onboarding.jsx', 'utf8');
// The exact broken line from your output
const brokenLine = `        bio: bio.trim(),                          , cover_photo_path: coverPath})`;
const fixedLine = `        bio: bio.trim(),
        cover_photo_path: coverPath
      })`;

if (onboard.includes(brokenLine)) {
  onboard = onboard.replace(brokenLine, fixedLine);
  fs.writeFileSync('src/screens/Onboarding.jsx', onboard);
  console.log("✅ SUCCESS: Fixed syntax error in Onboarding.jsx!");
} else {
  // Fallback regex if spacing is slightly different
  const regex = /bio:\s*bio\.trim\(\),\s*,\s*cover_photo_path:\s*coverPath\}\)/;
  if (regex.test(onboard)) {
    onboard = onboard.replace(regex, fixedLine);
    fs.writeFileSync('src/screens/Onboarding.jsx', onboard);
    console.log("✅ SUCCESS: Fixed syntax error in Onboarding.jsx (Regex fallback)!");
  } else {
    console.log("❌ ERROR: Could not find the exact syntax error in Onboarding.jsx.");
  }
}
