const fs = require('fs');
const file = 'src/components/PostComposer.jsx';
let code = fs.readFileSync(file, 'utf8');

const oldUpload = `        const { data, error: upErr } = await supabase.storage
          .from("community-media")
          .upload(path, f, { upsert: false, contentType: f.type })
        if (upErr) throw new Error(upErr.message)
        uploadedPaths.push(path)`;

const newUpload = `        // META-SCALE: Upload directly to Telegram via Cloudflare
        const formData = new FormData();
        formData.append("file", f);
        const uploadRes = await fetch("https://nakubonye.bernestart.workers.dev/api/upload", {
          method: "POST",
          body: formData
        });
        const uploadJson = await uploadRes.json();
        if (!uploadJson.success) throw new Error(uploadJson.error || "Upload failed");
        uploadedPaths.push(uploadJson.file_id); // Save the Telegram file_id`;

if (code.includes(oldUpload)) {
  code = code.replace(oldUpload, newUpload);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: PostComposer now uploads to Telegram!");
} else {
  // Regex fallback
  const regex = /const\s*\{\s*data,\s*error:\s*upErr\s*\}\s*=\s*await\s*supabase\.storage[\s\S]*?uploadedPaths\.push\(path\)/;
  if (regex.test(code)) {
    code = code.replace(regex, newUpload);
    fs.writeFileSync(file, code);
    console.log("✅ SUCCESS: PostComposer patched (Regex fallback)!");
  } else {
    console.log("❌ ERROR: Could not find the exact upload block.");
  }
}
