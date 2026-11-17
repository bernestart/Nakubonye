#!/usr/bin/env node
const fs = require('fs');

const FILES = [
  'src/screens/HashtagPage.jsx',
  'src/components/chat/DocBubble.jsx',
  'src/screens/Chat.jsx',
  'src/screens/GroupChat.jsx',
  'src/components/CommunityChat.jsx',
];

// Inline SVG replacements
const hashSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`;
const fileTextSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
const downloadSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, 'utf8');
  let changed = false;

  // Remove Hash from import if present
  if (s.includes('Hash')) {
    s = s.replace(/,\s*Hash\s*/g, '').replace(/Hash\s*,\s*/g, '').replace(/\bHash\b/g, '');
    changed = true;
  }
  // Remove Download from import
  if (s.includes('Download')) {
    s = s.replace(/,\s*Download\s*/g, '').replace(/Download\s*,\s*/g, '').replace(/\bDownload\b/g, '');
    changed = true;
  }
  // Remove FileText from import
  if (s.includes('FileText')) {
    s = s.replace(/,\s*FileText\s*/g, '').replace(/FileText\s*,\s*/g, '').replace(/\bFileText\b/g, '');
    changed = true;
  }

  // Replace JSX usages
  s = s.replace(/<Hash[^>]*\/>/g, hashSvg);
  s = s.replace(/<FileText[^>]*\/>/g, fileTextSvg);
  s = s.replace(/<Download[^>]*\/>/g, downloadSvg);

  if (changed) {
    fs.writeFileSync(f, s);
    console.log(`✅ Patched ${f}`);
  }
}
