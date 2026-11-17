const fs = require('fs');

// ==========================================
// 1. PATCH ONBOARDING.JSX
// ==========================================
const onboardPath = 'src/screens/Onboarding.jsx';
let o = fs.readFileSync(onboardPath, 'utf8');

// A. Update STEPS array (Remove Preferences and Looking For)
o = o.replace(
  /const STEPS = \['Identity', 'About you', 'Preferences', 'Looking for', 'Where & bio', 'Interests', 'Photo'\]/,
  `const STEPS = ['Identity', 'About you', 'Where & bio', 'Interests', 'Photo', 'Cover']`
);

// B. Add Cover & Crop state
if (!o.includes('coverFile')) {
  o = o.replace(
    "const [photoPreview, setPhotoPreview] = useState('')",
    "const [photoPreview, setPhotoPreview] = useState('')\n  const [coverFile, setCoverFile] = useState(null)\n  const [coverPreview, setCoverPreview] = useState('')\n  const [cropImageSrc, setCropImageSrc] = useState(null)\n  const [cropType, setCropType] = useState(null)"
  );
}

// C. Add Imports
if (!o.includes('FilePicker')) {
  o = o.replace(
    "import { supabase } from '../lib/supabase'",
    `import { supabase } from '../lib/supabase'
import { FilePicker } from '@capawesome/capacitor-file-picker';
import ImageCropper from '../components/ImageCropper';`
  );
}

// D. Renumber the JSX steps (Old 5->3, 6->4, 7->5)
o = o.replace(/\{step === 5 && \(/g, '{step === 3 && (');
o = o.replace(/\{step === 6 && \(/g, '{step === 4 && (');
o = o.replace(/\{step === 7 && \(/g, '{step === 5 && (');

// E. Add Skip button to optional steps (3, 4, 5)
const skipButton = `
          <button onClick={() => setStep(s => s + 1)} className="text-purple-400 text-[13px] font-bold underline mb-4 block">
            Skip for now
          </button>
`;
// Inject skip before the main content of steps 3, 4, 5
o = o.replace(/(\{step === 3 && \(\s*<)/, `$1div className="flex flex-col">${skipButton}<`);
o = o.replace(/(\{step === 4 && \(\s*<)/, `$1div className="flex flex-col">${skipButton}<`);
o = o.replace(/(\{step === 5 && \(\s*<)/, `$1div className="flex flex-col">${skipButton}<`);

// F. Add Step 6: Cover Photo
const coverStepJSX = `
      {step === 6 && (
        <div className="flex flex-col">
          ${skipButton}
          <h2 className="text-white text-[24px] font-black mb-2">Cover Photo</h2>
          <p className="text-muted text-[14px] mb-6">Make your digital home stand out.</p>
          <button onClick={async () => {
            const res = await FilePicker.pickImages({ limit: 1, readData: true });
            if (res.files && res.files.length > 0) {
              const file = res.files[0];
              const blob = await (await fetch(\`data:\${file.mimeType};base64,\${file.data}\`)).blob();
              setCropType('cover');
              setCropImageSrc(URL.createObjectURL(new File([blob], 'cover.jpg', { type: file.mimeType })));
            }
          }} className="w-full h-40 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center mb-6 overflow-hidden">
            {coverPreview ? <img src={coverPreview} className="w-full h-full object-cover" /> : <><span className="text-3xl mb-2">🖼️</span><span className="text-muted text-sm font-semibold">Tap to add cover</span></>}
          </button>
        </div>
      )}

      {cropImageSrc && (
        <ImageCropper
          image={cropImageSrc}
          aspect={cropType === 'cover' ? 16 / 9 : 1}
          onCancel={() => { setCropImageSrc(null); setCropType(null); }}
          onCropDone={(file, previewUrl) => {
            if (cropType === 'cover') { setCoverFile(file); setCoverPreview(previewUrl); }
            else { setPhotoFile(file); setPhotoPreview(previewUrl); }
            setCropImageSrc(null); setCropType(null);
          }}
        />
      )}
`;
// Append right before the end of the main component return
o = o.replace(/<\/div>\s*\)\s*\}/, `${coverStepJSX}\n    </div>\n  )\n}`);

// G. Update Supabase insert to include cover path
if (!o.includes('cover_photo_path')) {
  o = o.replace(
    /\.update\(\{([\s\S]*?)\}\)/,
    `.update({$1, cover_photo_path: coverPath})`
  );
  // Add cover upload logic before the profile update
  o = o.replace(
    "const { error: pErr } = await supabase",
    `let coverPath = null;
    if (coverFile) {
      const path = \`covers/\${userId}/\${crypto.randomUUID()}.jpg\`;
      const { error: upErr } = await supabase.storage.from('profile-photos').upload(path, coverFile, { upsert: true, contentType: coverFile.type });
      if (!upErr) coverPath = path;
    }
    const { error: pErr } = await supabase`
  );
}
fs.writeFileSync(onboardPath, o);
console.log('✅ Onboarding.jsx: Rebuilt to Meta 6-step flow with Skips and Cropper');

// ==========================================
// 2. ADD DATING PREFS TO EDITPROFILE.JSX
// ==========================================
const editPath = 'src/screens/EditProfile.jsx';
let e = fs.readFileSync(editPath, 'utf8');

if (!e.includes('Dating Preferences')) {
  // Find the Bio field to inject the Dating Preferences right after it
  const bioInjectionAnchor = /<Field label="Bio"[\s\S]*?<\/Field>/;
  
  const datingPrefsUI = `
            <Field label="Dating Preferences">
              <div className="flex flex-col gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                <div>
                  <label className="text-[12px] text-white/60 font-semibold mb-1 block">Looking For</label>
                  <select value={lookingFor} onChange={e => setLookingFor(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                    <option value="">Select...</option>
                    <option value="long_term">Long-term relationship</option>
                    <option value="short_term">Short-term fun</option>
                    <option value="friendship">New friends</option>
                    <option value="network">Networking</option>
                  </select>
                </div>
                <div>
                  <label className="text-[12px] text-white/60 font-semibold mb-1 block">Interested In</label>
                  <select value={preferredGender} onChange={e => setPreferredGender(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                    <option value="">Anyone</option>
                    <option value="male">Men</option>
                    <option value="female">Women</option>
                  </select>
                </div>
              </div>
            </Field>
  `;
  
  if (e.match(bioInjectionAnchor)) {
    e = e.replace(bioInjectionAnchor, `$&${datingPrefsUI}`);
  }
  
  // Add state variables (just in case they aren't there)
  if (!e.includes('const [lookingFor, setLookingFor]')) {
    e = e.replace("const [bio, setBio] = useState('')", "const [bio, setBio] = useState('')\n  const [lookingFor, setLookingFor] = useState('')\n  const [preferredGender, setPreferredGender] = useState('')");
  }
  
  fs.writeFileSync(editPath, e);
  console.log('✅ EditProfile.jsx: Added Dating Preferences section');
}
