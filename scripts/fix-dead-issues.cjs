const fs = require('fs');
const path = require('path');
const root = process.cwd();

// ==========================================
// FIX 1: StoryComposer (Use Camera Plugin)
// ==========================================
let sc = fs.readFileSync(path.join(root, 'src/components/StoryComposer.jsx'), 'utf8');

// Replace the preload useEffect with a dummy so it doesn't crash
const preloadStart = sc.indexOf('  // --- 1. PRELOAD GALLERY');
const preloadEnd = sc.indexOf('  async function runPublish');
if (preloadStart !== -1 && preloadEnd !== -1) {
  sc = sc.substring(0, preloadStart) + '  // Gallery preload disabled, using native picker on tap\n\n' + sc.substring(preloadEnd);
}

// Replace the selectRecentMedia function entirely
const selectStart = sc.indexOf('  async function selectRecentMedia');
const selectEnd = sc.indexOf('  // --- HANDLE STANDARD FILE PICKER CLICK ---');
if (selectStart !== -1 && selectEnd !== -1) {
  const newSelect = `  async function selectRecentMedia() {
    try {
      setBusy(true)
      setError("")
      
      // Use the official Capacitor Camera plugin to open the gallery safely
      const shot = await NativeCamera.getPhoto({
        quality: 90,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos, 
      })

      if (!shot.base64String) {
        setError("No image data received.")
        return
      }

      const ext = (shot.format || "jpeg").toLowerCase()
      const mime = \`image/\${ext === "jpg" ? "jpeg" : ext}\`
      const binary = atob(shot.base64String)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      
      const blob = new Blob([bytes], { type: mime })
      const file = new File([blob], \`story-\${Date.now()}.\${ext}\`, { type: mime })

      setFile(file)
      setPreview(URL.createObjectURL(blob))
      setEditedBlob(null)
      setEditorOpen(true)

    } catch (e) {
      // Ignore user cancellation
      if (e.message && !e.message.includes('cancelled')) {
        console.warn("Native picker failed:", e)
        setError("Could not load media: " + (e.message || "Unknown error"))
      }
    } finally {
      setBusy(false)
    }
  }

`;
  sc = sc.substring(0, selectStart) + newSelect + sc.substring(selectEnd);
}

// Ensure the UI buttons call selectRecentMedia instead of the hidden input
sc = sc.replace(/onClick=\{\(\) => singleFileRef\.current\?\.click\(\)\}/g, 'onClick={selectRecentMedia}');
sc = sc.replace(/onClick=\{\(\) => multiFileRef\.current\?\.click\(\)\}/g, 'onClick={selectRecentMedia}');

fs.writeFileSync(path.join(root, 'src/components/StoryComposer.jsx'), sc);
console.log('✅ StoryComposer patched: Now using Capacitor Camera for gallery.');


// ==========================================
// FIX 2: ProfileMenuSheet (Force Onboarding)
// ==========================================
let pms = fs.readFileSync(path.join(root, 'src/components/ProfileMenuSheet.jsx'), 'utf8');

// Ensure useNavigate is imported
if (!pms.includes('useNavigate')) {
  pms = "import { useNavigate } from 'react-router-dom';\n" + pms;
}
if (!pms.includes('const nav = useNavigate()')) {
  const funcStart = pms.indexOf('export default function ProfileMenuSheet');
  const braceIndex = pms.indexOf('{', funcStart);
  pms = pms.substring(0, braceIndex + 1) + '\n  const nav = useNavigate();\n' + pms.substring(braceIndex + 1);
}

// Change the onClick to route to the real CreatorMode screen
pms = pms.replace(
  /onClick=\{\(\) => \{ tap\('light'\); onToggleCreatorMode\(\); onClose\(\); \}\}/, 
  "onClick={() => { tap('light'); nav('/settings/creator'); onClose(); }}"
);
// Fallback regex just in case the exact string differs
pms = pms.replace(
  /onClick=\{\(\) => \{ tap\('light'\); [^}]*handleToggleCreatorMode[^}]*\(\); onClose\(\); \}\}/, 
  "onClick={() => { tap('light'); nav('/settings/creator'); onClose(); }}"
);

fs.writeFileSync(path.join(root, 'src/components/ProfileMenuSheet.jsx'), pms);
console.log('✅ ProfileMenuSheet patched: Now routes directly to CreatorMode.jsx');
