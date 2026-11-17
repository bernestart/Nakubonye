const fs = require('fs');
const file = 'src/components/PostComposer.jsx';
let code = fs.readFileSync(file, 'utf8');

// We match the EXACT code you just showed me
const oldBlock = `const { error: upErr } = await supabase.storage
          .from("community-media")
          .upload(path, f, { upsert: false, contentType: f.type })
        if (upErr) throw new Error(upErr.message)
        uploadedPaths.push(path)`;

const newBlock = `// META-SCALE: Upload directly to Telegram via Cloudflare
        const formData = new FormData();
        formData.append("file", f);
        const uploadRes = await fetch("https://nakubonye.bernestart.workers.dev/api/upload", {
          method: "POST",
          body: formData
        });
        const uploadJson = await uploadRes.json();
        if (!uploadJson.success) throw new Error(uploadJson.error || "Upload failed");
        uploadedPaths.push(uploadJson.file_id); // Save the Telegram file_id`;

if (code.includes(oldBlock)) {
  code = code.replace(oldBlock, newBlock);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: PostComposer now uploads directly to Telegram!");
} else {
  console.log("❌ ERROR: Still couldn't find the block.");
}
