const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/screens/ProfileSettings.jsx');
let src = fs.readFileSync(file, 'utf8');

// 1. Remove the entire standalone rows block
const startMarker = '        {/* Standalone rows above grid — Facebook pattern */}';
const endMarker = '        {/* Feature tile grid — NO label */}';
const startIndex = src.indexOf(startMarker);
const endIndex = src.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("❌ Could not find standalone rows block. Aborting.");
  process.exit(1);
}

src = src.substring(0, startIndex) + src.substring(endIndex);
console.log("✅ Removed standalone rows (actions, sub-features, and duplicate Saved)");

// 2. Fix duplicate "Get verified" rows in Settings
const verifiedRow = '<MenuRow icon={<ShieldCheck size={18} />} label="Get verified" to="/verify" nav={nav} />';
// Remove all instances of the row
src = src.split(verifiedRow).join('');
// Add it back exactly once, right under "Account"
src = src.replace(
  '<MenuRow icon={<User size={18} />} label="Account" to="/settings/account" nav={nav} />',
  '<MenuRow icon={<User size={18} />} label="Account" to="/settings/account" nav={nav} />\n          ' + verifiedRow
);
console.log("✅ Fixed duplicate 'Get verified' rows");

fs.writeFileSync(file, src);
