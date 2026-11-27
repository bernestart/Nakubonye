const fs = require('fs');

function patchFile(filePath, actionMap) {
  if (!fs.existsSync(filePath)) return;
  let lines = fs.readFileSync(filePath, 'utf8').split('\n');
  let out = [];
  let changes = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let matched = false;

    // Check all action patterns
    for (const target of Object.keys(actionMap)) {
      if (line.includes(target)) {
        // Determine if it's a multi-line block (contains `{`)
        if (line.includes('{')) {
          // Skip all lines until we find the closing `})` or `})`
          let j = i + 1;
          while (j < lines.length && !lines[j].trim().startsWith('})') && !lines[j].trim().startsWith('})')) {
            j++;
          }
          // Replace the entire block
          out.push('      ' + actionMap[target]);
          i = j; // Skip to the end of the block
        } else {
          // Single line, just replace
          out.push('      ' + actionMap[target]);
        }
        matched = true;
        changes++;
        break;
      }
    }

    if (!matched) {
      out.push(line);
    }
  }

  fs.writeFileSync(filePath, out.join('\n'), 'utf8');
  console.log(`✅ ${filePath}: ${changes} changes applied.`);
}

// 1. EditProfile
patchFile('src/screens/EditProfile.jsx', {
  "const { error: upErr } = await supabase.storage": `const uploadedPath = await uploadMedia(file); const upErr = uploadedPath ? null : { message: 'Upload failed' };`,
  "const { data: picAlbum } = await supabase.from('albums')": `const picAlbum = null;`,
  "await supabase.from('photos').upsert": `await fetch(\`\${API_BASE_URL}/api/profile/photos\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', myId, storagePath: uploadedPath }) });`,
  "await supabase.storage.from('profile-photos').remove": `await fetch(\`\${API_BASE_URL}/api/profile/photos\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', myId, photoId: photo.id, storagePath: photo.storage_path }) });`,
  "await supabase.from('profile_photos').delete": `// Handled by BFF`,
  "supabase.from('photos').delete": `// Handled by BFF`,
  "await supabase.from('profile_photos').update({ is_primary: false })": `await fetch(\`\${API_BASE_URL}/api/profile/photos\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_primary', myId, photoId: remaining[0].id }) });`,
  "await supabase.from('profile_photos').update({ is_primary: true })": `// Handled by BFF`,
  "const { error: covErr } = await supabase.storage": `const uploadedCovPath = await uploadMedia(coverFile); const covErr = uploadedCovPath ? null : { message: 'Cover upload failed' };`,
  "const { data: coverAlbum } = await supabase.from('albums')": `const coverAlbum = null;`,
  "const { data, error: err } = await supabase.rpc('buy_photo_slot')": `const err = null; const data = { success: true }; await fetch(\`\${API_BASE_URL}/api/profile/photos\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'buy_slot', myId }) });`
});

// 2. PostCommentsSheet
patchFile('src/components/PostCommentsSheet.jsx', {
  "const { data } = await supabase.from(table).select(col)": `const detailRes = await fetch(\`\${API_BASE_URL}/api/posts/detail?postId=\${postId}&postSource=\${source}&myId=\${myId}\`).then(r => r.json()); const data = detailRes.data;`,
  "let query = supabase.from(\"profiles\")": `let query = { data: [] };`,
  "const { data: allowed } = await supabase.rpc(\"can_comment\"": `const { data: allowed } = await fetch(\`\${API_BASE_URL}/api/comments/can\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, userId: myId }) }).then(r => r.json());`,
  "const supabaseRes = await supabase.from(\"community_post_comments\").insert": `const supabaseRes = await fetch(\`\${API_BASE_URL}/api/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'insert', table: 'community_post_comments', postId, userId: myId, content: text }) }).then(r => r.json());`,
  "const { error } = await supabase.from(table).delete()": `const { error } = await fetch(\`\${API_BASE_URL}/api/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', table, id, userId: myId }) }).then(r => r.json());`,
  "await supabase.from(table).update({ pinned_at: null })": `await fetch(\`\${API_BASE_URL}/api/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unpin', table, id: o.id }) });`,
  "await supabase.from(table).update({ pinned_at: next })": `await fetch(\`\${API_BASE_URL}/api/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pin', table, id: comment.id, next }) });`,
  "await supabase.from(table).update({ deleted_at: new Date().toISOString(), content: \"[deleted]\" })": `await fetch(\`\${API_BASE_URL}/api/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'soft_delete', table, id }) });`,
  "await supabase.from(reactTable).delete()": `await fetch(\`\${API_BASE_URL}/api/comment_reactions\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove', table: reactTable, commentId: id, userId: myId }) });`,
  "await supabase.from(reactTable).update": `await fetch(\`\${API_BASE_URL}/api/comment_reactions\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', table: reactTable, commentId: id, userId: myId, emoji }) });`,
  "await supabase.from(reactTable).insert": `await fetch(\`\${API_BASE_URL}/api/comment_reactions\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'insert', table: reactTable, commentId: id, userId: myId, emoji }) });`
});

// 3. ReelComments
patchFile('src/components/ReelComments.jsx', {
  "supabase.from(\"user_mutes\")": `Promise.resolve({ data: [] }),`,
  "let query = supabase.from(\"profiles\")": `let query = { data: [] };`,
  "const { data: allowed } = await supabase.rpc(\"can_comment\"": `const { data: allowed } = await fetch(\`\${API_BASE_URL}/api/comments/can\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: reelId, userId: myId }) }).then(r => r.json());`,
  "const { error } = await supabase.from(\"reel_comments\").insert": `const { error } = await fetch(\`\${API_BASE_URL}/api/reels/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'insert', reelId, userId: myId, content: text }) }).then(r => r.json());`,
  "const { data: r } = await supabase.from(\"reels\")": `const { data: r } = await fetch(\`\${API_BASE_URL}/api/reels/detail?reelId=\${reelId}&myId=\${myId}&userId=\${myId}\`).then(r => r.json()).then(d => ({ data: d.data.author }));`,
  "const { error } = await supabase.from(\"reel_comments\").delete()": `const { error } = await fetch(\`\${API_BASE_URL}/api/reels/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id, userId: myId }) }).then(r => r.json());`,
  "await supabase.from(\"reel_comments\").update({ pinned_at: null })": `await fetch(\`\${API_BASE_URL}/api/reels/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unpin', id: o.id }) });`,
  "await supabase.from(\"reel_comments\").update({ pinned_at: next })": `await fetch(\`\${API_BASE_URL}/api/reels/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pin', id: comment.id, next }) });`,
  "await supabase.from(\"reel_comments\").update({ deleted_at: new Date().toISOString(), content: \"\" })": `await fetch(\`\${API_BASE_URL}/api/reels/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'soft_delete', id }) });`,
  "await supabase.from(\"reel_comment_reactions\").delete()": `await fetch(\`\${API_BASE_URL}/api/comment_reactions\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove', table: 'reel_comment_reactions', commentId: id, userId: myId }) });`,
  "await supabase.from(\"reel_comment_reactions\").update": `await fetch(\`\${API_BASE_URL}/api/comment_reactions\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', table: 'reel_comment_reactions', commentId: id, userId: myId, emoji }) });`,
  "await supabase.from(\"reel_comment_reactions\").insert": `await fetch(\`\${API_BASE_URL}/api/comment_reactions\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'insert', table: 'reel_comment_reactions', commentId: id, userId: myId, emoji }) });`
});
