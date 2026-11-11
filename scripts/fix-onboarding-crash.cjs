const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/screens/CreatorOnboarding.jsx');
let src = fs.readFileSync(file, 'utf8');

// Fix the Sparkles wrapper crash
src = src.replace(/<Sparkles>(.*?)<\/Sparkles>/g, '<h2 className="text-cream font-extrabold text-[22px] text-center mb-2">$1</h2>');

// Check if Sub, SectionTitle, and Row exist at the bottom of the file
const missingComponents = [];
if (!src.includes('function Sub(')) missingComponents.push('Sub');
if (!src.includes('function SectionTitle(')) missingComponents.push('SectionTitle');
if (!src.includes('function Row(')) missingComponents.push('Row');

if (missingComponents.length > 0) {
  console.log('⚠️ WARNING: These components are missing definitions:', missingComponents.join(', '));
  // We will append them to the bottom of the file so it doesn't crash
  let appendage = '\n\n// --- Auto-generated missing UI components ---\n';
  if (!src.includes('function Sub(')) {
    appendage += 'function Sub({ children }) { return <p className="text-muted text-[13.5px] leading-relaxed text-center mb-6">{children}</p> }\n';
  }
  if (!src.includes('function SectionTitle(')) {
    appendage += 'function SectionTitle({ children }) { return <h3 className="text-cream font-bold text-[15px] mb-4">{children}</h3> }\n';
  }
  if (!src.includes('function Row(')) {
    appendage += 'function Row({ icon, title }) { return <div className="flex items-center gap-3 mb-3 text-cream"><span className="text-purple-400">{icon}</span><span className="text-[14px]">{title}</span></div> }\n';
  }
  src += appendage;
  console.log('✅ Appended missing components to the bottom of the file.');
}

fs.writeFileSync(file, src);
console.log('✅ CreatorOnboarding.jsx: Replaced <Sparkles> text wrappers with <h2> tags.');
