#!/usr/bin/env node
const fs = require('fs');

const files = [
  { file: 'src/screens/Chat.jsx', table: 'conversations', id: 'conversationId' },
  { file: 'src/screens/GroupChat.jsx', table: 'groups', id: 'groupId' },
  { file: 'src/components/CommunityChat.jsx', table: 'communities', id: 'communityId' },
];

let failed = false;

for (const f of files) {
  if (!fs.existsSync(f.file)) { console.error('MISSING: ' + f.file); failed = true; continue; }
  let src = fs.readFileSync(f.file, 'utf8');

  // 1. Remove premature state update and capture savedBefore
  const search1 = `setTimerSheetOpen(false)\n                    setDisappearingTimer(o.value)`;
  const replace1 = `const savedBefore = disappearingTimer\n                    setTimerSheetOpen(false)`;
  
  if (!src.includes(search1)) {
    console.error('FAIL: Could not find premature state update in ' + f.file);
    failed = true;
    continue;
  }
  src = src.replace(search1, replace1);

  // 2. Add revert on failure and trust DB on success
  const search2 = `if (typeof setError === 'function') setError('Timer save failed: ' + (saveErr?.message || 'no rows updated - ${f.id}=' + ${f.id}))\n    }`;
  const replace2 = `if (typeof setError === 'function') setError('Timer save failed: ' + (saveErr?.message || 'no rows updated - ${f.id}=' + ${f.id}))\n      setDisappearingTimer(savedBefore)\n    } else {\n      setDisappearingTimer(saveData[0].disappearing_timer_seconds)\n    }`;

  if (!src.includes(search2)) {
    console.error('FAIL: Could not find error check block in ' + f.file);
    failed = true;
    continue;
  }
  src = src.replace(search2, replace2);

  fs.writeFileSync(f.file, src);
  console.log('✅ Fully patched ' + f.file);
}

if (failed) { console.error('\nPatch failed. Do not build.'); process.exit(1); }
console.log('\nALL 3 FILES FULLY PATCHED');
