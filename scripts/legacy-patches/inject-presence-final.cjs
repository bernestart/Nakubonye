const fs = require('fs');
const file = 'src/App.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add Import
if (!code.includes('useMyPresence')) {
  code = "import { useMyPresence } from './hooks/usePresence';\n" + code;
}

// 2. Inject the hook right after the Auth hook
const target = `const { profile, loading: authLoading } = useAuth()`;
const injection = `const { profile, loading: authLoading } = useAuth();
  useMyPresence(profile?.id);`;

if (code.includes(target)) {
  code = code.replace(target, injection);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Global Presence Heartbeat injected into App.jsx!");
} else {
  console.log("❌ ERROR: Could not find the exact target in App.jsx.");
}
