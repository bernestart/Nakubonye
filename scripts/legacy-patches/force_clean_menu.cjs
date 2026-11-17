const fs = require('fs');
const file = 'src/screens/ProfileSettings.jsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');
let newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Keep "Creator mode" but change its destination to the Dashboard
  if (line.includes('label="Creator mode"')) {
    newLines.push(line.replace(/to="[^"]+"/, 'to="/creator-dashboard"').replace(/label="[^"]+"/, 'label="Creator Dashboard"'));
    continue;
  }

  // Remove these completely
  if (
    line.includes('label="Add to your story"') ||
    line.includes('label="Invite friends"') ||
    line.includes('label="Share profile"') ||
    line.includes('label="Story archive"') ||
    line.includes('label="Memories"') ||
    line.includes('label="Drafts"') ||
    line.includes('label="Offline reels"')
  ) {
    continue; 
  }

  newLines.push(line);
}

fs.writeFileSync(file, newLines.join('\n'));
console.log('✅ Force cleaned Main Menu (Removed Quick Actions, renamed Creator mode)');
