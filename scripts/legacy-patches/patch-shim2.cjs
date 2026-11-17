const fs = require('fs');
const p = 'src/lib/lucide-shim.jsx';
let s = fs.readFileSync(p, 'utf8');

// 1. Activity → Pulse (Phosphor name)
if (!s.includes('Activity as PhActivity')) { console.error('❌ Activity import not found'); process.exit(1); }
s = s.replace('Activity as PhActivity,', 'Pulse as PhActivity,');

// 2. Add missing Phosphor imports
const newImports = `  ShieldSlash as PhShieldSlash,
  ArrowSquareOut as PhArrowSquareOut,
`;
const closeImport = `} from '@phosphor-icons/react'`;
const impIdx = s.indexOf(closeImport);
if (impIdx === -1) { console.error('❌ import close not found'); process.exit(1); }
s = s.slice(0, impIdx) + newImports + s.slice(impIdx);

// 3. Append missing shim exports
const newExports = `
export const UserMinus = shim(PhUserMinus)
export const ShieldOff = shim(PhShieldSlash)
export const ExternalLink = shim(PhArrowSquareOut)
`;
s = s.trimEnd() + '\n' + newExports;

fs.writeFileSync(p, s);
console.log('✅ lucide-shim.jsx patched');
