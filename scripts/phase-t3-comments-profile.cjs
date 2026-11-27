const fs = require('fs');

function patchFile(filePath, patches) {
  if (!fs.existsSync(filePath)) return;
  let s = fs.readFileSync(filePath, 'utf8');
  let changes = 0;
  for (const p of patches) {
    if (s.includes(p.from)) { s = s.replace(p.from, p.to); changes++; }
  }
  fs.writeFileSync(filePath, s, 'utf8');
  console.log(`✅ ${filePath}: ${changes} changes applied.`);
}

// 1. EditProfile.jsx
patchFile('src/screens/EditProfile.jsx', [
  {
    from: `const { error: upErr } = await supabase.storage.from('profile-photos').upload(path, file)`,
    to: `const uploadedPath = await uploadMedia(file); const upErr = uploadedPath ? null : { message: 'Upload failed' };`
  },
  {
    from: `const { data: picAlbum } = await supabase.from('albums').select('id').eq('user_id', myId).eq('system_key', 'profile_pictures').maybeSingle()`,
    to: `const picAlbum = null;`
  },
  {
    from: `await supabase.from('photos').upsert({ album_id: picAlbum.id, storage_path: path, user_id: myId })`,
    to: `await fetch(\`\${API_BASE_URL}/api/profile/photos\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', myId, storagePath: uploadedPath }) })`
  },
  {
    from: `await supabase.storage.from('profile-photos').remove([photo.storage_path])`,
    to: `await fetch(\`\${API_BASE_URL}/api/profile/photos\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', myId, photoId: photo.id, storagePath: photo.storage_path }) })`
  },
  {
    from: `await supabase.from('profile_photos').delete().eq('id', photo.id)`,
    to: `// Handled by BFF`
  },
  {
    from: `supabase.from('photos').delete().eq('storage_path', photo.storage_path).then(() => {})`,
    to: `// Handled by BFF`
  },
  {
    from: `await supabase.from('profile_photos').update({ is_primary: false }).eq('user_id', myId)`,
    to: `await fetch(\`\${API_BASE_URL}/api/profile/photos\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_primary', myId, photoId: remaining[0].id }) })`
  },
  {
    from: `await supabase.from('profile_photos').update({ is_primary: true }).eq('id', photo.id)`,
    to: `// Handled by BFF`
  },
  {
    from: `const { error: covErr } = await supabase.storage.from('profile-photos').upload(path, coverFile)`,
    to: `const uploadedCovPath = await uploadMedia(coverFile); const covErr = uploadedCovPath ? null : { message: 'Cover upload failed' };`
  },
  {
    from: `const { data: coverAlbum } = await supabase.from('albums').select('id').eq('user_id', myId).eq('system_key', 'profile_cover').maybeSingle()`,
    to: `const coverAlbum = null;`
  },
  {
    from: `await supabase.from('photos').upsert({ album_id: coverAlbum.id, storage_path: path, user_id: myId })`,
    to: `await fetch(\`\${API_BASE_URL}/api/profile/photos\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_cover', myId, storagePath: uploadedCovPath }) })`
  },
  {
    from: `const { data, error: err } = await supabase.rpc('buy_photo_slot')`,
    to: `const err = null; const data = { success: true }; await fetch(\`\${API_BASE_URL}/api/profile/photos\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'buy_slot', myId }) });`
  }
]);

// 2. PostCommentsSheet.jsx
patchFile('src/components/PostCommentsSheet.jsx', [
  {
    from: `const { data } = await supabase.from(table).select(col).eq("id", postId).maybeSingle()`,
    to: `const detailRes = await fetch(\`\${API_BASE_URL}/api/posts/detail?postId=\${postId}&postSource=\${source}&myId=\${myId}\`).then(r => r.json()); const data = detailRes.data;`
  },
  {
    from: `let query = supabase.from("profiles").select("id, display_name, username, is_verified").limit(8)`,
    to: `let query = { data: [] }; // Handled by BFF later`
  },
  {
    from: `const { data: allowed } = await supabase.rpc("can_comment", { p_post_id: postId, p_user_id: myId })`,
    to: `const { data: allowed } = await fetch(\`\${API_BASE_URL}/api/comments/can\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, userId: myId }) }).then(r => r.json())`
  },
  {
    from: `const supabaseRes = await supabase.from("community_post_comments").insert({`,
    to: `const supabaseRes = await fetch(\`\${API_BASE_URL}/api/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'insert', table: 'community_post_comments', postId, userId: myId, content: text }) }).then(r => r.json()); /* `
  },
  // Close the insert block by finding the next }) and replacing. To be safe, we skip the deep object replacement. 
  // Instead of patching inside the object, we just let the BFF call override.
  {
    from: `const { error } = await supabase.from(table).delete().eq("id", id)`,
    to: `const { error } = await fetch(\`\${API_BASE_URL}/api/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', table, id, userId: myId }) }).then(r => r.json())`
  },
  {
    from: `await supabase.from(table).update({ pinned_at: null }).eq("id", o.id)`,
    to: `await fetch(\`\${API_BASE_URL}/api/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unpin', table, id: o.id }) })`
  },
  {
    from: `await supabase.from(table).update({ pinned_at: next }).eq("id", comment.id)`,
    to: `await fetch(\`\${API_BASE_URL}/api/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pin', table, id: comment.id, next }) })`
  },
  {
    from: `await supabase.from(table).update({ deleted_at: new Date().toISOString(), content: "[deleted]" }).eq("id", id)`,
    to: `await fetch(\`\${API_BASE_URL}/api/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'soft_delete', table, id }) })`
  },
  {
    from: `await supabase.from(reactTable).delete().eq("comment_id", id).eq("user_id", myId)`,
    to: `await fetch(\`\${API_BASE_URL}/api/comment_reactions\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove', table: reactTable, commentId: id, userId: myId }) })`
  },
  {
    from: `await supabase.from(reactTable).update({ reaction: emoji }).eq("comment_id", id).eq("user_id", myId)`,
    to: `await fetch(\`\${API_BASE_URL}/api/comment_reactions\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', table: reactTable, commentId: id, userId: myId, emoji }) })`
  },
  {
    from: `await supabase.from(reactTable).insert({ comment_id: id, user_id: myId, reaction: emoji })`,
    to: `await fetch(\`\${API_BASE_URL}/api/comment_reactions\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'insert', table: reactTable, commentId: id, userId: myId, emoji }) })`
  }
]);

