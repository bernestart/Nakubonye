const fs = require('fs');

function mergeLucideImports(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  const lucideLines = [];
  const otherLines = [];

  lines.forEach(line => {
    if (line.includes('from "lucide-react"') || line.includes("from 'lucide-react'")) {
      lucideLines.push(line);
    } else {
      otherLines.push(line);
    }
  });

  if (lucideLines.length === 0) return;

  // Extract all icon names
  const icons = new Set();
  lucideLines.forEach(line => {
    const match = line.match(/\{([^}]+)\}/);
    if (match) {
      match[1].split(',').forEach(icon => {
        const trimmed = icon.trim();
        if (trimmed) icons.add(trimmed);
      });
    }
  });

  // Create the single merged import line
  const mergedLine = `import { ${Array.from(icons).join(', ')} } from "lucide-react";`;
  
  // Reconstruct the file: merged import + all other original lines
  const finalLines = [mergedLine, ...otherLines];
  fs.writeFileSync(file, finalLines.join('\n'));
  console.log(`✅ Merged imports in ${file}`);
}

mergeLucideImports('src/components/PostCommentsSheet.jsx');
mergeLucideImports('src/components/StoryComposer.jsx');
