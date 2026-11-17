const fs = require('fs');
const p = 'src/screens/ProfileSettings.jsx';
let s = fs.readFileSync(p, 'utf8');

// 1. Add Sparkles to lucide import (if not already there)
const im = s.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/)
if (!im) { console.error('❌ lucide import not found'); process.exit(1); }
const names = im[1].split(',').map(x => x.trim())
if (!names.includes('Sparkles')) {
  names.push('Sparkles')
  s = s.replace(im[0], `import { ${names.join(', ')} } from 'lucide-react'`)
  console.log('✅ Sparkles added to lucide import')
} else {
  console.log('ℹ️  Sparkles already imported')
}

// 2. Add Creator mode MenuRow after Account
const find = `          <MenuRow icon={<User size={18} />} label="Account" to="/settings/account" nav={nav} />`
const replace = `          <MenuRow icon={<User size={18} />} label="Account" to="/settings/account" nav={nav} />
          <MenuRow icon={<Sparkles size={18} />} label="Creator mode" to="/settings/creator" nav={nav} />`
if (!s.includes(find)) { console.error('❌ Account menu row not found'); process.exit(1); }
s = s.replace(find, replace);
console.log('✅ Creator mode menu row added');

fs.writeFileSync(p, s);
console.log('✅ ProfileSettings.jsx patched');
