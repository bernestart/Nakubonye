#!/usr/bin/env node
const fs = require('fs');
const FILE = 'src/components/PostComposer.jsx';
let src = fs.readFileSync(FILE, 'utf8');

const edits = [];
function add(from, to, label) { edits.push({ from, to, label }); }

// C1 — import TagPicker
add(
`import { autosaveDraft, deleteDraftsByKind } from "../lib/drafts"`,
`import { autosaveDraft, deleteDraftsByKind } from "../lib/drafts"
import TagPicker from "./TagPicker"`,
'C1 import'
);

// C2 — state
add(
`  const [commentSheetOpen, setCommentSheetOpen] = useState(false)`,
`  const [commentSheetOpen, setCommentSheetOpen] = useState(false)
  const [taggedUsers, setTaggedUsers] = useState([])
  const [tagPickerOpen, setTagPickerOpen] = useState(false)`,
'C2 state'
);

// C3 — insert payload
add(
`        share_to_story: shareToStory,
      }).select("id").single()`,
`        share_to_story: shareToStory,
        tagged_user_ids: taggedUsers.map((u) => u.id).filter(Boolean),
      }).select("id").single()`,
'C3 payload'
);

// C4 — replace alert stub with picker open
add(
`          <button type="button" onClick={() => { tap("light"); try { alert("Tag people coming soon") } catch {} }}
            className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.04] border-b border-white/[0.06]">
            <span className="w-9 h-9 rounded-full grid place-items-center bg-blue-500/15"><span className="text-[15px]">{"\\u{1F464}"}</span></span>
            <span className="text-cream font-semibold text-[13.5px] flex-1">Tag people</span>
          </button>`,
`          <button type="button" onClick={() => { tap("light"); setTagPickerOpen(true) }}
            className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.04] border-b border-white/[0.06]">
            <span className="w-9 h-9 rounded-full grid place-items-center bg-blue-500/15"><span className="text-[15px]">{"\\u{1F464}"}</span></span>
            <span className="text-cream font-semibold text-[13.5px] flex-1">Tag people</span>
            {taggedUsers.length > 0 && <span className="text-purple-400 text-[12px] font-bold">{taggedUsers.length}</span>}
          </button>`,
'C4 tag row'
);

// C5 — render TagPicker at end
add(
`      {audienceSheetOpen && (`,
`      {tagPickerOpen && (
        <TagPicker
          initial={taggedUsers}
          onClose={() => setTagPickerOpen(false)}
          onSave={(sel) => setTaggedUsers(sel || [])}
        />
      )}

      {audienceSheetOpen && (`,
'C5 render picker'
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
console.log(`\n\u2705 Done. ${edits.length} edits applied to ${FILE}`);
