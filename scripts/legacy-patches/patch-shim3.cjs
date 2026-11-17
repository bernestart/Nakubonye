const fs = require('fs');
const p = 'src/lib/lucide-shim.jsx';
let s = fs.readFileSync(p, 'utf8');

// Add missing Phosphor imports
const newImports = `  FlipVertical as PhFlipVertical,
  Megaphone as PhMegaphone,
  MagicWand as PhMagicWand,
  ArrowClockwise as PhArrowClockwise2,
  Scroll as PhScroll,
`;
const closeImport = `} from '@phosphor-icons/react'`;
const impIdx = s.indexOf(closeImport);
if (impIdx === -1) { console.error('❌ import close not found'); process.exit(1); }
s = s.slice(0, impIdx) + newImports + s.slice(impIdx);

// Append missing shim exports
const newExports = `
export const FlipVertical = shim(PhFlipVertical)
export const Megaphone = shim(PhMegaphone)
export const Wand2 = shim(PhMagicWand)
export const RotateCw = shim(PhArrowClockwise2)
export const ScrollText = shim(PhScroll)
`;
s = s.trimEnd() + '\n' + newExports;

fs.writeFileSync(p, s);
console.log('✅ lucide-shim.jsx patched');
