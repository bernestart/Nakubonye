#!/usr/bin/env node
const fs = require('fs');

const patches = [
  { file: 'src/screens/Chat.jsx', table: 'conversations', idCol: 'conversationId' },
  { file: 'src/screens/GroupChat.jsx', table: 'groups', idCol: 'groupId' },
  { file: 'src/components/CommunityChat.jsx', table: 'communities', idCol: 'communityId' },
];

// This regex matches from setTimerSheetOpen(false) all the way to the end of the catch block,
// ignoring newlines and spaces in between.
const regex = /setTimerSheetOpen\(false\)[\s\S]*?console\.warn\("timer save failed", e\)\s*\}/;

let failed = false;
for (const p of patches) {
  if (!fs.existsSync(p.file)) { console.error('MISSING: ' + p.file); failed = true; continue; }
  let src = fs.readFileSync(p.file, 'utf8');
  
  if (src.includes('[timer-save] FAILED')) {
    console.log('  SKIP ' + p.file + ' (already patched)');
    continue;
  }

  const before = src;
  const replacement = `const savedBefore = disappearingTimer
                    setTimerSheetOpen(false)
                    const { data: saveData, error: saveErr } = await supabase.from('${p.table}')
                      .update({ disappearing_timer_seconds: o.value })
                      .eq('id', ${p.idCol})
                      .select('id, disappearing_timer_seconds')
                    console.log('[timer-save] ${p.idCol}=', ${p.idCol}, 'value=', o.value, 'saveErr=', saveErr, 'saveData=', saveData)
                    if (saveErr || !saveData || saveData.length === 0) {
                      console.error('[timer-save] FAILED', { saveErr, saveData, ${p.idCol}, value: o.value })
                      setDisappearingTimer(savedBefore)
                      if (typeof setError === 'function') setError('Timer save failed: ' + (saveErr?.message || 'no rows updated - ${p.idCol}=' + ${p.idCol}))
                    } else {
                      setDisappearingTimer(saveData[0].disappearing_timer_seconds)
                    }`;

  src = src.replace(regex, replacement);
  
  if (src === before) {
    console.error('FAIL: pattern not found in ' + p.file);
    failed = true;
    continue;
  }
  
  fs.writeFileSync(p.file, src);
  console.log('  OK patched ' + p.file);
}

if (failed) { console.error('\nPatch failed. Do not build.'); process.exit(1); }
console.log('\nALL 3 FILES PATCHED');
