const fs = require('fs');
const file = 'src/components/CommunityChat.jsx';
let code = fs.readFileSync(file, 'utf8');

// ==========================================
// PATCH 1: POLL SEND (Exact match)
// ==========================================
const oldPollSend = `const { data: inserted, error: err } = await supabase
        .from("community_messages")
        .insert(payload)
        .select("id, sender_id, content, media_url, media_type, media_name, reply_to_id, deleted_at, created_at, highlighted_until, metadata, view_once, viewed_by")
        .single()

      if (!err && inserted) {
        setMessages((cur) => cur.some((x) => x.id === inserted.id) ? cur : [...cur, inserted])
      }`;

const newPollSend = `// META-SCALE: Save Poll to Neon via Cloudflare
      try {
        const res = await fetch("https://nakubonye.bernestart.workers.dev/api/community/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            communityId: payload.community_id,
            senderId: payload.sender_id,
            content: payload.content,
            metadata: payload.metadata
          })
        });
        const json = await res.json();
        if (json.success && json.data) {
          setMessages((cur) => cur.some((x) => x.id === json.data.id) ? cur : [...cur, json.data]);
        } else {
          setError(json.error || "Failed to send poll");
        }
      } catch (err) {
        setError(err.message);
      }`;

if (code.includes(oldPollSend)) {
  code = code.replace(oldPollSend, newPollSend);
  console.log("✅ SUCCESS: Poll sending patched to Cloudflare!");
} else {
  console.log("⚠️ Warning: Poll block not found exactly. Check spacing.");
}

// ==========================================
// PATCH 2: VOICE NOTE UPLOAD & SEND (Exact match)
// ==========================================
// We replace the Supabase upload AND the Supabase insert in one go.
const oldVoiceBlock = `if (upErr) { setSending(false); setError(upErr.message); return }
        const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path)

        const voicePayload = {
          community_id: communityId,
          sender_id: myId,
          content: "",
          media_url: pub?.publicUrl || null,
          media_type: result.mimeType,
          media_name: "Voice · " + result.seconds + "s",
          ...(viewOnce ? { view_once: true, viewed_by: [] } : {}),
        }
        if (disappearingTimer) voicePayload.expires_at = new Date(Date.now() + disappearingTimer * 1000).toISOString()
        const { error: err } = await supabase.from("community_messages").insert(voicePayload)
        setSending(false)
        if (err) { setError(err.message); return }
        load()`;

const newVoiceBlock = `// META-SCALE: Upload to Telegram
        let fileId = "";
        try {
          fileId = await uploadMedia(result.blob);
        } catch (uploadErr) {
          setSending(false); setError(uploadErr.message); return;
        }

        const voicePayload = {
          communityId: communityId,
          senderId: myId,
          content: "",
          mediaUrl: fileId,
          mediaType: result.mimeType,
          mediaName: "Voice · " + result.seconds + "s",
          voiceDuration: result.seconds
        };

        // META-SCALE: Save to Neon
        try {
          const res = await fetch("https://nakubonye.bernestart.workers.dev/api/community/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(voicePayload)
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

if (code.includes(oldVoiceBlock)) {
  code = code.replace(oldVoiceBlock, newVoiceBlock);
  console.log("✅ SUCCESS: Voice Note upload & send patched to Telegram/Cloudflare!");
} else {
  console.log("⚠️ Warning: Voice block not found exactly. Check spacing.");
}

fs.writeFileSync(file, code);
