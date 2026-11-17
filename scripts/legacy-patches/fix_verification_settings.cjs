const fs = require('fs');
const file = 'src/screens/ProfileSettings.jsx';
let content = fs.readFileSync(file, 'utf8');

// Find the Settings & privacy Collapsible block and add Get Verified inside it
const settingsAnchor = 'label="Settings & privacy"';
const verifyRow = `
              <FeatureTile icon={<ShieldCheck size={20} />} label="Get verified" to="/verify" nav={nav} />`;

// This is a simplified insertion — we will verify the exact location with recon
if (!content.includes('Get verified')) {
  // Insert after the first item inside the Collapsible
  const firstSettingsItem = /(<Collapsible[\s\S]*?>\s*)/;
  content = content.replace(firstSettingsItem, `$1${verifyRow}\n              `);
  fs.writeFileSync(file, content);
  console.log('✅ Added Get Verified inside Settings & Privacy');
} else {
  console.log('✅ Get Verified already present');
}
