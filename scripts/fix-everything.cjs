const fs = require('fs');
const path = require('path');
const root = process.cwd();

// ==========================================
// 1. FIX CREATOR ONBOARDING (Remove PhotoIllustration)
// ==========================================
const coPath = path.join(root, 'src/screens/CreatorOnboarding.jsx');
let co = fs.readFileSync(coPath, 'utf8');

// Replace the hallucinated component with standard img tags and the correct SVGs
co = co.replace(
  '<PhotoIllustration src="/illustrations/welcome.jpg" />',
  '<img src="/illustrations/creator/welcome.svg" className="w-full max-w-[280px] mx-auto mb-6" />'
);
co = co.replace(
  '<PhotoIllustration src="/illustrations/audience.jpg" />',
  '<img src="/illustrations/creator/audience.svg" className="w-full max-w-[280px] mx-auto mb-6" />'
);
co = co.replace(
  '<PhotoIllustration src="/illustrations/frame.jpg" />',
  '<img src="/illustrations/creator/finish.svg" className="w-full max-w-[280px] mx-auto mb-6" />'
);

fs.writeFileSync(coPath, co);
console.log('✅ CreatorOnboarding.jsx: Removed broken <PhotoIllustration />, using SVG images.');


// ==========================================
// 2. FIX CREATOR MODE (Turn Off logic & Intro Image)
// ==========================================
const cmPath = path.join(root, 'src/screens/CreatorMode.jsx');
let cm = fs.readFileSync(cmPath, 'utf8');

// Fix the Intro image (it was looking for a .jpg)
cm = cm.replace('/illustrations/entry.jpg', '/illustrations/creator/welcome.svg');

// Fix the turnOff function to ensure UI updates and context refreshes
// We use a regex to safely catch the whole function block
cm = cm.replace(
  /async function turnOff\(\) \{[\s\S]*?\n  \}/,
  `async function turnOff() {
    if (busy || !myId) return
    setBusy(true); tap('medium')
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_type: 'personal', creator_onboarded_at: null })
        .eq('id', myId)
      if (error) throw error
      
      // Update local state so the UI flips back to IntroView
      setAccountType('personal')
      setShowConfirmOff(false)
      
      // Refresh the global auth context
      if (refreshProfile) await refreshProfile()
      
      // Go back to the profile page
      nav('/me', { replace: true })
    } catch (e) {
      console.warn('disable creator mode failed', e)
      alert('Could not turn off creator mode: ' + (e.message || e))
    } finally { setBusy(false) }
  }`
);

fs.writeFileSync(cmPath, cm);
console.log('✅ CreatorMode.jsx: Fixed turnOff logic & intro SVG.');


// ==========================================
// 3. RESTORE STORY COMPOSER GRID (With Native Fix)
// ==========================================
const scPath = path.join(root, 'src/components/StoryComposer.jsx');
let sc = fs.readFileSync(scPath, 'utf8');

// A. Ensure Filesystem and PhotoLibrary are imported
if (!sc.includes('@capacitor/filesystem')) {
  sc = sc.replace(
    'import { Camera as NativeCamera',
    'import { Filesystem } from "@capacitor/filesystem"\nimport { PhotoLibrary } from "@capgo/capacitor-photo-library"\nimport { Camera as NativeCamera'
  );
}

// B. Replace the useEffect to preload the library
const preloadStart = sc.indexOf('  // --- 1. PRELOAD GALLERY');
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
        setLoadingMedia(false);
      }
    }
    loadRecent()
  }, [])

`;
  sc = sc.substring(0, preloadStart) + newPreload + sc.substring(preloadEnd);
}

// C. Replace selectRecentMedia to use Filesystem
const selectStart = sc.indexOf('  async function selectRecentMedia');
const selectEnd = sc.indexOf('  // --- HANDLE STANDARD FILE PICKER CLICK ---');
if (selectStart !== -1 && selectEnd !== -1) {
  const newSelect = `  async function selectRecentMedia(photo) {
    try {
      setBusy(true)
      setError("")
      
      const fileInfo = await PhotoLibrary.getPhotoUrl({ id: photo.id })
      
      // Use Filesystem to read the file (bypasses fetch CORS issues)
      const fileData = await Filesystem.readFile({ path: fileInfo.path })
      const binary = atob(fileData.data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      
      const mime = fileInfo.mimeType || "image/jpeg"
      const blob = new Blob([bytes], { type: mime })
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
  }

`;
  sc = sc.substring(0, selectStart) + newSelect + sc.substring(selectEnd);
}

// D. Restore the grid UI (Replace the "Open Gallery" block)
const uiStart = sc.indexOf('        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">');
const uiEnd = sc.indexOf('        <input ref={singleFileRef}');
if (uiStart !== -1 && uiEnd !== -1) {
  const newUI = `        <div className="flex-1 overflow-y-auto px-1 pb-4">
          <div className="grid grid-cols-3 gap-1">
             <button onClick={openCamera} className="aspect-[9/16] bg-[#242526] rounded-sm flex flex-col items-center justify-center gap-2 active:bg-white/10">
                <CameraIcon size={32} className="text-white/60" />
                <span className="text-white/60 text-[11px]">Camera</span>
             </button>

             {loadingMedia ? (
                <div className="aspect-[9/16] flex items-center justify-center bg-[#242526]">
                  <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
                </div>
             ) : recentMedia.length > 0 ? (
                recentMedia.map((photo, i) => (
                  <button key={i} onClick={() => selectRecentMedia(photo)} className="aspect-[9/16] bg-[#242526] rounded-sm overflow-hidden active:opacity-70">
                     <img src={photo.thumbnail?.webPath || photo.file?.webPath || ""} alt="" className="w-full h-full object-cover" />
                  </button>
                ))
             ) : (
                <button onClick={() => singleFileRef.current?.click()} className="aspect-[9/16] bg-[#242526] rounded-sm flex flex-col items-center justify-center gap-2 active:bg-white/10">
                  <ImageIcon size={32} className="text-white/60" />
                  <span className="text-white/60 text-[11px] text-center px-2">Choose from Gallery</span>
                </button>
             )}
          </div>
        </div>

`;
  sc = sc.substring(0, uiStart) + newUI + sc.substring(uiEnd);
}

fs.writeFileSync(scPath, sc);
console.log('✅ StoryComposer.jsx: Restored preload grid, fixed image tapping with Filesystem.');
