const fs = require('fs');
const p = 'src/lib/lucide-shim.jsx';
let s = fs.readFileSync(p, 'utf8');

const newImports = `  Record as PhRecord,
`;
const closeImport = `} from '@phosphor-icons/react'`;
const impIdx = s.indexOf(closeImport);
if (impIdx === -1) { console.error('❌ import close not found'); process.exit(1); }
s = s.slice(0, impIdx) + newImports + s.slice(impIdx);

s = s.trimEnd() + `
export const CircleDot = shim(PhRecord)
`;

fs.writeFileSync(p, s);
console.log('✅ CircleDot added');
