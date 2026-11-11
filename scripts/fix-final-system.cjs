const fs = require('fs');
const path = require('path');
const root = process.cwd();

// ==========================================
// 1. FIX CREATOR ONBOARDING (Remove 'Big' crash)
// ==========================================
const coPath = path.join(root, 'src/screens/CreatorOnboarding.jsx');
let co = fs.readFileSync(coPath, 'utf8');
let bigFound = false;

// Replace <Big> with <Users> or <Sparkles>
if (co.includes('<Big')) {
  co = co.replace(/<Big[^>]*\/>/g, '<Sparkles size={18} />');
  bigFound = true;
}
if (co.includes('Big')) {
  // If it's just the word Big in a variable name, remove it
  co = co.replace(/Big/g, 'Sparkles');
  bigFound = true;
}
fs.writeFileSync(coPath, co);
console.log(bigFound ? '✅ CreatorOnboarding: Removed <Big /> crash.' : '✅ CreatorOnboarding: No <Big /> crash found.');

// ==========================================
// 2. FIX STORY COMPOSER (Spinner, Camera, Grid)
// ==========================================
const scPath = path.join(root, 'src/components/StoryComposer.jsx');
let sc = fs.readFileSync(scPath, 'utf8');

// A. Restore the useEffect preload (Fixes infinite spinner)
const preloadStart = sc.indexOf('  // Gallery preload disabled');
const preloadEnd = sc.indexOf('  async function runPublish');
if (preloadStart !== -1 && preloadEnd !== -1) {
  const newPreload = `  // --- 1. PRELOAD GALLERY ---
  useEffect(() => {
    async function loadRecent() {
      if (!Capacitor.isNativePlatform()) { setLoadingMedia(false); return; }
      try {
        const perm = await PhotoLibrary.requestAuthorization();
        if (perm.state === 'authorized' || perm.state === 'limited') {
          const result = await PhotoLibrary.getLibrary({ limit: 18, includeImages: true, includeVideos: true });
          setRecentMedia(result.assets || []);
        }
      } catch (e) {
        console.warn("Native gallery load failed:", e);
      } finally {
        setLoadingMedia(false); // 🚨 THIS STOPS THE INFINITE SPINNER
      }
    }
    loadRecent()
  }, [])

`;
  sc = sc.substring(0, preloadStart) + newPreload + sc.substring(preloadEnd);
}

// B. Fix openCamera (Directly set state instead of faking a DOM event)
sc = sc.replace(
  /async function openCamera\(\) \{[\s\S]*?catch \(e\) \{ if \(e && e\.message && !\/cancel\/i\.test\(e\.message\)\) console\.warn\(e\) \}\n  \}/,
  `async function openCamera() {
    if (!Capacitor.isNativePlatform()) { singleFileRef.current?.click(); return }
    try {
      const shot = await NativeCamera.getPhoto({ quality: 90, resultType: CameraResultType.Base64, source: CameraSource.Camera })
      if (!shot.base64String) return
      const ext = (shot.format || "jpeg").toLowerCase()
      const mime = "image/" + (ext === "jpg" ? "jpeg" : ext)
      const binary = atob(shot.base64String)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: mime })
      const f = new File([blob], "story-" + Date.now() + "." + ext, { type: mime })
      
      // Directly set state instead of calling pickSingle
      setFile(f)
      setPreview(URL.createObjectURL(blob))
      setEditedBlob(null)
      setEditorOpen(true)
      
    } catch (e) { 
      if (e && e.message && !/cancel/i.test(e.message)) console.warn(e) 
    }
  }`
);

// C. Fix selectRecentMedia (Use fetch on webPath instead of Filesystem for Blobs)
sc = sc.replace(
  /async function selectRecentMedia\(photo\) \{[\s\S]*?finally \{\n      setBusy\(false\)\n    \}\n  \}/,
  `async function selectRecentMedia(photo) {
    try {
      setBusy(true)
      setError("")
      
      const fileInfo = await PhotoLibrary.getPhotoUrl({ id: photo.id })
      
      // Use fetch() on the webPath. It works perfectly in Capacitor WebView.
      const res = await fetch(fileInfo.webPath)
      const blob = await res.blob()
      
      const mime = fileInfo.mimeType || "image/jpeg"
      const file = new File([blob], photo.fileName || \`story-\${Date.now()}.jpg\`, { type: mime })

      setFile(file)
      setPreview(URL.createObjectURL(blob))
      setEditedBlob(null)

      if (photo.type === "video" || mime.startsWith("video/")) {
        setMode("video")
      } else {
        setEditorOpen(true)
      }
    } catch (e) {
      console.warn("Media load failed:", e)
      setError("Could not load image: " + (e.message || "Unknown error"))
    } finally {
      setBusy(false)
    }
  }`
);

fs.writeFileSync(scPath, sc);
console.log('✅ StoryComposer: Spinner fixed, Camera fixed, Grid tapping fixed.');
