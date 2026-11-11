const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/screens/Chat.jsx');
if (!fs.existsSync(file)) process.exit(1);

let src = fs.readFileSync(file, 'utf8');

// Remove the state and ref
src = src.replace(/const \[vanishMode, setVanishMode\] = useState\(false\)\r?\n/, '');
src = src.replace(/const vanishModeRef = useRef\(vanishMode\)\r?\n/, '');
src = src.replace(/useEffect\(\(\) => \{ vanishModeRef\.current = vanishMode \}, \[vanishMode\]\)\r?\n/, '');

// Remove the unmount deletion effect
src = src.replace(/useEffect\(\(\) => \{\s*return \(\) => \{\s*if \(vanishModeRef\.current && conversationId\) \{[\s\S]*?\}, \[conversationId\]\)\r?\n/, '');

// Remove the MenuItem
src = src.replace(/<MenuItem\s*icon=\{<Timer size=\{16\} \/>\}\s*label="Vanish mode"[\s\S]*?\/>\r?\n/, '');

// Remove the banner render
src = src.replace(/\{vanishMode && <VanishModeOverlay[\s\S]*?\/>\}\r?\n/, '');

// Remove the payload injection
src = src.replace(/\.insert\(\{ \.\.\.payload, \.\.\.\(\(vanishModeRef\.current && \!payload\.ephemeral_type\) \? \{ ephemeral_type: 'VANISH' \} : \{\}\) \}\)/g, '.insert(payload)');

fs.writeFileSync(file, src);
console.log('✅ Vanish mode code completely removed from Chat.jsx');
