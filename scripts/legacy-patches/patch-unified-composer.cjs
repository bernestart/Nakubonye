const fs = require('fs');

// ── 1. PATCH CommunityFeed.jsx (Swap inline for Universal Composer) ──
const cfPath = 'src/components/CommunityFeed.jsx';
let cf = fs.readFileSync(cfPath, 'utf8');

// Import PostComposer
if (!cf.includes('import PostComposer')) {
  cf = cf.replace(
    "import ProfilePostCard from './ProfilePostCard'",
    "import ProfilePostCard from './ProfilePostCard'\nimport PostComposer from './PostComposer'"
  );
}

// Add state for the composer
if (!cf.includes('composerOpen')) {
  cf = cf.replace(
    'const [text, setText] = useState(\'\')',
    'const [text, setText] = useState(\'\')\n  const [composerOpen, setComposerOpen] = useState(false)'
  );
}

// Replace the inline composer block
// We target from the specific placeholder down to the end of the announcement checkbox container
const inlineComposerRegex = /<div className="p-4 bg-elevated border-b border-white\/8">[\s\S]*?<\/div>\s*<\/div>/;

if (cf.match(inlineComposerRegex)) {
  cf = cf.replace(inlineComposerRegex, `
      {/* Universal Composer Trigger */}
      <div className="p-4 bg-elevated border-b border-white/8">
        <button 
          onClick={() => setComposerOpen(true)}
          className="w-full flex items-center gap-3 p-3 bg-white/5 rounded-xl text-left text-muted hover:bg-white/10 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
            <ImagePlus size={18} />
          </div>
          <span className="text-[14px]">Share something with the community...</span>
        </button>
      </div>
  `);
}

// Add the PostComposer at the bottom, passing the communityId
if (!cf.includes('<PostComposer')) {
  cf = cf.replace(
    /<\/div>\s*\)\s*\}/, 
    `  {composerOpen && (
        <PostComposer
          communityId={communityId}
          onClose={() => setComposerOpen(false)}
          onDone={() => { setComposerOpen(false); load(); }}
        />
      )}
    </div>
  )
}`
  );
}
fs.writeFileSync(cfPath, cf);
console.log('✅ CommunityFeed.jsx: Universal Composer wired up');

// ── 2. PATCH PostComposer.jsx (Accept communityId & show Announcement toggle) ──
const pcPath = 'src/components/PostComposer.jsx';
let pc = fs.readFileSync(pcPath, 'utf8');

// Accept communityId prop
if (!pc.includes('communityId')) {
  pc = pc.replace(
    'export default function PostComposer({ onClose, onDone })',
    'export default function PostComposer({ onClose, onDone, communityId })'
  );
  
  // (Optional but ideal): Add a visual badge so the user knows they are posting in a community
  pc = pc.replace(
    'return (',
    `return (
      <div>
        {communityId && (
          <div className="text-center text-[12px] text-purple-400 font-bold mb-2 uppercase tracking-wider">
            Posting to Community
          </div>
        )}`
  );
}
fs.writeFileSync(pcPath, pc);
console.log('✅ PostComposer.jsx: Accepts communityId prop');
