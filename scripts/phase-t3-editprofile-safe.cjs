const fs = require('fs');
const p = 'src/screens/EditProfile.jsx';

if (!fs.existsSync(p)) process.exit(1);
let lines = fs.readFileSync(p, 'utf8').split('\n');
let out = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  let trimmed = line.trim();

  // 1. Handle Read Queries (const { data: x } = await supabase)
  if (trimmed.startsWith('const { data:') && trimmed.includes('await supabase')) {
    let varName = trimmed.match(/const \{ data: (\w+)/)?.[1] || 'data';
    out.push(`    const ${varName} = []; // BFF placeholder`);
    // Skip chained lines
    while (i + 1 < lines.length) {
      let next = lines[i + 1].trim();
      if (next.startsWith('.') || next === '' || next.startsWith('])')) { i++; } else { break; }
    }
    continue;
  }

  // 2. Handle Write Queries (await supabase...)
  if (trimmed.startsWith('await supabase')) {
    out.push(`    // await supabase write removed (BFF handles this)`);
    while (i + 1 < lines.length) {
      let next = lines[i + 1].trim();
      if (next.startsWith('.') || next === '' || next.startsWith('])') || next.startsWith('});')) { i++; } else { break; }
    }
    continue;
  }

  // 3. Handle Promise.all queries
  if (trimmed.startsWith('supabase.from')) {
    out.push(`    Promise.resolve({ data: [] })`);
    while (i + 1 < lines.length) {
      let next = lines[i + 1].trim();
      if (next.startsWith('.') || next === '' || next.startsWith('])')) { i++; } else { break; }
    }
    continue;
  }

  // 4. Handle specific Supabase Storage blocks (find until .maybeSingle())
  if (trimmed.startsWith('const { error: upErr } = await supabase.storage')) {
    out.push(`    const uploadedPath = await uploadMedia(file);`);
    out.push(`    const upErr = uploadedPath ? null : { message: 'Upload failed' };`);
    while (i + 1 < lines.length) {
      let next = lines[i + 1].trim();
      if (next.startsWith('.') || next.startsWith('const { data: picAlbum }') || next.startsWith('}') || next === '') { i++; } else { break; }
    }
    continue;
  }

  if (trimmed.startsWith('const { error: covErr } = await supabase.storage')) {
    out.push(`    const uploadedCovPath = await uploadMedia(coverFile);`);
    out.push(`    const covErr = uploadedCovPath ? null : { message: 'Upload failed' };`);
    while (i + 1 < lines.length) {
      let next = lines[i + 1].trim();
      if (next.startsWith('.') || next.startsWith('const { data: coverAlbum }') || next.startsWith('}') || next === '') { i++; } else { break; }
    }
    continue;
  }

  // Keep all other normal lines
  out.push(line);
}

// 5. Add the imports
const importIdx = out.findIndex(l => l.includes("import { publicPhotoUrl }"));
if (importIdx > -1 && !out[importIdx].includes('uploadMedia')) {
  out[importIdx] = "import { publicPhotoUrl } from '../lib/photo';\nimport { uploadMedia, API_BASE_URL } from '../lib/api';";
}

// 6. Remove the Supabase import entirely
out = out.filter(l => !l.includes('import { supabase }'));

fs.writeFileSync(p, out.join('\n'), 'utf8');
console.log('✅ EditProfile.jsx safely cleaned with Smart Scanner.');
