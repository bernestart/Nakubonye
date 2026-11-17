const fs = require('fs');
const file = 'src/components/CommunityChat.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');
let newLines = [];
let skipMode = null;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // ==========================================
  // 1. DETECT POLL SEND BLOCK
  // ==========================================
  if (line.includes('const { data: inserted, error: err } = await supabase') && lines[i+1]?.includes('.from("community_messages")')) {
    skipMode = 'poll';
    newLines.push(`        // META-SCALE: Save Poll to Neon via Cloudflare`);
    newLines.push(`        try {`);
    newLines.push(`          const res = await fetch("https://nakubonye.bernestart.workers.dev/api/community/messages", {`);
    newLines.push(`            method: "POST",`);
    newLines.push(`            headers: { "Content-Type": "application/json" },`);
    newLines.push(`            body: JSON.stringify({ communityId: payload.community_id, senderId: payload.sender_id, content: payload.content, metadata: payload.metadata })`);
    newLines.push(`          });`);
    newLines.push(`          const json = await res.json();`);
    newLines.push(`          if (json.success && json.data) {`);
    newLines.push(`            setMessages((cur) => cur.some((x) => x.id === json.data.id) ? cur : [...cur, json.data]);`);
    newLines.push(`          } else { setError(json.error || "Failed to send poll"); }`);
    newLines.push(`        } catch (err) { setError(err.message); }`);
    continue;
  }

  // Skip the rest of the old poll block
  if (skipMode === 'poll') {
    if (line.includes('.single()') || line.includes('if (!err && inserted)')) {
      skipMode = null;
    }
    continue;
  }

  // ==========================================
  // 2. DETECT VOICE NOTE UPLOAD BLOCK
  // ==========================================
  if (line.includes('const voicePayload = {')) {
    skipMode = 'voice';
    newLines.push(`        // META-SCALE: Upload Voice to Telegram & Save to Neon`);
    newLines.push(`        let fileId = "";`);
    newLines.push(`        try { fileId = await uploadMedia(result.blob); } catch (uploadErr) { setSending(false); setError(uploadErr.message); return; }`);
    newLines.push(`        const voicePayload = { communityId, senderId: myId, content: "", mediaUrl: fileId, mediaType: result.mimeType, mediaName: "Voice · " + result.seconds + "s", voiceDuration: result.seconds };`);
    newLines.push(`        try {`);
    newLines.push(`          const res = await fetch("https://nakubonye.bernestart.workers.dev/api/community/messages", {`);
    newLines.push(`            method: "POST",`);
    newLines.push(`            headers: { "Content-Type": "application/json" },`);
    newLines.push(`            body: JSON.stringify(voicePayload)`);
    newLines.push(`          });`);
    newLines.push(`          const json = await res.json();`);
    newLines.push(`          if (json.success && json.data) {`);
    newLines.push(`            setMessages((cur) => cur.some((x) => x.id === json.data.id) ? cur : [...cur, json.data]);`);
    newLines.push(`          } else { setError(json.error || "Failed to send voice"); }`);
    newLines.push(`        } catch (err) { setError(err.message); }`);
    newLines.push(`        setSending(false);`);
    continue;
  }

  // Skip the rest of the old voice block
  if (skipMode === 'voice') {
    if (line.includes('load()')) {
      skipMode = null;
    }
    continue;
  }

  // Normal line
  newLines.push(line);
}

fs.writeFileSync(file, newLines.join('\n'));
console.log("✅ SUCCESS: Surgical patch applied! Old Supabase blocks removed and replaced with Cloudflare API.");
