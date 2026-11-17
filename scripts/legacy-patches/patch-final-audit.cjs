const fs = require('fs');

// ── 1. FIX SAFE AREA FALLBACK (Force to 0) ──
const saPath = 'src/lib/useSafeArea.js';
if (fs.existsSync(saPath)) {
  let sa = fs.readFileSync(saPath, 'utf8');
  // Strip out any isAndroid ? 32 : 0 logic
  sa = sa.replace(/isAndroid \? 32 : 0/g, '0');
  sa = sa.replace(/isAndroid \? 32/g, '0');
  fs.writeFileSync(saPath, sa);
  console.log('✅ useSafeArea.js: Forced 0px fallback');
}

// ── 2. FIX COMMUNITY FEED TDZ CRASH ──
const cfPath = 'src/components/CommunityFeed.jsx';
if (fs.existsSync(cfPath)) {
  let cf = fs.readFileSync(cfPath, 'utf8');
  if (cf.includes('PostCommentsSheet') && !cf.includes('lazy(')) {
    cf = cf.replace(/import\s+PostCommentsSheet\s+from\s+["'].*PostCommentsSheet["'];?/g, `import { lazy, Suspense } from "react";\nconst PostCommentsSheet = lazy(() => import("./PostCommentsSheet"));`);
    // Fix the tags
    cf = cf.replace(/<PostCommentsSheet([\s\S]*?)>/g, `<Suspense fallback={null}><PostCommentsSheet$1>`);
    cf = cf.replace(/<\/PostCommentsSheet>/g, `</PostCommentsSheet></Suspense>`);
    // Handle self-closing tags
    cf = cf.replace(/(<Suspense fallback=\{null\}><PostCommentsSheet[\s\S]*?\/>)(?!<\/Suspense>)/g, '$1</Suspense>');
    
    fs.writeFileSync(cfPath, cf);
    console.log('✅ CommunityFeed.jsx: Fixed TDZ Crash (Lazy Loaded)');
  } else {
    console.log('⏭ CommunityFeed.jsx: Already lazy or not found');
  }
}
