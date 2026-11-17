const fs = require('fs');
const file = 'src/screens/Preview.jsx';
let content = fs.readFileSync(file, 'utf8');

// Update the button condition to check profile?.account_type as well
content = content.replace(
  "{accountType === 'creator' && (",
  "{(accountType === 'creator' || profile?.account_type === 'creator') && ("
);

fs.writeFileSync(file, content);
console.log('✅ Updated Dashboard button to use profile.account_type fallback');
