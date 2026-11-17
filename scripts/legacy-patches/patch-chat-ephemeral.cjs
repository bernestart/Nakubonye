#!/usr/bin/env node
const fs = require('fs');
const FILE = 'src/screens/Chat.jsx';
let src = fs.readFileSync(FILE, 'utf8');

const edits = [];
function add(from, to, label) { edits.push({ from, to, label }); }

// 1. Add ephemeral toggle state for recording
add(
`  const [viewOnce, setViewOnce] = useState(false)`,
`  const [viewOnce, setViewOnce] = useState(false)
  const [voiceViewOnce, setVoiceViewOnce] = useState(false)`,
'state'
);

// 2. Add a UI toggle next to the Mic button (simplified anchor)
add(
`        <button
          onClick={() => { if (recording) { stopRecording(true) } else { startRecording() } }}`,
`        <button
          onClick={() => { tap("light"); setVoiceViewOnce(v => !v) }}
          className={"w-8 h-8 rounded-full grid place-items-center " + (voiceViewOnce ? "bg-purple-500 text-white" : "text-muted")}
          title="Send as view once"
        >
          <span className="text-[11px] font-black">1</span>
        </button>
        <button
          onClick={() => { if (recording) { stopRecording(true) } else { startRecording() } }}`,
'mic toggle'
);

// 3. Update the payload to use ephemeral_type
add(
`    if (disappearingTimer) {
      payload.expires_at = new Date(Date.now() + disappearingTimer * 1000).toISOString()`,
`    if (voiceViewOnce && payload.media_type?.startsWith("audio/")) {
      payload.ephemeral_type = "VIEW_ONCE"
      payload.view_once = true
    }
    if (disappearingTimer) {
      payload.expires_at = new Date(Date.now() + disappearingTimer * 1000).toISOString()`,
'payload'
);

// ===== PREFLIGHT =====
console.log('--- preflight ---');
let ok = true;
for (const e of edits) {
  const c = src.split(e.from).length - 1;
  if (c === 0) { console.error(`\u274c MISSING: ${e.label}`); ok = false; }
  else if (c > 1) { console.error(`\u274c NOT UNIQUE (${c}x): ${e.label}`); ok = false; }
  else { console.log(`\u2705 ok: ${e.label}`); }
}
if (!ok) { console.error('\n\u274c Preflight failed. File untouched.'); process.exit(1); }

console.log('\n--- applying ---');
for (const e of edits) {
  src = src.replace(e.from, e.to);
  console.log(`\u2705 ${e.label}`);
}
fs.writeFileSync(FILE, src);
console.log(`\n\u2705 Done.`);
