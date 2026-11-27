const fs = require('fs');
const p = 'src/screens/EditProfile.jsx';

if (!fs.existsSync(p)) process.exit(1);
let s = fs.readFileSync(p, 'utf8');

// 1. Ensure API_BASE_URL is imported
if (!s.includes('API_BASE_URL')) {
  s = s.replace(
    "import { publicPhotoUrl } from '../lib/photo'",
    "import { publicPhotoUrl } from '../lib/photo';\nimport { API_BASE_URL } from '../lib/api';"
  );
}

// 2. Replace the LOAD block
const loadStart = s.indexOf("const { data: lfRow } = await supabase");
const loadEndMarker = "setLoading(false)";
const loadEnd = s.indexOf(loadEndMarker, loadStart) + loadEndMarker.length;

if (loadStart > -1 && loadEnd > loadStart) {
  const newLoad = `const loadRes = await fetch(\`\${API_BASE_URL}/api/profile/edit/load?myId=\${myId}\`).then(r => r.json());
    if (loadRes.success) {
      const d = loadRes.data;
      if (d.profile?.looking_for) setLookingFor(d.profile.looking_for);
      
      setAvailableInterests(d.allInterests || []);
      setSelectedInterests(d.interests || []);
      setPrompts(d.prompts || []);
      
      setPhotos((d.photos || []).map((p) => ({
        id: p.id,
        storage_path: p.storage_path,
        is_primary: p.is_primary,
        display_order: p.display_order,
        url: publicPhotoUrl(p.storage_path),
      })));
    }
    setLoading(false)`;
  
  s = s.slice(0, loadStart) + newLoad + s.slice(loadEnd);
  console.log("✅ Load block replaced.");
}

// 3. Replace the SAVE block
const saveStart = s.indexOf("// Save prompts");
const saveEndMarker = "setTimeout(() => setSavedMsg(''), 1600)";
const saveEnd = s.indexOf(saveEndMarker, saveStart) + saveEndMarker.length;

if (saveStart > -1 && saveEnd > saveStart) {
  const newSave = `// BFF: Save everything at once
    const cleanPrompts = prompts.filter((p) => p.prompt_key && p.answer && p.answer.trim().length > 0)
      .map((p, i) => ({ prompt_key: p.prompt_key, answer: p.answer.trim(), display_order: i }));
    
    const saveRes = await fetch(\`\${API_BASE_URL}/api/profile/edit/save\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ myId, prompts: cleanPrompts, interests: selectedInterests })
    }).then(r => r.json());

    if (!saveRes.success) { setSaving(false); setError(saveRes.error || 'Save failed'); return; }
    
    // Refresh local profile state
    setProfile(prev => ({ ...prev, ...saveRes.data }));
    setSaving(false)

    setSavedMsg('Saved.')
    tap('medium')
    setTimeout(() => setSavedMsg(''), 1600)`;

  s = s.slice(0, saveStart) + newSave + s.slice(saveEnd);
  console.log("✅ Save block replaced.");
}

fs.writeFileSync(p, s, 'utf8');
console.log('✅ EditProfile.jsx updated with BFF routes.');
