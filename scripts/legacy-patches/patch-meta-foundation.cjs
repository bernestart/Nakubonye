const fs = require('fs');

// ==========================================
// 1. REBRAND WELCOME.JSX (Kill the dating vibe)
// ==========================================
const welcomePath = 'src/screens/Welcome.jsx';
if (fs.existsSync(welcomePath)) {
  let w = fs.readFileSync(welcomePath, 'utf8');
  w = w.replace(
    /Somebody is\s*<br \/>\s*looking for you\./,
    `Connect with your world.\n          <br />\n          Share moments. Build communities.`
  );
  w = w.replace(
    /\{\/\* Three hearts \*\/\}[\s\S]*?<\/div>/,
    `{/* Global Connections */}
        <div className="flex items-center justify-center gap-4 mb-12 opacity-80">
          <span className="text-[28px] leading-none">🌍</span>
          <span className="text-[38px] leading-none" style={{ filter: 'drop-shadow(0 8px 24px rgba(168,85,247,0.45))' }}>
            🤝
          </span>
          <span className="text-[28px] leading-none">✨</span>
        </div>`
  );
  fs.writeFileSync(welcomePath, w);
  console.log('✅ Welcome.jsx: Rebranded');
}

// ==========================================
// 2. UPDATE SIGNUP.JSX (Add DOB and Gender)
// ==========================================
const signupPath = 'src/screens/SignUp.jsx';
if (fs.existsSync(signupPath)) {
  let s = fs.readFileSync(signupPath, 'utf8');
  
  // Add state
  if (!s.includes('dateOfBirth')) {
    s = s.replace(
      "const [password, setPassword] = useState('')",
      "const [password, setPassword] = useState('')\n  const [dateOfBirth, setDateOfBirth] = useState('')\n  const [gender, setGender] = useState('')"
    );
  }
  
  // Add UI fields before the submit button
  if (!s.includes('Date of birth')) {
    s = s.replace(
      /<button\s+type="submit"/,
      `<div>
            <label className="block text-white/70 text-[12.5px] font-semibold mb-2">Date of Birth</label>
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required disabled={busy} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
          </div>
          <div>
            <label className="block text-white/70 text-[12.5px] font-semibold mb-2">Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} required disabled={busy} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non_binary">Non-binary</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          <button type="submit"`
    );
  }

  // Update Supabase insert
  s = s.replace(
    /\.update\(\{ display_name: dn, username: un \}\)/,
    `.update({ display_name: dn, username: un, date_of_birth: dateOfBirth || null, gender: gender || null })`
  );
  fs.writeFileSync(signupPath, s);
  console.log('✅ SignUp.jsx: Added DOB & Gender');
}

// ==========================================
// 3. CREATE IMAGE CROPPER COMPONENT
// ==========================================
const cropperPath = 'src/components/ImageCropper.jsx';
const cropperCode = `import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check } from 'lucide-react';

export default function ImageCropper({ image, aspect, onCropDone, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleDone = async () => {
    try {
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.src = image;
      await new Promise((resolve) => (img.onload = resolve));
      
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      const ctx = canvas.getContext('2d');
      
      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      canvas.toBlob((blob) => {
        const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' });
        onCropDone(file, URL.createObjectURL(blob));
      }, 'image/jpeg', 0.9);
    } catch (e) {
      console.error(e);
      alert('Failed to crop image');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 bg-black/50 z-10">
        <button onClick={onCancel} className="text-white p-2"><X size={24} /></button>
        <span className="text-white font-bold text-[16px]">Crop Image</span>
        <button onClick={handleDone} className="text-purple-400 p-2"><Check size={24} /></button>
      </div>
      <div className="relative flex-1">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
        />
      </div>
    </div>
  );
}
`;
if (!fs.existsSync(cropperPath)) {
  fs.writeFileSync(cropperPath, cropperCode);
  console.log('✅ Created ImageCropper.jsx');
}

// ==========================================
// 4. UPDATE EDITPROFILE.JSX (Wire up FilePicker + Cropper)
// ==========================================
const editPath = 'src/screens/EditProfile.jsx';
if (fs.existsSync(editPath)) {
  let e = fs.readFileSync(editPath, 'utf8');

  // Imports
  if (!e.includes('ImageCropper')) {
    e = e.replace("import { Camera as NativeCamera", "import ImageCropper from '../components/ImageCropper';\nimport { FilePicker } from '@capawesome/capacitor-file-picker';\nimport { Camera as NativeCamera");
  }

  // Add Cropper state
  if (!e.includes('cropImageSrc')) {
    e = e.replace(
      "const [coverPreview, setCoverPreview] = useState('')",
      "const [coverPreview, setCoverPreview] = useState('')\n  const [cropImageSrc, setCropImageSrc] = useState(null)\n  const [cropType, setCropType] = useState(null)"
    );
  }

  // Replace the HTML file input with Native FilePicker + Cropper
  const oldButtonRegex = /onClick=\{\(\) => coverInputRef\.current\?\.click\(\)\}/;
  const newButtonCode = `onClick={async () => {
            try {
              const result = await FilePicker.pickImages({ limit: 1, readData: true });
              if (result.files && result.files.length > 0) {
                const file = result.files[0];
                const res = await fetch(\`data:\${file.mimeType};base64,\${file.data}\`);
                const blob = await res.blob();
                const newFile = new File([blob], file.name || 'image.jpg', { type: file.mimeType });
                setCropType('cover');
                setCropImageSrc(URL.createObjectURL(newFile));
              }
            } catch (err) { console.warn(err); }
          }}`;
  e = e.replace(oldButtonRegex, newButtonCode);

  // Add Cropper render at the bottom of the return statement
  if (!e.includes('<ImageCropper')) {
    e = e.replace(
      /<\/div>\s*\)\s*\}/,
      `  {cropImageSrc && (
        <ImageCropper
          image={cropImageSrc}
          aspect={cropType === 'cover' ? 16 / 9 : 1}
          onCancel={() => { setCropImageSrc(null); setCropType(null); }}
          onCropDone={(file, previewUrl) => {
            if (cropType === 'cover') {
              setCoverFile(file);
              setCoverPreview(previewUrl);
            }
            setCropImageSrc(null);
            setCropType(null);
          }}
        />
      )}
    </div>
  )
}`
    );
  }

  fs.writeFileSync(editPath, e);
  console.log('✅ EditProfile.jsx: Wired Native FilePicker & Cropper');
}
