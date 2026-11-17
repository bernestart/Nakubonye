#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const FILE = 'src/screens/GroupChat.jsx';
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
  'media_name: "Voice \u00b7 " + result.seconds + "s",',
  'media_name: "Voice \u00b7 " + result.seconds + "s",\n        ...(disappearingTimer ? { expires_at: new Date(Date.now() + disappearingTimer * 1000).toISOString() } : {}),',
  'voice send expires_at'
);

replaceOnce(
  "const path = `${conversationId}/${crypto.randomUUID()}.${file.name.split('.').pop()}`",
  "const path = `${groupId}/${crypto.randomUUID()}.${file.name.split('.').pop()}`",
  'doc send path groupId'
);

replaceOnce(
  "const payload = { conversation_id: conversationId, sender_id: myId, content: '', media_url: pub?.publicUrl, media_type: file.type, media_name: file.name }",
  "const payload = { group_id: groupId, sender_id: myId, content: '', media_url: pub?.publicUrl, media_type: file.type, media_name: file.name }\n    if (disappearingTimer) payload.expires_at = new Date(Date.now() + disappearingTimer * 1000).toISOString()",
  'doc send payload group_id + expires_at'
);

replaceOnce(
  "supabase.from('messages').insert(payload).select().single()",
  "supabase.from('group_messages').insert(payload).select().single()",
  'doc send table group_messages'
);

replaceOnce(
  '.select("id, name, avatar_url, created_by, created_at, invite_code, invite_enabled")',
  '.select("id, name, avatar_url, created_by, created_at, invite_code, invite_enabled, disappearing_timer_seconds")',
  'boot select includes timer column'
);

replaceOnce(
  'setGroup(g)',
  'setGroup(g)\n    setDisappearingTimer(g.disappearing_timer_seconds || null)',
  'boot setDisappearingTimer'
);

if (content === original) { console.log('No changes (already patched?)'); process.exit(0); }
fs.writeFileSync(filePath, content);
console.log('PATCHED: ' + FILE);
