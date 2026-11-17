const fs = require('fs');
const file = 'src/components/CommunityChat.jsx';
let code = fs.readFileSync(file, 'utf8');

// ==========================================
// PATCH 1: TEXT & POLL SEND
// ==========================================
const oldTextSend = `const { data: inserted, error: err } = await supabase
        .from("community_messages")
        .insert(payload)
        .select("id, sender_id, content, media_url, media_type, media_name, reply_to_id, deleted_at, created_at, highlighted_until, metadata, view_once, viewed_by")
        .single()

      if (!err && inserted) {
        setMessages((cur) => cur.some((x) => x.id === inserted.id) ? cur : [...cur, inserted])
      }`;

const newTextSend = `// META-SCALE: Save to Neon via Cloudflare
      try {
        const res = await fetch("https://nakubonye.bernestart.workers.dev/api/community/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            communityId: payload.community_id,
            senderId: payload.sender_id,
            content: payload.content,
            mediaUrl: payload.media_url,
            mediaType: payload.media_type,
            mediaName: payload.media_name
          })
        });
        const json = await res.json();
        if (json.success && json.data) {
          setMessages((cur) => cur.some((x) => x.id === json.data.id) ? cur : [...cur, json.data]);
        } else {
          setError(json.error || "Failed to send text");
        }
      } catch (err) {
        setError(err.message);
      }`;

if (code.includes(oldTextSend)) {
  code = code.replace(oldTextSend, newTextSend);
  console.log("✅ SUCCESS: Text & Poll sending patched to Cloudflare!");
} else {
  console.log("⚠️ WARNING: Could not find the exact text send block.");
}

// ==========================================
// PATCH 2: VOICE NOTE SEND
// ==========================================
const oldVoiceSend = `const { error: err } = await supabase.from("community_messages").insert(voicePayload)
      setSending(false)
      if (err) { setError(err.message); return }
      load()`;

const newVoiceSend = `// META-SCALE: Save Voice Note to Neon via Cloudflare
      try {
        const res = await fetch("https://nakubonye.bernestart.workers.dev/api/community/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            communityId: voicePayload.community_id,
            senderId: voicePayload.sender_id,
            content: voicePayload.content,
            mediaUrl: voicePayload.media_url,
            mediaType: voicePayload.media_type,
            mediaName: voicePayload.media_name,
            voiceDuration: result.seconds
          })
        });
        const json = await res.json();
        if (json.success && json.data) {
          setMessages((cur) => cur.some((x) => x.id === json.data.id) ? cur : [...cur, json.data]);
        } else {
          setError(json.error || "Failed to send voice note");
        }
      } catch (err) {
        setError(err.message);
      }
      setSending(false)`;

if (code.includes(oldVoiceSend)) {
  code = code.replace(oldVoiceSend, newVoiceSend);
  console.log("✅ SUCCESS: Voice Note sending patched to Cloudflare!");
} else {
  console.log("⚠️ WARNING: Could not find the exact voice send block.");
}

fs.writeFileSync(file, code);
