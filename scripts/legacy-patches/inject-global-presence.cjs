const fs = require('fs');
const file = 'src/App.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add Import
if (!code.includes('useMyPresence')) {
  code = "import { useMyPresence } from './hooks/usePresence';\n" + code;
}

// 2. Call the hook inside the main App component.
// We look for the Auth context or a central place where `myId` is known.
// If your App.jsx uses useAuth, we inject it right after.
const target = `const { session } = useAuth();`; 
const newCode = `const { session } = useAuth();\n  useMyPresence(session?.user?.id);`;

if (code.includes(target)) {
  code = code.replace(target, newCode);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Global Presence Heartbeat injected into App.jsx!");
} else {
  console.log("⚠️ Could not find the exact 'useAuth' hook in App.jsx. We will need to wire it manually.");
}
