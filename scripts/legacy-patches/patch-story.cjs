const fs = require('fs');
const p = 'src/components/StoryViewer.jsx';
let s = fs.readFileSync(p, 'utf8');

// Fix 1 — sendReply: close viewer before navigating
const find1 = `    setReply("")
    tap("medium")
    nav("/messages/" + group.user_id)
  }`;
const replace1 = `    setReply("")
    tap("medium")
    onClose?.()
    nav("/messages/" + group.user_id)
  }`;
if (!s.includes(find1)) { console.error('❌ sendReply anchor not found'); process.exit(1); }
s = s.replace(find1, replace1);

// Fix 2 — sendReaction: close viewer before navigating
const find2 = `    nav("/messages/" + group.user_id, {
      state: {
        prefill: emoji,
        storyReply: {
          story_id: story.id,
          media_url: story.media_url,
          media_type: story.media_type,
        },
      },
    })`;
const replace2 = `    onClose?.()
    nav("/messages/" + group.user_id, {
      state: {
        prefill: emoji,
        storyReply: {
          story_id: story.id,
          media_url: story.media_url,
          media_type: story.media_type,
        },
      },
    })`;
if (!s.includes(find2)) { console.error('❌ sendReaction anchor not found'); process.exit(1); }
s = s.replace(find2, replace2);

fs.writeFileSync(p, s);
console.log('✅ StoryViewer.jsx patched — sendReply + sendReaction');
