const fs = require('fs');

// 1. Read the old Monetization file
let mContent = fs.readFileSync('src/screens/Monetization.jsx', 'utf8');

// 2. Convert it into a reusable Dashboard component
mContent = mContent.replace(
  'export default function Monetization() {',
  'export default function CreatorDashboard({ myId }) {'
);

// Remove the fixed full-screen wrapper and replace with standard div
mContent = mContent.replace(
  /<div style=\{\{\s*position: 'fixed',[\s\S]*?overflow: 'hidden',\s*\}\}>/,
  '<div className="w-full flex flex-col">'
);

// Remove the Header (back button + Monetization title)
mContent = mContent.replace(
  /<header[\s\S]*?<\/header>/,
  ''
);

// Remove the scrollable container padding (since CreatorMode handles scrolling)
mContent = mContent.replace(
  '<div className="flex-1 overflow-y-auto px-5 py-5 pb-12">',
  '<div className="w-full py-2">'
);

fs.writeFileSync('src/components/CreatorDashboard.jsx', mContent);
console.log('✅ Copied and adapted Monetization.jsx into CreatorDashboard.jsx');

// 3. Patch CreatorMode.jsx to use the new component
let cMode = fs.readFileSync('src/screens/CreatorMode.jsx', 'utf8');

// Ensure the import is correct
if (!cMode.includes('CreatorDashboard')) {
  cMode = cMode.replace(
    'import CreatorOnboarding from \'./CreatorOnboarding\'',
    'import CreatorOnboarding from \'./CreatorOnboarding\'\nimport CreatorDashboard from "../components/CreatorDashboard"'
  );
}

// Replace the "Coming Soon" block with the Dashboard
const comingSoonRegex = /<div className="rounded-2xl bg-white\/\[0\.03\] border border-white\/8 p-4 mb-4">[\s\S]*?<\/div>\s*<\/div>/;
if (cMode.match(comingSoonRegex)) {
  cMode = cMode.replace(
    comingSoonRegex,
    '{myId && <CreatorDashboard myId={myId} />}'
  );
} else {
  // Fallback if regex fails, try string replace
  const oldBox = `<div className="flex flex-col gap-2">
          <SameRow text="Creator dashboard — reach, growth, audience" muted />
          <SameRow text="Moderation tools — comment filters, keyword blocks" muted />
          <SameRow text="Monetization eligibility" muted />
        </div>
      </div>`;
  cMode = cMode.replace(oldBox, '{myId && <CreatorDashboard myId={myId} />}');
}

// Ensure ActiveView receives myId
cMode = cMode.replace(
  'function ActiveView({ onTurnOff, category, onEditCategory }) {',
  'function ActiveView({ onTurnOff, category, onEditCategory, myId }) {'
);
cMode = cMode.replace(
  '<ActiveView onTurnOff={() => setShowConfirmOff(true)}',
  '<ActiveView myId={myId} onTurnOff={() => setShowConfirmOff(true)}'
);

fs.writeFileSync('src/screens/CreatorMode.jsx', cMode);
console.log('✅ Connected CreatorDashboard to CreatorMode.jsx');
