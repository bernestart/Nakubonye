#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const FILE = 'src/components/CommunityChat.jsx';
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
  "const payload = { community_id: communityId, sender_id: myId, content: '', media_url: pub?.publicUrl, media_type: file.type, media_name: file.name }",
  "const payload = { community_id: communityId, sender_id: myId, content: '', media_url: pub?.publicUrl, media_type: file.type, media_name: file.name }\n    if (disappearingTimer) payload.expires_at = new Date(Date.now() + disappearingTimer * 1000).toISOString()",
  'doc send expires_at'
);

replaceOnce(
  'const [clearRes, muteRes] = await Promise.all([',
  'const [clearRes, muteRes, communityRes] = await Promise.all([',
  'load destructure communityRes'
);

replaceOnce(
  'supabase.from("community_mutes").select("community_id").eq("community_id", communityId).eq("user_id", myId).maybeSingle(),\n    ])',
  'supabase.from("community_mutes").select("community_id").eq("community_id", communityId).eq("user_id", myId).maybeSingle(),\n      supabase.from("communities").select("disappearing_timer_seconds").eq("id", communityId).maybeSingle(),\n    ])',
  'load third fetch communities'
);

replaceOnce(
  'setIsMuted(!!muteRes.data)',
  'setIsMuted(!!muteRes.data)\n    setDisappearingTimer(communityRes.data?.disappearing_timer_seconds || null)',
  'load setDisappearingTimer'
);

if (content === original) { console.log('No changes (already patched?)'); process.exit(0); }
fs.writeFileSync(filePath, content);
console.log('PATCHED: ' + FILE);
