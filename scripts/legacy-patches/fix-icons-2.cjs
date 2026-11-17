#!/usr/bin/env node
const fs = require('fs');

const hashSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`;
const fileTextSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
const downloadSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

const fixes = {
  'src/components/chat/DocBubble.jsx': {
    20: fileTextSvg,
    18: downloadSvg
  },
  'src/screens/HashtagPage.jsx': {
    18: hashSvg
  },
  'src/screens/Chat.jsx': {
    18: fileTextSvg
  },
  'src/screens/GroupChat.jsx': {
    18: fileTextSvg
  },
  'src/components/CommunityChat.jsx': {
    18: fileTextSvg
  },
};

for (const [file, sizeMap] of Object.entries(fixes)) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Regex to match: < size={20} className="..." /> OR < size={20} />
  const regex = /<\s*size=\{(\d+)\}(?:\s+className="([^"]*)")?\s*\/>/g;
  
  s = s.replace(regex, (match, size, className) => {
    changed = true;
    const svg = sizeMap[parseInt(size, 10)];
    if (!svg) return match; // Fallback if size not in map
    if (className) {
      return `<span className="${className}">${svg}</span>`;
    }
    return svg;
  });

  // Handle the case where it was < size={18} className={"..."} />
  const regex2 = /<\s*size=\{(\d+)\}(?:\s+className=\{"([^"]*)"\})?\s*\/>/g;
  s = s.replace(regex2, (match, size, className) => {
    changed = true;
    const svg = sizeMap[parseInt(size, 10)];
    if (!svg) return match;
    if (className) {
      return `<span className="${className}">${svg}</span>`;
    }
    return svg;
  });

  if (changed) {
    fs.writeFileSync(file, s);
    console.log(`✅ Fixed ${file}`);
  }
}
