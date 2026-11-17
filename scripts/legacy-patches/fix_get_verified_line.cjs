const fs = require('fs');
const file = 'src/screens/ProfileSettings.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

let inserted = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('label="Account"')) {
    // Check if it's already there to prevent duplicates
    if (!lines.slice(i, i + 5).some(l => l.includes('Get verified'))) {
      const indent = lines[i].match(/^\s*/)[0]; // Preserve indentation
      lines.splice(i + 1, 0, `${indent}<MenuRow icon={<ShieldCheck size={18} />} label="Get verified" to="/verify" nav={nav} />`);
      inserted = true;
    }
    break;
  }
}

if (inserted) {
  fs.writeFileSync(file, lines.join('\n'));
  console.log('✅ Successfully inserted "Get verified" under Account in Settings');
} else {
  console.log('⚠️ Could not find the "Account" line. It might already be patched.');
}
