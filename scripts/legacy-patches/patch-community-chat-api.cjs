const fs = require('fs');
const file = 'src/components/CommunityChat.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Ensure imports
if (!code.includes('uploadMedia')) {
  code = "import { uploadMedia } from '../lib/api';\n" + code;
}

// ==========================================
// PATCH 1: READING MESSAGES (FETCH)
// ==========================================
const oldFetch = `    const { data: rows, error: err } = await supabase
      .from('community_messages')
      .select('id, sender_id, content, media_url, media_type, media_name, reply_to_id, deleted_at, created_at, highlighted_until, metadata, expires_at, view_once, viewed_by')
      .eq('community_id', communityId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (err) { setError(err.message); setLoading(false); return }

    const list = rows || []`;

const newFetch = `    // META-SCALE: Fetch from Cloudflare API
    let rows = [];
    try {
      const res = await fetch(\`https://nakubonye.bernestart.workers.dev/api/community/messages?communityId=\${communityId}\`);
      const json = await res.json();
      if (json.success) rows = json.data;
    } catch (err) {
      console.error("Failed to load messages", err);
    }

    const list = rows || [];`;

if (code.includes(oldFetch)) {
  code = code.replace(oldFetch, newFetch);
  console.log("✅ SUCCESS: Chat messages are now fetching from Cloudflare API!");
}

// ==========================================
// PATCH 2: SENDING DOCUMENT (UPLOAD + INSERT)
// ==========================================
const oldSendDoc = `    const path = \`community/\${communityId}/\${crypto.randomUUID()}.\${file.name.split('.').pop()}\`
    const { error: upErr } = await supabase.storage.from('chat-media').upload(path, file, { contentType: file.type })
    if (upErr) { setError(upErr.message); setSending(false); return }
    const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path)
    const payload = { community_id: communityId, sender_id: myId, content: '', media_url: pub?.publicUrl, media_type: file.type, media_name: file.name }
    if (disappearingTimer) payload.expires_at = new Date(Date.now() + disappearingTimer * 1000).toISOString()
    if (replyingTo?.id) payload.reply_to_id = replyingTo.id
    const { data: inserted, error: sendErr } = await supabase.from('community_messages').insert(payload).select().single()
    if (sendErr) setError(sendErr.message); else if (inserted) setMessages(cur => [...cur, inserted])`;

const newSendDoc = `    // META-SCALE: Upload to Telegram and save to Neon
    let fileId = "";
    try {
      fileId = await uploadMedia(file);
    } catch (upErr) {
      setError(upErr.message); setSending(false); return;
    }
    
    const payload = { 
      communityId, 
      senderId: myId, 
      content: '', 
      mediaUrl: fileId, 
      mediaType: file.type, 
      mediaName: file.name 
    };
    
    try {
      const res = await fetch("https://nakubonye.bernestart.workers.dev/api/community/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success && json.data) {
        setMessages(cur => [...cur, json.data]);
      } else {
        setError(json.error || "Failed to send");
      }
    } catch (err) {
      setError(err.message);
    }`;

if (code.includes(oldSendDoc)) {
  code = code.replace(oldSendDoc, newSendDoc);
  console.log("✅ SUCCESS: Chat document sending is now using Telegram and Cloudflare API!");
} else {
  console.log("⚠️ WARNING: Could not find the exact document sending block.");
}

fs.writeFileSync(file, code);
