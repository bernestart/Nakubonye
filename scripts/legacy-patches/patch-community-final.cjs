const fs = require('fs');

// ── 1. FIX TDZ CRASH IN COMMUNITY VIEW (Lazy Load Tree) ──
const cvPath = 'src/screens/CommunityView.jsx';
if (fs.existsSync(cvPath)) {
  let cv = fs.readFileSync(cvPath, 'utf8');
  if (!cv.includes('lazy(')) {
    cv = cv.replace(/import CommunityFeed from ['"].*CommunityFeed['"];?/g, `import { lazy, Suspense } from 'react';\nconst CommunityFeed = lazy(() => import('../components/CommunityFeed'));`);
    cv = cv.replace(/import CommunityChat from ['"].*CommunityChat['"];?/g, `const CommunityChat = lazy(() => import('../components/CommunityChat'));`);
    cv = cv.replace(/<CommunityFeed([\s\S]*?)\/>/g, `<Suspense fallback={<div className="p-8 text-center text-muted">Loading feed...</div>}><CommunityFeed$1/></Suspense>`);
    cv = cv.replace(/<CommunityChat([\s\S]*?)\/>/g, `<Suspense fallback={<div className="p-8 text-center text-muted">Loading chat...</div>}><CommunityChat$1/></Suspense>`);
    fs.writeFileSync(cvPath, cv);
    console.log('✅ CommunityView.jsx: Lazy Loaded (TDZ Crash Fixed)');
  }
}

// ── 2. FORCE META UI IN COMMUNITY CHAT (Hide the input box) ──
const ccPath = 'src/components/CommunityChat.jsx';
if (fs.existsSync(ccPath)) {
  let cc = fs.readFileSync(ccPath, 'utf8');
  // Force the textarea to hide when recording
  cc = cc.replace(/<textarea([\s\S]*?)>/g, `<textarea className={voice.recording ? 'hidden' : ''} $1>`);
  // Force the start button to hide when recording
  cc = cc.replace(/<button([\s\S]*?)onClick=\{startVoice\}/g, `<button className={voice.recording ? 'hidden' : ''} $1 onClick={startVoice}`);
  fs.writeFileSync(ccPath, cc);
  console.log('✅ CommunityChat.jsx: Voice Note UI forced to replace text input');
}
