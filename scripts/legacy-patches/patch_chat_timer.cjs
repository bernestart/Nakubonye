#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const FILE = 'src/screens/Chat.jsx';
const filePath = path.join(process.cwd(), FILE);
if (!fs.existsSync(filePath)) { console.error('FAIL: ' + FILE + ' not found'); process.exit(1); }
let content = fs.readFileSync(filePath, 'utf8');
const original = content;

function fail(msg) { console.error('FAIL: ' + msg); process.exit(1); }
function replaceOnce(needle, repl, label) {
  const count = content.split(needle).length - 1;
  if (count === 0) fail('[' + label + '] anchor not found');
  if (count > 1) fail('[' + label + '] anchor appears ' + count + ' times (expected 1)');
  content = content.replace(needle, repl);
  console.log('  OK ' + label);
}

replaceOnce(
  "const payload = { conversation_id: conversationId, sender_id: myId, content: '', media_url: pub?.publicUrl, media_type: file.type, media_name: file.name }",
  "const payload = { conversation_id: conversationId, sender_id: myId, content: '', media_url: pub?.publicUrl, media_type: file.type, media_name: file.name }\n    if (disappearingTimer) payload.expires_at = new Date(Date.now() + disappearingTimer * 1000).toISOString()",
  'doc send expires_at'
);

(function () {
  const anchor = 'if (viewOnce) {';
  const count = content.split(anchor).length - 1;
  if (count !== 1) fail('[voice expires_at] "if (viewOnce) {" appears ' + count + ' times (expected 1)');
  const idx = content.indexOf(anchor);
  const after = content.slice(idx, idx + 300);
  if (!after.includes("payload.ephemeral_type = 'VIEW_ONCE'")) {
    fail('[voice expires_at] "if (viewOnce) {" not followed by ephemeral_type - refusing to patch wrong block');
  }
  const before = content.slice(0, idx);
  const lineStart = before.lastIndexOf('\n') + 1;
  const indent = before.slice(lineStart, idx);
  const insert = indent + 'if (disappearingTimer) payload.expires_at = new Date(Date.now() + disappearingTimer * 1000).toISOString()\n';
  content = content.slice(0, lineStart) + insert + content.slice(lineStart);
  console.log('  OK voice send expires_at');
})();

replaceOnce(
  "const { data: inserted, error: err } = await supabase",
  "if (disappearingTimer) payload.expires_at = new Date(Date.now() + disappearingTimer * 1000).toISOString()\n    const { data: inserted, error: err } = await supabase",
  'poll send expires_at'
);

if (content === original) { console.log('No changes (already patched?)'); process.exit(0); }
fs.writeFileSync(filePath, content);
console.log('PATCHED: ' + FILE);
