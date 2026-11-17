const fs = require('fs');
const file = 'src/screens/Chat.jsx';
let code = fs.readFileSync(file, 'utf8');

// We know from line 911 that the avatar initial is (other?.display_name || '?')[0]
// We will inject the dot right after the closing div of the avatar.
const avatarRegex = /(<button[^>]*className="[^"]*w-10 h-10[^"]*"[^>]*>[\s\S]*?<\/button>)/;

if (avatarRegex.test(code)) {
  code = code.replace(avatarRegex, (match) => `\n              <div className="relative">\n                ${match}\n                <OnlineDot userId={otherId} myId={myId} variant="avatar" className="!w-3 !h-3 !bottom-0 !right-0" />\n              </div>`);
  if (!code.includes('OnlineDot')) {
    code = "import OnlineDot from '../components/OnlineDot';\n" + code;
  }
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Avatar dot wrapped and added to Chat header!");
} else {
  console.log("⚠️ Could not find the exact avatar button in Chat.jsx. The text dot is still working.");
}
