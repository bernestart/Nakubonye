const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
const FILE = 'src/components/StoryComposer.jsx';
const src0 = fs.readFileSync(path.join(ROOT, FILE), 'utf8');

function mustReplace(src, oldStr, newStr, label) {
  const c = src.split(oldStr).length - 1;
  if (c === 0) throw new Error(`[${label}] anchor not found`);
  if (c > 1)   throw new Error(`[${label}] anchor not unique (${c})`);
  return src.replace(oldStr, newStr);
}

let src = src0;

// Fix 1 — permission call has no args
src = mustReplace(src,
  'PhotoLibrary.requestAuthorization({ read: true })',
  'PhotoLibrary.requestAuthorization()',
  'fix1-permission-args');

// Fix 2 — response shape is { state: 'authorized'|'limited'|... }
src = mustReplace(src,
  "perm.photos === 'granted' || perm.photos === 'limited'",
  "perm.state === 'authorized' || perm.state === 'limited'",
  'fix2-permission-check');

// Fix 3 — method is getLibrary, not getPhotos
src = mustReplace(src,
  'PhotoLibrary.getPhotos({ limit: 18 })',
  'PhotoLibrary.getLibrary({ limit: 18, includeImages: true, includeVideos: true })',
  'fix3-get-library');

// Fix 4 — response field is assets, not photos
src = mustReplace(src,
  'setRecentMedia(result.photos || [])',
  'setRecentMedia(result.assets || [])',
  'fix4-assets-field');

// Fix 5 — asset has no .uri; fetch full-res via getPhotoUrl on tap
src = mustReplace(src,
  'const res = await fetch(photo.uri)',
  'const fileInfo = await PhotoLibrary.getPhotoUrl({ id: photo.id })\n      const res = await fetch(fileInfo.webPath)',
  'fix5-get-photo-url');

// Fix 6 — field is fileName, not filename
src = mustReplace(src,
  'const filename = photo.filename || `story-${Date.now()}.jpg`',
  'const filename = photo.fileName || `story-${Date.now()}.jpg`',
  'fix6-file-name');

// Fix 7 — mime from getPhotoUrl response, not blob.type
src = mustReplace(src,
  'const file = new File([blob], filename, { type: blob.type })',
  'const mime = fileInfo.mimeType || photo.mimeType || "image/jpeg"\n      const file = new File([blob], filename, { type: mime })',
  'fix7-mime');

// Fix 8 — use asset.type ('image'|'video'), not mimeType prefix
src = mustReplace(src,
  'if (photo.mimeType?.startsWith("video/") || filename.endsWith(".mp4")) {',
  'if (photo.type === "video" || mime.startsWith("video/")) {',
  'fix8-video-detect');

// Fix 9 — img src uses thumbnail.webPath / file.webPath
src = mustReplace(src,
  '<img src={photo.uri} alt=""',
  '<img src={photo.thumbnail?.webPath || photo.file?.webPath || ""} alt=""',
  'fix9-img-src');

// Fix 10 — camera returns Base64 (no fetch on webPath)
src = mustReplace(src,
  'resultType: CameraResultType.Uri, source: CameraSource.Camera',
  'resultType: CameraResultType.Base64, source: CameraSource.Camera',
  'fix10-camera-base64');

// Fix 11 — decode base64 into blob (4 lines → 9 lines)
src = mustReplace(src,
  'const res = await fetch(shot.webPath)\n      const blob = await res.blob()\n      const ext = (shot.format || "jpeg").toLowerCase()\n      const f = new File([blob], "story-" + Date.now() + "." + ext, { type: blob.type })',
  'if (!shot.base64String) return\n      const ext = (shot.format || "jpeg").toLowerCase()\n      const mime = "image/" + (ext === "jpg" ? "jpeg" : ext)\n      const binary = atob(shot.base64String)\n      const bytes = new Uint8Array(binary.length)\n      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)\n      const blob = new Blob([bytes], { type: mime })\n      const f = new File([blob], "story-" + Date.now() + "." + ext, { type: mime })',
  'fix11-base64-blob');

// ---- verify all fixes landed ----
const checks = [
  ['getPhotos', src.includes('PhotoLibrary.getPhotos') ? 'remains' : null],
  ['requestAuthorization({ read', src.includes('requestAuthorization({ read') ? 'remains' : null],
  ['photo.uri', src.includes('photo.uri') ? 'remains' : null],
  ['photo.filename', src.includes('photo.filename ') ? 'remains' : null],
  ['getLibrary', !src.includes('getLibrary(') ? 'missing' : null],
  ['getPhotoUrl', !src.includes('getPhotoUrl(') ? 'missing' : null],
  ['requestAuthorization()', !src.includes('requestAuthorization()') ? 'missing' : null],
  ['permission state check', !src.includes("perm.state === 'authorized'") ? 'missing' : null],
];
const failures = checks.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
if (failures.length) throw new Error('VERIFY FAILURES:\n' + failures.join('\n'));

fs.writeFileSync(path.join(ROOT, FILE), src);
console.log('OK — StoryComposer.jsx: 11 fixes applied');
console.log('Bytes before/after:', src0.length, '->', src.length);
console.log('Next: npm run build');
