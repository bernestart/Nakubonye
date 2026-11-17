const fs = require('fs');

const files = [
  { path: 'src/screens/Chat.jsx', varName: 'voiceRecorder' },
  { path: 'src/screens/GroupChat.jsx', varName: 'voice' },
  { path: 'src/components/CommunityChat.jsx', varName: 'voice' }
];

files.forEach(f => {
  if (!fs.existsSync(f.path)) return;
  let content = fs.readFileSync(f.path, 'utf8');
  
  const brokenStr = `${f.varName}.waveform.slice(-30).map(`;
  const fixedStr = `{${f.varName}.waveform.slice(-30).map(`;
  
  if (content.includes(brokenStr)) {
    content = content.replace(brokenStr, fixedStr);
    fs.writeFileSync(f.path, content);
    console.log('✅ Fixed missing JSX brace in', f.path);
  } else {
    console.log('⚠️ Pattern not found in', f.path);
  }
});
