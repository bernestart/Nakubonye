const fs = require('fs');
const file = 'src/screens/Chat.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add Import
if (!code.includes('OnlineDot')) {
  code = "import OnlineDot from '../components/OnlineDot';\n" + code;
}

// 2. Find the exact JSX line for the name
const target = `{other?.display_name || other?.username || 'Someone'}`;
const replacement = `<div className="flex flex-col">
                  <span>{other?.display_name || other?.username || 'Someone'}</span>
                  <OnlineDot userId={otherId} myId={myId} showText={true} />
                </div>`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Green dot added to Chat header!");
} else {
  console.log("⚠️ Could not find the exact name string in Chat.jsx");
}
