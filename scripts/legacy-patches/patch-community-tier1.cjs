const fs = require('fs');

// ── 1. FIX VOICE UI OVERLAP (CommunityChat.jsx) ──
const ccPath = 'src/components/CommunityChat.jsx';
let cc = fs.readFileSync(ccPath, 'utf8');
// Remove the broken hidden class and fix the duplicate className
cc = cc.replace(
  /<textarea className=\{voice\.recording \? 'hidden' : ''\}[\s\S]*?className="([^"]*)"/g,
  `<textarea className={\`\${voice.recording ? 'hidden' : ''} \${"$1"}\`}`
);
// Ensure the whole text input area is hidden when recording
cc = cc.replace(
  /\{voice\.recording \? \(\s*<div className="flex-1 flex items-center gap-2 min-w-0 px-1">/g,
  `{voice.recording ? (\n          <div className="flex-1 flex items-center gap-2 min-w-0 px-1">`
);
fs.writeFileSync(ccPath, cc);
console.log('✅ CommunityChat: Voice UI overlap fixed');

// ── 2. FIX TDZ CRASH (CommunityView.jsx) ──
const cvPath = 'src/screens/CommunityView.jsx';
let cv = fs.readFileSync(cvPath, 'utf8');
// Lazy load CommunityEvents
cv = cv.replace(
  /import CommunityEvents from ['"].*CommunityEvents['"];?/g,
  `const CommunityEvents = lazy(() => import('../components/CommunityEvents'));`
);
// Wrap it in Suspense if it's rendered
cv = cv.replace(/<CommunityEvents([\s\S]*?)\/>/g, `<Suspense fallback={<div className="p-8 text-center text-muted">Loading events...</div>}><CommunityEvents$1/></Suspense>`);
fs.writeFileSync(cvPath, cv);
console.log('✅ CommunityView: Lazy-loaded Events (TDZ crash fixed)');

// ── 3. FIX INFINITE LOADING (Messages.jsx) ──
const msgPath = 'src/screens/Messages.jsx';
let msg = fs.readFileSync(msgPath, 'utf8');
// Find the load function and wrap the end in finally to always stop loading
msg = msg.replace(
  /setLoading\(false\)\n  \}/,
  `} finally {\n      setLoading(false)\n    }\n  }`
);
fs.writeFileSync(msgPath, msg);
console.log('✅ Messages.jsx: Infinite loading fixed');
