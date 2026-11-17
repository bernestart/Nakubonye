const fs = require('fs');

const fix = (file, broken, fixed) => {
  if (!fs.existsSync(file)) { console.log(`⚠️  ${file} not found`); return; }
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(broken)) {
    s = s.replace(broken, fixed);
    fs.writeFileSync(file, s);
    console.log(`✅ Fixed ${file}`);
  } else {
    console.log(`❌ Anchor not found in ${file}`);
  }
};

const fileTextSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
const downloadSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const hashSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`;
const fileTextSvg18 = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;

// DocBubble.jsx — two broken tags
fix(
  'src/components/chat/DocBubble.jsx',
  `< size={20} className={mine ? "text-white" : "text-purple-300"} />`,
  `<span className={mine ? "text-white" : "text-purple-300"} style={{ width: 20, height: 20, display: 'inline-block' }}>${fileTextSvg}</span>`
);

fix(
  'src/components/chat/DocBubble.jsx',
  `< size={18} className={mine ? "text-white/70" : "text-muted"} />`,
  `<span className={mine ? "text-white/70" : "text-muted"} style={{ width: 18, height: 18, display: 'inline-block' }}>${downloadSvg}</span>`
);

// HashtagPage.jsx — broken <ArrowLeft>? Check other files
// Look for other broken < size={N} usages across the 5 files
const targets = [
  'src/screens/HashtagPage.jsx',
  'src/screens/Chat.jsx',
  'src/screens/GroupChat.jsx',
  'src/components/CommunityChat.jsx',
];

for (const f of targets) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, 'utf8');
  let before = s;

  // Generic replacement: < size={18} .../> -> inline svg wrapped in span
  s = s.replace(/<\s*size=\{18\}\s*className=\{([^}]+)\}\s*\/>/g, (m, cls) => {
    return `<span className={${cls}} style={{ width: 18, height: 18, display: 'inline-block' }}>${fileTextSvg18}</span>`;
  });
  s = s.replace(/<\s*size=\{18\}\s*\/>/g, `<span style={{ width: 18, height: 18, display: 'inline-block' }}>${fileTextSvg18}</span>`);
  s = s.replace(/<\s*size=\{20\}\s*\/>/g, `<span style={{ width: 20, height: 20, display: 'inline-block' }}>${fileTextSvg}</span>`);

  if (s !== before) {
    fs.writeFileSync(f, s);
    console.log(`✅ Cleaned leftover broken tags in ${f}`);
  }
}
