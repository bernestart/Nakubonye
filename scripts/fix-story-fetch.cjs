const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/components/StoryComposer.jsx');
let src = fs.readFileSync(file, 'utf8');

// Add Filesystem import
src = src.replace(
  'import { PhotoLibrary } from "@capgo/capacitor-photo-library"',
  'import { PhotoLibrary } from "@capgo/capacitor-photo-library"\nimport { Filesystem } from "@capacitor/filesystem"'
);

// Replace the whole selectRecentMedia function block
const startStr = '  async function selectRecentMedia(photo) {';
const endStr = '  // --- HANDLE STANDARD FILE PICKER CLICK ---';
const startIndex = src.indexOf(startStr);
const endIndex = src.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.error("❌ Anchor not found. Aborting.");
  process.exit(1);
}

const newFunc = `  async function selectRecentMedia(photo) {
    try {
      setBusy(true)
      setError("")
      
      const fileInfo = await PhotoLibrary.getPhotoUrl({ id: photo.id })
      
      // Read natively instead of fetch(webPath)
      const fileData = await Filesystem.readFile({ path: fileInfo.path })
      const binary = atob(fileData.data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      
      const mime = fileInfo.mimeType || photo.mimeType || "image/jpeg"
      const filename = photo.fileName || \`story-\${Date.now()}.jpg\`
      const blob = new Blob([bytes], { type: mime })
      const file = new File([blob], filename, { type: mime })

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

src = src.substring(0, startIndex) + newFunc + src.substring(endIndex);
fs.writeFileSync(file, src);
console.log("✅ StoryComposer native file read applied");
