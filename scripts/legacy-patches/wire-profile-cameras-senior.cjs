const fs = require('fs');
const file = 'src/screens/ProfileView.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Ensure imports
if (!code.includes('uploadMedia')) {
  code = code.replace("import { supabase } from '../lib/supabase'", "import { supabase } from '../lib/supabase';\nimport { uploadMedia } from '../lib/api';");
}
if (!code.includes('useRef')) {
  code = code.replace("import { useState", "import { useState, useRef");
}

// 2. Add Refs and State (insert right after the component declaration)
const stateInjection = `  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const [uploadingImg, setUploadingImg] = useState(false);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const fileId = await uploadMedia(file);
      await supabase.from('profile_photos').update({ is_primary: false }).eq('user_id', userId);
      await supabase.from('profile_photos').insert({ user_id: userId, storage_path: fileId, is_primary: true, display_order: 0 });
      window.location.reload(); 
    } catch (err) { console.error(err); } finally { setUploadingImg(false); }
  };

  const handleCoverChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const fileId = await uploadMedia(file);
      await supabase.from('profiles').update({ cover_photo_path: fileId }).eq('id', userId);
      window.location.reload(); 
    } catch (err) { console.error(err); } finally { setUploadingImg(false); }
  };
`;

// Find the start of the component to inject state
const compStartRegex = /export default function ProfileView\(\) \{/;
if (compStartRegex.test(code)) {
  code = code.replace(compStartRegex, `export default function ProfileView() {\n${stateInjection}`);
}

// 3. Add hidden inputs right before the main return
const returnRegex = /return \(\s*<div/;
if (returnRegex.test(code)) {
  code = code.replace(returnRegex, `return (
    <div>
      <input type="file" accept="image/*" className="hidden" ref={avatarInputRef} onChange={handleAvatarChange} />
      <input type="file" accept="image/*" className="hidden" ref={coverInputRef} onChange={handleCoverChange} />
      {uploadingImg && <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center text-white font-bold">Uploading...</div>}
      <div`); // Note: We replace the opening <div with a wrapper + inputs
}

// 4. Wire the Avatar Camera Icon
// Replace the previously added button with the ref trigger
const oldAvatarBtn = `onClick={(e) => { e.stopPropagation(); tap('light'); nav('/edit-profile'); }}`;
const newAvatarBtn = `onClick={(e) => { e.stopPropagation(); tap('light'); avatarInputRef.current?.click(); }}`;
code = code.replace(oldAvatarBtn, newAvatarBtn);

// 5. Wire the Cover Camera Icon (If it exists)
// We will search for the cover camera icon div we added earlier (if we added one)
const oldCoverBtn = `onClick={(e) => { e.stopPropagation(); tap('light'); nav('/edit-profile'); }}`;
code = code.replace(oldCoverBtn, `onClick={(e) => { e.stopPropagation(); tap('light'); coverInputRef.current?.click(); }}`);

fs.writeFileSync(file, code);
console.log("✅ SUCCESS: ProfileView Camera Icons wired directly to Telegram Upload & Database Update!");
