const fs = require('fs');

// ── 1. FIX COMMENT CRASH (Feed & PostDetail) ──
['src/screens/Feed.jsx', 'src/screens/PostDetail.jsx'].forEach(p => {
  if (!fs.existsSync(p)) return;
  let f = fs.readFileSync(p, 'utf8');
  // Find self-closing PostCommentsSheet inside Suspense and add the missing closing tag
  f = f.replace(/(<Suspense fallback=\{null\}><PostCommentsSheet[\s\S]*?\/>)(?!<\/Suspense>)/g, '$1</Suspense>');
  fs.writeFileSync(p, f);
  console.log('✅ Fixed Suspense syntax in', p);
});

// ── 2. FIX VOICE RECORDER SYNTAX (Chat, GroupChat, CommunityChat) ──
['src/screens/Chat.jsx', 'src/screens/GroupChat.jsx', 'src/components/CommunityChat.jsx'].forEach(p => {
  if (!fs.existsSync(p)) return;
  let f = fs.readFileSync(p, 'utf8');
  // Remove the rogue comment that broke the ternary operator
  f = f.replace(/\{\/\* Meta-Style Recording Bar \*\/\}\n\s*/g, '');
  f = f.replace(/\{\/\* Meta-Style Recording Bar \*\/\}/g, '');
  fs.writeFileSync(p, f);
  console.log('✅ Fixed voice recorder syntax in', p);
});
