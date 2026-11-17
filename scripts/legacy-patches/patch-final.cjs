const fs = require('fs');

// ── 1. FIX TDZ CRASH IN COMMUNITY FEED ──
const communityFiles = ['src/screens/CommunityView.jsx', 'src/components/CommunityFeed.jsx'];
communityFiles.forEach(p => {
  if (fs.existsSync(p)) {
    let f = fs.readFileSync(p, 'utf8');
    // Only patch if it imports PostCommentsSheet and isn't lazy loaded yet
    if (f.includes('PostCommentsSheet') && !f.includes('lazy(')) {
      f = f.replace(/import\s+PostCommentsSheet\s+from\s+["'].*PostCommentsSheet["'];?/g, `import { lazy, Suspense } from "react";\nconst PostCommentsSheet = lazy(() => import("../components/PostCommentsSheet"));`);
      f = f.replace(/<PostCommentsSheet([\s\S]*?)>/g, `<Suspense fallback={null}><PostCommentsSheet$1>`);
      f = f.replace(/<\/PostCommentsSheet>/g, `</PostCommentsSheet></Suspense>`);
      fs.writeFileSync(p, f);
      console.log('✅ ' + p + ': Fixed TDZ Crash (Lazy Loaded)');
    }
  }
});

// ── 2. FIX VOICE RECORDER UI (LOCK IT SOLID) ──
// We add `min-w-0` to the parent, and `shrink-0` to icons to stop horizontal push/swipe
const chatFiles = ['src/screens/Chat.jsx', 'src/screens/GroupChat.jsx', 'src/components/CommunityChat.jsx'];
chatFiles.forEach(p => {
  if (fs.existsSync(p)) {
    let f = fs.readFileSync(p, 'utf8');
    
    // The main recording bar container
    f = f.replace(
      /className="flex-1 flex items-center gap-3 bg-\[#1C1C1E\] border border-white\/10 rounded-\[22px\] px-4 h-11"/g,
      'className="flex-1 min-w-0 flex items-center gap-2 bg-[#1C1C1E] border border-white/10 rounded-[22px] px-3 h-11 overflow-hidden"'
    );

    // The waveform container (add min-w-0 and overflow-hidden so it doesn't push the send button out)
    f = f.replace(
      /className="flex-1 h-6 flex items-center justify-center gap-\[3px\]"/g,
      'className="flex-1 min-w-0 h-6 flex items-center justify-center gap-[2px] overflow-hidden"'
    );

    // Trash Icon button
    f = f.replace(
      /className="text-red-500 hover:text-red-400"/g,
      'className="text-red-500 hover:text-red-400 shrink-0"'
    );

    // Timer text
    f = f.replace(
      /className="text-white text-\[13.5px\] font-mono font-semibold"/g,
      'className="text-white text-[13px] font-mono font-semibold shrink-0"'
    );

    // Red dot
    f = f.replace(
      /className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"/g,
      'className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"'
    );

    // Send button
    f = f.replace(
      /className="text-purple-500 hover:text-purple-400"/g,
      'className="text-purple-500 hover:text-purple-400 shrink-0"'
    );

    fs.writeFileSync(p, f);
    console.log('✅ ' + p + ': Locked Voice Recorder UI');
  }
});
