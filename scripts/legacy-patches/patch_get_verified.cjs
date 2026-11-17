const fs = require('fs');
const file = 'src/screens/ProfileSettings.jsx';
let content = fs.readFileSync(file, 'utf8');

const anchor = `<MenuRow icon={<User size={18} />} label="Account" to="/settings/account" nav={nav} />`;
const newRow = `<MenuRow icon={<User size={18} />} label="Account" to="/settings/account" nav={nav} />
              <MenuRow icon={<ShieldCheck size={18} />} label="Get verified" to="/verify" nav={nav} />`;

if (content.includes(anchor) && !content.includes('label="Get verified" to="/verify"')) {
  content = content.replace(anchor, newRow);
  fs.writeFileSync(file, content);
  console.log('✅ Moved "Get verified" into Settings > Account');
} else {
  console.log('⚠️ Anchor missing or already patched.');
}
