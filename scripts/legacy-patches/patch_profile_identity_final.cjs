const fs = require('fs');
const file = 'src/screens/ProfileView.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update the TierRing to show the Creator ring if account_type is creator
const oldRing = `<TierRing tier={person.tier || 'standard'} size={128}>`;
const newRing = `<TierRing tier={person.account_type === 'creator' ? 'creator' : (person.tier || 'standard')} size={128}>`;

if (content.includes(oldRing)) {
  content = content.replace(oldRing, newRing);
  console.log('✅ Avatar ring now switches to Creator style');
}

// 2. Clean up the Name block and inject the Category Label properly
const oldNameBlock = `<div className="flex items-center justify-center gap-1.5 mt-3 px-4">
            <h1 className="text-cream text-[22px] font-extrabold tracking-tight text-center">
              {person.display_name || person.username}
            </h1>
            {person.is_verified && (
              <span className="w-[16px] h-[16px] rounded-full bg-[#1DA1F2] grid place-items-center shrink-0">
                <span className="text-white text-[10px] font-black">✓</span>
              </span>
            )}
          </div>`;

// Note: If the previous patch modified this block, the exact string might be slightly different.
// We will use a regex that targets the entire flex container for the name.
const nameRegex = /<div className="flex items-center justify-center gap-1\.5 mt-3 px-4">[\s\S]*?<\/div>/;

const newNameBlock = `<div className="flex flex-col items-center justify-center mt-3 px-4">
            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-cream text-[22px] font-extrabold tracking-tight text-center">
                {person.display_name || person.username}
              </h1>
              {person.is_verified && (
                <span className="w-[16px] h-[16px] rounded-full bg-[#1DA1F2] grid place-items-center shrink-0">
                  <span className="text-white text-[10px] font-black">✓</span>
                </span>
              )}
            </div>
            {person.account_type === 'creator' && person.category_label && (
              <span className="text-purple-400 text-[11.5px] font-black tracking-widest uppercase mt-1">
                {person.category_label}
              </span>
            )}
          </div>`;

if (nameRegex.test(content)) {
  content = content.replace(nameRegex, newNameBlock);
  console.log('✅ Cleaned up Name block and added Category Label');
} else {
  console.error('❌ Could not find the name block. It might already be modified.');
}

fs.writeFileSync(file, content);
