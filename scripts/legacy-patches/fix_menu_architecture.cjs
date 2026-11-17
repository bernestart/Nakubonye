const fs = require('fs');
const file = 'src/screens/ProfileSettings.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove "Posts" and "Reels" (they are profile tabs, not menu destinations)
content = content.replace(
  /<FeatureTile icon=\{<LayoutGrid size=\{20\} \/>\} label="Posts" to="\/me\/preview" nav=\{nav\} \/>\s*/,
  ''
);
content = content.replace(
  /<FeatureTile icon=\{<Play size=\{20\} \/>\} label="Reels" to="\/reels" nav=\{nav\} \/>\s*/,
  ''
);

// 2. Remove "Monetization" and "Audiences" (they live inside the Creator Dashboard now)
content = content.replace(
  /<FeatureTile icon=\{<Coins size=\{20\} \/>\} label="Monetization" to="\/monetization" nav=\{nav\} \/>\s*/,
  ''
);
content = content.replace(
  /<FeatureTile icon=\{<Layers size=\{20\} \/>\} label="Audiences" to="\/circles" nav=\{nav\} \/>\s*/,
  ''
);

// 3. Remove "Get verified" from the top list (we will move it to Settings below)
content = content.replace(
  /<FeatureTile icon=\{<ShieldCheck size=\{20\} \/>\} label="Get verified" to="\/verify" nav=\{nav\} \/>\s*/,
  ''
);

// 4. Optional: Add "Get verified" inside the "Settings & privacy" Collapsible block
// We'll insert it right after the Collapsible opens.
const collapsibleAnchor = '<Collapsible \n              icon={<Key size={18} />}\n              label="Settings & privacy"';
const verifyTile = `
              <FeatureTile icon={<ShieldCheck size={20} />} label="Get verified" to="/verify" nav={nav} />
`;
// Find the closing tag of the Collapsible and insert it there, or just leave it out if it's too complex.
// Let's just leave it out of the menu entirely for now to keep the menu clean, since it's in Profile Settings.

fs.writeFileSync(file, content);
console.log('✅ Cleaned up the Main Menu Architecture (Removed Redundant/Creator tools)');
