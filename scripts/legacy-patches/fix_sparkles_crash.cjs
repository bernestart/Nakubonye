const fs = require('fs');
const file = 'src/screens/Preview.jsx';
let content = fs.readFileSync(file, 'utf8');

// Add Sparkles to the lucide-react import safely
if (!content.includes('Sparkles')) {
  content = content.replace(
    /import \{([^}]+)\} from ['"]lucide-react['"]/,
    (match, p1) => {
      return `import { ${p1}, Sparkles } from "lucide-react"`;
    }
  );
  fs.writeFileSync(file, content);
  console.log('✅ Added Sparkles import to Preview.jsx');
} else {
  console.log('✅ Sparkles already imported');
}
