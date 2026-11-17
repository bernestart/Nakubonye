const fs = require("fs");
const p = "src/screens/Chat.jsx";
let s = fs.readFileSync(p, "utf8");

// 1. Import
const importAnchor = `import { useVoiceCall } from '../lib/voiceCall'`;
if (!s.includes(importAnchor)) { console.error("voiceCall import missing"); process.exit(1); }
if (!s.includes("MessageActionsSheet")) {
  s = s.replace(importAnchor, importAnchor + `\nimport MessageActionsSheet from '../components/MessageActionsSheet'`);
}

// 2. State
const stateAnchor = `  const [reactionPickerFor, setReactionPickerFor] = useState(null)`;
if (!s.includes(stateAnchor)) { console.error("reactionPickerFor state missing"); process.exit(1); }
if (!s.includes("actionsForMsg")) {
  s = s.replace(stateAnchor, stateAnchor + `\n  const [actionsForMsg, setActionsForMsg] = useState(null)\n  const [forwardMsg, setForwardMsg] = useState(null)\n  const longPressTimer = useRef(null)`);
}

// 3. Add long-press handlers before the return
const returnAnchor = `  return (`;
const idx = s.indexOf(returnAnchor);
if (idx < 0) { console.error("return anchor missing"); process.exit(1); }

const handlers = `  function onMsgPressStart(m) {
    longPressTimer.current = setTimeout(() => {
      tap("medium")
      setActionsForMsg(m)
    }, 450)
  }
  function onMsgPressEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

`;

s = s.slice(0, idx) + handlers + s.slice(idx);

// 4. Attach handlers to the message bubble — find the bubble motion.div
// The message row already has motion.div. Find the message content container that wraps it.
// Look for the message bubble wrapper
const bubbleAnchor = `<div
                  className={\`px-3.5 py-2 text-[14px] leading-[1.4] break-words rounded-2xl \${`;

if (!s.includes(bubbleAnchor)) { console.error("bubble anchor missing"); process.exit(1); }

s = s.replace(bubbleAnchor, `<div
                  onTouchStart={() => onMsgPressStart(m)}
                  onTouchEnd={onMsgPressEnd}
                  onTouchMove={onMsgPressEnd}
                  onContextMenu={(e) => { e.preventDefault(); setActionsForMsg(m) }}
                  className={\`px-3.5 py-2 text-[14px] leading-[1.4] break-words rounded-2xl \${`);

// 5. Render MessageActionsSheet before BottomNav/close
const closeAnchor = `      <div style={{ height: 72, flexShrink: 0 }} />`;
if (!s.includes(closeAnchor)) { console.error("close anchor missing"); process.exit(1); }
if (!s.includes("<MessageActionsSheet")) {
  s = s.replace(closeAnchor, `      {actionsForMsg && (
        <MessageActionsSheet
          message={actionsForMsg}
          isMine={actionsForMsg.sender_id === myId}
          onClose={() => setActionsForMsg(null)}
          onReply={(m) => setReplyingTo(m)}
          onForward={(m) => { setForwardMsg(m); alert("Forward coming soon") }}
          onDelete={deleteMessage}
          onReact={(emoji) => toggleReaction(actionsForMsg.id, emoji)}
        />
      )}

${closeAnchor}`);
}

fs.writeFileSync(p, s);
console.log("long-press menu wired");
