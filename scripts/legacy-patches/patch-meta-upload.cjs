const fs = require('fs');
const path = 'src/screens/EditProfile.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add the FilePicker import at the top
if (!code.includes('FilePicker')) {
  code = code.replace(
    /import \{ Camera as NativeCamera[\s\S]*?from '@capacitor\/camera';/,
    `import { Camera as NativeCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { FilePicker } from '@capawesome/capacitor-file-picker';`
  );
}

// 2. Replace the HTML onClick with the Native Picker function
// We target the button and replace its onClick
code = code.replace(
  /onClick=\{\(\) => coverInputRef\.current\?\.click\(\)\}/,
  `onClick={async () => {
    try {
      const result = await FilePicker.pickImages({ limit: 1, readData: true });
      if (result.files && result.files.length > 0) {
        const file = result.files[0];
        // Convert base64 to a File object so your existing uploadMedia works
        const res = await fetch(\`data:\${file.mimeType};base64,\${file.data}\`);
        const blob = await res.blob();
        const newFile = new File([blob], file.name || 'cover.jpg', { type: file.mimeType });
        setCoverFile(newFile);
        setCoverPreview(URL.createObjectURL(newFile));
      }
    } catch (err) {
      console.warn('Picker cancelled or failed', err);
    }
  }}`
);

// 3. Remove the hidden <input type="file"> to clean up the UI
code = code.replace(
  /<input\s+ref=\{coverInputRef\}\s+type="file"[\s\S]*?\/>/,
  '{/* Native file picker now used */}'
);

fs.writeFileSync(path, code);
console.log('✅ EditProfile.jsx: Replaced HTML file input with Native FilePicker');
