#!/usr/bin/env node
const fs = require('fs');

const edits = [];
function add(FILE, from, to, label) { edits.push({ FILE, from, to, label }); }

// ==========================================
// 1. Patch StoryViewer.jsx (Music + Links)
// ==========================================
const SV = 'src/components/StoryViewer.jsx';
add(SV,
`import { X, Send, Heart, MoreVertical, Eye, Volume2, VolumeX, Trash2, Star } from "lucide-react"`,
`import { X, Send, Heart, MoreVertical, Eye, Volume2, VolumeX, Trash2, Star } from "lucide-react"
import StoryMusicPlayer from "./stories/StoryMusicPlayer"
import StoryLinkSticker from "./stories/StoryLinkSticker"`,
'SV imports'
);

// Inject UI right above the reply bar (line 530)
add(SV,
`      {/* Bottom — reply bar (own story shows viewers button instead) */}`,
`      <StoryMusicPlayer track={story.music_track} playing={!paused} />
      <StoryLinkSticker url={story.link_url} onOpen={(url) => { tap("light"); window.open(url, "_blank") }} />

      {/* Bottom — reply bar (own story shows viewers button instead) */}`,
'SV stickers'
);

// ==========================================
// 2. Patch Reels.jsx (Sound Page)
// ==========================================
const RD = 'src/screens/Reels.jsx';
add(RD,
`import ReelActionsSheet from "../components/ReelActionsSheet"`,
`import ReelActionsSheet from "../components/ReelActionsSheet"
import ReelSoundPage from "../components/reels/ReelSoundPage"`,
'RD imports'
);

add(RD,
`  const [composerOpen, setComposerOpen] = useState(false)`,
`  const [composerOpen, setComposerOpen] = useState(false)
  const [soundPageOpen, setSoundPageOpen] = useState(null)`,
'RD state'
);

// Inject Sound button inside the bottom info block (line 1035-1036)
add(RD,
`                {/* Bottom info: author + caption + actions */}
                <div className="absolute left-3 right-20 bottom-4 z-20">`,
`                {/* Bottom info: author + caption + actions */}
                <div className="absolute left-3 right-20 bottom-4 z-20">
                  {reel.audio_track && (
                    <button 
                      onClick={() => { tap("light"); setSoundPageOpen(reel.audio_track) }}
                      className="flex items-center gap-1.5 mb-2 bg-black/40 backdrop-blur-md rounded-full px-3 py-1 w-max active:scale-95 transition-transform"
                    >
                      <Music size={12} className="text-white" />
                      <span className="text-white text-[11px] font-semibold truncate max-w-[120px]">{reel.audio_track.title}</span>
                    </button>
                  )}`,
'RD sound button'
);

// Render Sound Page
add(RD,
`      {shareFor && (`,
`      {soundPageOpen && (
        <ReelSoundPage track={soundPageOpen} onClose={() => setSoundPageOpen(null)} />
      )}

      {shareFor && (`,
'RD render sound page'
);

// ===== PREFLIGHT =====
console.log('--- preflight ---');
let ok = true;
const srcCache = {};
for (const e of edits) {
  if (!srcCache[e.FILE]) srcCache[e.FILE] = fs.readFileSync(e.FILE, 'utf8');
  const c = srcCache[e.FILE].split(e.from).length - 1;
  if (c === 0) { console.error(`\u274c MISSING in ${e.FILE}: ${e.label}`); ok = false; }
  else if (c > 1) { console.error(`\u274c NOT UNIQUE (${c}x) in ${e.FILE}: ${e.label}`); ok = false; }
  else { console.log(`\u2705 ok: ${e.label}`); }
}
if (!ok) { console.error('\n\u274c Preflight failed. Files untouched.'); process.exit(1); }

console.log('\n--- applying ---');
const applied = new Set();
for (const e of edits) {
  if (!applied.has(e.FILE)) { srcCache[e.FILE] = fs.readFileSync(e.FILE, 'utf8'); applied.add(e.FILE); }
  srcCache[e.FILE] = srcCache[e.FILE].replace(e.from, e.to);
  console.log(`\u2705 ${e.label}`);
}
for (const f of applied) fs.writeFileSync(f, srcCache[f]);
console.log(`\n\u2705 Done. ${edits.length} edits applied across ${applied.size} files.`);
