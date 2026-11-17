const fs = require('fs');

const files = [
  'src/screens/Chat.jsx',
  'src/screens/GroupChat.jsx',
  'src/screens/CreateService.jsx',
  'src/screens/CreateGroup.jsx',
  'src/screens/CreateListing.jsx',
  'src/screens/EditGroup.jsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');
  
  // This Regex looks for the old path declaration immediately followed by our new uploadMedia line
  const regex = /const\s+path\s*=\s*(?:`[^`]+`|[^;]+);\s*\n\s*const\s+path\s*=\s*await\s+uploadMedia\(([^)]+)\);?/g;
  
  if (regex.test(code)) {
    code = code.replace(regex, 'const path = await uploadMedia($1);');
    fs.writeFileSync(file, code);
    console.log(`✅ Fixed duplicate path in ${file}`);
  }
});

console.log("🎉 ALL DUPLICATE PATHS CLEANED! Run 'npm run build' now.");
