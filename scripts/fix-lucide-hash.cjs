const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/lib/lucide-shim.jsx');

if (!fs.existsSync(file)) { console.error('🛑 ABORT: lucide-shim.jsx not found'); process.exit(1); }
let src = fs.readFileSync(file, 'utf8');

if (src.includes('export const Hash =')) { console.log('✅ Hash already exists.'); process.exit(0); }

if (!src.includes('Hash as PhHash')) {
  src = src.replace("Record as PhRecord,", "Record as PhRecord,\n  Hash as PhHash,");
}
src = src.replace("export const CircleDot = shim(PhRecord)", "export const CircleDot = shim(PhRecord)\nexport const Hash = shim(PhHash)");

fs.writeFileSync(file, src);
console.log('✅ Added Hash icon to lucide-shim.jsx');
