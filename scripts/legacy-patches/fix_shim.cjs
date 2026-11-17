const fs = require('fs');
const file = 'src/lib/lucide-shim.jsx';
let content = fs.readFileSync(file, 'utf8');

// If they don't exist, inject them before the final closing brace or export
if (!content.includes('CheckCircle2')) {
  content += `\nexport const CheckCircle2 = (props) => <Check {...props} />; // Fallback to Check\n`;
}

if (!content.includes('Award')) {
  content += `\nexport const Award = (props) => <Star {...props} />; // Fallback to Star\n`;
}

fs.writeFileSync(file, content);
console.log('✅ Added CheckCircle2 and Award to lucide-shim.jsx');
