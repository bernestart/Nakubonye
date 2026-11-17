const fs = require('fs');

// ==========================================
// PART 1: CLEAN ONBOARDING.JSX
// ==========================================
let onboard = fs.readFileSync('src/screens/Onboarding.jsx', 'utf8');

// 1. Reduce steps to 5 (Identity, About, Bio, Interests, Photo)
onboard = onboard.replace(
  /const STEPS = \[[\s\S]*?\]/,
  `const STEPS = ['Identity', 'About you', 'Where & bio', 'Interests', 'Photo']`
);

// 2. Disable the dating steps by making them false (safest way without breaking brackets)
onboard = onboard.replace(/\{step === 3 && \(/g, '{false && (');
onboard = onboard.replace(/\{step === 4 && \(/g, '{false && (');

// 3. Change Date of Birth to manual text input
// We look for the date input and replace it with a text input
const dobRegex = /<input\s+type="date"[\s\S]*?\/>/;
if (dobRegex.test(onboard)) {
  onboard = onboard.replace(dobRegex, `<input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-elevated border border-line rounded-2xl px-4 py-3 text-cream text-[15px] focus:outline-none focus:border-purple-500"
                  />`);
}

// Ensure uploadMedia is used for Profile Photo
const onboardUploadRegex = /const ext = photoFile\.name\.split\('\.'\)[\s\S]*?if \(uErr\) \{ setBusy\(false\); setError\(uErr\.message\); return \}/;
if (onboardUploadRegex.test(onboard)) {
  onboard = onboard.replace(onboardUploadRegex, `const path = await uploadMedia(photoFile);`);
}
fs.writeFileSync('src/screens/Onboarding.jsx', onboard);
console.log("✅ SUCCESS: Onboarding.jsx is now Meta-style (Dating steps hidden, DOB manual, Telegram upload)");

// ==========================================
// PART 2: UNIVERSAL UPLOAD PATCH (ALL FILES)
// ==========================================
const filesToPatch = [
  'src/screens/Chat.jsx',
  'src/screens/GroupChat.jsx',
  'src/screens/CreateGroup.jsx',
  'src/screens/CreateListing.jsx',
  'src/screens/CreateService.jsx',
  'src/screens/EditProfile.jsx'
];

filesToPatch.forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');
  
  if (!code.includes('uploadMedia')) {
    code = "import { uploadMedia } from '../lib/api';\n" + code;
  }

  // Pattern to find: const { error: upErr } = await supabase.storage.from('...').upload(path, VARIABLE, ...)
  // We capture the VARIABLE (e.g., file, f, attachment, avatarFile, res.blob)
  const uploadRegex = /const\s*\{\s*error:\s*\w+\s*\}\s*=\s*await\s*supabase\s*\.storage\s*\.from\([^)]+\)\s*\.upload\(\s*path\s*,\s*([^,]+)[\s\S]*?\)/g;
  
  code = code.replace(uploadRegex, (match, fileVar) => {
    return `const path = await uploadMedia(${fileVar});`;
  });

  // Also fix the getPublicUrl calls so they just use the path variable directly
  const urlRegex = /const\s*\{\s*data:\s*pub\s*\}\s*=\s*supabase\s*\.storage\s*\.from\([^)]+\)\s*\.getPublicUrl\(path\)/g;
  code = code.replace(urlRegex, `const pub = { publicUrl: path }; // Cloudflare will proxy it`);

  fs.writeFileSync(file, code);
  console.log(`✅ SUCCESS: Routed uploads to Telegram in ${file}`);
});

// ==========================================
// PART 3: MOVE DATING PREFERENCES TO EDITPROFILE
// ==========================================
let editProfile = fs.readFileSync('src/screens/EditProfile.jsx', 'utf8');

// We will inject the Dating UI right before the "Save" button
const saveButtonRegex = /<(Button|button)[^>]*onClick=\{handleSave\}/;

const datingUI = `
          {/* DATING PREFERENCES (Moved from Onboarding) */}
          <div className="mt-8 mb-4 border-t border-line pt-6">
            <h3 className="text-cream font-bold text-[16px] mb-4">Dating Preferences</h3>
            
            <Field label="Interested in">
              <div className="grid grid-cols-3 gap-2">
                {['female', 'male', 'everyone'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPreferredGender(v)}
                    className={\`py-3 rounded-2xl text-[13px] font-semibold border \${
                      preferredGender === v ? 'bg-purple-600 border-purple-600 text-white' : 'bg-elevated border-line text-muted'
                    }\`}
                  >
                    {v === 'female' ? 'Women' : v === 'male' ? 'Men' : 'Everyone'}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Age range">
              <div className="flex items-center gap-3">
                <input type="number" min={18} max={100} value={minAge} onChange={(e) => setMinAge(Number(e.target.value))} className="w-full bg-elevated border border-line rounded-2xl px-4 py-3 text-cream" placeholder="Min" />
                <span className="text-muted">to</span>
                <input type="number" min={18} max={100} value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} className="w-full bg-elevated border border-line rounded-2xl px-4 py-3 text-cream" placeholder="Max" />
              </div>
            </Field>
          </div>
`;

if (saveButtonRegex.test(editProfile) && !editProfile.includes("Dating Preferences (Moved")) {
  editProfile = editProfile.replace(saveButtonRegex, datingUI + '\n          $&');
  fs.writeFileSync('src/screens/EditProfile.jsx', editProfile);
  console.log("✅ SUCCESS: Injected Dating Preferences into EditProfile.jsx");
}

