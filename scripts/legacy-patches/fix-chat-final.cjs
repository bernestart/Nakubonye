const fs = require('fs');
const file = 'src/components/CommunityChat.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Replace sendPoll block
const oldPoll = `const { data: inserted, error: err } = await supabase
                .from("community_messages")
                .insert(payload)
                .select("id, sender_id, content, media_url, media_type, media_name, reply_to_id, deleted_at, created_at, highlighted_until, metadata, view_once, viewed_by")
                .single()`;

const newPoll = `// META-SCALE: Send Poll to Neon
        try {
          const res = await fetch("https://nakubonye.bernestart.workers.dev/api/community/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              communityId: payload.community_id,
              senderId: payload.sender_id,
              content: payload.content
            })
          });
          const json = await res.json();
          if (json.success && json.data) {
            setMessages((cur) => cur.some((x) => x.id === json.data.id) ? cur : [...cur, json.data]);
          }
        } catch (e) { console.error(e); }`;

code = code.replace(oldPoll, newPoll);

// 2. Replace Voice Note block
const oldVoice = `const { error: err } = await supabase.from("community_messages").insert(voicePayload)
        setSending(false)
        if (err) { setError(err.message); return }
        load()`;

const newVoice = `// META-SCALE: Send Voice to Neon
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
          }
        } catch (e) { console.error(e); }
        setSending(false)`;

code = code.replace(oldVoice, newVoice);

fs.writeFileSync(file, code);
console.log("✅ SUCCESS: Chat and Poll now send to Cloudflare/Neon!");
