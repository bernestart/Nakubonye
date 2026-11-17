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
  
  // Read the file line by line
  let lines = fs.readFileSync(file, 'utf8').split('\n');
  let newLines = [];
  let removedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';

    // If the current line is the OLD path declaration, and the NEXT line is the NEW uploadMedia path
    if (currentLine.includes('const path =') && 
        !currentLine.includes('uploadMedia') && 
        nextLine.includes('const path = await uploadMedia(')) {
      
      // Skip the old line (don't add it to newLines)
      removedCount++;
      continue; 
    }
    
    newLines.push(currentLine);
  }

  if (removedCount > 0) {
    fs.writeFileSync(file, newLines.join('\n'));
    console.log(`✅ Cleaned ${removedCount} duplicate 'const path' line(s) in ${file}`);
  }
});

console.log("🎉 ALL FILES SCANNED AND FIXED! Run 'npm run build' now.");
