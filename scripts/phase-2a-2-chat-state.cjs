const fs = require('fs');
const p = 'src/screens/Chat.jsx';

if (!fs.existsSync(p)) process.exit(1);
let lines = fs.readFileSync(p, 'utf8').split('\n');

// Find the start of the block
const startIdx = lines.findIndex(l => l.includes("const [mineRes, theirsRes] = await Promise.all(["));
// Find the end of the block (setLoading(false) inside the boot function)
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes("setLoading(false)"));

if (startIdx > -1 && endIdx > -1 && endIdx > startIdx) {
  const newBlock = [
    `      const stateRes = await fetch(\`\${API_BASE_URL}/api/chat/state?myId=\${myId}&otherId=\${otherId}&convId=\${convId}\`).then(r => r.json());`,
    `      const state = stateRes.success ? stateRes.data : {};`,
    `      setCanSeeReadReceipts(state.mineOn !== false && state.theirsOn !== false);`,
    `      setMyPreviousReadAt(state.prevReadAt || null);`,
    `      setIsMuted(!!state.isMuted);`,
    `      setClearedAt(state.clearedAt || null);`,
    ``,
    `      if (typeof setUnreadCount === 'function') setUnreadCount(0);`,
    ``,
    `      fetch(\`\${API_BASE_URL}/api/inbox/read\`, {`,
    `        method: 'POST',`,
    `        headers: { 'Content-Type': 'application/json' },`,
    `        body: JSON.stringify({ type: 'dm', rows: [{ conversation_id: convId, user_id: myId }] })`,
    `      }).catch(() => {});`,
    `      setLoading(false)`
  ];

  // Replace the lines from startIdx to endIdx
  lines.splice(startIdx, endIdx - startIdx + 1, ...newBlock);
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
  console.log('✅ Chat.jsx state safely migrated to BFF.');
} else {
  console.error('❌ ABORT: Could not find exact anchors for Chat state.');
}
