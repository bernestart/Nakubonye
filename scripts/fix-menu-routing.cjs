const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/components/ProfileMenuSheet.jsx');
let src = fs.readFileSync(file, 'utf8');

// 1. Ensure useNavigate is imported
if (!src.includes('useNavigate')) {
  src = "import { useNavigate } from 'react-router-dom';\n" + src;
}

// 2. Add nav hook inside the component
if (!src.includes('const nav = useNavigate()')) {
  const funcStart = src.indexOf('export default function ProfileMenuSheet');
  const braceIndex = src.indexOf('{', funcStart);
  src = src.substring(0, braceIndex + 1) + '\n  const nav = useNavigate();\n' + src.substring(braceIndex + 1);
}

// 3. Change the onClick to route to the real CreatorMode screen instead of firing the raw RPC
// We use a regex that looks for the label and the toggle function
src = src.replace(
  /onClick=\{\(\) => \{ tap\('light'\); onToggleCreatorMode\(\); onClose\(\); \}\}/, 
  "onClick={() => { tap('light'); nav('/settings/creator'); onClose(); }}"
);

// 4. Remove onToggleCreatorMode from props since we no longer use it
src = src.replace(/,\s*onToggleCreatorMode\s*/, '');

fs.writeFileSync(file, src);
console.log('✅ ProfileMenuSheet now routes to /settings/creator (your original onboarding flow)');
