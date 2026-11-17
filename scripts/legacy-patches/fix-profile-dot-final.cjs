const fs = require('fs');
const file = 'src/screens/ProfileView.jsx';
let code = fs.readFileSync(file, 'utf8');

// The hardcoded span
const oldSpan = `<span className="absolute bottom-4 right-4 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0B0B14] z-10" />`;

// Our new dynamic component (using important classes to override default positioning)
const newSpan = `<OnlineDot userId={userId} myId={myId} variant="avatar" className="!bottom-4 !right-4 !w-4 !h-4 z-10" />`;

if (code.includes(oldSpan)) {
  code = code.replace(oldSpan, newSpan);
  
  // Ensure import exists
  if (!code.includes('OnlineDot')) {
    code = "import OnlineDot from '../components/OnlineDot';\n" + code;
  }
  
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Hardcoded green dot replaced with dynamic OnlineDot in ProfileView!");
} else {
  console.log("⚠️ Could not find the exact hardcoded span.");
}
