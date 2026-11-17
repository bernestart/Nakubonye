const fs = require('fs');
const file = 'src/components/CommunityChat.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Remove the zombie code from the poll function
const zombieCode = `          } else { setError(json.error || "Failed to send poll"); }
        } catch (err) { setError(err.message); }
        if (!err && inserted) {
          setMessages((cur) => cur.some((x) => x.id === inserted.id) ? cur : [...cur, inserted])
        }
      }`;
const cleanPoll = `          } else { setError(json.error || "Failed to send poll"); }
        } catch (err) { setError(err.message); }
      }`;
if (code.includes(zombieCode)) {
  code = code.replace(zombieCode, cleanPoll);
  console.log("✅ Cleaned up zombie code in Poll function");
}

// 2. Replace the entire send() function
const oldSendRegex = /async function send\(\) \{[\s\S]*?if \(err\) \{/;
const newSendCode = `async function send() {
    const body = text.trim()
    if ((!body && !attachment) || sending || !myId) return

    setSending(true); tap('light')

    let mediaUrl = null, mediaType = null, mediaName = null
    if (attachment) {
      try {
        // META-SCALE: Upload attachment to Telegram
        mediaUrl = await uploadMedia(attachment);
        mediaType = attachment.type;
        mediaName = attachment.name;
      } catch (upErr) {
        setSending(false); setError(upErr.message); return;
      }
    }

    setText(""); const bodyToSend = body; clearAttachment()

    // META-SCALE: Send to Neon via Cloudflare
    try {
      const res = await fetch("https://nakubonye.bernestart.workers.dev/api/community/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communityId: communityId,
          senderId: myId,
          content: bodyToSend || "",
          mediaUrl: mediaUrl,
          mediaType: mediaType,
          mediaName: mediaName,
          replyToId: replyingTo?.id
        })
      });
      const json = await res.json();
      if (json.success && json.data) {
        setMessages((cur) => cur.some((x) => x.id === json.data.id) ? cur : [...cur, json.data]);
      } else {
        setError(json.error || "Failed to send message");
      }
    } catch (err) {
      setError(err.message);
    }
    
    setReplyingTo(null)
    setSending(false)
  }`;

if (oldSendRegex.test(code)) {
  code = code.replace(oldSendRegex, newSendCode);
  console.log("✅ SUCCESS: send() function replaced with Telegram + Cloudflare API!");
} else {
  console.log("❌ ERROR: Could not find the send() function.");
}

fs.writeFileSync(file, code);
