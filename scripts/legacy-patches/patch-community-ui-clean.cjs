const fs = require('fs');
const ccPath = 'src/components/CommunityChat.jsx';
let cc = fs.readFileSync(ccPath, 'utf8');

// ── 1. FIX THE DUPLICATE CLASSNAME ON SEARCH BUTTON ──
cc = cc.replace(
  /<button className=\{voice\.recording \? 'hidden' : ''\}\s+className=\{voice\.recording \? 'hidden' : ''\}/g,
  `<button className={voice.recording ? 'hidden' : ''}`
);

// ── 2. FIX THE DUPLICATE CLASSNAME ON THE TEXTAREA ──
// (Replaces the messy template literal with a clean single className)
cc = cc.replace(
  /<textarea className=\{`\$\{voice\.recording \? 'hidden' : ''\} \$\{"flex-1 bg-elevated[^`]*"\}`\}/g,
  `<textarea className={voice.recording ? 'hidden' : 'flex-1 bg-elevated border border-white/8 rounded-[22px] px-4 py-2.5 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500 resize-none max-h-28'}`
);

// ── 3. ENSURE THE EMOJI BUTTON HIDES CORRECTLY ──
// (If it has a duplicate class, fix it)
cc = cc.replace(
  /className=\{voice\.recording \? 'hidden' : ''\}\s+className="w-10 h-10/g,
  `className={voice.recording ? 'hidden' : 'w-10 h-10'}`
);

fs.writeFileSync(ccPath, cc);
console.log('✅ CommunityChat.jsx: Duplicate classNames removed, Textarea hidden properly.');
