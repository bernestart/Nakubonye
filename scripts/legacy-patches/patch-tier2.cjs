const fs = require('fs');

// ── 1. BRUTE FORCE COMMUNITY CHAT UI ──
const ccPath = 'src/components/CommunityChat.jsx';
let cc = fs.readFileSync(ccPath, 'utf8');

// Find the entire input block starting from the Emoji button
// We will replace the whole bottom bar with a strict ternary: 
// If recording -> Voice Bar. Else -> Text Input + Emoji + Mic.
// (Note: We will use a regex that matches from `{voice.recording ? (` down to the end of the input bar)
const voiceBarRegex = /\{voice\.recording \? \(([\s\S]*?)\n\s*\) : \(([\s\S]*?)\)\}/g;

// Since the current code is broken with duplicate classNames, let's just fix the duplicate className first
cc = cc.replace(/<textarea className=\{voice\.recording \? 'hidden' : ''\}[\s\S]*?className="([^"]*)"/g, 
  `<textarea className={\`\${voice.recording ? 'hidden' : ''} \${"$1"}\`}`
);

// Ensure the Emoji button and Textarea are hidden when recording
// Find the emoji button and add a conditional hide
cc = cc.replace(/<button([\s\S]*?)aria-label="Emoji"([\s\S]*?)>/g, 
  `<button className={voice.recording ? 'hidden' : ''} $1 aria-label="Emoji" $2>`
);

fs.writeFileSync(ccPath, cc);
console.log('✅ CommunityChat.jsx: UI hidden properly');

// ── 2. PROFILE POST CARD IMAGE INSPECTION ──
const ppcPath = 'src/components/ProfilePostCard.jsx';
if (fs.existsSync(ppcPath)) {
  let ppc = fs.readFileSync(ppcPath, 'utf8');
  console.log('\n🔍 --- ProfilePostCard.jsx Image Handling ---');
  
  // Extract lines with image_url, image_paths, or <img
  ppc.split('\n').forEach((line, i) => {
    if (line.includes('image') || line.includes('<img')) {
      console.log(`Line ${i+1}: ${line.trim()}`);
    }
  });
}
