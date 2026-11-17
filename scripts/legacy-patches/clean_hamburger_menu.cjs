const fs = require('fs');
const file = 'src/screens/ProfileSettings.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');
let newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Remove these quick actions from the main menu
  if (
    line.includes('label="Add to your story"') ||
    line.includes('label="Invite friends"') ||
    line.includes('label="Share profile"') ||
    line.includes('label="Memories"') ||
    line.includes('label="Story archive"') ||
    line.includes('label="Drafts"') ||
    line.includes('label="Offline reels"') ||
    line.includes('label="Creator mode"') // We are moving this to the profile menu
  ) {
    continue; // Skip adding this line
  }

  newLines.push(line);
}

fs.writeFileSync(file, newLines.join('\n'));
console.log('✅ Main Menu cleaned: Removed Quick Actions and Creator tools');
