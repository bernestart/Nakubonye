const fs = require('fs');
const path = require('path');
const root = process.cwd();

// ==========================================
// FIX 1: CreatorMode.jsx (Sync with DB & Auth)
// ==========================================
const cmPath = path.join(root, 'src/screens/CreatorMode.jsx');
let cm = fs.readFileSync(cmPath, 'utf8');

// Replace the local state with direct authProfile reading
if (cm.includes("const [accountType, setAccountType] = useState('personal')")) {
  cm = cm.replace(
    "const { session, refreshProfile } = useAuth()",
    "const { session, profile: authProfile, refreshProfile } = useAuth()\n  const accountType = authProfile?.account_type || 'personal';"
  );
  cm = cm.replace("const [accountType, setAccountType] = useState('personal')\n", "");
  cm = cm.replace("const [loading, setLoading] = useState(true)\n", "");
}

// Clean up old turnOff logic to just refresh profile
cm = cm.replace(
  /setAccountType\('personal'\)\n      setShowConfirmOff\(false\)/g,
  "setShowConfirmOff(false)\n      await refreshProfile()"
);

fs.writeFileSync(cmPath, cm);
console.log('✅ CreatorMode.jsx: Synced accountType with Auth Context. Turn On/Off will now update instantly.');


// ==========================================
// FIX 2: StoryComposer.jsx (Bulletproof Native Picker)
// ==========================================
const scPath = path.join(root, 'src/components/StoryComposer.jsx');
let sc = fs.readFileSync(scPath, 'utf8');

// A. Completely replace selectRecentMedia to use Native Camera (No fetch, no Filesystem)
sc = sc.replace(
  /async function selectRecentMedia\(photo\) \{[\s\S]*?finally \{\n      setBusy\(false\)\n    \}\n  \}/,
  `async function selectRecentMedia() {
    try {
      setBusy(true)
      setError("")
      
      const shot = await NativeCamera.getPhoto({
        quality: 90,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos, // Opens Native Android Gallery
      })

      if (!shot.base64String) return

      const ext = (shot.format || "jpeg").toLowerCase()
      const mime = "image/" + (ext === "jpg" ? "jpeg" : ext)
      const binary = atob(shot.base64String)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      
      const blob = new Blob([bytes], { type: mime })
      const file = new File([blob], \`story-\${Date.now()}.\${ext}\`, { type: mime })

      setFile(file)
      setPreview(URL.createObjectURL(blob))
      setEditedBlob(null)
      
      if (mime.startsWith("video/")) {
        setMode("video")
      } else {
        setEditorOpen(true)
      }
    } catch (e) {
      if (e.message && !e.message.toLowerCase().includes('cancel')) {
        console.warn("Native picker failed:", e)
        setError("Could not load media: " + (e.message || "Unknown error"))
      }
    } finally {
      setBusy(false)
    }
  }`
);

// B. Fix openCamera to not use the fake event trigger
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
      
      setFile(f)
      setPreview(URL.createObjectURL(blob))
      setEditedBlob(null)
      setEditorOpen(true)
    } catch (e) { 
      if (e && e.message && !/cancel/i.test(e.message)) console.warn(e) 
    }
  }`
);

// C. RIP OUT the infinite spinner grid entirely. Replace with a clean button.
const uiStart = sc.indexOf('        <div className="flex-1 overflow-y-auto px-1 pb-4">');
const uiEnd = sc.indexOf('        <input ref={singleFileRef}');
if (uiStart !== -1 && uiEnd !== -1) {
  const newUI = `        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <ImageIcon size={32} className="text-white/40" />
          </div>
          <h3 className="text-white font-bold text-[16px] mb-2">Select from Gallery</h3>
          <p className="text-white/50 text-[13px] text-center mb-6">Choose a photo or video from your device to add to your story.</p>
          <button onClick={selectRecentMedia} disabled={busy} className="w-full max-w-[280px] h-12 rounded-full bg-white text-black font-bold text-[15px] flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
            {busy ? "Opening..." : "Open Gallery"}
          </button>
        </div>

`;
  sc = sc.substring(0, uiStart) + newUI + sc.substring(uiEnd);
}

fs.writeFileSync(scPath, sc);
console.log('✅ StoryComposer.jsx: Removed infinite spinner grid. Using Native Camera for Gallery.');