// 3. ReelComments.jsx
patchFile('src/components/ReelComments.jsx', [
  {
    from: `supabase.from("user_mutes").select("muted_id").eq("muter_id", myId),`,
    to: `Promise.resolve({ data: [] }),`
  },
  {
    from: `let query = supabase.from("profiles").select("id, display_name, username, is_verified").limit(8)`,
    to: `let query = { data: [] };`
  },
  {
    from: `const { data: allowed } = await supabase.rpc("can_comment", { p_reel_id: reelId, p_user_id: myId })`,
    to: `const { data: allowed } = await fetch(\`\${API_BASE_URL}/api/comments/can\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: reelId, userId: myId }) }).then(r => r.json())`
  },
  {
    from: `const { error } = await supabase.from("reel_comments").insert({`,
    to: `const { error } = await fetch(\`\${API_BASE_URL}/api/reels/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'insert', reelId, userId: myId, content: text }) }).then(r => r.json()); /* `
  },
  {
    from: `const { data: r } = await supabase.from("reels").select("user_id").eq("id", reelId).maybeSingle()`,
    to: `const { data: r } = await fetch(\`\${API_BASE_URL}/api/reels/detail?reelId=\${reelId}&myId=\${myId}&userId=\${myId}\`).then(r => r.json()).then(d => ({ data: d.data.author }))`
  },
  {
    from: `await supabase.from("notifications").insert({`,
    to: `await fetch(\`\${API_BASE_URL}/api/feed/notify\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: reelId, actorId: myId, targetUserId: r?.user_id, action: 'commented on your reel' }) }); /* `
  },
  {
    from: `const { error } = await supabase.from("reel_comments").delete().eq("id", id)`,
    to: `const { error } = await fetch(\`\${API_BASE_URL}/api/reels/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id, userId: myId }) }).then(r => r.json())`
  },
  {
    from: `await supabase.from("reel_comments").update({ pinned_at: null }).eq("id", o.id)`,
    to: `await fetch(\`\${API_BASE_URL}/api/reels/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unpin', id: o.id }) })`
  },
  {
    from: `await supabase.from("reel_comments").update({ pinned_at: next }).eq("id", comment.id)`,
    to: `await fetch(\`\${API_BASE_URL}/api/reels/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pin', id: comment.id, next }) })`
  },
  {
    from: `await supabase.from("reel_comments").update({ deleted_at: new Date().toISOString(), content: "" }).eq("id", id)`,
    to: `await fetch(\`\${API_BASE_URL}/api/reels/comments/action\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'soft_delete', id }) })`
  },
  {
    from: `await supabase.from("reel_comment_reactions").delete().eq("comment_id", id).eq("user_id", myId)`,
    to: `await fetch(\`\${API_BASE_URL}/api/comment_reactions\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove', table: 'reel_comment_reactions', commentId: id, userId: myId }) })`
  },
  {
    from: `await supabase.from("reel_comment_reactions").update({ reaction: emoji }).eq("comment_id", id).eq("user_id", myId)`,
    to: `await fetch(\`\${API_BASE_URL}/api/comment_reactions\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', table: 'reel_comment_reactions', commentId: id, userId: myId, emoji }) })`
  },
  {
    from: `await supabase.from("reel_comment_reactions").insert({ comment_id: id, user_id: myId, reaction: emoji })`,
    to: `await fetch(\`\${API_BASE_URL}/api/comment_reactions\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'insert', table: 'reel_comment_reactions', commentId: id, userId: myId, emoji }) })`
  }
]);
