#!/usr/bin/env node
const fs = require('fs');

const patches = [
  {
    file: 'src/screens/Chat.jsx',
    regex: /try \{\s*await supabase\.from\('conversations'\)\s*\.update\(\{ disappearing_timer_seconds: o\.value \}\)\s*\.eq\('id', conversationId\)\s*\} catch \(e\) \{ console\.warn\("timer save failed", e\) \}/,
    replacement: "const { data: saveData, error: saveErr } = await supabase.from('conversations')\n      .update({ disappearing_timer_seconds: o.value })\n      .eq('id', conversationId)\n      .select('id, disappearing_timer_seconds')\n    console.log('[timer-save] convId=', conversationId, 'value=', o.value, 'saveErr=', saveErr, 'saveData=', saveData)\n    if (saveErr || !saveData || saveData.length === 0) {\n      console.error('[timer-save] FAILED', { saveErr, saveData, conversationId, value: o.value })\n      setDisappearingTimer(savedBefore)\n      if (typeof setError === 'function') setError('Timer save failed: ' + (saveErr?.message || 'no rows updated - conversationId=' + conversationId))\n    } else {\n      setDisappearingTimer(saveData[0].disappearing_timer_seconds)\n    }",
  },
  {
    file: 'src/screens/GroupChat.jsx',
    regex: /try \{\s*await supabase\.from\("groups"\)\s*\.update\(\{ disappearing_timer_seconds: o\.value \}\)\s*\.eq\("id", groupId\)\s*\} catch \(e\) \{ console\.warn\("timer save failed", e\) \}/,
    replacement: "const { data: saveData, error: saveErr } = await supabase.from(\"groups\")\n      .update({ disappearing_timer_seconds: o.value })\n      .eq(\"id\", groupId)\n      .select('id, disappearing_timer_seconds')\n    console.log('[timer-save] groupId=', groupId, 'value=', o.value, 'saveErr=', saveErr, 'saveData=', saveData)\n    if (saveErr || !saveData || saveData.length === 0) {\n      console.error('[timer-save] FAILED', { saveErr, saveData, groupId, value: o.value })\n      setDisappearingTimer(savedBefore)\n      if (typeof setError === 'function') setError('Timer save failed: ' + (saveErr?.message || 'no rows updated - groupId=' + groupId))\n    } else {\n      setDisappearingTimer(saveData[0].disappearing_timer_seconds)\n    }",
  },
  {
    file: 'src/components/CommunityChat.jsx',
    regex: /try \{\s*await supabase\.from\("communities"\)\s*\.update\(\{ disappearing_timer_seconds: o\.value \}\)\s*\.eq\("id", communityId\)\s*\} catch \(e\) \{ console\.warn\("timer save failed", e\) \}/,
    replacement: "const { data: saveData, error: saveErr } = await supabase.from(\"communities\")\n      .update({ disappearing_timer_seconds: o.value })\n      .eq(\"id\", communityId)\n      .select('id, disappearing_timer_seconds')\n    console.log('[timer-save] communityId=', communityId, 'value=', o.value, 'saveErr=', saveErr, 'saveData=', saveData)\n    if (saveErr || !saveData || saveData.length === 0) {\n      console.error('[timer-save] FAILED', { saveErr, saveData, communityId, value: o.value })\n      setDisappearingTimer(savedBefore)\n      if (typeof setError === 'function') setError('Timer save failed: ' + (saveErr?.message || 'no rows updated - communityId=' + communityId))\n    } else {\n      setDisappearingTimer(saveData[0].disappearing_timer_seconds)\n    }",
  },
];

// Also add `savedBefore` capture + remove the premature setDisappearingTimer(o.value)
const preCapture = {
  'src/screens/Chat.jsx': [/(\s+)setTimerSheetOpen\(false\)\s+setDisappearingTimer\(o\.value\)/, "$1const savedBefore = disappearingTimer\n$1setTimerSheetOpen(false)"],
  'src/screens/GroupChat.jsx': [/(\s+)setTimerSheetOpen\(false\)\s+setDisappearingTimer\(o\.value\)/, "$1const savedBefore = disappearingTimer\n$1setTimerSheetOpen(false)"],
  'src/components/CommunityChat.jsx': [/(\s+)setTimerSheetOpen\(false\)\s+setDisappearingTimer\(o\.value\)/, "$1const savedBefore = disappearingTimer\n$1setTimerSheetOpen(false)"],
};

let failed = false;
for (const p of patches) {
  if (!fs.existsSync(p.file)) { console.error('MISSING: ' + p.file); failed = true; continue; }
  let src = fs.readFileSync(p.file, 'utf8');
  // 1) remove premature state update
  const [re, repl] = preCapture[p.file];
  const beforePre = src;
  src = src.replace(re, repl);
  if (src === beforePre) { console.error('WARN: pre-capture pattern not found in ' + p.file + ' (may already be fixed)'); }
  // 2) replace try/catch with authoritative write
  const before = src;
  src = src.replace(p.regex, p.replacement);
  if (src === before) { console.error('FAIL: try/catch block not found in ' + p.file); failed = true; continue; }
  fs.writeFileSync(p.file, src);
  console.log('  OK patched ' + p.file);
}
if (failed) { console.error('\nPatch failed. Do not build.'); process.exit(1); }
console.log('\nALL 3 FILES PATCHED');
