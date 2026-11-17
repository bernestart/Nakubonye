#!/usr/bin/env node
const fs = require('fs');
const FILE = 'src/screens/Feed.jsx';
let src = fs.readFileSync(FILE, 'utf8');

const edits = [];
function add(from, to, label) { edits.push({ from, to, label }); }

// F1 — Import
add(
`import NewPostsPill from "../components/NewPostsPill"`,
`import NewPostsPill from "../components/NewPostsPill"
import PostFeedbackSheet from "../components/PostFeedbackSheet"`,
'F1 import'
);

// F2 — State for the feedback sheet
add(
`  const [actionsFor, setActionsFor] = useState(null)`,
`  const [actionsFor, setActionsFor] = useState(null)
  const [feedbackFor, setFeedbackFor] = useState(null)`,
'F2 state'
);

// F3 — Change X button from hidePost to setFeedbackFor
add(
`                  <button
                    onClick={() => { tap("light"); hidePost(p._source + ":" + p.id) }}
                    className="w-8 h-8 rounded-full grid place-items-center text-muted shrink-0"
                    aria-label="Hide post"
                  >
                    <X size={18} />
                  </button>`,
`                  <button
                    onClick={() => { tap("light"); setFeedbackFor(p) }}
                    className="w-8 h-8 rounded-full grid place-items-center text-muted shrink-0"
                    aria-label="Hide post"
                  >
                    <X size={18} />
                  </button>`,
'F3 X button'
);

// F4 — Render sheet at the bottom alongside other sheets
add(
`      {actionsFor && (`,
`      {feedbackFor && (
        <PostFeedbackSheet
          post={feedbackFor}
          onClose={() => setFeedbackFor(null)}
          onHide={(p) => hidePost(p._source + ":" + p.id)}
          onReport={(p) => { setFeedbackFor(null); setActionsFor(p); /* Opens report flow */ }}
        />
      )}

      {actionsFor && (`,
'F4 render sheet'
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
