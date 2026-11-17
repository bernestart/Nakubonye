const fs = require('fs');

const chatFiles = [
  'src/screens/Chat.jsx', 
  'src/screens/GroupChat.jsx', 
  'src/components/CommunityChat.jsx'
];

chatFiles.forEach(p => {
  if (!fs.existsSync(p)) return;
  let f = fs.readFileSync(p, 'utf8');
  let changed = false;

  // 1. LOCK THE RECORDING CONTAINER
  // Finds the dark recording bar and forces it to not expand past the screen
  const containerRegex = /className="([^"]*bg-\[#1C1C1E\][^"]*)"/g;
  f = f.replace(containerRegex, (match, classes) => {
    if (!classes.includes('min-w-0')) {
      changed = true;
      return `className="${classes} flex-1 min-w-0 overflow-hidden"`;
    }
    return match;
  });

  // 2. LOCK THE WAVEFORM
  // Finds the waveform flexbox and stops it from pushing the send button out
  const waveRegex = /className="([^"]*flex-1 h-6[^"]*)"/g;
  f = f.replace(waveRegex, (match, classes) => {
    if (!classes.includes('overflow-hidden')) {
      changed = true;
      return `className="${classes} min-w-0 overflow-hidden"`;
    }
    return match;
  });

  // 3. LOCK BUTTONS (Trash, Send, ViewOnce "1")
  // Prevents them from squishing or moving horizontally
  const btnRegex = /className="([^"]*text-red-500[^"]*| [^"]*text-purple-500[^"]*| [^"]*rounded-full[^"]*)"/g;
  f = f.replace(btnRegex, (match, classes) => {
    if (!classes.includes('shrink-0')) {
      changed = true;
      return `className="${classes} shrink-0"`;
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(p, f);
    console.log('✅ ' + p + ': Voice UI locked solid');
  } else {
    console.log('⏭ ' + p + ': Voice UI already solid');
  }
});

// 3. FIX TDZ CRASH IN COMMUNITY FEED (Since this is where it actually lives)
const communityFiles = ['src/screens/CommunityView.jsx', 'src/components/CommunityFeed.jsx'];
communityFiles.forEach(p => {
  if (fs.existsSync(p)) {
    let f = fs.readFileSync(p, 'utf8');
    if (f.includes('PostCommentsSheet') && !f.includes('lazy(')) {
      f = f.replace(/import\s+PostCommentsSheet\s+from\s+["'].*PostCommentsSheet["'];?/g, `import { lazy, Suspense } from "react";\nconst PostCommentsSheet = lazy(() => import("../components/PostCommentsSheet"));`);
      f = f.replace(/<PostCommentsSheet([\s\S]*?)>/g, `<Suspense fallback={null}><PostCommentsSheet$1>`);
      f = f.replace(/<\/PostCommentsSheet>/g, `</PostCommentsSheet></Suspense>`);
      fs.writeFileSync(p, f);
      console.log('✅ ' + p + ': Fixed TDZ Crash (Lazy Loaded)');
    }
  }
});
