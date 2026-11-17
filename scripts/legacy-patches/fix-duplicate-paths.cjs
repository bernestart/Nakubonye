const fs = require('fs');

const files = [
  'src/screens/CreateService.jsx',
  'src/screens/CreateGroup.jsx',
  'src/screens/CreateListing.jsx',
  'src/screens/Chat.jsx',
  'src/screens/EditGroup.jsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');
  
  // Regex looks for: const path = `...`; \n const path = await uploadMedia(...)
  // OR: const path = "..."; \n const path = await uploadMedia(...)
  const duplicateRegex = /const\s+path\s*=\s*[`"'][^`"']+[`"'];?\s*\n\s*const\s+path\s*=\s*await\s+uploadMedia\(([^)]+)\);?/g;
  
  if (duplicateRegex.test(code)) {
    code = code.replace(duplicateRegex, 'const path = await uploadMedia($1);');
    fs.writeFileSync(file, code);
    console.log(`✅ Removed duplicate path in ${file}`);
  }
});
console.log("🎉 Cleanup done!");
