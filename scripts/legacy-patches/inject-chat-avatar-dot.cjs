const fs = require('fs');
const file = 'src/screens/Chat.jsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('OnlineDot')) {
  code = "import OnlineDot from '../components/OnlineDot';\n" + code;
}

// Find the avatar container in the chat header
// From grep: line 911 area has the avatar initial
const avatarTarget = `{(other?.display_name || '?')[0]}`;
if (code.includes(avatarTarget)) {
  // We need to find the wrapping div and append the dot
  const avatarRegex = /(<div[^>]*className="[^"]*w-10 h-10[^"]*"[^>]*>[\s\S]*?<\/div>)/;
  if (avatarRegex.test(code)) {
    code = code.replace(avatarRegex, (match) => match + `\n              <OnlineDot userId={otherId} myId={myId} variant="avatar" />`);
    console.log("✅ SUCCESS: Avatar dot added to Chat header!");
  } else {
    console.log("⚠️ Could not find avatar wrapper in Chat.jsx");
  }
}

fs.writeFileSync(file, code);
