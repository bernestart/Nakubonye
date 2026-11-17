const fs = require('fs');
const file = 'src/components/StoryViewer.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Camera icon and NativeCamera imports
if (content.includes('lucide-react')) {
  content = content.replace(/import \{([^}]+)\} from "lucide-react"/, (match, p1) => {
    const icons = new Set(p1.split(',').map(s => s.trim()));
    icons.add('Camera');
    return `import { ${Array.from(icons).join(', ')} } from "lucide-react"`;
  });
}

if (!content.includes('@capacitor/camera')) {
  content = content.replace(
    'import { supabase } from "../lib/supabase"',
    'import { supabase } from "../lib/supabase"\nimport { Camera as NativeCamera, CameraResultType, CameraSource } from "@capacitor/camera"\nimport { Capacitor } from "@capacitor/core"'
  );
}

// 2. Add the sendMediaReply function right before sendReply
const replyAnchor = 'async function sendReply() {';
const mediaReplyFn = `async function sendMediaReply() {
    if (!group?.user_id || !story?.id || sending) return
    const ok = await canReply()
    if (!ok) { alert("This user isn't accepting story replies"); return }

    try {
      const shot = await NativeCamera.getPhoto({ 
        quality: 80, 
        resultType: CameraResultType.Uri, 
        source: Capacitor.isNativePlatform() ? CameraSource.Camera : CameraSource.Prompt 
      })
      const res = await fetch(shot.webPath)
      const blob = await res.blob()
      
      setSending(true)
      const convId = await findOrCreateConversation(group.user_id)
      if (!convId) { setSending(false); alert("Could not open chat"); return }
      
      const { data: sess } = await supabase.auth.getSession()
      const myId = sess?.session?.user?.id
      if (!myId) { setSending(false); return }

      // Upload the image
      const path = \`story-replies/\${myId}/\${crypto.randomUUID()}.jpg\`
      const { error: upErr } = await supabase.storage.from("chat-media").upload(path, blob, { contentType: "image/jpeg" })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path)
      
      // Send to DM
      const { error: sendErr } = await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: myId,
        content: "📷 Photo reply to story",
        media_url: pub?.publicUrl,
        media_type: "image/jpeg",
        metadata: {
          story_reply: {
            story_id: story.id,
            media_url: story.media_url,
            media_type: story.media_type,
          },
        },
      })
      
      setSending(false)
      if (sendErr) { alert("Send failed: " + sendErr.message); return }
      
      tap("medium")
      showToast("Sent to " + (group.display_name?.split(" ")[0] || "them"), group.user_id)
    } catch (e) {
      setSending(false)
      if (e && e.message && !/cancel/i.test(e.message)) {
        console.warn(e)
        alert("Camera error: " + e.message)
      }
    }
  }

  async function sendReply() {`;

if (!content.includes('sendMediaReply')) {
  content = content.replace(replyAnchor, mediaReplyFn);
}

// 3. Inject the Camera button right before the input in the reply bar
const inputAnchor = `<input
              value={reply}`;
const cameraButton = `<button
              onClick={sendMediaReply}
              disabled={sending}
              className="w-10 h-10 rounded-full grid place-items-center shrink-0 bg-black/35 backdrop-blur-sm border border-white/15 active:scale-95 disabled:opacity-50"
              aria-label="Send photo reply"
            >
              <Camera size={18} className="text-white" />
            </button>
            <input
              value={reply}`;

if (!content.includes('Send photo reply')) {
  content = content.replace(inputAnchor, cameraButton);
}

fs.writeFileSync(file, content);
console.log('✅ Successfully added Photo Reply to StoryViewer.jsx');
