const fs = require('fs');
const p = 'src/screens/Messages.jsx';

if (!fs.existsSync(p)) {
  console.error('❌ ABORT: Messages.jsx not found.');
  process.exit(1);
}

let lines = fs.readFileSync(p, 'utf8').split('\n');

// 1. Ensure API_BASE_URL is imported
const importIdx = lines.findIndex(l => l.includes("import { supabase }"));
if (importIdx > -1 && !lines[importIdx].includes("API_BASE_URL")) {
  lines[importIdx] = "import { API_BASE_URL } from '../lib/api';\n" + lines[importIdx];
}

// 2. Find the exact bounds to replace
const startIdx = lines.findIndex(l => l.includes('const [convPins, grpPins] = await Promise.all(['));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('let visibleOnline = []'));

if (startIdx > -1 && endIdx > -1 && endIdx > startIdx) {
  const bffBlock = `
    // BFF PATTERN: Single request for all inbox data
    const bootRes = await fetch(\`\${API_BASE_URL}/api/inbox/bootstrap?userId=\${userId}\`).then(r => r.json());
    const boot = bootRes.success ? bootRes.data : { convPins: [], grpPins: [], convArch: [], grpArch: [], convDel: [], grpDel: [], onlineRows: [] };

    const pinSet = new Set()
    ;(boot.convPins || []).forEach((r) => pinSet.add("c:" + r.conversation_id))
    ;(boot.grpPins || []).forEach((r) => pinSet.add("g:" + r.group_id))
    setPinnedKeys(pinSet)

    const archSet = new Set()
    ;(boot.convArch || []).forEach((r) => archSet.add("c:" + r.conversation_id))
    ;(boot.grpArch || []).forEach((r) => archSet.add("g:" + r.group_id))
    setArchivedKeys(archSet)

    const delSet = new Set()
    ;(boot.convDel || []).forEach((r) => delSet.add("c:" + r.conversation_id))
    ;(boot.grpDel || []).forEach((r) => delSet.add("g:" + r.group_id))
    setDeletedKeys(delSet)

    const onlineRows = boot.onlineRows || [];`;

  // Replace the lines from startIdx up to endIdx (exclusive)
  lines.splice(startIdx, endIdx - startIdx, bffBlock);
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
  console.log('✅ Messages.jsx Inbox BFF patch applied successfully.');
} else {
  console.error('❌ ABORT: Could not find exact anchors in Messages.jsx.');
}
